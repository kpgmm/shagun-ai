from datetime import datetime, timezone, date
from bson import ObjectId


def event_document(
    user_id: ObjectId,
    name: str,
    type: str,
    event_date: date,
    host_name: str,
    host_village: str,
    host_upi_id: str,
    host_whatsapp: str,
) -> dict:
    return {
        "user_id": user_id,
        "name": name,
        "type": type,
        "event_date": datetime.combine(event_date, datetime.min.time()),
        "host_name": host_name,
        "host_village": host_village,
        "host_upi_id": host_upi_id,
        "host_whatsapp": host_whatsapp,
        "razorpay_qr_id": None,
        "razorpay_qr_image_url": None,
        "status": "draft",
        "created_at": datetime.now(timezone.utc),
    }
