"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";

function AuthErrorContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const t = useTranslations("AuthError");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-red-400">{t("title")}</h1>
        <p className="text-gray-400">{error ?? t("fallback")}</p>
        <Link
          href="/"
          className="inline-block mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600"
        >
          {t("goHome")}
        </Link>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={null}>
      <AuthErrorContent />
    </Suspense>
  );
}
