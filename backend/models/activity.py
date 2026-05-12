from datetime import datetime, timezone, date as date_type
from typing import Optional
from bson import ObjectId


def activity_document(
    event_id: ObjectId,
    name: str,
    type: str,
    date: date_type,
    status: str = "upcoming",
    custom_type_name: Optional[str] = None,
    time: Optional[str] = None,
    description: Optional[str] = None,
    guest_ids: Optional[list] = None,
) -> dict:
    now = datetime.now(timezone.utc)
    return {
        "event_id": event_id,
        "name": name,
        "type": type,
        "custom_type_name": custom_type_name,
        "date": datetime.combine(date, datetime.min.time()),
        "time": time,
        "description": description,
        "status": status,
        "guest_ids": guest_ids or [],
        "created_at": now,
        "updated_at": now,
    }
