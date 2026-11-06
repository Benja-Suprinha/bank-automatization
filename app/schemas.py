from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class NotificationCreate(BaseModel):
    source: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=500)
    body: str = Field(min_length=1, max_length=10_240)
    received_at: datetime
    client_event_id: str | None = Field(default=None, max_length=255)


class TransactionPatch(BaseModel):
    merchant: str | None = None
    description: str | None = None
    occurred_at: str | None = None
    card_last4: str | None = Field(default=None, max_length=4)
    category: str | None = None
    status: str | None = None


class TransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    notification_id: int
    source: str
    amount: int
    currency: str
    merchant: str | None
    description: str | None
    occurred_at: str | None
    card_last4: str | None
    category: str | None
    status: str
    created_at: str
    updated_at: str


class NotificationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    source: str
    title: str
    body: str
    received_at: str
    client_event_id: str | None
    status: str
    parse_error: str | None
    created_at: str
    transaction: TransactionOut | None = None
