"use client";

import { createContext, useCallback, useContext, useEffect, useReducer } from "react";
import { useSignaling } from "./SignalingContext";
import type { Participant, RoomRole } from "@/types/room";
import type {
  HandLoweredMsg, HandRaisedMsg, ParticipantJoinedMsg, ParticipantKickedMsg,
  ParticipantLeftMsg, ParticipantMutedMsg, RoomStateMsg, SpeakerJoinedMsg, SpeakerLeftMsg,
  ViewerBecameListenerMsg,
} from "@/types/signaling";

interface RoomState {
  speakers: Participant[];
  listeners: Participant[];
  viewers: Participant[];
  handsRaised: Set<string>;
  myPeerId: string | null;
  roomStateReceived: boolean;
}

type Action =
  | { type: "SET_STATE"; payload: { speakers: Participant[]; listeners: Participant[]; viewers: Participant[]; hands_raised: string[] } }
  | { type: "PARTICIPANT_JOINED"; participant: Participant }
  | { type: "PARTICIPANT_LEFT"; peer_id: string }
  | { type: "PARTICIPANT_MUTED"; peer_id: string }
  | { type: "PARTICIPANT_KICKED"; peer_id: string }
  | { type: "HAND_RAISED"; peer_id: string }
  | { type: "HAND_LOWERED"; peer_id: string }
  | { type: "SPEAKER_JOINED"; peer_id: string; participant: Participant }
  | { type: "SPEAKER_LEFT"; peer_id: string }
  | { type: "VIEWER_BECAME_LISTENER"; peer_id: string; participant: Participant }
  | { type: "SET_MY_PEER_ID"; peer_id: string };

function reducer(state: RoomState, action: Action): RoomState {
  switch (action.type) {
    case "SET_STATE":
      return {
        ...state,
        speakers: action.payload.speakers,
        listeners: action.payload.listeners,
        viewers: action.payload.viewers ?? [],
        handsRaised: new Set(action.payload.hands_raised),
        roomStateReceived: true,
      };
    case "PARTICIPANT_JOINED":
      if (action.participant.role === "viewer") {
        return { ...state, viewers: [...state.viewers, action.participant] };
      }
      if (action.participant.role === "listener") {
        return { ...state, listeners: [...state.listeners, action.participant] };
      }
      return { ...state, speakers: [...state.speakers, action.participant] };
    case "PARTICIPANT_LEFT":
    case "PARTICIPANT_KICKED":
      return {
        ...state,
        speakers: state.speakers.filter((p) => p.peer_id !== action.peer_id),
        listeners: state.listeners.filter((p) => p.peer_id !== action.peer_id),
        viewers: state.viewers.filter((p) => p.peer_id !== action.peer_id),
      };
    case "PARTICIPANT_MUTED":
      return {
        ...state,
        speakers: state.speakers.map((p) => p.peer_id === action.peer_id ? { ...p, is_muted: true } : p),
      };
    case "HAND_RAISED":
      return { ...state, handsRaised: new Set([...state.handsRaised, action.peer_id]) };
    case "HAND_LOWERED": {
      const s = new Set(state.handsRaised);
      s.delete(action.peer_id);
      return { ...state, handsRaised: s };
    }
    case "SPEAKER_JOINED": {
      const listeners = state.listeners.filter((p) => p.peer_id !== action.peer_id);
      const viewers = state.viewers.filter((p) => p.peer_id !== action.peer_id);
      const existing = state.speakers.find((p) => p.peer_id === action.peer_id);
      const speakers = existing
        ? state.speakers.map((p) => p.peer_id === action.peer_id ? action.participant : p)
        : [...state.speakers, action.participant];
      return { ...state, speakers, listeners, viewers };
    }
    case "SPEAKER_LEFT": {
      const speaker = state.speakers.find((p) => p.peer_id === action.peer_id);
      const speakers = state.speakers.filter((p) => p.peer_id !== action.peer_id);
      const listeners = speaker ? [...state.listeners, { ...speaker, role: "listener" as RoomRole }] : state.listeners;
      return { ...state, speakers, listeners };
    }
    case "VIEWER_BECAME_LISTENER": {
      const viewers = state.viewers.filter((p) => p.peer_id !== action.peer_id);
      const existing = state.listeners.find((p) => p.peer_id === action.peer_id);
      const listeners = existing ? state.listeners : [...state.listeners, action.participant];
      return { ...state, viewers, listeners };
    }
    case "SET_MY_PEER_ID":
      return { ...state, myPeerId: action.peer_id };
    default:
      return state;
  }
}

interface RoomCtx extends RoomState {
  myRole: RoomRole | null;
  isHost: boolean;
  isSpeaker: boolean;
  isViewer: boolean;
  // roomStateReceived is inherited from RoomState
}

const Ctx = createContext<RoomCtx | null>(null);

export function RoomProvider({ myPeerId, children }: { myPeerId: string; children: React.ReactNode }) {
  const { on } = useSignaling();
  const [state, dispatch] = useReducer(reducer, {
    speakers: [],
    listeners: [],
    viewers: [],
    handsRaised: new Set<string>(),
    myPeerId,
    roomStateReceived: false,
  });

  useEffect(() => {
    console.log(`[Room] myPeerId set to ${myPeerId}`);
    dispatch({ type: "SET_MY_PEER_ID", peer_id: myPeerId });
  }, [myPeerId]);

  useEffect(() => {
    const unsubs = [
      on("room_state", (m) => {
        const msg = m as RoomStateMsg;
        console.log(`[Room] room_state received — speakers=${msg.speakers?.length ?? 0} listeners=${msg.listeners?.length ?? 0} viewers=${msg.viewers?.length ?? 0} hands_raised=${msg.hands_raised?.length ?? 0}`);
        dispatch({ type: "SET_STATE", payload: msg });
      }),
      on("participant_joined", (m) => {
        const { participant } = m as ParticipantJoinedMsg;
        console.log(`[Room] participant_joined peer=${participant.peer_id} role=${participant.role} name="${participant.display_name}"`);
        dispatch({ type: "PARTICIPANT_JOINED", participant });
      }),
      on("participant_left", (m) => {
        const { peer_id } = m as ParticipantLeftMsg;
        console.log(`[Room] participant_left peer=${peer_id}`);
        dispatch({ type: "PARTICIPANT_LEFT", peer_id });
      }),
      on("participant_muted", (m) => dispatch({ type: "PARTICIPANT_MUTED", peer_id: (m as ParticipantMutedMsg).peer_id })),
      on("participant_kicked", (m) => {
        const { peer_id } = m as ParticipantKickedMsg;
        console.log(`[Room] participant_kicked peer=${peer_id}`);
        dispatch({ type: "PARTICIPANT_KICKED", peer_id });
      }),
      on("hand_raised", (m) => dispatch({ type: "HAND_RAISED", peer_id: (m as HandRaisedMsg).peer_id })),
      on("hand_lowered", (m) => dispatch({ type: "HAND_LOWERED", peer_id: (m as HandLoweredMsg).peer_id })),
      on("speaker_joined", (m) => {
        const msg = m as SpeakerJoinedMsg;
        console.log(`[Room] speaker_joined peer=${msg.peer_id} name="${msg.participant.display_name}"`);
        dispatch({ type: "SPEAKER_JOINED", peer_id: msg.peer_id, participant: msg.participant });
      }),
      on("speaker_left", (m) => {
        const { peer_id } = (m as SpeakerLeftMsg);
        console.log(`[Room] speaker_left peer=${peer_id}`);
        dispatch({ type: "SPEAKER_LEFT", peer_id });
      }),
      on("viewer_became_listener", (m) => {
        const msg = m as ViewerBecameListenerMsg;
        console.log(`[Room] viewer_became_listener peer=${msg.peer_id} name="${msg.participant.display_name}"`);
        dispatch({ type: "VIEWER_BECAME_LISTENER", peer_id: msg.peer_id, participant: msg.participant });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, [on]);

  const myParticipant =
    state.speakers.find((p) => p.peer_id === myPeerId) ??
    state.listeners.find((p) => p.peer_id === myPeerId) ??
    state.viewers.find((p) => p.peer_id === myPeerId);

  const myRole = myParticipant?.role ?? null;

  const isHost = myParticipant?.is_host ?? false;

  return (
    <Ctx.Provider value={{
      ...state,
      myRole,
      isHost,
      isSpeaker: myRole === "speaker",
      isViewer: myRole === "viewer",
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRoom() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useRoom must be used within RoomProvider");
  return ctx;
}
