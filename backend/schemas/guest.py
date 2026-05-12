import re
from typing import List, Literal, Optional
from pydantic import BaseModel, field_validator

RelationSide = Literal["mama_pakkhu", "kaka_pakkhu", "friend", "colleague", "other"]
RsvpStatus = Literal["pending", "coming", "not_coming"]


class CreateGuestRequest(BaseModel):
    name: str
    phone: str
    village: str
    relation_side: RelationSide

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) != 10:
            raise ValueError("Phone must be exactly 10 digits")
        return digits


class BulkGuestItem(BaseModel):
    name: str
    phone: str
    village: str
    relation_side: RelationSide = "other"


class UpdateGuestRequest(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    village: Optional[str] = None
    relation_side: Optional[RelationSide] = None
    rsvp_status: Optional[RsvpStatus] = None


class GuestImportRequest(BaseModel):
    source_event_id: str
    guest_ids: Optional[List[str]] = None  # None = import all guests from source event


class SendInvitesRequest(BaseModel):
    guest_ids: Optional[List[str]] = None  # None = use only_uninvited query-param logic
