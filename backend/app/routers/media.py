"""
Media stub router — RTSP and YouTube ingestion.

All endpoints return HTTP 501 Not Implemented.
The DB schema and Pydantic contracts are fully defined; implement by
filling in media_service.py (see docstrings there for the intended approach).
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import require_host_or_speaker
from app.models.room import RoomParticipant
from app.schemas.media import MediaSlotOut, RtspSlotCreate, YoutubeSlotCreate

router = APIRouter(prefix="/rooms/{room_id}/media", tags=["media"])

_NOT_IMPL = HTTPException(
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
    detail="Media ingestion not yet implemented",
)


@router.post("/rtsp", response_model=MediaSlotOut, status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def register_rtsp(
    room_id: uuid.UUID,
    body: RtspSlotCreate,
    _p: RoomParticipant = Depends(require_host_or_speaker),
):
    raise _NOT_IMPL


@router.post("/youtube", response_model=MediaSlotOut, status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def register_youtube(
    room_id: uuid.UUID,
    body: YoutubeSlotCreate,
    _p: RoomParticipant = Depends(require_host_or_speaker),
):
    raise _NOT_IMPL


@router.get("", response_model=list[MediaSlotOut], status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def list_media(room_id: uuid.UUID):
    raise _NOT_IMPL


@router.delete("/{slot_id}", status_code=status.HTTP_501_NOT_IMPLEMENTED)
async def delete_media_slot(room_id: uuid.UUID, slot_id: uuid.UUID):
    raise _NOT_IMPL
