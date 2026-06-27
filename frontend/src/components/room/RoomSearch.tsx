"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";

export function RoomSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const t = useTranslations("RoomSearch");

  const search = () => {
    const p = new URLSearchParams();
    if (q.trim()) p.set("q", q.trim());
    router.push(`/rooms?${p}`);
  };

  return (
    <div className="flex gap-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t("placeholder")}
        onKeyDown={(e) => e.key === "Enter" && search()}
        className="flex-1 rounded-2xl px-4 py-2.5 text-sm focus:outline-none transition-colors"
        style={{
          background: "var(--night-card)",
          color: "var(--night-text)",
          border: "1px solid var(--night-border)",
        }}
      />
      <button
        onClick={search}
        className="px-4 py-2 rounded-2xl text-sm font-medium transition-colors"
        style={{
          background: "var(--night-raised)",
          color: "var(--night-muted)",
          border: "1px solid var(--night-border)",
        }}
      >
        {t("search")}
      </button>
    </div>
  );
}
