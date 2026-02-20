"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/components/i18n/i18n-provider";
import { SUPPORTED_LANGUAGES, type AppLanguage } from "@/lib/i18n/language";
import { cn } from "@/lib/utils";

type LanguageSwitcherProps = {
  className?: string;
  selectClassName?: string;
  selectedValueClassName?: string;
  chevronClassName?: string;
  compact?: boolean;
  showLabel?: boolean;
  showAutoDetected?: boolean;
  showSelectedTextInControl?: boolean;
  showCustomChevron?: boolean;
};

const UI_TEXT: Record<AppLanguage, { label: string; autoDetected: string }> = {
  en: {
    label: "Language",
    autoDetected: "Auto-detected",
  },
  fr: {
    label: "Langue",
    autoDetected: "Detectee automatiquement",
  },
  es: {
    label: "Idioma",
    autoDetected: "Detectado automaticamente",
  },
};

const LANGUAGE_FLAGS: Record<AppLanguage, string> = {
  en: "🇬🇧",
  fr: "🇫🇷",
  es: "🇪🇸",
};

const LANGUAGE_NAMES: Record<AppLanguage, string> = {
  en: "English",
  fr: "Francais",
  es: "Espanol",
};

export function LanguageSwitcher({
  className,
  selectClassName,
  selectedValueClassName,
  chevronClassName,
  compact = false,
  showLabel = true,
  showAutoDetected = false,
  showSelectedTextInControl = false,
  showCustomChevron = false,
}: LanguageSwitcherProps) {
  const id = useId();
  const { language, setLanguage, isAutoDetected } = useI18n();
  const text = UI_TEXT[language];

  return (
    <div
      data-i18n-ignore="true"
      className={cn("flex items-center gap-2", compact ? "" : "flex-col items-start", className)}
    >
      {showLabel ? (
        <label htmlFor={id} className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {text.label}
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <div className="relative">
          <select
            id={id}
            data-testid="language-switcher-select"
            value={language}
            onChange={(event) => setLanguage(event.target.value as AppLanguage)}
            className={cn(
              "h-9 rounded-md border border-input bg-background px-3 text-sm",
              selectClassName
            )}
            aria-label={text.label}
          >
            {SUPPORTED_LANGUAGES.map((option) => (
              <option
                key={option}
                value={option}
                style={{ color: "#1a271f", backgroundColor: "#f9f1e2" }}
              >
                {`\u2003${LANGUAGE_FLAGS[option]} ${LANGUAGE_NAMES[option]}`}
              </option>
            ))}
          </select>
          {showSelectedTextInControl ? (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-y-0 left-2 flex items-center text-sm text-foreground",
                selectedValueClassName
              )}
            >
              {LANGUAGE_FLAGS[language]} {LANGUAGE_NAMES[language]}
            </span>
          ) : null}
          {showCustomChevron ? (
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute right-0.5 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/75",
                chevronClassName
              )}
            />
          ) : null}
        </div>
        {showAutoDetected && isAutoDetected ? (
          <span className="text-xs text-muted-foreground">{text.autoDetected}</span>
        ) : null}
      </div>
    </div>
  );
}
