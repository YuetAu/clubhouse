"use client";

import { useLocale, type Locale } from "@/contexts/LocaleContext";

const LOCALES: { value: Locale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "zh-TW", label: "繁" },
  { value: "zh-CN", label: "简" },
];

export function LocaleSwitcher() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-0.5 text-xs font-medium">
      {LOCALES.map((l, i) => (
        <span key={l.value} className="flex items-center">
          {i > 0 && (
            <span className="px-0.5 opacity-30" style={{ color: "var(--night-muted)" }}>
              |
            </span>
          )}
          <button
            onClick={() => setLocale(l.value)}
            className="px-1 py-0.5 rounded transition-colors"
            style={{
              color: locale === l.value ? "var(--night-warm)" : "var(--night-muted)",
            }}
          >
            {l.label}
          </button>
        </span>
      ))}
    </div>
  );
}
