"""Stub schemas for RTSP and YouTube media slots."""

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class RtspSlotCreate(BaseModel):
    source_url: str
    label: str | None = None


class YoutubeSlotCreate(BaseModel):
    video_id: str
    label: str | None = None


class MediaSlotOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    slot_type: Literal["rtsp", "youtube"]
    source_url: str
    label: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
