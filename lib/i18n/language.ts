export const SUPPORTED_LANGUAGES = ["en", "fr", "es"] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = "en";
export const LANGUAGE_STORAGE_KEY = "soot-language";
export const LANGUAGE_COOKIE_KEY = "soot-language";
export const LANGUAGE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 5;

const LANGUAGE_TO_LOCALE: Record<AppLanguage, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
};

export const LANGUAGE_LABELS: Record<AppLanguage, string> = {
  en: "English",
  fr: "Francais",
  es: "Espanol",
};

export function isSupportedLanguage(value: string): value is AppLanguage {
  return SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function normalizeLanguage(value: string | null | undefined): AppLanguage | null {
  if (!value) return null;

  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;

  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("es")) return "es";

  return null;
}

export function resolveLanguage(value: string | null | undefined): AppLanguage {
  return normalizeLanguage(value) ?? DEFAULT_LANGUAGE;
}

export function localeTagFromLanguage(language: AppLanguage): string {
  return LANGUAGE_TO_LOCALE[language];
}

export function resolveLanguageFromAcceptLanguage(
  headerValue: string | null | undefined
): AppLanguage {
  if (!headerValue) return DEFAULT_LANGUAGE;

  let bestLanguage: AppLanguage | null = null;
  let bestWeight = -1;

  for (const chunk of headerValue.split(",")) {
    const [rawLang, ...params] = chunk.trim().split(";");
    const language = normalizeLanguage(rawLang);
    if (!language) continue;

    let weight = 1;
    for (const param of params) {
      const trimmed = param.trim();
      if (!trimmed.startsWith("q=")) continue;

      const parsed = Number(trimmed.slice(2));
      if (!Number.isNaN(parsed)) {
        weight = parsed;
      }
    }

    if (weight > bestWeight) {
      bestWeight = weight;
      bestLanguage = language;
    }
  }

  return bestLanguage ?? DEFAULT_LANGUAGE;
}

export function detectLanguageFromNavigator(
  navigatorLanguages: readonly string[] | undefined,
  navigatorLanguage: string | null | undefined
): AppLanguage {
  for (const candidate of navigatorLanguages ?? []) {
    const normalized = normalizeLanguage(candidate);
    if (normalized) return normalized;
  }

  const fallback = normalizeLanguage(navigatorLanguage);
  return fallback ?? DEFAULT_LANGUAGE;
}
