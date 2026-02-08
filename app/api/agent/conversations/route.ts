import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  AgentApiError,
  requireAgentUserId,
  requirePrimaryMembership,
} from "@/lib/agent/session";

const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

function getAgentConversationDelegate() {
  type AgentConversationDelegate = {
    findMany: (args: unknown) => Promise<
      Array<{
        id: string;
        title: string;
        createdAt: Date;
        updatedAt: Date;
        messages: Array<{ content: string; attachments: Array<{ id: string }> }>;
      }>
    >;
    create: (args: unknown) => Promise<{
      id: string;
      title: string;
      createdAt: Date;
      updatedAt: Date;
    }>;
  };

  const runtimePrisma = prisma as unknown as {
    agentConversation?: Partial<AgentConversationDelegate>;
  };

  const delegate = runtimePrisma.agentConversation;
  if (!delegate?.findMany || !delegate.create) {
    throw new AgentApiError(
      "Module agent indisponible. Redémarrez le serveur après `npm run db:push`.",
      500
    );
  }
  return delegate as AgentConversationDelegate;
}

function defaultConversationTitle(date = new Date()) {
  const formatted = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
  return `Conversation ${formatted}`;
}

export async function GET() {
  try {
    const userId = await requireAgentUserId();
    const conversationDelegate = getAgentConversationDelegate();

    const conversations = await conversationDelegate.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            content: true,
            attachments: {
              select: {
                id: true,
              },
            },
          },
        },
      },
      take: 100,
    });

    return NextResponse.json({
      conversations: conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        preview:
          conversation.messages[0]?.content ||
          (conversation.messages[0]?.attachments.length
            ? `${conversation.messages[0].attachments.length} pièce(s) jointe(s)`
            : ""),
      })),
    });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireAgentUserId();
    const membership = await requirePrimaryMembership(userId);
    const conversationDelegate = getAgentConversationDelegate();

    const body = await request.json().catch(() => ({}));
    const parsed = createConversationSchema.parse(body);

    const conversation = await conversationDelegate.create({
      data: {
        userId,
        houseId: membership.houseId,
        title: parsed.title || defaultConversationTitle(),
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Payload invalide" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
