import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentApiError, requireAgentUserId } from "@/lib/agent/session";
import { prisma } from "@/lib/db";
import {
  getNextImportantDateOccurrence,
  parseIsoDateAtNoon,
} from "@/lib/important-dates";

type RouteContext = {
  params: Promise<{ importantDateId: string }> | { importantDateId: string };
};

const importantDateTypeSchema = z.enum([
  "BIRTHDAY",
  "ANNIVERSARY",
  "EVENT",
  "OTHER",
]);

const updateSchema = z
  .object({
    title: z.string().trim().min(2).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    type: importantDateTypeSchema.optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    isRecurringYearly: z.boolean().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: "Au moins un champ doit être fourni",
  });

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
    nextOccurrence: getNextImportantDateOccurrence(
      importantDate.date,
      importantDate.isRecurringYearly
    ).toISOString(),
    createdAt: importantDate.createdAt.toISOString(),
    updatedAt: importantDate.updatedAt.toISOString(),
  };
}

async function ensureMembership(userId: string, houseId: string) {
  const membership = await prisma.houseMember.findFirst({
    where: {
      userId,
      houseId,
    },
    select: {
      id: true,
      house: {
        select: {
          clientStatus: true,
        },
      },
    },
  });

  if (!membership) {
    throw new AgentApiError("Accès refusé à cette ressource", 403);
  }

  if (membership.house.clientStatus === "INACTIVE") {
    throw new AgentApiError("Client désactivé", 403);
  }
}

async function resolveImportantDateId(context: RouteContext) {
  const params = await context.params;
  return z.string().cuid().parse(params.importantDateId);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireAgentUserId();
    const importantDateId = await resolveImportantDateId(context);

    const importantDate = await prisma.importantDate.findUnique({
      where: { id: importantDateId },
    });

    if (!importantDate) {
      return NextResponse.json({ error: "Date importante introuvable" }, { status: 404 });
    }

    await ensureMembership(userId, importantDate.houseId);
    return NextResponse.json({ importantDate: serializeImportantDate(importantDate) });
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const userId = await requireAgentUserId();
    const importantDateId = await resolveImportantDateId(context);
    const body = await request.json().catch(() => ({}));
    const parsed = updateSchema.parse(body);

    const existing = await prisma.importantDate.findUnique({
      where: { id: importantDateId },
      select: { id: true, houseId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Date importante introuvable" }, { status: 404 });
    }

    await ensureMembership(userId, existing.houseId);

    const updated = await prisma.importantDate.update({
      where: { id: importantDateId },
      data: {
        ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        ...(parsed.type !== undefined ? { type: parsed.type } : {}),
        ...(parsed.date !== undefined ? { date: parseIsoDateAtNoon(parsed.date) } : {}),
        ...(parsed.isRecurringYearly !== undefined
          ? { isRecurringYearly: parsed.isRecurringYearly }
          : {}),
        ...(parsed.description !== undefined
          ? { description: parsed.description?.trim() || null }
          : {}),
      },
    });

    return NextResponse.json({ importantDate: serializeImportantDate(updated) });
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireAgentUserId();
    const importantDateId = await resolveImportantDateId(context);

    const existing = await prisma.importantDate.findUnique({
      where: { id: importantDateId },
      select: { id: true, houseId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Date importante introuvable" }, { status: 404 });
    }

    await ensureMembership(userId, existing.houseId);

    await prisma.importantDate.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({ ok: true });
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
