"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRoom, updateRoom } from "@/lib/api";
import { useRoom } from "@/contexts/RoomContext";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { Stage } from "@/components/room/Stage";
import { Audience } from "@/components/room/Audience";
import { ChitchatRoom } from "@/components/room/ChitchatRoom";
import { ControlBar } from "@/components/room/ControlBar";
import { HandRaisedBanner } from "@/components/room/HandRaisedBanner";
import { StageInviteToast } from "@/components/room/StageInviteToast";
import { RoomEditPanel } from "@/components/room/RoomEditPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { useIdentity } from "@/hooks/useIdentity";
import { useTranslations } from "next-intl";

export default function RoomPage() {
  const params = useParams();
  const roomId = params.roomId as string;
  const identity = useIdentity();
  const myPeerId = identity.type === "oauth" || identity.type === "anon" ? identity.peerId : "";

  const queryClient = useQueryClient();
  const { isSpeaker, myRole, listeners, viewers, speakers } = useRoom();
  const { startLocalMedia } = useWebRTC();
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [makingPublic, setMakingPublic] = useState(false);
  const t = useTranslations("RoomPage");

  const { data: room } = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => getRoom(roomId),
  });

  const isHost = (identity.type === "oauth" || identity.type === "anon") && room?.owner_id === identity.peerId;
  const isChitchat = room?.room_type === "chitchat";

  const handleMakePublic = async () => {
    if (!room) return;
    setMakingPublic(true);
    try {
      await updateRoom(room.id, { is_temporary: false });
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } finally {
      setMakingPublic(false);
    }
  };
  const listenerCount = isChitchat ? 0 : listeners.length + viewers.length;
  const participantCount = isChitchat ? speakers.length : listeners.length + viewers.length;

  useEffect(() => {
    if (isSpeaker) {
      startLocalMedia().catch(() => {});
    }
  }, [isSpeaker, startLocalMedia]);

  return (
    <div className="h-screen flex flex-col" style={{ background: "var(--night-bg)", color: "var(--night-text)" }}>
      {/* Header */}
      <header
        className="px-4 py-3 flex items-center gap-3 shrink-0"
        style={{ borderBottom: "1px solid var(--night-border)", background: "var(--night-card)", backdropFilter: "blur(12px)" }}
      >
        <Link href="/" className="text-sm transition-colors shrink-0" style={{ color: "var(--night-muted)" }}>
          {t("back")}
        </Link>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold truncate" style={{ color: "var(--night-text)" }}>
              {room?.title ?? t("loading")}
            </h1>
            {room?.is_temporary && isHost && (
              <span className="shrink-0 px-2 py-0.5 text-xs rounded-full font-medium" style={{ background: "rgba(245,158,11,0.1)", color: "var(--night-warm)" }}>
                {t("draft")}
              </span>
            )}
          </div>
          {room?.topic_tags && room.topic_tags.length > 0 && (
            <div className="flex gap-1 mt-0.5">
              {room.topic_tags.slice(0, 3).map((tag) => (
                <span key={tag} className="px-1.5 py-0.5 text-xs rounded-full" style={{ background: "var(--night-raised)", color: "var(--night-muted)" }}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {participantCount > 0 && (
            <span className="text-xs" style={{ color: "var(--night-muted)" }}>
              {isChitchat
                ? t("chatting", { count: participantCount })
                : t("listening", { count: listenerCount })}
            </span>
          )}
          {isHost && room?.is_temporary && (
            <button
              onClick={handleMakePublic}
              disabled={makingPublic}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              style={{ background: "rgba(0,200,83,0.12)", color: "var(--night-speaking)", border: "1px solid rgba(0,200,83,0.3)" }}
            >
              {makingPublic ? "…" : t("makePublic")}
            </button>
          )}
          {isHost && room && (
            <button
              onClick={() => setShowEditPanel(true)}
              className="text-xs px-2.5 py-1.5 rounded-lg transition-colors font-medium"
              style={{ background: "var(--night-raised)", color: "var(--night-muted)" }}
            >
              {room.is_temporary ? t("setUp") : t("edit")}
            </button>
          )}
          <div className="flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--night-warm)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--night-warm)" }} />
            {t("live")}
          </div>
        </div>
      </header>

      {isChitchat ? (
        /* Chitchat: grid of speakers + chat side by side (or stacked on small screens) */
        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          <ChitchatRoom myPeerId={myPeerId} roomId={roomId} />
          <div
            className="md:w-80 shrink-0 flex flex-col min-h-0"
            style={{ borderLeft: "1px solid var(--night-border)" }}
          >
            <ChatPanel roomId={roomId} myPeerId={myPeerId} />
          </div>
        </div>
      ) : (
        <>
          {/* Stage: speaker strip + host audience controls */}
          <div className="shrink-0" style={{ borderBottom: "1px solid var(--night-border)" }}>
            <HandRaisedBanner />
            <Stage myPeerId={myPeerId} roomId={roomId} />
            <Audience myPeerId={myPeerId} roomId={roomId} />
          </div>

          {/* Chat — fills remaining space */}
          <div className="flex-1 min-h-0">
            <ChatPanel roomId={roomId} myPeerId={myPeerId} />
          </div>
        </>
      )}

      {/* Floating control bar */}
      <ControlBar roomId={roomId} myPeerId={myPeerId} isChitchat={isChitchat} />

      {!isChitchat && <StageInviteToast />}

      {room && (
        <RoomEditPanel
          open={showEditPanel}
          onClose={() => setShowEditPanel(false)}
          room={room}
        />
      )}
    </div>
  );
}
