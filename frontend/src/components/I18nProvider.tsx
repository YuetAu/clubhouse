"use client";

import { NextIntlClientProvider } from "next-intl";
import { useLocale } from "@/contexts/LocaleContext";
import messages_en from "@/messages/en.json";
import messages_zhTW from "@/messages/zh-TW.json";
import messages_zhCN from "@/messages/zh-CN.json";

const allMessages = {
  en: messages_en,
  "zh-TW": messages_zhTW,
  "zh-CN": messages_zhCN,
};

const timeZone = "Asia/Hong_Kong";

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  return (
    <NextIntlClientProvider locale={locale} messages={allMessages[locale]} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
