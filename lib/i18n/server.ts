import { cookies, headers } from "next/headers";
import {
  LANGUAGE_COOKIE_KEY,
  localeTagFromLanguage,
  normalizeLanguage,
  resolveLanguageFromAcceptLanguage,
} from "@/lib/i18n/language";

export async function getServerLanguage() {
  const cookieStore = await cookies();
  const cookieLanguage = normalizeLanguage(cookieStore.get(LANGUAGE_COOKIE_KEY)?.value);
  if (cookieLanguage) {
    return cookieLanguage;
  }

  const headersList = await headers();
  return resolveLanguageFromAcceptLanguage(headersList.get("accept-language"));
}

export async function getServerLocaleTag() {
  return localeTagFromLanguage(await getServerLanguage());
}
