from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from database import get_db
from middleware.auth import get_current_user
from models.entry import entry_document
from schemas.entry import CreateEntryRequest, DeleteEntryRequest, UpdateEntryRequest
from services.socket_manager import emit_to_event_room

router = APIRouter()


async def _send_confirmation_and_flag(entry_id, entry: dict, event: dict):
    """Send mode-specific WhatsApp payment confirmation and mark confirmation_sent=True."""
    from services.whatsapp import send_payment_cash, send_payment_gift, send_payment_upi
    mode = entry.get("mode", "cash")
    if mode == "upi":
        ok = await send_payment_upi(entry, event)
    elif mode == "gift":
        ok = await send_payment_gift(entry, event)
    else:
        ok = await send_payment_cash(entry, event)
    if ok:
        db = get_db()
        await db.entries.update_one(
            {"_id": entry_id},
            {"$set": {"confirmation_sent": True}},
        )


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


async def _get_event_or_403(db, event_id: str, user_id: ObjectId) -> dict:
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")
    event = await db.events.find_one({"_id": oid, "user_id": user_id})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@router.get("/events/{event_id}/entries")
async def list_entries(event_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    cursor = db.entries.find(
        {"event_id": ObjectId(event_id), "deleted_at": None}
    ).sort("created_at", -1)
    entries = [_serialize_entry(e) async for e in cursor]
    return {"success": True, "data": entries}


@router.post("/events/{event_id}/entries")
async def create_entry(
    event_id: str,
    body: CreateEntryRequest,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])

    # Validate activity_id if provided
    activity_oid: Optional[ObjectId] = None
    if body.activity_id:
        try:
            activity_oid = ObjectId(body.activity_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid activity ID")
        activity = await db.activities.find_one({"_id": activity_oid, "event_id": ObjectId(event_id)})
        if not activity:
            raise HTTPException(status_code=404, detail="Activity not found or does not belong to this event")

    # Try to match guest by phone
    guest_id = None
    is_unknown = True
    if body.phone:
        guest = await db.guests.find_one({"event_id": ObjectId(event_id), "phone": body.phone})
        if guest:
            guest_id = guest["_id"]
            is_unknown = False

    doc = entry_document(
        event_id=ObjectId(event_id),
        name=body.name.strip(),
        village=body.village.strip(),
        amount=body.amount,
        mode=body.mode,
        logged_by=body.logged_by,
        phone=body.phone,
        utr_number=body.utr_number,
        guest_id=guest_id,
        is_unknown_guest=is_unknown,
        notes=body.notes,
        activity_id=activity_oid,
        gift_item=body.gift_item.strip() if body.gift_item else None,
    )
    result = await db.entries.insert_one(doc)
    doc["_id"] = result.inserted_id

    serialized = _serialize_entry(doc)
    await emit_to_event_room(event_id, "new_entry", serialized)

    # Send WhatsApp confirmation if phone is present
    if body.phone:
        background_tasks.add_task(_send_confirmation_and_flag, doc["_id"], doc, event)

    return {"success": True, "data": serialized}


@router.put("/events/{event_id}/entries/{entry_id}")
async def update_entry(
    event_id: str,
    entry_id: str,
    body: UpdateEntryRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    try:
        eoid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entry ID")

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.entries.find_one_and_update(
        {"_id": eoid, "event_id": ObjectId(event_id), "deleted_at": None},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")

    serialized = _serialize_entry(result)
    await emit_to_event_room(event_id, "entry_updated", serialized)

    return {"success": True, "data": serialized}


@router.delete("/events/{event_id}/entries/{entry_id}")
async def delete_entry(
    event_id: str,
    entry_id: str,
    body: DeleteEntryRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    try:
        eoid = ObjectId(entry_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid entry ID")

    # Soft delete — keep record with audit trail
    result = await db.entries.find_one_and_update(
        {"_id": eoid, "event_id": ObjectId(event_id), "deleted_at": None},
        {"$set": {"deleted_at": datetime.now(timezone.utc), "delete_reason": body.delete_reason}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Entry not found")

    await emit_to_event_room(event_id, "entry_deleted", {"id": entry_id})
    return {"success": True, "data": {"deleted": True}}


@router.get("/events/{event_id}/entries/summary")
async def entries_summary(event_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    pipeline = [
        {"$match": {"event_id": ObjectId(event_id), "deleted_at": None}},
        {
            "$group": {
                "_id": None,
                "total": {"$sum": "$amount"},
                "count": {"$sum": 1},
                "total_upi": {"$sum": {"$cond": [{"$eq": ["$mode", "upi"]}, "$amount", 0]}},
                "total_cash": {"$sum": {"$cond": [{"$eq": ["$mode", "cash"]}, "$amount", 0]}},
                "total_gift": {"$sum": {"$cond": [{"$eq": ["$mode", "gift"]}, "$amount", 0]}},
                "count_upi": {"$sum": {"$cond": [{"$eq": ["$mode", "upi"]}, 1, 0]}},
                "count_cash": {"$sum": {"$cond": [{"$eq": ["$mode", "cash"]}, 1, 0]}},
                "count_gift": {"$sum": {"$cond": [{"$eq": ["$mode", "gift"]}, 1, 0]}},
            }
        },
    ]
    result = await db.entries.aggregate(pipeline).to_list(1)
    summary = result[0] if result else {
        "total": 0, "count": 0,
        "total_upi": 0, "total_cash": 0, "total_gift": 0,
        "count_upi": 0, "count_cash": 0, "count_gift": 0,
    }
    summary.pop("_id", None)
    return {"success": True, "data": summary}
