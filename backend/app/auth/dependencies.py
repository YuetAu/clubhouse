import uuid

from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.jwt import decode_access_token
from app.database import get_db
from app.models.room import RoomParticipant
from app.models.user import User

bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_oauth_user(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.is_anon:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Anonymous users cannot create rooms")
    return current_user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not credentials:
        return None
    try:
        payload = decode_access_token(credentials.credentials)
        return await db.get(User, uuid.UUID(payload["sub"]))
    except (ValueError, Exception):
        return None


async def get_ws_user(
    token: str = Query(...),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = decode_access_token(token)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await db.get(User, uuid.UUID(payload["sub"]))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def require_host(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoomParticipant:
    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.user_id == current_user.id,
            RoomParticipant.left_at.is_(None),
        )
    )
    participant = result.scalar_one_or_none()
    if not participant or not participant.is_host:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Host role required")
    return participant


async def require_host_or_speaker(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RoomParticipant:
    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.user_id == current_user.id,
            RoomParticipant.left_at.is_(None),
        )
    )
    participant = result.scalar_one_or_none()
    if not participant or (not participant.is_host and participant.role != "speaker"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Host or speaker role required")
    return participant
