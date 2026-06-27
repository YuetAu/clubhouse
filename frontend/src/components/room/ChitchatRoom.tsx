"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRoom } from "@/contexts/RoomContext";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { Avatar } from "@/components/ui/Avatar";
import { ScreenSharePreview } from "./ScreenSharePreview";
import { ParticipantContextMenu, type ContextMenuAction } from "./ParticipantContextMenu";
import { muteParticipant, unmuteParticipant, kickParticipant, banParticipant } from "@/lib/api";
import type { Participant } from "@/types/room";

interface Props {
  myPeerId: string;
  roomId: string;
}

interface MenuState {
  participant: Participant;
  x: number;
  y: number;
}

function ChitchatTile({
  participant,
  stream,
  isLocal,
  hasVideo,
  youLabel,
  isHost,
  onContextMenu,
}: {
  participant: Participant;
  stream?: MediaStream;
  isLocal?: boolean;
  hasVideo?: boolean;
  youLabel: string;
  isHost: boolean;
  onContextMenu?: (participant: Participant, x: number, y: number) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isSpeaking = useAudioLevel(stream, participant.is_muted);

  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, isLocal]);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isLocal || !onContextMenu || !isHost) return;
    e.preventDefault();
    onContextMenu(participant, e.clientX, e.clientY);
  };

  return (
    <div
      onContextMenu={handleContextMenu}
      className="relative rounded-xl overflow-hidden cursor-default transition-all"
      style={{
        aspectRatio: "16 / 9",
        background: "var(--night-card)",
        border: isSpeaking ? "2px solid var(--night-speaking)" : "2px solid var(--night-border)",
        boxShadow: isSpeaking ? "0 0 20px rgba(0,200,83,0.25)" : "none",
        opacity: participant.is_muted && !isSpeaking ? 0.75 : 1,
      }}
    >
      {/* Video — always mounted so srcObject survives mute/unmute cycles */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ display: hasVideo ? "block" : "none" }}
      />

      {/* Avatar shown when camera is off */}
      {!hasVideo && (
        <div className="absolute inset-0 flex items-center justify-center">
          {isSpeaking && (
            <span
              className="absolute rounded-full animate-ping opacity-20"
              style={{ background: "var(--night-speaking)", inset: "20%" }}
            />
          )}
          <Avatar src={participant.avatar_url} name={participant.display_name} size={64} />
        </div>
      )}

      {/* Bottom gradient + name / badges */}
      <div
        className="absolute bottom-0 left-0 right-0 flex items-end justify-between px-2 py-1.5 gap-1"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-1">
          {participant.is_muted && <span className="text-xs leading-none">🔇</span>}
        </div>
        <span className="text-xs font-medium text-white truncate max-w-[75%] text-right drop-shadow">
          {participant.display_name}
          {isLocal && <span className="opacity-60"> {youLabel}</span>}
          {participant.is_host && <span className="ml-1">👑</span>}
        </span>
      </div>

      {stream && !isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}
    </div>
  );
}

export function ChitchatRoom({ myPeerId, roomId }: Props) {
  const { speakers, isHost } = useRoom();
  const { localStream, remoteStreams, remoteScreenStreams, screenSharingPeerIds, localScreenStream, camEnabled } = useWebRTC();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const t = useTranslations("Chitchat");
  const tStage = useTranslations("Stage");

  const openMenu = useCallback((participant: Participant, x: number, y: number) => {
    setMenu({ participant, x, y });
  }, []);

  const buildActions = (participant: Participant): ContextMenuAction[] => {
    if (!isHost) return [];
    const actions: ContextMenuAction[] = [];
    if (participant.is_muted) {
      actions.push({
        label: tStage("unmute"),
        icon: "🎤",
        onClick: () => unmuteParticipant(roomId, participant.peer_id).catch(() => {}),
      });
    } else {
      actions.push({
        label: tStage("mute"),
        icon: "🔇",
        onClick: () => muteParticipant(roomId, participant.peer_id).catch(() => {}),
      });
    }
    actions.push({
      label: tStage("kick"),
      icon: "👢",
      danger: true,
      onClick: () => kickParticipant(roomId, participant.peer_id).catch(() => {}),
    });
    actions.push({
      label: tStage("ban"),
      icon: "🚫",
      danger: true,
      onClick: () => banParticipant(roomId, participant.peer_id).catch(() => {}),
    });
    return actions;
  };

  const screenShares = [...screenSharingPeerIds]
    .map((peerId) => ({
      peerId,
      stream: peerId === myPeerId ? localScreenStream : (remoteScreenStreams.get(peerId) ?? null),
      sharerName: speakers.find((s) => s.peer_id === peerId)?.display_name ?? "",
    }))
    .filter((s) => s.stream != null);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-y-auto px-4 py-4">
      {speakers.length === 0 ? (
        <div className="text-xs py-4" style={{ color: "var(--night-muted)" }}>
          {t("noOne")}
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          }}
        >
          {speakers.map((speaker) => (
            <ChitchatTile
              key={speaker.peer_id}
              participant={speaker}
              stream={
                speaker.peer_id === myPeerId
                  ? localStream ?? undefined
                  : remoteStreams.get(speaker.peer_id)
              }
              isLocal={speaker.peer_id === myPeerId}
              hasVideo={
                speaker.peer_id === myPeerId
                  ? camEnabled
                  : remoteStreams.get(speaker.peer_id)?.getVideoTracks().some((t) => t.readyState === "live") ?? false
              }
              youLabel={tStage("you")}
              isHost={isHost}
              onContextMenu={isHost ? openMenu : undefined}
            />
          ))}
        </div>
      )}

      {screenShares.length > 0 && (
        <div className="mt-4 flex flex-col gap-3">
          {screenShares.map(({ peerId, stream, sharerName }) => (
            <ScreenSharePreview key={peerId} stream={stream!} sharerName={sharerName} />
          ))}
        </div>
      )}

      {menu && (
        <ParticipantContextMenu
          participant={menu.participant}
          x={menu.x}
          y={menu.y}
          actions={buildActions(menu.participant)}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
