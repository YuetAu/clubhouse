import type { Participant } from "./room";

// ─── Client → Server ──────────────────────────────────────────────────────────
export type JoinMsg = { type: "join" };
export type LeaveMsg = { type: "leave" };
export type ChatSendMsg = { type: "chat_send"; content: string };
export type WebRTCOfferMsg = { type: "webrtc_offer"; target_peer_id: string; sdp: string };
export type WebRTCAnswerMsg = { type: "webrtc_answer"; target_peer_id: string; sdp: string };
export type WebRTCIceMsg = { type: "webrtc_ice"; target_peer_id: string; candidate: RTCIceCandidateInit };
export type RaiseHandMsg = { type: "raise_hand" };
export type LowerHandMsg = { type: "lower_hand" };
export type AcceptInvitationMsg = { type: "accept_stage_invitation" };
export type DeclineInvitationMsg = { type: "decline_stage_invitation" };
export type LeaveStageMsg = { type: "leave_stage" };
export type InviteToStageMsg = { type: "invite_to_stage"; target_peer_id: string };
export type RemoveFromStageMsg = { type: "remove_from_stage"; target_peer_id: string };
export type ScreenShareStartMsg = { type: "screen_share_start" };
export type ScreenShareStopMsg = { type: "screen_share_stop" };
export type MediaSlotStubMsg = { type: "media_slot_stub"; slot_type: string; source_url: string };
export type BecomeListenerMsg = { type: "become_listener" };
export type JoinStageMsg = { type: "join_stage" };

export type ClientMessage =
  | JoinMsg | LeaveMsg | ChatSendMsg
  | WebRTCOfferMsg | WebRTCAnswerMsg | WebRTCIceMsg
  | RaiseHandMsg | LowerHandMsg
  | AcceptInvitationMsg | DeclineInvitationMsg | LeaveStageMsg
  | InviteToStageMsg | RemoveFromStageMsg
  | ScreenShareStartMsg | ScreenShareStopMsg
  | MediaSlotStubMsg | BecomeListenerMsg | JoinStageMsg;

// ─── Server → Client ──────────────────────────────────────────────────────────
export type RoomStateMsg = {
  type: "room_state";
  speakers: Participant[];
  listeners: Participant[];
  viewers: Participant[];
  hands_raised: string[];
  screen_sharing_peer_ids?: string[];
};
export type ParticipantJoinedMsg = { type: "participant_joined"; participant: Participant };
export type ParticipantLeftMsg = { type: "participant_left"; peer_id: string };
export type ParticipantMutedMsg = { type: "participant_muted"; peer_id: string; muted_by: string };
export type ParticipantKickedMsg = { type: "participant_kicked"; peer_id: string };
export type HandRaisedMsg = { type: "hand_raised"; peer_id: string };
export type HandLoweredMsg = { type: "hand_lowered"; peer_id: string };
export type StageInvitationMsg = { type: "stage_invitation"; from_peer_id: string };
export type SpeakerJoinedMsg = { type: "speaker_joined"; peer_id: string; participant: Participant };
export type SpeakerLeftMsg = { type: "speaker_left"; peer_id: string };
export type ViewerBecameListenerMsg = { type: "viewer_became_listener"; peer_id: string; participant: Participant };
export type ChatMessageMsg = {
  type: "chat_message";
  message_id: string;
  author_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  is_anon: boolean;
  content: string;
  created_at: string;
};
export type ChatDeletedMsg = { type: "chat_deleted"; message_id: string; deleted_by: string };
export type WebRTCOfferFromMsg = { type: "webrtc_offer"; from_peer_id: string; sdp: string };
export type WebRTCAnswerFromMsg = { type: "webrtc_answer"; from_peer_id: string; sdp: string };
export type WebRTCIceFromMsg = { type: "webrtc_ice"; from_peer_id: string; candidate: RTCIceCandidateInit };
export type ScreenShareStartFromMsg = { type: "screen_share_start"; peer_id: string };
export type ScreenShareStopFromMsg = { type: "screen_share_stop"; peer_id: string };
export type ErrorMsg = { type: "error"; code: string; message: string };

export type ServerMessage =
  | RoomStateMsg | ParticipantJoinedMsg | ParticipantLeftMsg
  | ParticipantMutedMsg | ParticipantKickedMsg
  | HandRaisedMsg | HandLoweredMsg | StageInvitationMsg
  | SpeakerJoinedMsg | SpeakerLeftMsg | ViewerBecameListenerMsg
  | ChatMessageMsg | ChatDeletedMsg
  | WebRTCOfferFromMsg | WebRTCAnswerFromMsg | WebRTCIceFromMsg
  | ScreenShareStartFromMsg | ScreenShareStopFromMsg
  | ErrorMsg;
