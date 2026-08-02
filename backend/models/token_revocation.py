from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.base import Base


class TokenRevocation(Base):
    __tablename__ = "token_revocations"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    jti: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    token_type: Mapped[str] = mapped_column(String(50), nullable=False)
    user_id: Mapped[UUID | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    revoked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
