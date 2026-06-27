"""
Stage and moderation REST endpoints.
Most stage actions flow through WebSocket (real-time), but these REST endpoints
allow direct server-side enforcement and are usable from admin tools.
"""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, require_host, require_host_or_speaker
from app.database import get_db
from app.models.ban import RoomBan
from app.models.chat import ChatMessage
from app.models.room import RoomParticipant
from app.models.user import User
from app.ws import connection_manager as cm

router = APIRouter(prefix="/rooms/{room_id}", tags=["stage", "moderation"])


@router.delete("/messages/{message_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_message(
    room_id: uuid.UUID,
    message_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    _participant: RoomParticipant = Depends(require_host_or_speaker),
):
    msg = await db.get(ChatMessage, message_id)
    if not msg or msg.room_id != room_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Message not found")
    msg.is_deleted = True
    msg.deleted_by = current_user.id
    msg.deleted_at = datetime.now(timezone.utc)


@router.post("/participants/{user_id}/mute", status_code=status.HTTP_204_NO_CONTENT)
async def mute_participant(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _host: RoomParticipant = Depends(require_host),
):
    participant = await _get_active_participant(db, room_id, user_id)
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    participant.is_muted = True


@router.delete("/participants/{user_id}/mute", status_code=status.HTTP_204_NO_CONTENT)
async def unmute_participant(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _host: RoomParticipant = Depends(require_host),
):
    participant = await _get_active_participant(db, room_id, user_id)
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    participant.is_muted = False


@router.post("/participants/{user_id}/kick", status_code=status.HTTP_204_NO_CONTENT)
async def kick_participant(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _host: RoomParticipant = Depends(require_host),
):
    participant = await _get_active_participant(db, room_id, user_id)
    if not participant:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found")
    if participant.is_host:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot kick the host")
    participant.left_at = datetime.now(timezone.utc)
    peer_id = str(user_id)
    await cm.broadcast(str(room_id), {"type": "participant_kicked", "peer_id": peer_id})


@router.post("/participants/{user_id}/ban", status_code=status.HTTP_204_NO_CONTENT)
async def ban_participant(
    room_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    _host: RoomParticipant = Depends(require_host),
):
    participant = await _get_active_participant(db, room_id, user_id)
    if participant:
        if participant.is_host:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot ban the host")
        participant.left_at = datetime.now(timezone.utc)

    # Check if already banned
    existing = await db.execute(
        select(RoomBan).where(RoomBan.room_id == room_id, RoomBan.user_id == user_id)
    )
    if not existing.scalar_one_or_none():
        db.add(RoomBan(
            id=uuid.uuid4(),
            room_id=room_id,
            user_id=user_id,
            banned_by=current_user.id,
        ))
    peer_id = str(user_id)
    await cm.broadcast(str(room_id), {"type": "participant_kicked", "peer_id": peer_id})


async def _get_active_participant(
    db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID
) -> RoomParticipant | None:
    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.user_id == user_id,
            RoomParticipant.left_at.is_(None),
        )
    )
    return result.scalar_one_or_none()
