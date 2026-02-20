"use client";

import { LanguageSwitcher } from "@/components/i18n/language-switcher";
import { useI18n } from "@/components/i18n/i18n-provider";
import { type AppLanguage } from "@/lib/i18n/language";

const COPY: Record<AppLanguage, { title: string; description: string }> = {
  en: {
    title: "App language",
    description: "Choose the language shown on the landing page and inside the app.",
  },
  fr: {
    title: "Langue de l'application",
    description: "Choisis la langue affichee sur la landing et dans l'application.",
  },
  es: {
    title: "Idioma de la aplicacion",
    description: "Elige el idioma mostrado en la landing y en la aplicacion.",
  },
};

export function LanguageSettings() {
  const { language } = useI18n();
  const copy = COPY[language];

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">{copy.title}</p>
        <p className="text-xs text-muted-foreground">{copy.description}</p>
      </div>
      <LanguageSwitcher showLabel={false} showAutoDetected />
    </div>
  );
}
