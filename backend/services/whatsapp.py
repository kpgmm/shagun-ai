"""WhatsApp messaging via Twilio REST API (plain text)."""
import httpx

from config import settings


def _wa_to(phone_10: str) -> str:
    """Format 10-digit Indian phone as a Twilio WhatsApp address."""
    return f"whatsapp:+91{phone_10}"


def _fmt_date(dt) -> str:
    return dt.strftime("%d %B %Y") if hasattr(dt, "strftime") else str(dt or "")


async def _send_text(phone_10: str, body: str, *, label: str = "") -> bool:
    """Send a plain-text WhatsApp message via Twilio REST API."""
    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        print(f"[WA] not configured — skipping {label} to ...{phone_10[-4:]}")
        return False
    url = (
        f"https://api.twilio.com/2010-04-01/Accounts"
        f"/{settings.TWILIO_ACCOUNT_SID}/Messages.json"
    )
    payload = {
        "From": settings.TWILIO_WHATSAPP_FROM,
        "To": _wa_to(phone_10),
        "Body": body,
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                url,
                data=payload,
                auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                timeout=10,
            )
            resp.raise_for_status()
            return True
    except Exception as exc:
        print(f"[WA] {label} failed → ...{phone_10[-4:]}: {exc}")
        return False


async def send_event_invite(guest: dict, event: dict) -> bool:
    """Send event invitation (Template 1)."""
    phone = guest.get("phone", "")
    if len(phone) != 10:
        return False
    date_str = _fmt_date(event.get("event_date"))
    message = (
        f"🪔 આદરણીય {guest['name']} & પરિવાર,\n\n"
        f"આપને સાદર આમંત્રણ છે.\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"✨ {event['name']}\n"
        f"📅 {date_str}\n"
        f"📍 {event['host_village']}\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"આપના શુભ આગમનથી આ પ્રસંગ વધુ યાદગાર બનશે.\n"
        f"Reply *HAAN* (આવીશ) અથવા *NA* (નહીં આવી શકું)\n\n"
        f"— {event['host_name']} 🙏"
    )
    return await _send_text(phone, message, label="invite")


async def send_rsvp_ack(guest: dict, event: dict, coming: bool) -> bool:
    """Send RSVP acknowledgment — coming (Template 2) or not coming (Template 3)."""
    phone = guest.get("phone", "")
    if len(phone) != 10:
        return False
    date_str = _fmt_date(event.get("event_date"))
    if coming:
        message = (
            f"🙏 આદરણીય {guest['name']},\n\n"
            f"આપની હાજરીની પુષ્ટિ મળી ગઈ છે. ✅\n\n"
            f"━━━━━━━━━━━━━━━━━━\n"
            f"✨ {event['name']}\n"
            f"📅 {date_str}\n"
            f"📍 {event['host_village']}\n"
            f"━━━━━━━━━━━━━━━━━━\n\n"
            f"આપના શુભ આગમનની પ્રતીક્ષા રહેશે.\n\n"
            f"— {event['host_name']} 🙏"
        )
    else:
        message = (
            f"🙏 આદરણીય {guest['name']},\n\n"
            f"આપનો જવાબ મળી ગયો છે.\n\n"
            f"આ વખતે આપ પધારી શક્તા નથી એ જાણી\n"
            f"અફસોસ થયો, પરંતુ આપના આશીર્વાદ\n"
            f"અમારી સાથે છે. 🙏\n\n"
            f"ભવિષ્યમાં આપ સાથે મળવાની\n"
            f"ઉત્કંઠા રહેશે.\n\n"
            f"— {event['host_name']}"
        )
    return await _send_text(phone, message, label="rsvp_ack")


async def send_payment_upi(entry: dict, event: dict) -> bool:
    """Send UPI payment confirmation (Template 4 — Razorpay webhook path)."""
    phone = entry.get("phone", "")
    if len(phone) != 10:
        return False
    amount = int(entry.get("amount", 0))
    date_str = _fmt_date(entry.get("created_at"))
    utr = entry.get("utr_number") or "—"
    message = (
        f"🙏 આદરણીય {entry['name']},\n\n"
        f"આપનું શગુન સાદર સ્વીકારવામાં આવ્યું છે. ✅\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"💰 રકમ     : ₹{amount}\n"
        f"🏷️ પ્રસંગ  : {event['name']}\n"
        f"📅 તારીખ   : {date_str}\n"
        f"🔖 UTR     : {utr}\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"આપ પધાર્યા તે માટે હૃદયપૂર્વક આભાર. 🌸\n\n"
        f"— {event['host_name']}"
    )
    return await _send_text(phone, message, label="payment_upi")


async def send_payment_cash(entry: dict, event: dict) -> bool:
    """Send cash payment confirmation (Template 5 — manual entry path)."""
    phone = entry.get("phone", "")
    if len(phone) != 10:
        return False
    amount = int(entry.get("amount", 0))
    date_str = _fmt_date(entry.get("created_at"))
    message = (
        f"🙏 આદરણીય {entry['name']},\n\n"
        f"આપનું શગુન સાદર સ્વીકારવામાં આવ્યું છે. ✅\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"💰 રકમ     : ₹{amount}\n"
        f"💵 પ્રકાર  : રોકડ (Cash)\n"
        f"🏷️ પ્રસંગ  : {event['name']}\n"
        f"📅 તારીખ   : {date_str}\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"આપ પધાર્યા તે માટે હૃદયપૂર્વક આભાર. 🌸\n\n"
        f"— {event['host_name']}"
    )
    return await _send_text(phone, message, label="payment_cash")


async def send_payment_gift(entry: dict, event: dict) -> bool:
    """Send gift acknowledgment (Template 6 — manual gift entry path)."""
    phone = entry.get("phone", "")
    if len(phone) != 10:
        return False
    gift_item = entry.get("gift_item") or "ઉપહાર"
    date_str = _fmt_date(entry.get("created_at"))
    message = (
        f"🙏 આદરણીય {entry['name']},\n\n"
        f"આપનું ભેટ-સોગાદ સાદર સ્વીકારવામાં આવ્યું છે. ✅\n\n"
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🎁 ઉપહાર   : {gift_item}\n"
        f"🏷️ પ્રસંગ  : {event['name']}\n"
        f"📅 તારીખ   : {date_str}\n"
        f"━━━━━━━━━━━━━━━━━━\n\n"
        f"આપ પધાર્યા તે માટે હૃદયપૂર્વક આભાર. 🌸\n\n"
        f"— {event['host_name']}"
    )
    return await _send_text(phone, message, label="payment_gift")
