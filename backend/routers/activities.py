from datetime import datetime, timezone
from typing import Optional

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from database import get_db
from middleware.auth import get_current_user
from models.activity import activity_document
from schemas.activity import ActivityCreate, ActivityStatusUpdate, ActivityUpdate, GuestIdsRequest

router = APIRouter()


def _serialize_activity(
    a: dict,
    guest_count: Optional[int] = None,
    entry_count: Optional[int] = None,
    entry_total: Optional[float] = None,
) -> dict:
    return {
        "id": str(a["_id"]),
        "event_id": str(a["event_id"]),
        "name": a["name"],
        "type": a["type"],
        "custom_type_name": a.get("custom_type_name"),
        "date": a["date"].isoformat() if hasattr(a["date"], "isoformat") else str(a["date"]),
        "time": a.get("time"),
        "description": a.get("description"),
        "status": a["status"],
        "guest_ids": [str(gid) for gid in a.get("guest_ids", [])],
        "guest_count": guest_count if guest_count is not None else len(a.get("guest_ids", [])),
        "entry_count": entry_count if entry_count is not None else 0,
        "entry_total": entry_total if entry_total is not None else 0.0,
        "created_at": a["created_at"].isoformat(),
        "updated_at": a["updated_at"].isoformat(),
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


async def _get_activity_or_404(db, activity_id: str, event_oid: ObjectId) -> dict:
    try:
        aoid = ObjectId(activity_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid activity ID")
    activity = await db.activities.find_one({"_id": aoid, "event_id": event_oid})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


async def _validate_guest_ids(db, event_oid: ObjectId, guest_ids: list) -> list:
    if not guest_ids:
        return []
    try:
        oids = [ObjectId(gid) for gid in guest_ids]
    except Exception:
        raise HTTPException(status_code=400, detail="One or more guest IDs are invalid")
    count = await db.guests.count_documents({"event_id": event_oid, "_id": {"$in": oids}})
    if count != len(oids):
        raise HTTPException(status_code=400, detail="One or more guest IDs do not belong to this event")
    return oids


@router.get("/events/{event_id}/activities")
async def list_activities(event_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    event_oid = event["_id"]

    activities = [a async for a in db.activities.find({"event_id": event_oid}).sort("date", 1)]

    entry_stats: dict = {}
    if activities:
        activity_oids = [a["_id"] for a in activities]
        pipeline = [
            {"$match": {"activity_id": {"$in": activity_oids}, "deleted_at": None}},
            {
                "$group": {
                    "_id": "$activity_id",
                    "count": {"$sum": 1},
                    "total": {"$sum": "$amount"},
                }
            },
        ]
        async for doc in db.entries.aggregate(pipeline):
            entry_stats[doc["_id"]] = {"count": doc["count"], "total": doc["total"]}

    result = [
        _serialize_activity(
            a,
            entry_count=entry_stats.get(a["_id"], {}).get("count", 0),
            entry_total=entry_stats.get(a["_id"], {}).get("total", 0.0),
        )
        for a in activities
    ]
    return {"success": True, "data": result}


@router.post("/events/{event_id}/activities")
async def create_activity(
    event_id: str,
    body: ActivityCreate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    event_oid = event["_id"]

    if body.type == "custom" and not (body.custom_type_name or "").strip():
        raise HTTPException(status_code=422, detail="custom_type_name is required when type is 'custom'")

    guest_oids = await _validate_guest_ids(db, event_oid, body.guest_ids)

    doc = activity_document(
        event_id=event_oid,
        name=body.name,
        type=body.type,
        date=body.date,
        custom_type_name=body.custom_type_name,
        time=body.time,
        description=body.description,
        guest_ids=guest_oids,
    )
    result = await db.activities.insert_one(doc)
    doc["_id"] = result.inserted_id
    return {"success": True, "data": _serialize_activity(doc)}


@router.get("/events/{event_id}/activities/{activity_id}")
async def get_activity(
    event_id: str,
    activity_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    activity = await _get_activity_or_404(db, activity_id, event["_id"])

    # Resolve full guest documents
    guest_oids = activity.get("guest_ids", [])
    guests = []
    if guest_oids:
        async for g in db.guests.find({"_id": {"$in": guest_oids}}):
            guests.append({
                "id": str(g["_id"]),
                "name": g["name"],
                "phone": g["phone"],
                "village": g["village"],
                "relation_side": g["relation_side"],
                "rsvp_status": g["rsvp_status"],
            })

    # Entry summary for this activity
    pipeline = [
        {"$match": {"activity_id": activity["_id"], "deleted_at": None}},
        {
            "$group": {
                "_id": None,
                "total_amount": {"$sum": "$amount"},
                "entry_count": {"$sum": 1},
                "upi_amount": {"$sum": {"$cond": [{"$eq": ["$mode", "upi"]}, "$amount", 0]}},
                "cash_amount": {"$sum": {"$cond": [{"$eq": ["$mode", "cash"]}, "$amount", 0]}},
            }
        },
    ]
    agg = await db.entries.aggregate(pipeline).to_list(1)
    entry_summary = agg[0] if agg else {
        "total_amount": 0, "entry_count": 0, "upi_amount": 0, "cash_amount": 0,
    }
    entry_summary.pop("_id", None)

    data = _serialize_activity(
        activity,
        entry_count=entry_summary["entry_count"],
        entry_total=entry_summary["total_amount"],
    )
    data["guests"] = guests
    data["entry_summary"] = entry_summary
    return {"success": True, "data": data}


@router.patch("/events/{event_id}/activities/{activity_id}")
async def update_activity(
    event_id: str,
    activity_id: str,
    body: ActivityUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    event_oid = event["_id"]
    activity = await _get_activity_or_404(db, activity_id, event_oid)

    update_data = body.model_dump(exclude_none=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    new_type = update_data.get("type", activity.get("type"))
    new_custom = update_data.get("custom_type_name", activity.get("custom_type_name"))
    if new_type == "custom" and not (new_custom or "").strip():
        raise HTTPException(status_code=422, detail="custom_type_name is required when type is 'custom'")

    if "guest_ids" in update_data:
        update_data["guest_ids"] = await _validate_guest_ids(db, event_oid, update_data["guest_ids"])

    update_data["updated_at"] = datetime.now(timezone.utc)

    result = await db.activities.find_one_and_update(
        {"_id": activity["_id"]},
        {"$set": update_data},
        return_document=True,
    )
    return {"success": True, "data": _serialize_activity(result)}


@router.patch("/events/{event_id}/activities/{activity_id}/status")
async def update_activity_status(
    event_id: str,
    activity_id: str,
    body: ActivityStatusUpdate,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    activity = await _get_activity_or_404(db, activity_id, event["_id"])

    result = await db.activities.find_one_and_update(
        {"_id": activity["_id"]},
        {"$set": {"status": body.status, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return {"success": True, "data": _serialize_activity(result)}


@router.delete("/events/{event_id}/activities/{activity_id}")
async def delete_activity(
    event_id: str,
    activity_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    activity = await _get_activity_or_404(db, activity_id, event["_id"])

    entry_count = await db.entries.count_documents(
        {"activity_id": activity["_id"], "deleted_at": None}
    )
    if entry_count > 0:
        label = "entry" if entry_count == 1 else "entries"
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete activity with {entry_count} existing {label}. Remove entries first.",
        )

    await db.activities.delete_one({"_id": activity["_id"]})
    return {"success": True, "data": {"deleted": True}}


@router.post("/events/{event_id}/activities/{activity_id}/guests")
async def add_activity_guests(
    event_id: str,
    activity_id: str,
    body: GuestIdsRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    event_oid = event["_id"]
    activity = await _get_activity_or_404(db, activity_id, event_oid)

    new_oids = await _validate_guest_ids(db, event_oid, body.guest_ids)

    existing_strs = {str(gid) for gid in activity.get("guest_ids", [])}
    merged = list(activity.get("guest_ids", [])) + [o for o in new_oids if str(o) not in existing_strs]

    result = await db.activities.find_one_and_update(
        {"_id": activity["_id"]},
        {"$set": {"guest_ids": merged, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return {"success": True, "data": _serialize_activity(result)}


@router.delete("/events/{event_id}/activities/{activity_id}/guests/{guest_id}")
async def remove_activity_guest(
    event_id: str,
    activity_id: str,
    guest_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    event = await _get_event_or_403(db, event_id, current_user["_id"])
    activity = await _get_activity_or_404(db, activity_id, event["_id"])

    try:
        goid = ObjectId(guest_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid guest ID")

    updated = [gid for gid in activity.get("guest_ids", []) if gid != goid]

    result = await db.activities.find_one_and_update(
        {"_id": activity["_id"]},
        {"$set": {"guest_ids": updated, "updated_at": datetime.now(timezone.utc)}},
        return_document=True,
    )
    return {"success": True, "data": _serialize_activity(result)}
