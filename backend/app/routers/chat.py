import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.chat import ChatMessage
from app.models.user import User
from app.schemas.chat import ChatMessageOut

router = APIRouter(prefix="/rooms/{room_id}/messages", tags=["chat"])


@router.get("", response_model=list[ChatMessageOut])
async def get_messages(
    room_id: uuid.UUID,
    before: uuid.UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(ChatMessage, User)
        .join(User, ChatMessage.author_id == User.id, isouter=True)
        .where(ChatMessage.room_id == room_id, ChatMessage.is_deleted.is_(False))
        .order_by(ChatMessage.created_at.desc())
        .limit(limit)
    )
    if before:
        before_msg = await db.get(ChatMessage, before)
        if before_msg:
            stmt = stmt.where(ChatMessage.created_at < before_msg.created_at)

    result = await db.execute(stmt)
    rows = result.all()

    out = []
    for msg, user in reversed(rows):
        out.append(ChatMessageOut(
            id=msg.id,
            room_id=msg.room_id,
            author_id=msg.author_id,
            display_name=user.display_name if user else "deleted user",
            avatar_url=user.avatar_url if user else None,
            is_verified=user.is_verified if user else False,
            is_anon=user.is_anon if user else False,
            content=msg.content,
            is_deleted=msg.is_deleted,
            created_at=msg.created_at,
        ))
    return out
