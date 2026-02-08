import { NextResponse } from "next/server";
import { z } from "zod";
import {
  AgentApiError,
  requireAgentUserId,
  requirePrimaryMembership,
} from "@/lib/agent/session";
import { prisma } from "@/lib/db";
import {
  buildImportantDateOccurrences,
  parseIsoDateAtNoon,
} from "@/lib/important-dates";

const importantDateTypeSchema = z.enum([
  "BIRTHDAY",
  "ANNIVERSARY",
  "EVENT",
  "OTHER",
]);

const querySchema = z.object({
  houseId: z.string().cuid().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createSchema = z.object({
  houseId: z.string().cuid().optional(),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional(),
  type: importantDateTypeSchema.optional().default("OTHER"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  isRecurringYearly: z.boolean().optional().default(true),
});

function toDateRange(fromRaw: string, toRaw: string) {
  const from = parseIsoDateAtNoon(fromRaw);
  const to = parseIsoDateAtNoon(toRaw);

  const start = new Date(from);
  start.setHours(0, 0, 0, 0);

  const end = new Date(to);
  end.setHours(23, 59, 59, 999);

  return { from: start, to: end };
}

function serializeImportantDate(importantDate: {
  id: string;
  houseId: string;
  createdById: string;
  title: string;
  description: string | null;
  date: Date;
  type: "BIRTHDAY" | "ANNIVERSARY" | "EVENT" | "OTHER";
  isRecurringYearly: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: importantDate.id,
    houseId: importantDate.houseId,
    createdById: importantDate.createdById,
    title: importantDate.title,
    description: importantDate.description,
    date: importantDate.date.toISOString(),
    type: importantDate.type,
    isRecurringYearly: importantDate.isRecurringYearly,
    createdAt: importantDate.createdAt.toISOString(),
    updatedAt: importantDate.updatedAt.toISOString(),
  };
}

async function resolveHouseId(userId: string, requestedHouseId?: string) {
  if (!requestedHouseId) {
    const primaryMembership = await requirePrimaryMembership(userId);
    return primaryMembership.houseId;
  }

  const membership = await prisma.houseMember.findFirst({
    where: {
      userId,
      houseId: requestedHouseId,
    },
    select: { id: true },
  });

  if (!membership) {
    throw new AgentApiError("Accès refusé à cette maison", 403);
  }

  return requestedHouseId;
}

export async function GET(request: Request) {
  try {
    const userId = await requireAgentUserId();
    const url = new URL(request.url);
    const parsedQuery = querySchema.parse({
      houseId: url.searchParams.get("houseId") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    const houseId = await resolveHouseId(userId, parsedQuery.houseId);

    if ((parsedQuery.from && !parsedQuery.to) || (!parsedQuery.from && parsedQuery.to)) {
      return NextResponse.json(
        { error: "Les paramètres from et to doivent être fournis ensemble" },
        { status: 400 }
      );
    }

    const importantDates = await prisma.importantDate.findMany({
      where: { houseId },
      orderBy: [{ date: "asc" }, { title: "asc" }],
    });

    const payload = {
      houseId,
      importantDates: importantDates.map(serializeImportantDate),
      occurrences:
        parsedQuery.from && parsedQuery.to
          ? buildImportantDateOccurrences(
              importantDates.map((item) => ({
                id: item.id,
                title: item.title,
                description: item.description,
                date: item.date,
                type: item.type,
                isRecurringYearly: item.isRecurringYearly,
              })),
              toDateRange(parsedQuery.from, parsedQuery.to)
            ).map((occurrence) => ({
              id: occurrence.id,
              importantDateId: occurrence.importantDateId,
              title: occurrence.title,
              description: occurrence.description ?? null,
              type: occurrence.type,
              occurrenceDate: occurrence.occurrenceDate.toISOString(),
              isRecurringYearly: occurrence.isRecurringYearly,
            }))
          : [],
    };

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Paramètres invalides" },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAgentUserId();
    const body = await request.json().catch(() => ({}));
    const parsed = createSchema.parse(body);
    const houseId = await resolveHouseId(userId, parsed.houseId);

    const created = await prisma.importantDate.create({
      data: {
        houseId,
        createdById: userId,
        title: parsed.title,
        description: parsed.description || null,
        date: parseIsoDateAtNoon(parsed.date),
        type: parsed.type,
        isRecurringYearly: parsed.isRecurringYearly,
      },
    });

    return NextResponse.json({ importantDate: serializeImportantDate(created) }, { status: 201 });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Payload invalide" },
        { status: 400 }
      );
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
