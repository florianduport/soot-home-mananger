import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { runAgentTurn } from "@/lib/agent/openai";
import {
  enqueueConversationRetitleJob,
  isDefaultConversationTitle,
} from "@/lib/agent/conversation-title";
import { AgentApiError, requireAgentUserId } from "@/lib/agent/session";

type RouteContext = {
  params: Promise<{ conversationId: string }> | { conversationId: string };
};

const jsonPayloadSchema = z.object({
  message: z.string().trim().max(5000).optional(),
});

const MAX_ATTACHMENTS = 8;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const OUT_OF_SCOPE_REPLY =
  "Je suis Soot, l'assistant de maison et de l'app Soot. Je peux aider sur les tâches, listes d'achats, projets, équipements, budget, zones, personnes/animaux, entretien ou réglages de l'app. Pour le reste, je ne peux pas répondre. Reformule avec un besoin lié à la maison ou à l'application.";

const IN_SCOPE_KEYWORDS = [
  "maison",
  "domicile",
  "logement",
  "appartement",
  "jardin",
  "cuisine",
  "salon",
  "chambre",
  "bureau",
  "salle de bain",
  "garage",
  "cave",
  "grenier",
  "balcon",
  "terrasse",
  "piscine",
  "chauffage",
  "clim",
  "electricite",
  "plomberie",
  "fuite",
  "travaux",
  "reparation",
  "entretien",
  "menage",
  "nettoyage",
  "courses",
  "achat",
  "liste",
  "budget",
  "depense",
  "revenu",
  "facture",
  "rendez-vous",
  "calendrier",
  "tache",
  "routine",
  "projet",
  "equipement",
  "zone",
  "categorie",
  "animal",
  "personne",
  "famille",
  "soot",
  "application",
  "app",
  "parametre",
  "reglage",
  "compte",
  "connexion",
  "bug",
  "probleme",
];

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

function getAgentDelegates() {
  type AgentConversationDelegate = {
    findFirst: (args: unknown) => Promise<{
      id: string;
      houseId: string;
      title: string;
      _count: { messages: number };
    } | null>;
    update: (args: unknown) => Promise<unknown>;
  };

  type AgentMessageDelegate = {
    create: (args: unknown) => Promise<{
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
    findMany: (args: unknown) => Promise<
      Array<{
        role: "USER" | "ASSISTANT";
        content: string;
        attachments: Array<{
          name: string;
          mimeType: string;
          path: string;
        }>;
      }>
    >;
  };

  const runtimePrisma = prisma as unknown as {
    agentConversation?: Partial<AgentConversationDelegate>;
    agentMessage?: Partial<AgentMessageDelegate>;
  };

  const conversationDelegate = runtimePrisma.agentConversation;
  const messageDelegate = runtimePrisma.agentMessage;

  if (
    !conversationDelegate?.findFirst ||
    !conversationDelegate.update ||
    !messageDelegate?.create ||
    !messageDelegate.findMany
  ) {
    throw new AgentApiError(
      "Module agent indisponible. Redémarrez le serveur après `npm run db:push`.",
      500
    );
  }

  return {
    conversationDelegate: conversationDelegate as AgentConversationDelegate,
    messageDelegate: messageDelegate as AgentMessageDelegate,
  };
}

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function normalizeForScopeCheck(message: string) {
  return message
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isInScopeMessage(message: string) {
  const normalized = normalizeForScopeCheck(message);
  if (!normalized) return true;
  return IN_SCOPE_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function inferExtension(mimeType: string) {
  if (mimeType === "application/pdf") return ".pdf";
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/heic") return ".heic";
  if (mimeType === "image/heif") return ".heif";
  return "";
}

function validateFiles(files: File[]) {
  if (files.length > MAX_ATTACHMENTS) {
    throw new AgentApiError(
      `Maximum ${MAX_ATTACHMENTS} pièces jointes par message.`,
      400
    );
  }

  for (const file of files) {
    const mimeType = file.type || "application/octet-stream";
    const isAllowed = allowedMimeTypes.has(mimeType) || mimeType.startsWith("image/");

    if (!isAllowed) {
      throw new AgentApiError(
        `Type non supporté pour ${file.name}. Formats autorisés: images et PDF.`,
        400
      );
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      throw new AgentApiError(
        `${file.name} dépasse la taille max de 20 Mo.`,
        400
      );
    }
  }
}

async function parseIncomingRequest(request: Request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const rawMessage = formData.get("message")?.toString() ?? "";

    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File)
      .filter((file) => file.size > 0);

    return {
      message: rawMessage.trim(),
      files,
    };
  }

  const json = await request.json().catch(() => ({}));
  const parsed = jsonPayloadSchema.parse(json);
  return {
    message: (parsed.message ?? "").trim(),
    files: [] as File[],
  };
}

async function persistAttachments(conversationId: string, files: File[]) {
  const baseDir = path.join(process.cwd(), "public", "agent-uploads", conversationId);
  await mkdir(baseDir, { recursive: true });

  const persisted = [] as Array<{
    name: string;
    mimeType: string;
    sizeBytes: number;
    path: string;
  }>;

  for (const file of files) {
    const mimeType = file.type || "application/octet-stream";
    const originalExt = path.extname(file.name);
    const extension = originalExt || inferExtension(mimeType) || ".bin";
    const safeName = sanitizeFileName(path.basename(file.name, originalExt || undefined));
    const diskFileName = `${Date.now()}-${randomUUID()}-${safeName}${extension}`;
    const relativePath = path.join("agent-uploads", conversationId, diskFileName);
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    const content = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, content);

    persisted.push({
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      path: `/${relativePath.replace(/\\/g, "/")}`,
    });
  }

  return persisted;
}

async function resolveConversationId(context: RouteContext) {
  const params = await context.params;
  return z.string().cuid().parse(params.conversationId);
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const userId = await requireAgentUserId();
    const conversationId = await resolveConversationId(context);
    const { conversationDelegate, messageDelegate } = getAgentDelegates();

    const incoming = await parseIncomingRequest(request);
    validateFiles(incoming.files);

    if (!incoming.message && incoming.files.length === 0) {
      return NextResponse.json(
        { error: "Le message est vide." },
        { status: 400 }
      );
    }

    if (incoming.message.length > 5000) {
      return NextResponse.json(
        { error: "Le message est trop long (5000 caractères max)." },
        { status: 400 }
      );
    }

    const conversation = await conversationDelegate.findFirst({
      where: {
        id: conversationId,
        userId,
      },
      select: {
        id: true,
        houseId: true,
        title: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation introuvable" },
        { status: 404 }
      );
    }

    const persistedAttachments = await persistAttachments(
      conversationId,
      incoming.files
    );

    const userMessage = await messageDelegate.create({
      data: {
        conversationId,
        role: "USER",
        content: incoming.message,
        attachments: {
          create: persistedAttachments.map((attachment) => ({
            name: attachment.name,
            mimeType: attachment.mimeType,
            sizeBytes: attachment.sizeBytes,
            path: attachment.path,
          })),
        },
      },
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
    });

    if (
      conversation._count.messages === 0 &&
      isDefaultConversationTitle(conversation.title)
    ) {
      enqueueConversationRetitleJob({
        conversationId,
        userId,
        currentTitle: conversation.title,
        message: incoming.message,
        attachmentNames: persistedAttachments.map((item) => item.name),
      });
    }

    await conversationDelegate.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    const latestHistory = await messageDelegate.findMany({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        role: true,
        content: true,
        attachments: {
          select: {
            name: true,
            mimeType: true,
            path: true,
          },
        },
      },
    });
    const history = latestHistory.reverse();

    let assistantText = "";
    let usedTools: string[] = [];

    if (incoming.message && !isInScopeMessage(incoming.message)) {
      assistantText = OUT_OF_SCOPE_REPLY;
    } else {
      try {
        const result = await runAgentTurn({
          history,
          context: {
            userId,
            houseId: conversation.houseId,
          },
        });
        assistantText = result.assistantText;
        usedTools = result.usedTools;
      } catch (error) {
        assistantText =
          error instanceof Error
            ? `Je n'ai pas pu traiter la demande: ${error.message}`
            : "Je n'ai pas pu traiter la demande pour une raison inconnue.";
      }
    }

    const assistantMessage = await messageDelegate.create({
      data: {
        conversationId,
        role: "ASSISTANT",
        content: assistantText,
      },
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
    });

    await conversationDelegate.update({
      where: { id: conversationId },
      data: {
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      userMessage,
      message: assistantMessage,
      usedTools,
    });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
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
