from datetime import datetime

from sqlalchemy import ForeignKey, Index, Integer, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_source", "source"), Index("ix_notifications_status", "status"))

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    received_at: Mapped[str] = mapped_column(String, nullable=False)
    client_event_id: Mapped[str | None] = mapped_column(String, unique=True)
    status: Mapped[str] = mapped_column(String, default="received", nullable=False)
    parse_error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[str] = mapped_column(String, server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    transaction: Mapped["Transaction | None"] = relationship(back_populates="notification", uselist=False, cascade="all, delete-orphan")


class Transaction(Base):
    __tablename__ = "transactions"
    __table_args__ = (Index("ix_transactions_occurred_at", "occurred_at"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    notification_id: Mapped[int] = mapped_column(ForeignKey("notifications.id", ondelete="CASCADE"), unique=True, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String, default="CLP", nullable=False)
    merchant: Mapped[str | None] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[str | None] = mapped_column(String)
    card_last4: Mapped[str | None] = mapped_column(String)
    category: Mapped[str | None] = mapped_column(String)
    status: Mapped[str] = mapped_column(String, default="pending_review", nullable=False)
    created_at: Mapped[str] = mapped_column(String, server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    updated_at: Mapped[str] = mapped_column(String, server_default=text("CURRENT_TIMESTAMP"), nullable=False)
    notification: Mapped[Notification] = relationship(back_populates="transaction")
