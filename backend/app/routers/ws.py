import json
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_ws_user
from app.auth.password import pwd_context
from app.database import AsyncSessionLocal
from app.models.ban import RoomBan
from app.models.room import Room
from app.models.user import User
from app.schemas.signaling import IncomingMessage
from app.ws import connection_manager as cm
from app.ws.message_handler import handle

_incoming_adapter = TypeAdapter(IncomingMessage)

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])

# WebSocket close codes (4000-4999 are application-defined per RFC 6455)
WS_CLOSE_NOT_FOUND = 4004
WS_CLOSE_FORBIDDEN = 4003


@router.websocket("/ws/room/{room_id}")
async def room_websocket(
    websocket: WebSocket,
    room_id: str,
    password: str | None = Query(None),
    user: User = Depends(get_ws_user),
):
    # Pre-accept room validation
    try:
        room_uuid = uuid.UUID(room_id)
    except ValueError:
        await websocket.close(code=WS_CLOSE_NOT_FOUND)
        return

    async with AsyncSessionLocal() as db:
        room = await db.get(Room, room_uuid)
        ban_result = await db.execute(
            select(RoomBan).where(RoomBan.room_id == room_uuid, RoomBan.user_id == user.id)
        )
        is_banned = ban_result.scalar_one_or_none() is not None

    if not room or room.closed_at:
        await websocket.close(code=WS_CLOSE_NOT_FOUND)
        return

    # Banned users cannot join
    if is_banned:
        await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="You are banned from this room")
        return

    # Block early access to scheduled rooms
    if room.scheduled_at and room.scheduled_at > datetime.now(timezone.utc):
        await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="Room not started yet")
        return

    # Password check
    if room.password_hash:
        if not password or not pwd_context.verify(password, room.password_hash):
            await websocket.close(code=WS_CLOSE_FORBIDDEN, reason="Invalid password")
            return

    peer_id = str(user.id)
    await websocket.accept()
    cm.connect(room_id, peer_id, websocket)

    try:
        async with AsyncSessionLocal() as db:
            while True:
                raw = await websocket.receive_text()
                try:
                    data = json.loads(raw)
                    msg = _incoming_adapter.validate_python(data)
                except (ValidationError, ValueError, Exception) as exc:
                    await websocket.send_json({"type": "error", "code": "invalid_message", "message": str(exc)})
                    continue

                try:
                    await handle(msg, peer_id, room_id, user, db)
                    await db.commit()
                except Exception as exc:
                    await db.rollback()
                    logger.exception("Error handling WS message: %s", exc)
                    await websocket.send_json({"type": "error", "code": "server_error", "message": "Internal error"})

    except WebSocketDisconnect:
        pass
    finally:
        cm.disconnect(room_id, peer_id, websocket)

        # If user has reconnected with a new socket, don't mark as left or broadcast
        if peer_id in cm.get_peers(room_id):
            return

        async with AsyncSessionLocal() as db:
            try:
                from app.ws.message_handler import _mark_left
                await _mark_left(db, room_uuid, user.id)
                await db.commit()
            except Exception:
                pass

        await cm.broadcast(room_id, {"type": "participant_left", "peer_id": peer_id})
