import io
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from database import get_db
from middleware.auth import get_current_user
from services.report_generator import generate_event_pdf, generate_activity_pdf

router = APIRouter()


@router.get("/events/{event_id}/report/pdf")
async def download_event_pdf(
    event_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(event_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid event ID")

    event = await db.events.find_one({"_id": oid, "user_id": current_user["_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    entries = [e async for e in db.entries.find({"event_id": oid, "deleted_at": None})]
    activities = [a async for a in db.activities.find({"event_id": oid}).sort("date", 1)]

    # RSVP summary
    rsvp_pipeline = [
        {"$match": {"event_id": oid}},
        {
            "$group": {
                "_id": None,
                "total": {"$sum": 1},
                "coming": {"$sum": {"$cond": [{"$eq": ["$rsvp_status", "coming"]}, 1, 0]}},
                "not_coming": {"$sum": {"$cond": [{"$eq": ["$rsvp_status", "not_coming"]}, 1, 0]}},
                "pending": {"$sum": {"$cond": [{"$eq": ["$rsvp_status", "pending"]}, 1, 0]}},
            }
        },
    ]
    rsvp_result = await db.guests.aggregate(rsvp_pipeline).to_list(1)
    rsvp = rsvp_result[0] if rsvp_result else {"total": 0, "coming": 0, "not_coming": 0, "pending": 0}
    rsvp.pop("_id", None)

    pdf_bytes = generate_event_pdf(event, entries, rsvp, activities if activities else None)

    safe_name = event["name"].replace(" ", "_")[:40]
    filename = f"Shagun_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/events/{event_id}/activities/{activity_id}/report/pdf")
async def download_activity_pdf(
    event_id: str,
    activity_id: str,
    current_user: dict = Depends(get_current_user),
):
    db = get_db()
    try:
        oid = ObjectId(event_id)
        aoid = ObjectId(activity_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ID")

    event = await db.events.find_one({"_id": oid, "user_id": current_user["_id"]})
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    activity = await db.activities.find_one({"_id": aoid, "event_id": oid})
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    entries = [e async for e in db.entries.find({"activity_id": aoid, "deleted_at": None})]

    pdf_bytes = generate_activity_pdf(activity, entries, event_name=event["name"])

    safe_name = activity["name"].replace(" ", "_")[:30]
    filename = f"Shagun_{safe_name}_{datetime.now().strftime('%Y%m%d')}.pdf"

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
