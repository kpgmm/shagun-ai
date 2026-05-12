from datetime import date
from typing import List, Literal, Optional
from pydantic import BaseModel, field_validator

ActivityType = Literal[
    "wedding", "mehandi", "garba", "haldi", "reception",
    "puja", "sangeet", "engagement", "tilak", "griha_pravesh",
    "naamkaran", "custom",
]
ActivityStatus = Literal["upcoming", "active", "completed"]


class ActivityCreate(BaseModel):
    name: str
    type: ActivityType
    custom_type_name: Optional[str] = None
    date: date
    time: Optional[str] = None
    description: Optional[str] = None
    guest_ids: List[str] = []

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class ActivityUpdate(BaseModel):
    name: Optional[str] = None
    type: Optional[ActivityType] = None
    custom_type_name: Optional[str] = None
    date: Optional[date] = None
    time: Optional[str] = None
    description: Optional[str] = None
    guest_ids: Optional[List[str]] = None


class ActivityStatusUpdate(BaseModel):
    status: ActivityStatus


class GuestIdsRequest(BaseModel):
    guest_ids: List[str]
