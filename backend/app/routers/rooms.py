import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import get_current_user, get_oauth_user, get_optional_user
from app.auth.password import pwd_context
from app.database import get_db
from app.models.room import Room, RoomParticipant
from app.models.user import User
from app.schemas.room import ParticipantOut, RoomCreate, RoomOut, RoomUpdate
from app.ws import connection_manager as cm

router = APIRouter(prefix="/rooms", tags=["rooms"])


def _room_out(room: Room, participants: list[RoomParticipant]) -> RoomOut:
    active = [p for p in participants if p.left_at is None]
    if room.room_type == "chitchat":
        speakers = active
        listeners: list[RoomParticipant] = []
    else:
        speakers = [p for p in active if p.role in ("host", "speaker")]
        listeners = [p for p in active if p.role == "listener"]
    out = RoomOut.model_validate(room)
    out.has_password = room.password_hash is not None
    out.speaker_count = len(speakers)
    out.listener_count = len(listeners)
    return out


async def _check_owner_limit(db: AsyncSession, user_id: uuid.UUID) -> Room | None:
    result = await db.execute(
        select(Room).where(Room.owner_id == user_id, Room.closed_at.is_(None))
    )
    return result.scalar_one_or_none()


@router.get("", response_model=list[RoomOut])
async def list_rooms(
    q: str | None = Query(None),
    tags: list[str] = Query(default=[]),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    stmt = select(Room).where(Room.closed_at.is_(None), Room.is_temporary.is_(False))
    if not current_user:
        stmt = stmt.where(Room.is_private.is_(False))

    if q:
        stmt = stmt.where(
            text("to_tsvector('english', title || ' ' || coalesce(description, '')) @@ plainto_tsquery('english', :q)")
        ).params(q=q)

    if tags:
        stmt = stmt.where(Room.topic_tags.overlap(tags))

    stmt = stmt.order_by(Room.created_at.desc()).offset((page - 1) * limit).limit(limit)
    result = await db.execute(stmt)
    rooms = result.scalars().all()

    out = []
    for room in rooms:
        parts_result = await db.execute(select(RoomParticipant).where(RoomParticipant.room_id == room.id))
        parts = parts_result.scalars().all()
        out.append(_room_out(room, parts))
    return out


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
async def create_room(
    body: RoomCreate,
    current_user: User = Depends(get_oauth_user),
    db: AsyncSession = Depends(get_db),
):
    existing_owner = await _check_owner_limit(db, current_user.id)
    if existing_owner:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "You already have an active room", "room_id": str(existing_owner.id)},
        )

    existing_slug = await db.execute(select(Room).where(Room.slug == body.slug))
    if existing_slug.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already taken")

    if body.scheduled_at and body.scheduled_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="scheduled_at must be in the future")

    password_hash = pwd_context.hash(body.password) if body.password else None

    room = Room(
        id=uuid.uuid4(),
        slug=body.slug,
        title=body.title,
        description=body.description,
        topic_tags=body.topic_tags or None,
        room_type=body.room_type,
        is_private=body.is_private,
        password_hash=password_hash,
        is_temporary=body.is_temporary,
        scheduled_at=body.scheduled_at,
        max_speakers=body.max_speakers,
        owner_id=current_user.id,
    )
    db.add(room)
    await db.flush()

    participant = RoomParticipant(
        id=uuid.uuid4(),
        room_id=room.id,
        user_id=current_user.id,
        role="host",
        is_host=True,
    )
    db.add(participant)
    await db.flush()

    return _room_out(room, [participant])


@router.post("/instant", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
async def create_instant_room(
    current_user: User = Depends(get_oauth_user),
    db: AsyncSession = Depends(get_db),
):
    existing_owner = await _check_owner_limit(db, current_user.id)
    if existing_owner:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"message": "You already have an active room", "room_id": str(existing_owner.id)},
        )

    slug = f"room-{uuid.uuid4().hex[:8]}"
    now = datetime.now(timezone.utc)
    title = now.strftime("Room at %-I:%M %p UTC")

    room = Room(
        id=uuid.uuid4(),
        slug=slug,
        title=title,
        description=None,
        topic_tags=None,
        is_private=True,
        password_hash=None,
        is_temporary=True,
        scheduled_at=None,
        max_speakers=10,
        owner_id=current_user.id,
    )
    db.add(room)
    await db.flush()

    participant = RoomParticipant(
        id=uuid.uuid4(),
        room_id=room.id,
        user_id=current_user.id,
        role="host",
        is_host=True,
    )
    db.add(participant)
    await db.flush()

    return _room_out(room, [participant])


@router.get("/{room_id}", response_model=RoomOut)
async def get_room(room_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    room = await db.get(Room, room_id)
    if not room or room.closed_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")
    parts_result = await db.execute(select(RoomParticipant).where(RoomParticipant.room_id == room.id))
    return _room_out(room, parts_result.scalars().all())


@router.patch("/{room_id}", response_model=RoomOut)
async def update_room(
    room_id: uuid.UUID,
    body: RoomUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(Room, room_id)
    if not room or room.closed_at:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    participant = await _get_active_participant(db, room_id, current_user.id)
    if not participant or not participant.is_host:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Host only")

    data = body.model_dump(exclude_unset=True)

    if "password" in data:
        raw_password = data.pop("password")
        room.password_hash = pwd_context.hash(raw_password) if raw_password else None

    if "scheduled_at" in data and data["scheduled_at"] and data["scheduled_at"] <= datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="scheduled_at must be in the future")

    old_room_type = room.room_type
    for field, val in data.items():
        setattr(room, field, val)
    new_room_type = room.room_type

    await db.flush()

    # When room_type changes, update participant roles and broadcast fresh room_state
    if "room_type" in data and old_room_type != new_room_type:
        active_result = await db.execute(
            select(RoomParticipant, User)
            .join(User, RoomParticipant.user_id == User.id)
            .where(RoomParticipant.room_id == room.id, RoomParticipant.left_at.is_(None))
        )
        rows = active_result.all()
        speakers_out, listeners_out, viewers_out, hands_raised_out = [], [], [], []
        for p, u in rows:
            p.role = "speaker" if new_room_type == "chitchat" else "viewer"
            info = {
                "peer_id": str(u.id),
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
                "is_verified": u.is_verified,
                "is_anon": u.is_anon,
                "is_host": p.is_host,
                "role": p.role,
                "has_raised_hand": p.has_raised_hand,
                "is_muted": p.is_muted,
            }
            if p.role == "speaker":
                speakers_out.append(info)
            else:
                viewers_out.append(info)
        await db.flush()
        await cm.broadcast(str(room.id), {
            "type": "room_state",
            "speakers": speakers_out,
            "listeners": listeners_out,
            "viewers": viewers_out,
            "hands_raised": hands_raised_out,
        })

    parts_result = await db.execute(select(RoomParticipant).where(RoomParticipant.room_id == room.id))
    return _room_out(room, parts_result.scalars().all())


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT)
async def close_room(
    room_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    room = await db.get(Room, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Room not found")

    participant = await _get_active_participant(db, room_id, current_user.id)
    if not participant or not participant.is_host:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Host only")

    room.closed_at = datetime.now(timezone.utc)


@router.get("/{room_id}/participants", response_model=list[ParticipantOut])
async def list_participants(room_id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RoomParticipant, User)
        .join(User, RoomParticipant.user_id == User.id)
        .where(RoomParticipant.room_id == room_id, RoomParticipant.left_at.is_(None))
    )
    rows = result.all()
    out = []
    for part, user in rows:
        out.append(ParticipantOut(
            user_id=user.id,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            is_verified=user.is_verified,
            is_anon=user.is_anon,
            role=part.role,
            has_raised_hand=part.has_raised_hand,
            is_muted=part.is_muted,
            joined_at=part.joined_at,
        ))
    return out


async def _get_active_participant(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> RoomParticipant | None:
    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.user_id == user_id,
            RoomParticipant.left_at.is_(None),
        )
    )
    return result.scalar_one_or_none()
