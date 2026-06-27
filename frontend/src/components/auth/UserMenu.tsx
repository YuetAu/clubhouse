"use client";

import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { clearToken } from "@/lib/api";

interface Props {
  onLoginClick: () => void;
}

export function UserMenu({ onLoginClick }: Props) {
  const { data: session, status } = useSession();
  const t = useTranslations("Nav");

  if (status === "loading") return null;

  if (!session) {
    return (
      <button
        onClick={onLoginClick}
        className="px-3 py-1.5 text-sm rounded-xl font-medium transition-colors"
        style={{ background: "var(--night-warm)", color: "#080910" }}
      >
        {t("join")}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Badge variant="verified" />
      <Avatar src={session.user?.image ?? null} name={session.user?.name ?? ""} size={32} />
      <button
        className="px-3 py-1.5 text-sm rounded-xl font-medium transition-colors"
        style={{ color: "var(--night-muted)" }}
        onClick={() => {
          clearToken();
          signOut();
        }}
      >
        {t("signOut")}
      </button>
    </div>
  );
}
