"""
All WebSocket message types, discriminated on the `type` field.
"""

from typing import Annotated, Any, Literal, Union

from pydantic import BaseModel, Field


# ─── Client → Server ──────────────────────────────────────────────────────────

class JoinMessage(BaseModel):
    type: Literal["join"]


class LeaveMessage(BaseModel):
    type: Literal["leave"]


class ChatSendMessage(BaseModel):
    type: Literal["chat_send"]
    content: str = Field(..., min_length=1, max_length=2000)


class WebRTCOfferMessage(BaseModel):
    type: Literal["webrtc_offer"]
    target_peer_id: str
    sdp: str


class WebRTCAnswerMessage(BaseModel):
    type: Literal["webrtc_answer"]
    target_peer_id: str
    sdp: str


class WebRTCIceMessage(BaseModel):
    type: Literal["webrtc_ice"]
    target_peer_id: str
    candidate: Any


class RaiseHandMessage(BaseModel):
    type: Literal["raise_hand"]


class LowerHandMessage(BaseModel):
    type: Literal["lower_hand"]


class AcceptStageInvitationMessage(BaseModel):
    type: Literal["accept_stage_invitation"]


class DeclineStageInvitationMessage(BaseModel):
    type: Literal["decline_stage_invitation"]


class LeaveStageMessage(BaseModel):
    type: Literal["leave_stage"]


class InviteToStageMessage(BaseModel):
    type: Literal["invite_to_stage"]
    target_peer_id: str


class RemoveFromStageMessage(BaseModel):
    type: Literal["remove_from_stage"]
    target_peer_id: str


class ScreenShareStartMessage(BaseModel):
    type: Literal["screen_share_start"]


class ScreenShareStopMessage(BaseModel):
    type: Literal["screen_share_stop"]


class MediaSlotStubMessage(BaseModel):
    type: Literal["media_slot_stub"]
    slot_type: str
    source_url: str


class BecomeListenerMessage(BaseModel):
    type: Literal["become_listener"]


class JoinStageMessage(BaseModel):
    type: Literal["join_stage"]


IncomingMessage = Annotated[
    Union[
        JoinMessage,
        LeaveMessage,
        ChatSendMessage,
        WebRTCOfferMessage,
        WebRTCAnswerMessage,
        WebRTCIceMessage,
        RaiseHandMessage,
        LowerHandMessage,
        AcceptStageInvitationMessage,
        DeclineStageInvitationMessage,
        LeaveStageMessage,
        InviteToStageMessage,
        RemoveFromStageMessage,
        ScreenShareStartMessage,
        ScreenShareStopMessage,
        MediaSlotStubMessage,
        BecomeListenerMessage,
        JoinStageMessage,
    ],
    Field(discriminator="type"),
]
