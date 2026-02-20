import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAppBaseUrl } from "@/lib/email";
import { buildImportantDateOccurrences } from "@/lib/important-dates";
import { getServerLanguage } from "@/lib/i18n/server";
import { translateText } from "@/lib/i18n/translate";
import {
  escapeIcsText,
  formatIcsDate,
  formatIcsDateTime,
} from "@/lib/calendar-feed";

const querySchema = z.object({
  token: z.string().min(10),
});

function isImportantDateUnavailableError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")) ||
    (error instanceof TypeError &&
      error.message.toLowerCase().includes("importantdate"))
  );
}

function buildCalendarIcs({
  calendarName,
  tasks,
  importantDates,
}: {
  calendarName: string;
  tasks: Array<{
    id: string;
    title: string;
    description: string | null;
    dueDate: Date;
    updatedAt: Date;
  }>;
  importantDates: Array<{
    id: string;
    title: string;
    description: string | null;
    date: Date;
    type: string;
    isRecurringYearly: boolean;
  }>;
}) {
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Soot//Home Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "X-WR-TIMEZONE:UTC",
  ];

  const baseUrl = getAppBaseUrl();

  tasks.forEach((task) => {
    const start = task.dueDate;
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const url = new URL(`/app/tasks/${task.id}`, `${baseUrl}/`).toString();
    lines.push("BEGIN:VEVENT");
    lines.push(`UID:soot-task-${task.id}@soot`);
    lines.push(`DTSTAMP:${formatIcsDateTime(task.updatedAt)}`);
    lines.push(`DTSTART:${formatIcsDateTime(start)}`);
    lines.push(`DTEND:${formatIcsDateTime(end)}`);
    lines.push(`SUMMARY:${escapeIcsText(task.title)}`);
    if (task.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(task.description)}`);
    }
    lines.push(`URL:${escapeIcsText(url)}`);
    lines.push("END:VEVENT");
  });

  const anchorDate = new Date();
  const from = new Date(anchorDate.getFullYear() - 2, 0, 1, 0, 0, 0, 0);
  const to = new Date(anchorDate.getFullYear() + 4, 11, 31, 23, 59, 59, 999);
  const occurrences = buildImportantDateOccurrences(importantDates, { from, to });

  occurrences.forEach((occurrence) => {
    const startDate = occurrence.occurrenceDate;
    const endDate = new Date(startDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    const url = new URL("/app/settings", `${baseUrl}/`).toString();

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:soot-important-${occurrence.id}@soot`);
    lines.push(`DTSTAMP:${formatIcsDateTime(new Date())}`);
    lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endDate)}`);
    lines.push(`SUMMARY:${escapeIcsText(occurrence.title)}`);
    if (occurrence.description) {
      lines.push(`DESCRIPTION:${escapeIcsText(occurrence.description)}`);
    }
    lines.push(`URL:${escapeIcsText(url)}`);
    lines.push("END:VEVENT");
  });

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

export async function GET(request: Request) {
  const language = await getServerLanguage();
  const t = (value: string) => translateText(value, language);

  try {
    const url = new URL(request.url);
    const parsedQuery = querySchema.parse({
      token: url.searchParams.get("token") ?? "",
    });

    const user = await prisma.user.findUnique({
      where: { calendarFeedToken: parsedQuery.token },
      select: {
        id: true,
        memberships: {
          include: {
            house: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    const membership = user?.memberships[0];
    if (!user || !membership) {
      return NextResponse.json({ error: t("Lien invalide.") }, { status: 404 });
    }

    if (membership.house.clientStatus === "INACTIVE") {
      return NextResponse.json({ error: t("Client désactivé.") }, { status: 403 });
    }

    const tasks = await prisma.task.findMany({
      where: {
        houseId: membership.houseId,
        isTemplate: false,
        status: { not: "DONE" },
        dueDate: { not: null },
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        updatedAt: true,
      },
      orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    });

    let importantDates: Array<{
      id: string;
      title: string;
      description: string | null;
      date: Date;
      type: string;
      isRecurringYearly: boolean;
    }> = [];

    try {
      importantDates = await prisma.importantDate.findMany({
        where: { houseId: membership.houseId },
        select: {
          id: true,
          title: true,
          description: true,
          date: true,
          type: true,
          isRecurringYearly: true,
        },
        orderBy: [{ date: "asc" }, { title: "asc" }],
      });
    } catch (error) {
      if (!isImportantDateUnavailableError(error)) {
        throw error;
      }
    }

    const calendarName = `Soot - ${membership.house.name}`;
    const ics = buildCalendarIcs({ calendarName, tasks, importantDates });

    return new NextResponse(ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="soot-calendar.ics"',
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: t("Paramètres invalides.") },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Erreur serveur.";
    return NextResponse.json({ error: t(message) }, { status: 500 });
  }
}
