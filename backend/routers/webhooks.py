import hashlib
import hmac
import json
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Request

from config import settings
from database import get_db
from models.entry import entry_document
from services.guest_matcher import match_guest
from services.socket_manager import emit_to_event_room

router = APIRouter()


def _serialize_entry(e: dict) -> dict:
    return {
        "id": str(e["_id"]),
        "event_id": str(e["event_id"]),
        "activity_id": str(e["activity_id"]) if e.get("activity_id") else None,
        "guest_id": str(e["guest_id"]) if e.get("guest_id") else None,
        "name": e["name"],
        "village": e["village"],
        "phone": e.get("phone"),
        "amount": e["amount"],
        "mode": e["mode"],
        "utr_number": e.get("utr_number"),
        "razorpay_payment_id": e.get("razorpay_payment_id"),
        "is_unknown_guest": e.get("is_unknown_guest", False),
        "gift_item": e.get("gift_item"),
        "notes": e.get("notes"),
        "confirmation_sent": e.get("confirmation_sent", False),
        "created_at": e["created_at"].isoformat(),
        "logged_by": e["logged_by"],
    }


@router.post("/razorpay")
async def razorpay_webhook(request: Request, background_tasks: BackgroundTasks):
    # CRITICAL: Read raw body FIRST before any JSON parsing
    raw_body = await request.body()

    # Verify Razorpay webhook signature
    if settings.RAZORPAY_WEBHOOK_SECRET:
        signature = request.headers.get("X-Razorpay-Signature", "")
        expected = hmac.new(
            settings.RAZORPAY_WEBHOOK_SECRET.encode(),
            raw_body,
            hashlib.sha256,
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    try:
        payload = json.loads(raw_body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("event")

    # Only handle payment captured events
    if event_type != "payment.captured":
        return {"status": "ok", "handled": False}

    payment = payload.get("payload", {}).get("payment", {}).get("entity", {})
    payment_id = payment.get("id")
    amount_paise = payment.get("amount", 0)
    amount_rupees = amount_paise / 100
    contact = payment.get("contact", "")
    utr = payment.get("acquirer_data", {}).get("utr")
    notes = payment.get("notes", {})

    # Extract event_id from payment notes (set during QR creation)
    event_id = notes.get("event_id") if isinstance(notes, dict) else None
    if not event_id:
        return {"status": "ok", "handled": False, "reason": "No event_id in notes"}

    db = get_db()
    try:
        event_oid = ObjectId(event_id)
    except Exception:
        return {"status": "ok", "handled": False, "reason": "Invalid event_id"}

    event = await db.events.find_one({"_id": event_oid})
    if not event:
        return {"status": "ok", "handled": False, "reason": "Event not found"}

    # Idempotency: skip if payment already processed
    existing = await db.entries.find_one({"razorpay_payment_id": payment_id})
    if existing:
        return {"status": "ok", "handled": False, "reason": "Already processed"}

    # Match guest by phone
    phone_clean = contact.replace("+91", "").replace("+", "").strip()[-10:] if contact else None
    matched_guest = None
    is_unknown = True
    guest_name = "Unknown Guest"
    guest_village = ""
    guest_id = None

    if phone_clean and len(phone_clean) == 10:
        matched_guest = await match_guest(db, event_id, phone_clean)
        if matched_guest:
            is_unknown = False
            guest_name = matched_guest["name"]
            guest_village = matched_guest["village"]
            guest_id = matched_guest["_id"]

    # Auto-assign to an active activity if exactly one is active for this event
    active_activities = await db.activities.find(
        {"event_id": event_oid, "status": "active"}
    ).to_list(None)
    auto_activity_id = active_activities[0]["_id"] if len(active_activities) == 1 else None

    doc = entry_document(
        event_id=event_oid,
        name=guest_name,
        village=guest_village,
        amount=amount_rupees,
        mode="upi",
        logged_by="razorpay_webhook",
        phone=phone_clean,
        utr_number=utr,
        razorpay_payment_id=payment_id,
        guest_id=guest_id,
        is_unknown_guest=is_unknown,
        activity_id=auto_activity_id,
    )
    result = await db.entries.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Emit to live dashboard
    await emit_to_event_room(event_id, "new_entry", _serialize_entry(doc))

    # Send WhatsApp confirmation asynchronously
    if phone_clean:
        from routers.entries import _send_confirmation_and_flag
        background_tasks.add_task(_send_confirmation_and_flag, doc["_id"], doc, event)

    # Always return 200 to Razorpay
    return {"status": "ok", "handled": True}


@router.post("/whatsapp")
async def whatsapp_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
):
    """Handle incoming WhatsApp messages (RSVP replies) from Twilio."""
    form_data = await request.form()
    from_number = str(form_data.get("From", ""))
    body_text = str(form_data.get("Body", "")).strip().upper()

    # Strip whatsapp: prefix and +91
    phone = from_number.replace("whatsapp:", "").replace("+91", "").replace("+", "").strip()[-10:]

    if len(phone) != 10:
        return {"status": "ok"}

    # Map reply to RSVP status
    coming_words = {"HAAN", "YES", "1", "HA", "HAN"}
    not_coming_words = {"NA", "NO", "2", "NAHI"}

    if body_text in coming_words:
        rsvp_status = "coming"
    elif body_text in not_coming_words:
        rsvp_status = "not_coming"
    else:
        return {"status": "ok"}  # unrecognised reply

    db = get_db()
    # Find the guest across all events (most recent invite sent to this phone)
    guest = await db.guests.find_one(
        {"phone": phone, "invite_sent": True},
        sort=[("invite_sent_at", -1)],
    )
    if not guest:
        return {"status": "ok"}

    await db.guests.update_one(
        {"_id": guest["_id"]},
        {"$set": {"rsvp_status": rsvp_status, "rsvp_at": datetime.now(timezone.utc)}},
    )

    # Send RSVP acknowledgment
    from services.whatsapp import send_rsvp_ack
    background_tasks.add_task(send_rsvp_ack, phone, rsvp_status == "coming")

    return {"status": "ok"}
