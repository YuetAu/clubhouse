"use client";

import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { cn } from "@/lib/utils";
import { LocaleProvider } from "@/contexts/LocaleContext";
import { I18nProvider } from "@/components/I18nProvider";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en" className={cn("font-sans", inter.variable)} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <SessionProvider>
            <QueryClientProvider client={queryClient}>
              <LocaleProvider>
                <I18nProvider>
                  {children}
                </I18nProvider>
              </LocaleProvider>
            </QueryClientProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
