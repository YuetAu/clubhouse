"""
MediaSlot — stub model for future RTSP and YouTube ingestion.

Future RTSP path: spawn FFmpeg subprocess per slot reading RTSP URL,
push to WHIP endpoint (WebRTC HTTP Ingest Protocol), distribute via SFU.

Future YouTube path: resolve video ID via oEmbed/IFrame API, broadcast
playback sync events to room participants via the media_slot_stub WS message.
"""

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MediaSlot(Base):
    __tablename__ = "media_slots"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"))
    slot_type: Mapped[str] = mapped_column(String(16), nullable=False)  # 'rtsp' | 'youtube'
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    label: Mapped[str | None] = mapped_column(String(64), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSONB, nullable=True)
