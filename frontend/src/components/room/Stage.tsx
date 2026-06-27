"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRoom } from "@/contexts/RoomContext";
import { useSignaling } from "@/contexts/SignalingContext";
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

function SpeakerChip({
  participant,
  stream,
  isLocal,
  hasVideo,
  youLabel,
  onContextMenu,
}: {
  participant: Participant;
  stream?: MediaStream;
  isLocal?: boolean;
  hasVideo?: boolean;
  youLabel: string;
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
    if (isLocal || !onContextMenu) return;
    e.preventDefault();
    onContextMenu(participant, e.clientX, e.clientY);
  };

  if (hasVideo) {
    return (
      <div
        onContextMenu={handleContextMenu}
        className="relative rounded-xl overflow-hidden cursor-default flex-shrink-0 transition-all"
        style={{
          width: 180,
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
        />
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

  return (
    <div
      onContextMenu={handleContextMenu}
      className="flex flex-col items-center gap-1.5 cursor-default flex-shrink-0"
      title={participant.display_name}
    >
      {/* Video always mounted even in chip mode so srcObject survives toggle */}
      <video ref={videoRef} autoPlay playsInline muted={isLocal} className="hidden" />

      <div className="relative">
        {isSpeaking && (
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-30"
            style={{ background: "var(--night-speaking)", transform: "scale(1.15)" }}
          />
        )}
        <div
          className="rounded-full transition-all overflow-hidden"
          style={{
            boxShadow: isSpeaking
              ? "0 0 0 2px var(--night-speaking)"
              : participant.is_muted
              ? "0 0 0 2px rgba(138,136,152,0.2)"
              : "0 0 0 2px rgba(255,255,255,0.06)",
            opacity: participant.is_muted && !isSpeaking ? 0.55 : 1,
            width: 48,
            height: 48,
          }}
        >
          <Avatar src={participant.avatar_url} name={participant.display_name} size={48} />
        </div>
        {participant.is_host && (
          <span className="absolute -bottom-1 -right-1 text-xs leading-none">👑</span>
        )}
        {participant.is_muted && (
          <span className="absolute -bottom-1 -left-1 text-xs leading-none">🔇</span>
        )}
      </div>

      <span
        className="text-xs max-w-[56px] truncate text-center"
        style={{ color: "var(--night-muted)" }}
      >
        {participant.display_name}
        {isLocal && youLabel}
      </span>

      {stream && !isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}
    </div>
  );
}

export function Stage({ myPeerId, roomId }: Props) {
  const { speakers, isHost } = useRoom();
  const { send } = useSignaling();
  const { localStream, remoteStreams, remoteScreenStreams, screenSharingPeerIds, localScreenStream, camEnabled } = useWebRTC();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const t = useTranslations("Stage");

  const openMenu = useCallback((participant: Participant, x: number, y: number) => {
    setMenu({ participant, x, y });
  }, []);

  const buildActions = (participant: Participant): ContextMenuAction[] => {
    if (!isHost) return [];
    const actions: ContextMenuAction[] = [];

    if (participant.is_muted) {
      actions.push({
        label: t("unmute"),
        icon: "🎤",
        onClick: () => unmuteParticipant(roomId, participant.peer_id).catch(() => {}),
      });
    } else {
      actions.push({
        label: t("mute"),
        icon: "🔇",
        onClick: () => muteParticipant(roomId, participant.peer_id).catch(() => {}),
      });
    }
    actions.push({
      label: t("removeFromStage"),
      icon: "⬇️",
      onClick: () => send({ type: "remove_from_stage", target_peer_id: participant.peer_id }),
    });
    actions.push({
      label: t("kick"),
      icon: "👢",
      danger: true,
      onClick: () => kickParticipant(roomId, participant.peer_id).catch(() => {}),
    });
    actions.push({
      label: t("ban"),
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

  if (speakers.length === 0) {
    return (
      <div className="px-4 py-3 text-xs" style={{ color: "var(--night-muted)" }}>
        {t("noOne")}
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-3 flex items-start gap-4 overflow-x-auto">
        {speakers.map((speaker) => (
          <SpeakerChip
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
            youLabel={t("you")}
            onContextMenu={isHost ? openMenu : undefined}
          />
        ))}
      </div>

      {screenShares.length > 0 && (
        <div className="flex flex-col gap-3 px-4 pb-3">
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
    </>
  );
}
