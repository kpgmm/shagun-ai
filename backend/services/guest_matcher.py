from bson import ObjectId


async def match_guest(db, event_id: str, phone: str) -> dict | None:
    """Look up a guest by phone number within an event.

    Args:
        db: Motor database instance
        event_id: str event ObjectId
        phone: 10-digit phone number (no country code, no spaces)

    Returns:
        Guest document dict or None if not found.
    """
    try:
        oid = ObjectId(event_id)
    except Exception:
        return None

    return await db.guests.find_one({"event_id": oid, "phone": phone})
