"use client";

import { useEffect, useRef } from "react";
import { clsx } from "clsx";
import { useTranslations } from "next-intl";
import type { Participant } from "@/types/room";

export interface ContextMenuAction {
  label: string;
  icon: string;
  danger?: boolean;
  onClick: () => void;
}

interface Props {
  participant: Participant;
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ParticipantContextMenu({ participant, x, y, actions, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const tRoles = useTranslations("Common.roles");

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScroll = () => onClose();

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [onClose]);

  const MENU_WIDTH = 192;
  const MENU_APPROX_HEIGHT = actions.length * 40 + 52;
  const safeX = Math.min(x, window.innerWidth - MENU_WIDTH - 8);
  const safeY = Math.min(y, window.innerHeight - MENU_APPROX_HEIGHT - 8);

  if (actions.length === 0) return null;

  const roleLabel = (() => {
    try {
      return tRoles(participant.role as "listener" | "speaker" | "host" | "viewer");
    } catch {
      return participant.role;
    }
  })();

  return (
    <div
      ref={menuRef}
      className="fixed z-[9999] w-48 rounded-xl bg-white border border-stone-200 shadow-xl py-1 select-none"
      style={{ left: safeX, top: safeY }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Header */}
      <div className="px-3 py-2 border-b border-stone-100">
        <p className="text-xs font-semibold text-stone-900 truncate">{participant.display_name}</p>
        <p className="text-xs text-stone-400">{roleLabel}</p>
      </div>

      {/* Actions */}
      <div className="py-1">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              action.onClick();
              onClose();
            }}
            className={clsx(
              "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors",
              action.danger
                ? "text-red-600 hover:bg-red-50"
                : "text-stone-700 hover:bg-stone-50"
            )}
          >
            <span className="text-base leading-none">{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>
    </div>
  );
}
