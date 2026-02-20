import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/email";

const CALENDAR_FEED_TOKEN_BYTES = 24;

export function buildCalendarFeedUrl(token: string) {
  const baseUrl = getAppBaseUrl();
  const url = new URL("/api/calendar/feed", `${baseUrl}/`);
  url.searchParams.set("token", token);
  return url.toString();
}

async function createUniqueToken() {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const token = randomBytes(CALENDAR_FEED_TOKEN_BYTES).toString("hex");
    const existing = await prisma.user.findFirst({
      where: { calendarFeedToken: token },
      select: { id: true },
    });
    if (!existing) {
      return token;
    }
  }

  throw new Error("Impossible de générer un lien de calendrier unique.");
}

export async function ensureCalendarFeedToken(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { calendarFeedToken: true },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable.");
  }

  if (user.calendarFeedToken) {
    return {
      token: user.calendarFeedToken,
      url: buildCalendarFeedUrl(user.calendarFeedToken),
    };
  }

  const token = await createUniqueToken();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { calendarFeedToken: token },
    select: { calendarFeedToken: true },
  });

  return {
    token: updated.calendarFeedToken!,
    url: buildCalendarFeedUrl(updated.calendarFeedToken!),
  };
}

export async function regenerateCalendarFeedToken(userId: string) {
  const token = await createUniqueToken();
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { calendarFeedToken: token },
    select: { calendarFeedToken: true },
  });

  return {
    token: updated.calendarFeedToken!,
    url: buildCalendarFeedUrl(updated.calendarFeedToken!),
  };
}

export function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

export function formatIcsDateTime(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function formatIcsDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${value.getUTCDate()}`.padStart(2, "0");
  return `${year}${month}${day}`;
}
