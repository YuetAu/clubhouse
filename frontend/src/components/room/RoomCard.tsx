"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import type { Room } from "@/types/room";

interface Props {
  room: Room;
  scheduledLabel?: string;
}

export function RoomCard({ room, scheduledLabel }: Props) {
  const total = room.speaker_count + room.listener_count;
  const isScheduled = !!scheduledLabel;
  const t = useTranslations("RoomCard");

  return (
    <Link href={`/rooms/${room.id}`} className="block rounded-2xl group" style={{ outline: "none" }}>
      <div
        className="rounded-2xl p-4 transition-all duration-300"
        style={{
          background: "var(--night-card)",
          border: "1px solid var(--night-border)",
          boxShadow: "0 0 0 0 var(--night-warm-dim)",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 24px var(--night-warm-dim)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(245,158,11,0.18)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 0 0 var(--night-warm-dim)";
          (e.currentTarget as HTMLDivElement).style.borderColor = "var(--night-border)";
        }}
      >
        {/* Title row */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3
            className="font-semibold line-clamp-2 leading-snug"
            style={{ color: "var(--night-text)" }}
          >
            {room.title}
          </h3>
          {isScheduled ? (
            <span
              className="flex items-center gap-1 text-xs shrink-0 mt-0.5 font-medium"
              style={{ color: "#a78bfa" }}
            >
              🗓 {scheduledLabel}
            </span>
          ) : (
            <span
              className="flex items-center gap-1 text-xs shrink-0 mt-0.5 font-medium"
              style={{ color: "var(--night-warm)" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--night-warm)" }}
              />
              {t("live")}
            </span>
          )}
        </div>

        {/* Description */}
        {room.description && (
          <p className="text-sm line-clamp-2 mt-1" style={{ color: "var(--night-muted)" }}>
            {room.description}
          </p>
        )}

        {/* Tags */}
        {room.topic_tags && room.topic_tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {room.topic_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 text-xs rounded-full"
                style={{ background: "var(--night-raised)", color: "var(--night-muted)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-3 text-xs" style={{ color: "var(--night-muted)" }}>
            {isScheduled ? (
              <span style={{ color: "#a78bfa" }}>{t("startingSoon")}</span>
            ) : room.room_type === "chitchat" ? (
              <span>{t("chatting", { count: room.speaker_count })}</span>
            ) : (
              <>
                <span>{t("onStage", { count: room.speaker_count })}</span>
                <span>{t("total", { count: total })}</span>
              </>
            )}
          </div>
          <span
            className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0"
            style={{
              background: room.room_type === "chitchat"
                ? "rgba(139,92,246,0.12)"
                : "rgba(245,158,11,0.10)",
              color: room.room_type === "chitchat" ? "#a78bfa" : "var(--night-warm)",
            }}
          >
            {room.room_type === "chitchat" ? t("typeChitchat") : t("typeStage")}
          </span>
        </div>
      </div>
    </Link>
  );
}
