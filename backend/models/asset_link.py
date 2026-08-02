from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.base import Base


class AssetLink(Base):
    __tablename__ = "asset_links"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    parent_asset_id: Mapped[UUID] = mapped_column(nullable=False)
    child_asset_id: Mapped[UUID] = mapped_column(nullable=False)
    relationship_type: Mapped[str] = mapped_column(String(50), nullable=False)
    created_at: Mapped[DateTime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
