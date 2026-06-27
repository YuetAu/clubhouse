"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { setAnonIdentity } from "@/lib/anon";
import { loginAnon, setToken } from "@/lib/api";

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AnonNicknameModal({ open, onClose, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const t = useTranslations("AnonModal");

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("required"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      const identity = setAnonIdentity(trimmed);
      const data = await loginAnon(identity.anonToken, identity.displayName);
      setToken(data.access_token as string);
      onSuccess();
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--night-muted)" }}>{t("description")}</p>
        <Input
          label={t("nickname")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("nicknamePlaceholder")}
          error={error}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          autoFocus
          maxLength={64}
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? t("joining") : t("joinAnonymously")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
