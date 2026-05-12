from datetime import datetime, timezone


def user_document(name: str, phone: str, password_hash: str) -> dict:
    return {
        "name": name,
        "phone": phone,
        "password_hash": password_hash,
        "created_at": datetime.now(timezone.utc),
    }
