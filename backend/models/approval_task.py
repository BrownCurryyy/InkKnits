from __future__ import annotations

from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.base import Base


class ApprovalTask(Base):
    __tablename__ = "approval_tasks"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    asset_id: Mapped[UUID] = mapped_column(nullable=False)
    assigned_to: Mapped[UUID] = mapped_column(nullable=False)
    assigned_by: Mapped[UUID] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="PENDING")
    deadline: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    escalated_to: Mapped[UUID | None] = mapped_column(nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[DateTime | None] = mapped_column(DateTime(timezone=True), nullable=True)
