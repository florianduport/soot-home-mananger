import { prisma } from "@/lib/db";

const TITLE_MAX_LENGTH = 120;
const TITLE_SOURCE_MAX_LENGTH = 700;

function getAgentConversationDelegate() {
  type AgentConversationDelegate = {
    updateMany: (args: unknown) => Promise<{ count: number }>;
  };

  const runtimePrisma = prisma as unknown as {
    agentConversation?: Partial<AgentConversationDelegate>;
  };

  const delegate = runtimePrisma.agentConversation;
  if (!delegate?.updateMany) {
    throw new Error(
      "Module agent indisponible. Redemarrez le serveur apres `npm run db:push`."
    );
  }

  return delegate as AgentConversationDelegate;
}

function compactText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function cropText(value: string, maxLength: number) {
  const compact = compactText(value);
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trimEnd()}...`;
}

function normalizeTitle(raw: string) {
  const cleaned = compactText(raw)
    .replace(/^["'`]+/, "")
    .replace(/["'`]+$/, "")
    .replace(/[.]+$/, "");

  if (!cleaned) return null;
  if (cleaned.length <= TITLE_MAX_LENGTH) return cleaned;
  return `${cleaned.slice(0, TITLE_MAX_LENGTH).trimEnd()}...`;
}

function extractOpenAIText(payload: Record<string, unknown>) {
  const outputText = payload.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = Array.isArray(payload.output)
    ? (payload.output as Array<{ type?: string; content?: Array<{ text?: string }> }>)
    : [];

  for (const item of output) {
    if (item.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    const text = content
      .map((chunk) => (typeof chunk.text === "string" ? chunk.text : ""))
      .join("\n")
      .trim();

    if (text) return text;
  }

  return "";
}

async function generateConversationTitle({
  message,
  attachmentNames,
}: {
  message: string;
  attachmentNames: string[];
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    return null;
  }

  const model =
    process.env.OPENAI_CONVERSATION_TITLE_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini";

  const clippedMessage = cropText(message, TITLE_SOURCE_MAX_LENGTH);
  const clippedAttachmentNames = attachmentNames
    .map((name) => cropText(name, 80))
    .slice(0, 6);

  const prompt = [
    "Genere un titre clair pour une conversation utilisateur/assistant de gestion de maison.",
    "Contraintes:",
    "- Francais.",
    "- Entre 3 et 8 mots.",
    "- Maximum 60 caracteres.",
    "- Ne mets ni guillemets ni point final.",
    "- Ne commence pas par 'Conversation'.",
    "Objectif: resumer l'intention principale de l'utilisateur.",
    `Message utilisateur: ${clippedMessage || "(message vide)"}`,
    `Pieces jointes: ${clippedAttachmentNames.join(", ") || "aucune"}`,
    "Retourne uniquement le titre.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      max_output_tokens: 60,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return normalizeTitle(extractOpenAIText(payload));
}

function runDetached(job: () => Promise<void>, label: string) {
  void Promise.resolve()
    .then(job)
    .catch((error) => {
      console.error(label, error);
    });
}

async function runConversationRetitleJob({
  conversationId,
  userId,
  currentTitle,
  message,
  attachmentNames,
}: {
  conversationId: string;
  userId: string;
  currentTitle: string;
  message: string;
  attachmentNames: string[];
}) {
  const title = await generateConversationTitle({
    message,
    attachmentNames,
  });

  if (!title || title === currentTitle) {
    return;
  }

  const conversationDelegate = getAgentConversationDelegate();
  await conversationDelegate.updateMany({
    where: {
      id: conversationId,
      userId,
      title: currentTitle,
    },
    data: {
      title,
    },
  });
}

export function isDefaultConversationTitle(title: string) {
  return /^Conversation\s+\d{2}\/\d{2}\/\d{4}/.test(title);
}

export function enqueueConversationRetitleJob(params: {
  conversationId: string;
  userId: string;
  currentTitle: string;
  message: string;
  attachmentNames: string[];
}) {
  runDetached(
    () => runConversationRetitleJob(params),
    `Conversation retitle job failed (${params.conversationId})`
  );
}
