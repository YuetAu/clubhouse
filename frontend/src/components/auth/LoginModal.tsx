"use client";

import { useEffect, useState } from "react";
import { getProviders, signIn } from "next-auth/react";
import type { ClientSafeProvider } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

const PROVIDER_ICONS: Record<string, string> = {
  google: "G",
  github: "GH",
  discord: "D",
  kioubit: "K",
};

interface Props {
  open: boolean;
  onClose: () => void;
  onAnonClick?: () => void;
  hideAnon?: boolean;
  subtitle?: string;
}

export function LoginModal({ open, onClose, onAnonClick, hideAnon = false, subtitle }: Props) {
  const [providers, setProviders] = useState<ClientSafeProvider[]>([]);
  const t = useTranslations("LoginModal");

  useEffect(() => {
    getProviders().then((p) => setProviders(p ? Object.values(p) : []));
  }, []);

  return (
    <Modal open={open} onClose={onClose} title={t("title")}>
      <div className="space-y-3">
        {subtitle && (
          <p className="text-sm text-center" style={{ color: "var(--night-muted)" }}>{subtitle}</p>
        )}
        {providers.map((p) => {
          const icon = PROVIDER_ICONS[p.id] ?? p.id.slice(0, 2).toUpperCase();
          const label = t("continueWith", { name: p.name });
          return (
            <Button key={p.id} variant="secondary" className="w-full" onClick={() => signIn(p.id)}>
              <span className="font-bold text-xs bg-gray-600 rounded px-1.5 py-0.5">{icon}</span>
              {label}
            </Button>
          );
        })}

        {!hideAnon && (
          <>
            <div className="relative flex items-center gap-3 py-2">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">{t("or")}</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            <Button variant="ghost" className="w-full border border-gray-600" onClick={onAnonClick}>
              {t("enterAnonymously")}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
