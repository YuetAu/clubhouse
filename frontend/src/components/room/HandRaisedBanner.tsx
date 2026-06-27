"use client";

import { useTranslations } from "next-intl";
import { useRoom } from "@/contexts/RoomContext";
import { useSignaling } from "@/contexts/SignalingContext";

export function HandRaisedBanner() {
  const { handsRaised, listeners, viewers, isHost, isSpeaker } = useRoom();
  const { send } = useSignaling();
  const t = useTranslations("HandRaised");

  if ((!isHost && !isSpeaker) || handsRaised.size === 0) return null;

  const raisedParticipants = [
    ...listeners.filter((p) => handsRaised.has(p.peer_id)),
    ...viewers.filter((p) => handsRaised.has(p.peer_id)),
  ];

  return (
    <div
      className="px-4 py-2.5"
      style={{
        background: "rgba(245,158,11,0.08)",
        borderBottom: "1px solid rgba(245,158,11,0.15)",
      }}
    >
      <p className="text-xs font-medium mb-2" style={{ color: "var(--night-warm)" }}>
        {t("wantsToSpeak", { count: raisedParticipants.length })}
      </p>
      <div className="flex flex-wrap gap-2">
        {raisedParticipants.map((p) => (
          <div
            key={p.peer_id}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1"
            style={{ background: "var(--night-raised)", border: "1px solid rgba(245,158,11,0.2)" }}
          >
            <span className="text-xs" style={{ color: "var(--night-text)" }}>
              {p.display_name}
            </span>
            {isHost && (
              <button
                onClick={() => send({ type: "invite_to_stage", target_peer_id: p.peer_id })}
                className="text-xs font-semibold ml-1 transition-colors"
                style={{ color: "var(--night-warm)" }}
              >
                {t("invite")}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
