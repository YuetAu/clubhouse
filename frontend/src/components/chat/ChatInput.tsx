"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";

interface Props {
  onSend: (content: string) => void;
}

export function ChatInput({ onSend }: Props) {
  const [value, setValue] = useState("");
  const t = useTranslations("Chat");

  const submit = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setValue("");
  };

  return (
    <div className="flex gap-2" style={{ borderTop: "1px solid var(--night-border)", padding: "8px 0 0" }}>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), submit())}
        placeholder={t("placeholder")}
        maxLength={2000}
        className="flex-1 rounded-2xl px-4 py-2.5 text-sm focus:outline-none"
        style={{
          background: "var(--night-raised)",
          color: "var(--night-text)",
          border: "1px solid var(--night-border)",
        }}
      />
      <Button size="sm" onClick={submit} disabled={!value.trim()}>
        {t("send")}
      </Button>
    </div>
  );
}
