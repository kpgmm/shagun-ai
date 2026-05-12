import bcrypt
from fastapi import APIRouter, HTTPException, Response, Depends

from database import get_db
from middleware.auth import create_access_token, get_current_user
from models.user import user_document
from schemas.user import LoginRequest, RegisterRequest

router = APIRouter()


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = 60 * 60 * 24 * 7  # 7 days in seconds


def _serialize_user(user: dict) -> dict:
    return {
        "id": str(user["_id"]),
        "name": user["name"],
        "phone": user["phone"],
        "created_at": user["created_at"].isoformat(),
    }


@router.post("/register")
async def register(body: RegisterRequest):
    db = get_db()

    existing = await db.users.find_one({"phone": body.phone})
    if existing:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    hashed = _hash_password(body.password)
    doc = user_document(body.name, body.phone, hashed)
    result = await db.users.insert_one(doc)

    doc["_id"] = result.inserted_id
    return {"success": True, "data": _serialize_user(doc)}


@router.post("/login")
async def login(body: LoginRequest, response: Response):
    db = get_db()

    user = await db.users.find_one({"phone": body.phone})
    if not user or not _verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid phone or password")

    token = create_access_token(str(user["_id"]))

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        secure=False,  # Set True in production with HTTPS
    )

    return {"success": True, "data": _serialize_user(user)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key=COOKIE_NAME)
    return {"success": True, "data": {"message": "Logged out"}}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {"success": True, "data": _serialize_user(current_user)}
