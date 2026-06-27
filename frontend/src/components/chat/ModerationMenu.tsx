"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { deleteMessage, kickParticipant, muteParticipant } from "@/lib/api";
import { clsx } from "clsx";

interface Props {
  roomId: string;
  messageId: string;
  authorId: string | null;
  isHost: boolean;
  isSpeaker: boolean;
}

export function ModerationMenu({ roomId, messageId, authorId, isHost, isSpeaker }: Props) {
  const [open, setOpen] = useState(false);
  const t = useTranslations("Moderation");

  if (!isHost && !isSpeaker) return null;

  const actions = [
    {
      label: t("deleteMessage"),
      show: true,
      action: async () => {
        await deleteMessage(roomId, messageId);
        setOpen(false);
      },
    },
    {
      label: t("muteUser"),
      show: isHost && !!authorId,
      action: async () => {
        if (authorId) await muteParticipant(roomId, authorId);
        setOpen(false);
      },
    },
    {
      label: t("kickUser"),
      show: isHost && !!authorId,
      action: async () => {
        if (authorId) await kickParticipant(roomId, authorId);
        setOpen(false);
      },
      danger: true,
    },
  ].filter((a) => a.show);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-gray-700 text-gray-500 hover:text-gray-300 transition-all text-sm"
      >
        ···
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-6 z-20 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden min-w-[140px]">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.action}
                className={clsx(
                  "w-full text-left px-3 py-2 text-sm hover:bg-gray-700 transition-colors",
                  a.danger ? "text-red-400" : "text-gray-300"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
