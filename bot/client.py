import asyncio
import json
import logging
import uuid
from typing import Optional

import aiohttp
import websockets
from aiortc import RTCIceCandidate, RTCPeerConnection, RTCSessionDescription
from aiortc.sdp import candidate_from_sdp
from aiortc.contrib.media import MediaPlayer, MediaRelay
from aiortc.rtcconfiguration import RTCConfiguration, RTCIceServer

logger = logging.getLogger(__name__)


class RoomBot:
    def __init__(
        self,
        server_url: str,
        room_id: str,
        mp4_path: str,
        display_name: str,
        loop_media: bool = True,
    ) -> None:
        self.server_url = server_url.rstrip("/")
        self.room_id = room_id
        self.mp4_path = mp4_path
        self.display_name = display_name
        self.loop_media = loop_media

        self.token: Optional[str] = None
        self.peer_id: Optional[str] = None
        self.role: str = "viewer"

        self.player: Optional[MediaPlayer] = None
        self.relay: Optional[MediaRelay] = None
        self.pcs: dict[str, RTCPeerConnection] = {}
        self.ws = None
        self._stop = False

    # ------------------------------------------------------------------
    # Auth
    # ------------------------------------------------------------------

    async def _authenticate(self) -> None:
        anon_token = str(uuid.uuid4())
        async with aiohttp.ClientSession() as session:
            resp = await session.post(
                f"{self.server_url}/api/v1/auth/anon",
                json={"anon_token": anon_token, "display_name": self.display_name},
            )
            resp.raise_for_status()
            data = await resp.json()
        self.token = data["access_token"]
        self.peer_id = str(data["user"]["id"])
        logger.info("Authenticated as %s (peer_id=%s)", self.display_name, self.peer_id)

    # ------------------------------------------------------------------
    # Media
    # ------------------------------------------------------------------

    def _init_media(self) -> None:
        options: dict[str, str] = {}
        if self.loop_media:
            options["stream_loop"] = "-1"
        self.player = MediaPlayer(self.mp4_path, options=options)
        self.relay = MediaRelay()
        logger.info("Media player ready: %s (loop=%s)", self.mp4_path, self.loop_media)

    # ------------------------------------------------------------------
    # WebSocket helpers
    # ------------------------------------------------------------------

    async def _send(self, msg: dict) -> None:
        await self.ws.send(json.dumps(msg))

    # ------------------------------------------------------------------
    # Peer connection helpers
    # ------------------------------------------------------------------

    def _make_pc(self, peer_id: str) -> RTCPeerConnection:
        config = RTCConfiguration(
            iceServers=[RTCIceServer(urls=["stun:stun.l.google.com:19302"])]
        )
        pc = RTCPeerConnection(configuration=config)
        self.pcs[peer_id] = pc

        assert self.player is not None and self.relay is not None

        if self.player.audio:
            pc.addTrack(self.relay.subscribe(self.player.audio))
        if self.player.video:
            pc.addTrack(self.relay.subscribe(self.player.video))

        # Capture peer_id in closure for the ICE callback
        target = peer_id

        @pc.on("icecandidate")
        async def on_ice(candidate: RTCIceCandidate) -> None:
            if candidate:
                await self._send(
                    {
                        "type": "webrtc_ice",
                        "target_peer_id": target,
                        "candidate": {
                            "candidate": candidate.candidate,
                            "sdpMid": candidate.sdpMid,
                            "sdpMLineIndex": candidate.sdpMLineIndex,
                        },
                    }
                )

        return pc

    async def _create_offer_to(self, peer_id: str) -> None:
        logger.info("Sending offer to %s", peer_id)
        pc = self._make_pc(peer_id)
        offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await self._send(
            {
                "type": "webrtc_offer",
                "target_peer_id": peer_id,
                "sdp": pc.localDescription.sdp,
            }
        )

    async def _handle_offer(self, from_peer_id: str, sdp: str) -> None:
        logger.info("Received offer from %s", from_peer_id)
        pc = self._make_pc(from_peer_id)
        await pc.setRemoteDescription(RTCSessionDescription(sdp=sdp, type="offer"))
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await self._send(
            {
                "type": "webrtc_answer",
                "target_peer_id": from_peer_id,
                "sdp": pc.localDescription.sdp,
            }
        )

    # ------------------------------------------------------------------
    # Message dispatch
    # ------------------------------------------------------------------

    async def _handle_message(self, msg: dict) -> None:
        t = msg.get("type")

        if t == "room_state":
            speakers = [p["display_name"] for p in msg.get("speakers", [])]
            listeners = len(msg.get("listeners", []))
            viewers = len(msg.get("viewers", []))
            logger.info(
                "Room state — speakers: %s, listeners: %d, viewers: %d",
                speakers,
                listeners,
                viewers,
            )

        elif t == "stage_invitation":
            logger.info("Stage invitation from %s — accepting", msg.get("from_peer_id"))
            await self._send({"type": "accept_stage_invitation"})

        elif t == "speaker_joined":
            pid = msg["peer_id"]
            if pid == self.peer_id:
                self.role = "speaker"
                logger.info("Now on stage as speaker")
                self._init_media()
                await self._send({"type": "screen_share_start"})
            elif self.role == "speaker":
                # New speaker joined while we're already on stage — initiate offer
                await self._create_offer_to(pid)

        elif t == "webrtc_offer":
            if self.role == "speaker":
                await self._handle_offer(msg["from_peer_id"], msg["sdp"])

        elif t == "webrtc_answer":
            pid = msg["from_peer_id"]
            if pid in self.pcs:
                await self.pcs[pid].setRemoteDescription(
                    RTCSessionDescription(sdp=msg["sdp"], type="answer")
                )

        elif t == "webrtc_ice":
            pid = msg["from_peer_id"]
            if pid in self.pcs:
                cand = msg["candidate"]
                candidate_str = cand.get("candidate", "")
                # Empty candidate signals end-of-candidates — skip
                if candidate_str:
                    sdp_part = candidate_str
                    if sdp_part.startswith("candidate:"):
                        sdp_part = sdp_part[len("candidate:"):]
                    ice_candidate = candidate_from_sdp(sdp_part)
                    ice_candidate.sdpMid = cand.get("sdpMid")
                    ice_candidate.sdpMLineIndex = cand.get("sdpMLineIndex")
                    await self.pcs[pid].addIceCandidate(ice_candidate)

        elif t == "speaker_left":
            pid = msg.get("peer_id", "")
            if pid in self.pcs:
                await self.pcs.pop(pid).close()
                logger.info("Closed PC for departed speaker %s", pid)

        elif t == "participant_kicked":
            if msg.get("peer_id") == self.peer_id:
                logger.info("Bot was kicked — disconnecting")
                self._stop = True

        elif t == "error":
            logger.warning("Server error: [%s] %s", msg.get("code"), msg.get("message"))

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    async def run(self) -> None:
        await self._authenticate()

        ws_base = self.server_url.replace("https://", "wss://").replace("http://", "ws://")
        ws_url = f"{ws_base}/ws/room/{self.room_id}?token={self.token}"

        logger.info("Connecting to room %s …", self.room_id)
        try:
            async with websockets.connect(ws_url) as ws:
                self.ws = ws
                await self._send({"type": "join"})
                logger.info("Joined room — waiting for stage invitation")

                async for raw in ws:
                    if self._stop:
                        break
                    try:
                        msg = json.loads(raw)
                        await self._handle_message(msg)
                    except Exception as exc:
                        logger.exception("Error handling message: %s", exc)

        except websockets.exceptions.ConnectionClosedError as exc:
            logger.info("Connection closed: %s", exc)
        finally:
            for pid, pc in list(self.pcs.items()):
                await pc.close()
            self.pcs.clear()
            logger.info("Bot disconnected")
