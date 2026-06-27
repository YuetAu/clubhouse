"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="p-1.5 rounded-xl transition-colors text-base leading-none"
      style={{ color: "var(--night-muted)" }}
      aria-label="Toggle theme"
    >
      {resolvedTheme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
