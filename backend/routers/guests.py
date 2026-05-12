import re
from datetime import datetime, timezone
from typing import List, Optional

from bson import ObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from database import get_db
from middleware.auth import get_current_user
from schemas.guest import BulkGuestItem, CreateGuestRequest, GuestImportRequest, SendInvitesRequest, UpdateGuestRequest

router = APIRouter()


def _normalize_phone(phone: str) -> str:
    return re.sub(r"\D", "", phone)


def _serialize_guest(g: dict) -> dict:
    return {
        "id": str(g["_id"]),
        "event_id": str(g["event_id"]),
        "name": g["name"],
        "phone": g["phone"],
        "village": g["village"],
        "relation_side": g["relation_side"],
        "rsvp_status": g["rsvp_status"],
        "rsvp_at": g["rsvp_at"].isoformat() if g.get("rsvp_at") else None,
        "invite_sent": g["invite_sent"],
        "invite_sent_at": g["invite_sent_at"].isoformat() if g.get("invite_sent_at") else None,
        "created_at": g["created_at"].isoformat(),
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


@router.get("/events/{event_id}/guests")
async def list_guests(
    event_id: str,
    relation_side: Optional[str] = None,
    rsvp_status: Optional[str] = None,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    query: dict = {"event_id": ObjectId(event_id)}
    if relation_side:
        query["relation_side"] = relation_side
    if rsvp_status:
        query["rsvp_status"] = rsvp_status

    cursor = db.guests.find(query).sort("name", 1)
    guests = [_serialize_guest(g) async for g in cursor]
    return {"success": True, "data": guests}


@router.post("/events/{event_id}/guests")
async def add_guest(
    event_id: str,
    body: CreateGuestRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    phone = _normalize_phone(body.phone)
    existing = await db.guests.find_one({"event_id": ObjectId(event_id), "phone": phone})
    if existing:
        raise HTTPException(status_code=409, detail="Guest with this phone already exists in this event")

    doc = {
        "event_id": ObjectId(event_id),
        "name": body.name.strip(),
        "phone": phone,
        "village": body.village.strip(),
        "relation_side": body.relation_side,
        "rsvp_status": "pending",
        "rsvp_at": None,
        "invite_sent": False,
        "invite_sent_at": None,
        "created_at": datetime.now(timezone.utc),
    }
    result = await db.guests.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _serialize_guest(doc)}


@router.post("/events/{event_id}/guests/bulk")
async def bulk_add_guests(
    event_id: str,
    body: List[BulkGuestItem],
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    event_oid = ObjectId(event_id)
    now = datetime.now(timezone.utc)

    # Get existing phones to deduplicate
    existing_phones = set()
    async for g in db.guests.find({"event_id": event_oid}, {"phone": 1}):
        existing_phones.add(g["phone"])

    docs_to_insert = []
    skipped = 0
    for item in body:
        phone = _normalize_phone(item.phone)
        if phone in existing_phones or len(phone) != 10:
            skipped += 1
            continue
        existing_phones.add(phone)
        docs_to_insert.append({
            "event_id": event_oid,
            "name": item.name.strip(),
            "phone": phone,
            "village": item.village.strip(),
            "relation_side": item.relation_side,
            "rsvp_status": "pending",
            "rsvp_at": None,
            "invite_sent": False,
            "invite_sent_at": None,
            "created_at": now,
        })

    inserted = 0
    if docs_to_insert:
        result = await db.guests.insert_many(docs_to_insert)
        inserted = len(result.inserted_ids)

    return {
        "success": True,
        "data": {"inserted": inserted, "skipped": skipped},
    }


@router.post("/events/{event_id}/guests/import")
async def import_guests(
    event_id: str,
    body: GuestImportRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    try:
        source_oid = ObjectId(body.source_event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid source_event_id")

    # Verify source event also belongs to this user
    source_event = await db.events.find_one({"_id": source_oid, "user_id": current_user["_id"]})
    if not source_event:
        raise HTTPException(status_code=404, detail="Source event not found")

    target_oid = ObjectId(event_id)
    now = datetime.now(timezone.utc)

    # Existing phones in the target event (to skip duplicates)
    existing_phones: set = set()
    async for g in db.guests.find({"event_id": target_oid}, {"phone": 1}):
        existing_phones.add(g["phone"])

    # Fetch from source event — optionally filtered by specific guest IDs
    source_query: dict = {"event_id": source_oid}
    if body.guest_ids is not None:
        try:
            gids = [ObjectId(gid) for gid in body.guest_ids]
        except Exception:
            raise HTTPException(status_code=400, detail="One or more invalid guest IDs")
        source_query["_id"] = {"$in": gids}

    source_guests = [g async for g in db.guests.find(source_query)]

    docs_to_insert = []
    skipped = 0
    for g in source_guests:
        phone = g.get("phone", "")
        if not phone or phone in existing_phones:
            skipped += 1
            continue
        existing_phones.add(phone)
        docs_to_insert.append({
            "event_id": target_oid,
            "name": g["name"],
            "phone": phone,
            "village": g.get("village", ""),
            "relation_side": g.get("relation_side", "other"),
            "rsvp_status": "pending",
            "rsvp_at": None,
            "invite_sent": False,
            "invite_sent_at": None,
            "created_at": now,
        })

    imported = 0
    if docs_to_insert:
        result = await db.guests.insert_many(docs_to_insert)
        imported = len(result.inserted_ids)

    return {
        "success": True,
        "data": {"imported": imported, "skipped": skipped},
    }


@router.put("/events/{event_id}/guests/{guest_id}")
async def update_guest(
    event_id: str,
    guest_id: str,
    body: UpdateGuestRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    try:
        goid = ObjectId(guest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid guest ID")

    update_data = body.model_dump(exclude_none=True)
    if "phone" in update_data:
        update_data["phone"] = _normalize_phone(update_data["phone"])

    result = await db.guests.find_one_and_update(
        {"_id": goid, "event_id": ObjectId(event_id)},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Guest not found")

    return {"success": True, "data": _serialize_guest(result)}


@router.delete("/events/{event_id}/guests/{guest_id}")
async def delete_guest(
    event_id: str,
    guest_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    try:
        goid = ObjectId(guest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid guest ID")

    result = await db.guests.delete_one({"_id": goid, "event_id": ObjectId(event_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Guest not found")

    return {"success": True, "data": {"deleted": True}}


@router.post("/events/{event_id}/guests/{guest_id}/send-invite")
async def send_invite_single(
    event_id: str,
    guest_id: str,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])

    try:
        goid = ObjectId(guest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid guest ID")

    guest = await db.guests.find_one({"_id": goid, "event_id": ObjectId(event_id)})
    if not guest:
        raise HTTPException(status_code=404, detail="Guest not found")

    from services.whatsapp import send_invite as _send_invite

    async def _send_and_flag():
        ok = await _send_invite(guest, event)
        if ok:
            await db.guests.update_one(
                {"_id": goid},
                {"$set": {"invite_sent": True, "invite_sent_at": datetime.now(timezone.utc)}},
            )

    background_tasks.add_task(_send_and_flag)

    return {"success": True, "data": {"queued": True}}


@router.post("/events/{event_id}/guests/send-invites")
async def send_invites(
    event_id: str,
    background_tasks: BackgroundTasks,
    body: SendInvitesRequest = None,
    only_uninvited: bool = True,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])

    specific_ids = body.guest_ids if body else None

    if specific_ids:
        # Send only to the explicitly selected guests
        try:
            gids = [ObjectId(gid) for gid in specific_ids]
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid guest ID(s)")
        query: dict = {"event_id": ObjectId(event_id), "_id": {"$in": gids}}
    else:
        query = {"event_id": ObjectId(event_id)}
        if only_uninvited:
            query["invite_sent"] = False

    guests = [g async for g in db.guests.find(query)]

    from services.whatsapp import send_invite
    for guest in guests:
        background_tasks.add_task(send_invite, guest, event)
    # Mark invite_sent after queueing (optimistic update)
    await db.guests.update_many(
        {"event_id": ObjectId(event_id), "_id": {"$in": [g["_id"] for g in guests]}},
        {"$set": {"invite_sent": True, "invite_sent_at": datetime.now(timezone.utc)}},
    )

    return {
        "success": True,
        "data": {"queued": len(guests), "message": f"Invite sending queued for {len(guests)} guests"},
    }


@router.get("/events/{event_id}/guests/rsvp-summary")
async def rsvp_summary(event_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    await _get_event_or_403(db, event_id, current_user["_id"])

    pipeline = [
        {"$match": {"event_id": ObjectId(event_id)}},
        {"$group": {"_id": "$rsvp_status", "count": {"$sum": 1}}},
    ]
    result = {doc["_id"]: doc["count"] async for doc in db.guests.aggregate(pipeline)}

    return {
        "success": True,
        "data": {
            "total": sum(result.values()),
            "coming": result.get("coming", 0),
            "not_coming": result.get("not_coming", 0),
            "pending": result.get("pending", 0),
        },
    }
