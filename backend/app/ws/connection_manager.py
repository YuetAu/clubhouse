import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)

# room_id → { peer_id → WebSocket }
_rooms: dict[str, dict[str, WebSocket]] = defaultdict(dict)

# room_id → set of peer_ids currently screen sharing
_screen_sharing: dict[str, set[str]] = defaultdict(set)


def connect(room_id: str, peer_id: str, ws: WebSocket) -> None:
    _rooms[room_id][peer_id] = ws


def disconnect(room_id: str, peer_id: str, ws: WebSocket) -> None:
    if _rooms.get(room_id, {}).get(peer_id) is ws:
        _rooms[room_id].pop(peer_id, None)
        if not _rooms[room_id]:
            del _rooms[room_id]
    _screen_sharing.get(room_id, set()).discard(peer_id)


def set_screen_sharing(room_id: str, peer_id: str, sharing: bool) -> None:
    if sharing:
        _screen_sharing[room_id].add(peer_id)
    else:
        _screen_sharing[room_id].discard(peer_id)


def get_screen_sharing_peers(room_id: str) -> list[str]:
    return list(_screen_sharing.get(room_id, set()))


def get_peers(room_id: str) -> list[str]:
    return list(_rooms.get(room_id, {}).keys())


async def send_to(room_id: str, peer_id: str, msg: dict) -> None:
    ws = _rooms.get(room_id, {}).get(peer_id)
    if ws:
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            logger.debug("Failed to send to %s in %s", peer_id, room_id)


async def broadcast(room_id: str, msg: dict, exclude_peer_id: str | None = None) -> None:
    peers = dict(_rooms.get(room_id, {}))
    for pid, ws in peers.items():
        if pid == exclude_peer_id:
            continue
        try:
            await ws.send_text(json.dumps(msg))
        except Exception:
            logger.debug("Failed to broadcast to %s in %s", pid, room_id)


async def broadcast_to_roles(room_id: str, msg: dict, roles: set[str], peer_roles: dict[str, str]) -> None:
    """Broadcast only to peers whose role is in `roles`."""
    peers = dict(_rooms.get(room_id, {}))
    for pid, ws in peers.items():
        if peer_roles.get(pid) in roles:
            try:
                await ws.send_text(json.dumps(msg))
            except Exception:
                logger.debug("Failed to send to %s", pid)
