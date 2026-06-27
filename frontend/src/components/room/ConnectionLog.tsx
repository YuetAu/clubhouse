"use client";

import { useEffect, useRef, useState } from "react";
import { useSignaling } from "@/contexts/SignalingContext";
import { useRoom } from "@/contexts/RoomContext";
import { useWebRTC } from "@/contexts/WebRTCContext";

interface LogLine {
  id: number;
  text: string;
  done: boolean;
}

export function ConnectionLog() {
  const { wsStatus } = useSignaling();
  const { roomStateReceived, speakers, listeners, viewers, isSpeaker } = useRoom();
  const { localStream, remoteStreams } = useWebRTC();

  const idRef = useRef(1);
  const mk = (text: string, done = false): LogLine => ({ id: idRef.current++, text, done });

  const [lines, setLines] = useState<LogLine[]>([{ id: 0, text: "Connecting to WebSocket server...", done: false }]);
  const [fading, setFading] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Step flags — each fires exactly once
  const f = useRef({ ws: false, room: false, mic: false, peers: false, done: false });

  // Step 1: WebSocket connected
  useEffect(() => {
    if (wsStatus !== "connected" || f.current.ws) return;
    f.current.ws = true;
    setLines(prev => [
      { ...prev[0], done: true, text: "WebSocket connected" },
      mk("Joining room..."),
    ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsStatus]);

  // Step 2: Room state received
  useEffect(() => {
    if (!roomStateReceived || f.current.room) return;
    f.current.room = true;

    const peerCount = isSpeaker ? speakers.length - 1 : speakers.length;

    setLines(prev => {
      const listenerCount = listeners.length + viewers.length;
      const updated = prev.map(l =>
        l.text === "Joining room..."
          ? { ...l, done: true, text: `Room joined — ${speakers.length} speaker${speakers.length !== 1 ? "s" : ""}, ${listenerCount} listener${listenerCount !== 1 ? "s" : ""}` }
          : l
      );
      if (isSpeaker) {
        updated.push(mk("Requesting microphone access..."));
      } else if (peerCount > 0) {
        updated.push(mk(`Connecting to ${peerCount} peer${peerCount > 1 ? "s" : ""} via WebRTC...`));
      }
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomStateReceived]);

  // Step 3a: Microphone ready (speakers only)
  useEffect(() => {
    if (!localStream || !isSpeaker || f.current.mic) return;
    f.current.mic = true;

    setLines(prev => {
      const updated = prev.map(l =>
        l.text === "Requesting microphone access..."
          ? { ...l, done: true, text: "Microphone ready" }
          : l
      );
      const peerCount = speakers.length - 1;
      if (peerCount > 0) {
        updated.push(mk(`Connecting to ${peerCount} peer${peerCount > 1 ? "s" : ""} via WebRTC...`));
      }
      return updated;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localStream]);

  // Step 3b / 4: WebRTC peers established
  useEffect(() => {
    if (remoteStreams.size === 0 || f.current.peers) return;
    f.current.peers = true;

    setLines(prev => prev.map(l =>
      l.text.includes("via WebRTC")
        ? { ...l, done: true, text: `WebRTC connected — ${remoteStreams.size} peer${remoteStreams.size > 1 ? "s" : ""}` }
        : l
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteStreams.size]);

  // Dismiss when all lines are done and nothing more is expected
  useEffect(() => {
    if (!f.current.room || f.current.done) return;
    if (lines.some(l => !l.done)) return;

    const pendingWebRTC = lines.some(l => !l.done && l.text.includes("via WebRTC"));
    if (pendingWebRTC) return;

    f.current.done = true;
    setFading(true);
    const t = setTimeout(() => setDismissed(true), 700);
    return () => clearTimeout(t);
  }, [lines]);

  // Hard fallback: dismiss 6s after room state received
  useEffect(() => {
    if (!roomStateReceived) return;
    const t = setTimeout(() => setDismissed(true), 6000);
    return () => clearTimeout(t);
  }, [roomStateReceived]);

  if (dismissed) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.87)",
        backdropFilter: "blur(6px)",
        transition: "opacity 0.7s ease",
        opacity: fading ? 0 : 1,
      }}
    >
      <div className="flex flex-col items-start gap-3">
        {/* Spinner */}
        <div
          className="w-5 h-5 rounded-full border-2 animate-spin self-center mb-1"
          style={{ borderColor: "rgba(255,255,255,0.15)", borderTopColor: "rgba(255,255,255,0.6)" }}
        />

        {/* Log lines */}
        <div
          className="space-y-1.5"
          style={{ fontFamily: '"SF Mono","Fira Code","Cascadia Code","Courier New",monospace', fontSize: "0.78rem" }}
        >
          {lines.map(line => (
            <div key={line.id} className="flex items-baseline gap-2 leading-snug">
              <span
                className="shrink-0"
                style={{ color: line.done ? "#28c840" : "rgba(255,255,255,0.35)", width: "1em", textAlign: "center" }}
              >
                {line.done ? "✓" : "·"}
              </span>
              <span style={{ color: line.done ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.75)" }}>
                {line.text}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
