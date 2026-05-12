"""WhatsApp messaging service via Twilio.

All functions are async and use httpx.AsyncClient.
Will be fully implemented in Phase 9.
"""
import httpx
from config import settings


def _whatsapp_number(phone_10: str) -> str:
    """Convert 10-digit Indian phone to Twilio WhatsApp format."""
    return f"whatsapp:+91{phone_10}"


async def _send_message(to_phone: str, body: str) -> bool:
    """Send a WhatsApp message via Twilio REST API."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        print(f"[WhatsApp] (not configured) → {to_phone}: {body[:60]}")
        return False

    url = f"https://api.twilio.com/2010-04-01/Accounts/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    data = {
        "From": settings.TWILIO_WHATSAPP_FROM,
        "To": _whatsapp_number(to_phone),
        "Body": body,
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                data=data,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                timeout=10,
            )
            resp.raise_for_status()
            return True
    except Exception as e:
        print(f"[WhatsApp] Failed to send to {to_phone}: {e}")
        return False


async def send_invite(guest: dict, event: dict) -> bool:
    """Send a WhatsApp invite to a guest."""
    event_date = event["event_date"]
    date_str = event_date.strftime("%d %B %Y") if hasattr(event_date, "strftime") else str(event_date)

    message = (
        f"🌸 Jai Shree Krishna 🌸\n\n"
        f"Pranam {guest['name']} & Family,\n\n"
        f"Aapne sadar amantra chhe —\n\n"
        f"✨ {event['name']}\n"
        f"🗓️ {date_str}\n"
        f"📍 {event['host_village']}\n\n"
        f"Krupaya RSVP karva maate niche tap karo:\n\n"
        f"✅ Aavsu Chhu → Reply \"HAAN\"\n"
        f"❌ Nahi Avai Shakay → Reply \"NA\"\n\n"
        f"— {event['host_name']} Parivar 🙏"
    )
    success = await _send_message(guest["phone"], message)
    return success


async def send_confirmation(entry: dict, event: dict) -> bool:
    """Send a WhatsApp payment confirmation to a guest."""
    if not entry.get("phone"):
        return False

    message = (
        f"🙏 Jai Shree Krishna\n\n"
        f"Pranam {entry['name']},\n\n"
        f"Tamaro shagun ₹{int(entry['amount'])} saras rite prapt thayo. ✅\n\n"
        f"Tame aavya te maate khub khub aabhar. 🌸\n\n"
        f"— {event['host_name']} Parivar, {event['host_village']}\n"
        f"({event['name']})"
    )
    return await _send_message(entry["phone"], message)


async def send_rsvp_ack(phone: str, coming: bool) -> bool:
    """Send RSVP acknowledgment message."""
    if coming:
        message = "Dhanyavaad! Aapni pratiksha raheshe 🙏"
    else:
        message = "Samajhi gayi. Aapno aabhar 🙏"
    return await _send_message(phone, message)
