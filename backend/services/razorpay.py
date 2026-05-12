"""Razorpay service for UPI QR code creation.

Uses httpx.AsyncClient directly (Razorpay SDK is synchronous).
"""
from typing import Optional
import httpx
from config import settings


async def create_upi_qr(event: dict) -> Optional[dict]:
    """Create a Razorpay UPI QR code linked to the event.

    Returns dict with qr_id and qr_image_url, or None if not configured.
    """
    if not settings.RAZORPAY_KEY_ID or not settings.RAZORPAY_KEY_SECRET:
        print("[Razorpay] Not configured — skipping QR creation")
        return None

    event_id = str(event["_id"])
    payload = {
        "type": "upi_qr",
        "name": event["name"],
        "usage": "multiple_use",
        "fixed_amount": False,
        "description": f"Shagun collection for {event['name']}",
        "notes": {
            "event_id": event_id,
            "host_name": event["host_name"],
        },
    }

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.razorpay.com/v1/payments/qr_codes",
                json=payload,
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                timeout=15,
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "razorpay_qr_id": data.get("id"),
                "razorpay_qr_image_url": data.get("image_url"),
            }
    except Exception as e:
        print(f"[Razorpay] QR creation failed: {e}")
        return None


async def close_upi_qr(qr_id: str) -> bool:
    """Close/disable a QR code after event completion."""
    if not settings.RAZORPAY_KEY_ID or not qr_id:
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"https://api.razorpay.com/v1/payments/qr_codes/{qr_id}/close",
                auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
                timeout=10,
            )
            resp.raise_for_status()
            return True
    except Exception as e:
        print(f"[Razorpay] QR close failed: {e}")
        return False
