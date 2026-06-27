"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getRoomSocket, closeRoomSocket } from "@/lib/ws";
import type { ClientMessage, ServerMessage } from "@/types/signaling";

type Handler = (msg: ServerMessage) => void;

interface SignalingCtx {
  send: (msg: ClientMessage) => void;
  on: (type: string, handler: Handler) => () => void;
  wsStatus: "connecting" | "connected";
}

const Ctx = createContext<SignalingCtx | null>(null);

export function SignalingProvider({
  roomId,
  password,
  children,
}: {
  roomId: string;
  password?: string;
  children: React.ReactNode;
}) {
  const handlersRef = useRef<Map<string, Set<Handler>>>(new Map());
  const [wsStatus, setWsStatus] = useState<"connecting" | "connected">("connecting");

  useEffect(() => {
    console.log(`[Signaling] mounting room=${roomId}`);
    const socket = getRoomSocket(roomId, password);
    let joined = false;

    const unsubOpen = socket.onOpen(() => {
      console.log(`[Signaling] WS open → status=connected room=${roomId}`);
      setWsStatus("connected");
      console.log(`[Signaling] sending join room=${roomId}`);
      socket.send({ type: "join" });
      joined = true;
    });
    const unsub = socket.onMessage((msg) => {
      const set = handlersRef.current.get(msg.type);
      set?.forEach((h) => h(msg));
      // also call "*" handlers
      handlersRef.current.get("*")?.forEach((h) => h(msg));
    });

    return () => {
      console.log(`[Signaling] unmounting room=${roomId}`);
      unsubOpen();
      unsub();
      if (joined) {
        console.log(`[Signaling] sending leave room=${roomId}`);
        socket.send({ type: "leave" });
      }
      closeRoomSocket(roomId);
    };
  }, [roomId]);

  const send = useCallback((msg: ClientMessage) => {
    getRoomSocket(roomId, password).send(msg);
  }, [roomId, password]);

  const on = useCallback((type: string, handler: Handler) => {
    if (!handlersRef.current.has(type)) {
      handlersRef.current.set(type, new Set());
    }
    handlersRef.current.get(type)!.add(handler);
    return () => handlersRef.current.get(type)?.delete(handler);
  }, []);

  return <Ctx.Provider value={{ send, on, wsStatus }}>{children}</Ctx.Provider>;
}

export function useSignaling() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useSignaling must be used within SignalingProvider");
  return ctx;
}
