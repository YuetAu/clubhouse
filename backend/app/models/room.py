import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, SmallInteger, String, func
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Room(Base):
    __tablename__ = "rooms"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String(128), nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    topic_tags: Mapped[list[str] | None] = mapped_column(ARRAY(String(32)), nullable=True)
    room_type: Mapped[str] = mapped_column(String(16), nullable=False, default="chitchat")
    is_private: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    password_hash: Mapped[str | None] = mapped_column(String(128), nullable=True)
    is_temporary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    max_speakers: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=10)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_emptied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    participants: Mapped[list["RoomParticipant"]] = relationship(back_populates="room", cascade="all, delete-orphan")


class RoomParticipant(Base):
    __tablename__ = "room_participants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    room_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rooms.id", ondelete="CASCADE"))
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(String(16), nullable=False, default="viewer")
    is_host: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    has_raised_hand: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    room: Mapped["Room"] = relationship(back_populates="participants")
    user: Mapped["User"] = relationship(back_populates="room_participants")  # noqa: F821
