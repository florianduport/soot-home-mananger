"use client";

import { SessionProvider } from "next-auth/react";
import { I18nProvider } from "@/components/i18n/i18n-provider";
import { type AppLanguage } from "@/lib/i18n/language";

export function Providers({
  children,
  initialLanguage,
}: {
  children: React.ReactNode;
  initialLanguage: AppLanguage;
}) {
  return (
    <SessionProvider>
      <I18nProvider initialLanguage={initialLanguage}>{children}</I18nProvider>
    </SessionProvider>
  );
}
