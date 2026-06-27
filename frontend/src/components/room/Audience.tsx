"use client";

import { useCallback, useState } from "react";
import { useRoom } from "@/contexts/RoomContext";
import { useSignaling } from "@/contexts/SignalingContext";
import { ListenerAvatar } from "./ListenerAvatar";
import { ParticipantContextMenu, type ContextMenuAction } from "./ParticipantContextMenu";
import { useTranslations } from "next-intl";
import { kickParticipant, banParticipant } from "@/lib/api";
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

export function Audience({ myPeerId, roomId }: Props) {
  const { listeners, viewers, isHost } = useRoom();
  const { send } = useSignaling();
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [expanded, setExpanded] = useState(false);
  const t = useTranslations("Audience");

  const openMenu = useCallback((participant: Participant, x: number, y: number) => {
    setMenu({ participant, x, y });
  }, []);

  const buildActions = (participant: Participant): ContextMenuAction[] => {
    if (!isHost) return [];
    return [
      { label: t("inviteToStage"), icon: "🎙️", onClick: () => send({ type: "invite_to_stage", target_peer_id: participant.peer_id }) },
      { label: t("kick"), icon: "👢", danger: true, onClick: () => kickParticipant(roomId, participant.peer_id).catch(() => {}) },
      { label: t("ban"), icon: "🚫", danger: true, onClick: () => banParticipant(roomId, participant.peer_id).catch(() => {}) },
    ];
  };

  const all = [...listeners, ...viewers];
  if (all.length === 0) return null;

  // Non-host: audience is shown as a count in the room header — render nothing here
  if (!isHost) return null;

  // Host: show a minimal collapsible row for moderation
  return (
    <>
      <div className="px-4 py-2 border-t" style={{ borderColor: "var(--night-border)" }}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-2 text-xs transition-colors"
          style={{ color: "var(--night-muted)" }}
        >
          <span>{t("inTheRoom", { count: all.length })}</span>
          <span className="text-[10px]">{expanded ? "▲" : "▼"}</span>
        </button>

        {expanded && (
          <div className="flex flex-wrap gap-3 mt-3">
            {all.map((p) => (
              <ListenerAvatar
                key={p.peer_id}
                participant={p}
                myPeerId={myPeerId}
                isViewer={viewers.some((v) => v.peer_id === p.peer_id)}
                onContextMenu={openMenu}
              />
            ))}
          </div>
        )}
      </div>

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
