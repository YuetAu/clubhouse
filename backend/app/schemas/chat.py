import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ChatMessageOut(BaseModel):
    id: uuid.UUID
    room_id: uuid.UUID
    author_id: uuid.UUID | None
    display_name: str
    avatar_url: str | None
    is_verified: bool
    is_anon: bool
    content: str
    is_deleted: bool
    created_at: datetime

    model_config = {"from_attributes": True}
