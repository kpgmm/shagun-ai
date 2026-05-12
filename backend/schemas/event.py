import re
from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, field_validator

EventType = Literal["wedding", "naamkaran", "griha_pravesh", "puja", "other"]
EventStatus = Literal["draft", "active", "completed"]


class CreateEventRequest(BaseModel):
    name: str
    type: EventType
    event_date: date
    host_name: str
    host_village: str
    host_upi_id: str
    host_whatsapp: str

    @field_validator("host_whatsapp")
    @classmethod
    def validate_whatsapp(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) != 10:
            raise ValueError("WhatsApp number must be exactly 10 digits")
        return digits

    @field_validator("name", "host_name", "host_village", "host_upi_id")
    @classmethod
    def strip_strings(cls, v: str) -> str:
        return v.strip()


class UpdateEventRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[EventType] = None
    event_date: Optional[date] = None
    host_name: Optional[str] = None
    host_village: Optional[str] = None
    host_upi_id: Optional[str] = None
    host_whatsapp: Optional[str] = None


class UpdateStatusRequest(BaseModel):
    status: EventStatus
