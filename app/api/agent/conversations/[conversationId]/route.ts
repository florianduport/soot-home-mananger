import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { AgentApiError, requireAgentUserId } from "@/lib/agent/session";

type RouteContext = {
  params: Promise<{ conversationId: string }> | { conversationId: string };
};

function getAgentConversationDelegate() {
  type AgentConversationDelegate = {
    findFirst: (args: unknown) => Promise<{
      id: string;
      title: string;
      createdAt: Date;
      updatedAt: Date;
      messages: Array<{
        id: string;
        role: "USER" | "ASSISTANT";
        content: string;
        createdAt: Date;
        attachments: Array<{
          id: string;
          name: string;
          mimeType: string;
          sizeBytes: number;
          path: string;
        }>;
      }>;
    } | null>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  };

  const runtimePrisma = prisma as unknown as {
    agentConversation?: Partial<AgentConversationDelegate>;
  };

  const delegate = runtimePrisma.agentConversation;
  if (!delegate?.findFirst || !delegate.deleteMany) {
    throw new AgentApiError(
      "Module agent indisponible. Redémarrez le serveur après `npm run db:push`.",
      500
    );
  }
  return delegate as AgentConversationDelegate;
}

async function resolveConversationId(context: RouteContext) {
  const params = await context.params;
  return z.string().cuid().parse(params.conversationId);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const userId = await requireAgentUserId();
    const conversationId = await resolveConversationId(context);
    const conversationDelegate = getAgentConversationDelegate();

    const conversation = await conversationDelegate.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            role: true,
            content: true,
            createdAt: true,
            attachments: {
              select: {
                id: true,
                name: true,
                mimeType: true,
                sizeBytes: true,
                path: true,
              },
            },
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }

    return NextResponse.json({
      conversation: {
        id: conversation.id,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: conversation.messages,
    });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Identifiant de conversation invalide" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const userId = await requireAgentUserId();
    const conversationId = await resolveConversationId(context);
    const conversationDelegate = getAgentConversationDelegate();

    const deleted = await conversationDelegate.deleteMany({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!deleted.count) {
      return NextResponse.json({ error: "Conversation introuvable" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Identifiant de conversation invalide" }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "Erreur serveur";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
