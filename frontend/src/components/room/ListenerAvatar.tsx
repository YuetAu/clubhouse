"use client";

import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { useWebRTC } from "@/contexts/WebRTCContext";
import type { Participant } from "@/types/room";

interface Props {
  participant: Participant;
  myPeerId?: string;
  isViewer?: boolean;
  onContextMenu?: (participant: Participant, x: number, y: number) => void;
}

export function ListenerAvatar({ participant, myPeerId, isViewer, onContextMenu }: Props) {
  const { pings } = useWebRTC();
  const ping = pings.get(participant.peer_id);
  const isLocal = participant.peer_id === myPeerId;

  const handleContextMenu = (e: React.MouseEvent) => {
    if (isLocal || !onContextMenu) return;
    e.preventDefault();
    onContextMenu(participant, e.clientX, e.clientY);
  };

  return (
    <div
      className="flex flex-col items-center gap-1 relative cursor-pointer"
      onContextMenu={handleContextMenu}
    >
      <div className="relative">
        <Avatar src={participant.avatar_url} name={participant.display_name} size={40} />
        {participant.has_raised_hand && (
          <span className="absolute -top-1 -right-1 text-base">✋</span>
        )}
      </div>
      <p className="text-xs text-stone-500 truncate max-w-[60px]">{participant.display_name}</p>
      <div className="flex items-center gap-1">
        {participant.is_verified && <Badge variant="verified" className="scale-75" />}
        {!isLocal && !isViewer && ping !== null && (
          <span className="text-xs text-stone-400">{ping}ms</span>
        )}
      </div>
    </div>
  );
}
