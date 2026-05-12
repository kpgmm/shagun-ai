from typing import Literal, Optional
from pydantic import BaseModel, model_validator

PaymentMode = Literal["upi", "cash", "gift"]


class CreateEntryRequest(BaseModel):
    name: str
    village: str
    phone: Optional[str] = None
    amount: float = 0
    mode: PaymentMode
    utr_number: Optional[str] = None
    gift_item: Optional[str] = None
    notes: Optional[str] = None
    logged_by: str = "operator"
    activity_id: Optional[str] = None

    @model_validator(mode="after")
    def validate_amount_for_mode(self) -> "CreateEntryRequest":
        if self.mode != "gift" and self.amount <= 0:
            raise ValueError("Amount must be greater than 0 for cash/UPI entries")
        if self.mode == "gift" and self.amount < 0:
            raise ValueError("Estimated value cannot be negative")
        return self


class UpdateEntryRequest(BaseModel):
    name: Optional[str] = None
    village: Optional[str] = None
    phone: Optional[str] = None
    amount: Optional[float] = None
    mode: Optional[PaymentMode] = None
    utr_number: Optional[str] = None
    gift_item: Optional[str] = None
    notes: Optional[str] = None


class DeleteEntryRequest(BaseModel):
    delete_reason: str
