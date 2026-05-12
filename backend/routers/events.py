from fastapi import APIRouter, Depends, HTTPException
from bson import ObjectId

from database import get_db
from middleware.auth import get_current_user
from models.event import event_document
from schemas.event import CreateEventRequest, UpdateEventRequest, UpdateStatusRequest

router = APIRouter()


def _serialize_event(e: dict) -> dict:
    return {
        "id": str(e["_id"]),
        "user_id": str(e["user_id"]),
        "name": e["name"],
        "type": e["type"],
        "event_date": e["event_date"].isoformat() if hasattr(e["event_date"], "isoformat") else e["event_date"],
        "host_name": e["host_name"],
        "host_village": e["host_village"],
        "host_upi_id": e["host_upi_id"],
        "host_whatsapp": e["host_whatsapp"],
        "razorpay_qr_id": e.get("razorpay_qr_id"),
        "razorpay_qr_image_url": e.get("razorpay_qr_image_url"),
        "status": e["status"],
        "created_at": e["created_at"].isoformat(),
    }


@router.get("")
async def list_events(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.events.find({"user_id": current_user["_id"]}).sort("created_at", -1)
    events = [_serialize_event(e) async for e in cursor]
    return {"success": True, "data": events}


@router.post("")
async def create_event(body: CreateEventRequest, current_user: dict = Depends(get_current_user)):
    db = get_db()
    doc = event_document(
        user_id=current_user["_id"],
        name=body.name,
        type=body.type,
        event_date=body.event_date,
        host_name=body.host_name,
        host_village=body.host_village,
        host_upi_id=body.host_upi_id,
        host_whatsapp=body.host_whatsapp,
    )
    result = await db.events.insert_one(doc)
    doc["_id"] = result.inserted_id

    # Generate Razorpay UPI QR code (requires API keys in .env)
    from services.razorpay import create_upi_qr
    qr = await create_upi_qr(doc)
    if qr:
        await db.events.update_one({"_id": result.inserted_id}, {"$set": qr})
        doc.update(qr)

    return {"success": True, "data": _serialize_event(doc)}


@router.get("/{event_id}")
async def get_event(event_id: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await db.events.find_one({"_id": oid, "user_id": current_user["_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"success": True, "data": _serialize_event(event)}


@router.patch("/{event_id}")
async def update_event(
    event_id: str,
    body: UpdateEventRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    update_data = body.model_dump(exclude_none=True)
    if "event_date" in update_data and hasattr(update_data["event_date"], "isoformat"):
        pass  # keep as date object for MongoDB

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = await db.events.find_one_and_update(
        {"_id": oid, "user_id": current_user["_id"]},
        {"$set": update_data},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"success": True, "data": _serialize_event(result)}


@router.patch("/{event_id}/status")
async def update_event_status(
    event_id: str,
    body: UpdateStatusRequest,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    result = await db.events.find_one_and_update(
        {"_id": oid, "user_id": current_user["_id"]},
        {"$set": {"status": body.status}},
        return_document=True,
    )
    if not result:
        raise HTTPException(status_code=404, detail="Event not found")

    return {"success": True, "data": _serialize_event(result)}
