"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (password: string) => void;
  error?: string;
}

export function PasswordPromptModal({ open, onClose, onSubmit, error }: Props) {
  const [password, setPassword] = useState("");
  const t = useTranslations("PasswordModal");

  const handleSubmit = () => {
    if (password.trim()) {
      onSubmit(password.trim());
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <div className="space-y-4">
        <p className="text-sm" style={{ color: "var(--night-muted)" }}>{t("description")}</p>
        <Input
          type="password"
          label={t("label")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder={t("placeholder")}
          error={error}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <Button variant="ghost" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!password.trim()}>
            {t("join")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
