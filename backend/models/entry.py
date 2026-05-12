from datetime import datetime, timezone
from typing import Optional
from bson import ObjectId


def entry_document(
    event_id: ObjectId,
    name: str,
    village: str,
    amount: float,
    mode: str,
    logged_by: str,
    phone: Optional[str] = None,
    utr_number: Optional[str] = None,
    razorpay_payment_id: Optional[str] = None,
    guest_id: Optional[ObjectId] = None,
    is_unknown_guest: bool = False,
    notes: Optional[str] = None,
    activity_id: Optional[ObjectId] = None,
    gift_item: Optional[str] = None,
) -> dict:
    return {
        "event_id": event_id,
        "activity_id": activity_id,
        "guest_id": guest_id,
        "name": name,
        "village": village,
        "phone": phone,
        "amount": amount,
        "mode": mode,
        "utr_number": utr_number,
        "razorpay_payment_id": razorpay_payment_id,
        "is_unknown_guest": is_unknown_guest,
        "gift_item": gift_item,
        "notes": notes,
        "confirmation_sent": False,
        "created_at": datetime.now(timezone.utc),
        "logged_by": logged_by,
        "deleted_at": None,
        "delete_reason": None,
    }
