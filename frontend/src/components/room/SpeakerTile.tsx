"use client";

import { useEffect, useRef } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useAudioLevel } from "@/hooks/useAudioLevel";
import { useWebRTC } from "@/contexts/WebRTCContext";
import { clsx } from "clsx";
import type { Participant } from "@/types/room";

interface Props {
  participant: Participant;
  stream?: MediaStream;
  isLocal?: boolean;
  onContextMenu?: (participant: Participant, x: number, y: number) => void;
}

export function SpeakerTile({ participant, stream, isLocal, onContextMenu }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const isSpeaking = useAudioLevel(stream, participant.is_muted);
  const { pings } = useWebRTC();
  const ping = pings.get(participant.peer_id);

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isLocal || !onContextMenu) return;
    e.preventDefault();
    onContextMenu(participant, e.clientX, e.clientY);
  };

  useEffect(() => {
    if (audioRef.current && stream && !isLocal) {
      audioRef.current.srcObject = stream;
    }
  }, [stream, isLocal]);

  return (
    <div
      onContextMenu={handleContextMenu}
      className={clsx(
        "flex flex-col items-center gap-2 p-4 rounded-2xl bg-white border transition-all shadow-sm",
        !isLocal && onContextMenu && "cursor-pointer",
        isSpeaking
          ? "border-[#00C853] shadow-[0_0_0_2px_rgba(0,200,83,0.15)]"
          : participant.is_muted
          ? "border-stone-100 opacity-70"
          : "border-stone-200"
      )}
    >
      <div className="relative">
        {isSpeaking && (
          <span className="absolute inset-0 rounded-full animate-ping bg-[#00C853] opacity-20 scale-110" />
        )}
        <Avatar src={participant.avatar_url} name={participant.display_name} size={64} />
        {participant.is_host && (
          <span className="absolute -bottom-1 -right-1 text-sm">👑</span>
        )}
        {participant.is_muted && (
          <span className="absolute -bottom-1 -left-1 text-sm">🔇</span>
        )}
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold text-stone-900 truncate max-w-[100px]">
          {participant.display_name}
          {isLocal && <span className="text-xs text-stone-400 font-normal ml-1">(you)</span>}
        </p>
        <div className="flex items-center justify-center gap-1 mt-0.5">
          {participant.is_verified ? (
            <Badge variant="verified" />
          ) : (
            <Badge variant="anon" />
          )}
        </div>
      </div>

      {!isLocal && ping !== null && (
        <div className="text-xs text-stone-400">
          {ping}ms
        </div>
      )}

      {stream && !isLocal && (
        <audio ref={audioRef} autoPlay playsInline className="hidden" />
      )}
    </div>
  );
}
