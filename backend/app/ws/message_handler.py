"""
Dispatch incoming WebSocket messages to the appropriate service.
All functions receive the parsed message, the sender's peer_id, room_id, user, and db session.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatMessage
from app.models.room import Room, RoomParticipant
from app.models.user import User
from app.schemas.signaling import (
    AcceptStageInvitationMessage,
    BecomeListenerMessage,
    ChatSendMessage,
    DeclineStageInvitationMessage,
    InviteToStageMessage,
    JoinMessage,
    JoinStageMessage,
    LeaveMessage,
    LeaveStageMessage,
    LowerHandMessage,
    MediaSlotStubMessage,
    RaiseHandMessage,
    RemoveFromStageMessage,
    ScreenShareStartMessage,
    ScreenShareStopMessage,
    WebRTCAnswerMessage,
    WebRTCIceMessage,
    WebRTCOfferMessage,
)
from app.ws import connection_manager as cm

logger = logging.getLogger(__name__)


async def handle(msg, peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    t = msg.type

    if t == "join":
        await _handle_join(peer_id, room_id, user, db)
    elif t == "leave":
        await _handle_leave(peer_id, room_id, user, db)
    elif t == "chat_send":
        await _handle_chat(msg, peer_id, room_id, user, db)
    elif t in ("webrtc_offer", "webrtc_answer", "webrtc_ice"):
        await _relay_webrtc(msg, peer_id, room_id)
    elif t == "raise_hand":
        await _handle_raise_hand(peer_id, room_id, user, db, raised=True)
    elif t == "lower_hand":
        await _handle_raise_hand(peer_id, room_id, user, db, raised=False)
    elif t == "invite_to_stage":
        await _handle_invite_to_stage(msg, peer_id, room_id, user, db)
    elif t == "accept_stage_invitation":
        await _handle_accept_invitation(peer_id, room_id, user, db)
    elif t == "decline_stage_invitation":
        await _handle_decline_invitation(peer_id, room_id)
    elif t == "leave_stage":
        await _handle_leave_stage(peer_id, room_id, user, db)
    elif t == "join_stage":
        await _handle_join_stage(peer_id, room_id, user, db)
    elif t == "remove_from_stage":
        await _handle_remove_from_stage(msg, peer_id, room_id, user, db)
    elif t == "become_listener":
        await _handle_become_listener(peer_id, room_id, user, db)
    elif t == "screen_share_start":
        cm.set_screen_sharing(room_id, peer_id, True)
        await cm.broadcast(room_id, {"type": "screen_share_start", "peer_id": peer_id}, exclude_peer_id=peer_id)
    elif t == "screen_share_stop":
        cm.set_screen_sharing(room_id, peer_id, False)
        await cm.broadcast(room_id, {"type": "screen_share_stop", "peer_id": peer_id}, exclude_peer_id=peer_id)
    elif t == "media_slot_stub":
        logger.info("media_slot_stub from %s in %s: %s", peer_id, room_id, msg)
    else:
        logger.warning("Unhandled message type: %s", t)


async def _handle_join(peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    room_uuid = uuid.UUID(room_id)

    room = await db.get(Room, room_uuid)
    is_owner = room is not None and room.owner_id == user.id
    is_chitchat = room is not None and room.room_type == "chitchat"

    # Chitchat: everyone joins directly as speaker.
    # Stage: everyone joins as viewer; host/speaker role is elevated separately.
    default_role = "speaker" if is_chitchat else "viewer"

    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_uuid,
            RoomParticipant.user_id == user.id,
        )
    )
    participant = result.scalar_one_or_none()

    if participant:
        participant.left_at = None  # rejoin
        participant.role = default_role
        participant.is_host = is_owner
    else:
        participant = RoomParticipant(
            id=uuid.uuid4(),
            room_id=room_uuid,
            user_id=user.id,
            role=default_role,
            is_host=is_owner,
        )
        db.add(participant)

    # Someone joined — room is no longer empty
    if room is not None and room.last_emptied_at is not None:
        room.last_emptied_at = None

    await db.flush()

    # Build room_state (sent only to the joiner)
    state = await _build_room_state(room_uuid, db)
    await cm.send_to(room_id, peer_id, {"type": "room_state", **state})

    participant_info = _participant_dict(participant, user)

    if is_chitchat:
        # Broadcast speaker_joined so existing peers set up WebRTC connections
        await cm.broadcast(
            room_id,
            {"type": "speaker_joined", "peer_id": peer_id, "participant": participant_info},
            exclude_peer_id=peer_id,
        )
    else:
        # Stage: everyone joins as viewer — no WebRTC initiated on join
        await cm.broadcast(
            room_id,
            {"type": "participant_joined", "participant": participant_info},
            exclude_peer_id=peer_id,
        )


async def _handle_leave(peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    await _mark_left(db, uuid.UUID(room_id), user.id)
    await cm.broadcast(room_id, {"type": "participant_left", "peer_id": peer_id}, exclude_peer_id=peer_id)


async def _handle_chat(msg: ChatSendMessage, peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    chat = ChatMessage(
        id=uuid.uuid4(),
        room_id=uuid.UUID(room_id),
        author_id=user.id,
        content=msg.content,
    )
    db.add(chat)
    await db.flush()

    payload = {
        "type": "chat_message",
        "message_id": str(chat.id),
        "author_id": str(user.id),
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "is_verified": user.is_verified,
        "is_anon": user.is_anon,
        "content": chat.content,
        "created_at": chat.created_at.isoformat(),
    }
    await cm.broadcast(room_id, payload)


async def _relay_webrtc(msg, peer_id: str, room_id: str) -> None:
    target = msg.target_peer_id
    payload = msg.model_dump()
    payload["from_peer_id"] = peer_id
    del payload["target_peer_id"]
    await cm.send_to(room_id, target, payload)


async def _handle_raise_hand(peer_id: str, room_id: str, user: User, db: AsyncSession, raised: bool) -> None:
    participant = await _get_active_participant(db, uuid.UUID(room_id), user.id)
    if not participant or participant.role not in ("listener", "viewer"):
        return
    room = await db.get(Room, uuid.UUID(room_id))
    if room and room.room_type == "chitchat":
        return
    participant.has_raised_hand = raised
    await db.flush()

    msg_type = "hand_raised" if raised else "hand_lowered"
    # Only notify hosts and speakers
    peer_roles = await _get_peer_roles(db, uuid.UUID(room_id))
    await cm.broadcast_to_roles(room_id, {"type": msg_type, "peer_id": peer_id}, {"host", "speaker"}, peer_roles)


async def _handle_invite_to_stage(
    msg: InviteToStageMessage, peer_id: str, room_id: str, user: User, db: AsyncSession
) -> None:
    participant = await _get_active_participant(db, uuid.UUID(room_id), user.id)
    if not participant or (not participant.is_host and participant.role != "speaker"):
        return
    await cm.send_to(room_id, msg.target_peer_id, {"type": "stage_invitation", "from_peer_id": peer_id})


async def _handle_accept_invitation(peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    participant = await _get_active_participant(db, uuid.UUID(room_id), user.id)
    if not participant or participant.role not in ("listener", "viewer"):
        return
    participant.role = "speaker"
    participant.has_raised_hand = False
    await db.flush()

    participant_info = _participant_dict(participant, user)
    await cm.broadcast(room_id, {"type": "speaker_joined", "peer_id": peer_id, "participant": participant_info})


async def _handle_decline_invitation(peer_id: str, room_id: str) -> None:
    pass


async def _handle_join_stage(peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    """Hosts can go directly on stage without an invitation."""
    participant = await _get_active_participant(db, uuid.UUID(room_id), user.id)
    if not participant or not participant.is_host or participant.role == "speaker":
        return
    participant.role = "speaker"
    participant.has_raised_hand = False
    await db.flush()

    participant_info = _participant_dict(participant, user)
    await cm.broadcast(room_id, {"type": "speaker_joined", "peer_id": peer_id, "participant": participant_info})


async def _handle_leave_stage(peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    participant = await _get_active_participant(db, uuid.UUID(room_id), user.id)
    if not participant or participant.role != "speaker":
        return
    participant.role = "listener"
    await db.flush()
    await cm.broadcast(room_id, {"type": "speaker_left", "peer_id": peer_id})


async def _handle_remove_from_stage(
    msg: RemoveFromStageMessage, peer_id: str, room_id: str, user: User, db: AsyncSession
) -> None:
    caller = await _get_active_participant(db, uuid.UUID(room_id), user.id)
    if not caller or not caller.is_host:
        return

    try:
        target_user_id = uuid.UUID(msg.target_peer_id)
    except ValueError:
        return

    target = await _get_active_participant(db, uuid.UUID(room_id), target_user_id)
    if not target or target.role != "speaker":
        return

    target.role = "listener"
    await db.flush()
    await cm.broadcast(room_id, {"type": "speaker_left", "peer_id": msg.target_peer_id})


async def _handle_become_listener(peer_id: str, room_id: str, user: User, db: AsyncSession) -> None:
    participant = await _get_active_participant(db, uuid.UUID(room_id), user.id)
    if not participant or participant.role != "viewer":
        return
    participant.role = "listener"
    await db.flush()

    participant_info = _participant_dict(participant, user)
    await cm.broadcast(room_id, {"type": "viewer_became_listener", "peer_id": peer_id, "participant": participant_info})


async def _get_active_participant(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> RoomParticipant | None:
    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.user_id == user_id,
            RoomParticipant.left_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def _mark_left(db: AsyncSession, room_id: uuid.UUID, user_id: uuid.UUID) -> None:
    participant = await _get_active_participant(db, room_id, user_id)
    if participant:
        participant.left_at = datetime.now(timezone.utc)
        await db.flush()

        # Check if room is now empty; if so, record when it became empty
        count_result = await db.execute(
            select(func.count()).select_from(RoomParticipant).where(
                RoomParticipant.room_id == room_id,
                RoomParticipant.left_at.is_(None),
            )
        )
        if count_result.scalar() == 0:
            room = await db.get(Room, room_id)
            if room and not room.closed_at:
                room.last_emptied_at = datetime.now(timezone.utc)
                await db.flush()


async def _get_peer_roles(db: AsyncSession, room_id: uuid.UUID) -> dict[str, str]:
    """Return a role string per peer_id. is_host participants always map to 'host'
    so that broadcast_to_roles({host, speaker}) correctly targets them regardless
    of their current audio role (viewer/listener/speaker)."""
    result = await db.execute(
        select(RoomParticipant).where(
            RoomParticipant.room_id == room_id,
            RoomParticipant.left_at.is_(None),
        )
    )
    return {str(p.user_id): "host" if p.is_host else p.role for p in result.scalars()}


async def _build_room_state(room_id: uuid.UUID, db: AsyncSession) -> dict:
    result = await db.execute(
        select(RoomParticipant, User)
        .join(User, RoomParticipant.user_id == User.id)
        .where(RoomParticipant.room_id == room_id, RoomParticipant.left_at.is_(None))
    )
    speakers, listeners, viewers, hands_raised = [], [], [], []
    for part, user in result.all():
        info = _participant_dict(part, user)
        if part.role == "speaker":
            speakers.append(info)
        elif part.role == "listener":
            listeners.append(info)
        else:
            viewers.append(info)
        if part.has_raised_hand:
            hands_raised.append(str(user.id))

    return {
        "speakers": speakers,
        "listeners": listeners,
        "viewers": viewers,
        "hands_raised": hands_raised,
        "screen_sharing_peer_ids": cm.get_screen_sharing_peers(str(room_id)),
    }


def _participant_dict(participant: RoomParticipant, user: User) -> dict:
    return {
        "peer_id": str(user.id),
        "display_name": user.display_name,
        "avatar_url": user.avatar_url,
        "is_verified": user.is_verified,
        "is_anon": user.is_anon,
        "is_host": participant.is_host,
        "role": participant.role,
        "has_raised_hand": participant.has_raised_hand,
        "is_muted": participant.is_muted,
    }
