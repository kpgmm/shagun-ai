import re
from pydantic import BaseModel, field_validator


class RegisterRequest(BaseModel):
    name: str
    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) != 10:
            raise ValueError("Phone must be exactly 10 digits")
        return digits

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        # bcrypt silently truncates at 72 bytes — reject longer passwords so
        # users aren't surprised that characters beyond 72 are ignored.
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 characters or fewer")
        return v


class LoginRequest(BaseModel):
    phone: str
    password: str

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        return re.sub(r"\D", "", v)


class UserResponse(BaseModel):
    id: str
    name: str
    phone: str
    created_at: str
