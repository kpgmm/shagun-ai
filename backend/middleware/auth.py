from datetime import datetime, timedelta, timezone
from typing import Optional

from bson import ObjectId
from fastapi import Cookie, HTTPException
from jose import JWTError, jwt

from config import settings
from database import get_db

ALGORITHM = "HS256"


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)


async def get_current_user(
    access_token: Optional[str] = Cookie(default=None),
):
    """FastAPI dependency — reads JWT from httpOnly cookie named 'access_token'."""
    if not access_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(access_token, settings.JWT_SECRET, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    db = get_db()
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user
