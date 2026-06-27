import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.user import UserOut


class RoomCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=64, pattern=r"^[a-z0-9-]+$")
    title: str = Field(..., min_length=1, max_length=128)
    description: str | None = None
    topic_tags: list[str] = Field(default_factory=list)
    room_type: Literal["chitchat", "stage"] = "stage"
    is_private: bool = False
    password: str | None = Field(None, min_length=4, max_length=128)
    is_temporary: bool = False
    scheduled_at: datetime | None = None
    max_speakers: int = Field(default=10, ge=2, le=50)


class RoomUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=128)
    description: str | None = None
    topic_tags: list[str] | None = None
    room_type: Literal["chitchat", "stage"] | None = None
    is_private: bool | None = None
    password: str | None = Field(None, min_length=4, max_length=128)
    is_temporary: bool | None = None
    scheduled_at: datetime | None = None


class ParticipantOut(BaseModel):
    user_id: uuid.UUID
    display_name: str
    avatar_url: str | None
    is_verified: bool
    is_anon: bool
    role: str
    has_raised_hand: bool
    is_muted: bool
    joined_at: datetime

    model_config = {"from_attributes": True}


class RoomOut(BaseModel):
    id: uuid.UUID
    slug: str
    title: str
    description: str | None
    topic_tags: list[str] | None
    room_type: str
    is_private: bool
    has_password: bool = False
    is_temporary: bool
    max_speakers: int
    owner_id: uuid.UUID | None
    created_at: datetime
    scheduled_at: datetime | None
    closed_at: datetime | None
    speaker_count: int = 0
    listener_count: int = 0

    model_config = {"from_attributes": True}
