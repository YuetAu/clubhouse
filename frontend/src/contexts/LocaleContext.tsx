"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

export type Locale = "en" | "zh-TW" | "zh-CN";

interface LocaleCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

const LocaleContext = createContext<LocaleCtx>({ locale: "en", setLocale: () => {} });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = localStorage.getItem("locale") as Locale | null;
    if (saved === "en" || saved === "zh-TW" || saved === "zh-CN") {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  };

  return <LocaleContext.Provider value={{ locale, setLocale }}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);
