import { readFile } from "fs/promises";
import path from "path";
import { agentFunctionTools, executeAgentTool, type AgentToolContext } from "@/lib/agent/tools";

type PersistedMessage = {
  role: "USER" | "ASSISTANT";
  content: string;
  attachments?: Array<{
    name: string;
    mimeType: string;
    path: string;
  }>;
};

type AgentRunResult = {
  assistantText: string;
  usedTools: string[];
};

type OpenAIResponseOutputItem = {
  type?: string;
  name?: string;
  call_id?: string;
  arguments?: string;
  content?: Array<{ type?: string; text?: string }>;
};

function buildSystemPrompt(now: Date) {
  const isoDate = now.toISOString().slice(0, 10);
  const humanDate = new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
  }).format(now);

  return [
    "Tu es l'assistant IA de Soot.",
    "Objectif: aider l'utilisateur sur sa maison et exécuter des actions dans l'application quand demandé.",
    `Date actuelle: ${humanDate} (ISO: ${isoDate}).`,
    "Règles:",
    "- Réponds en français.",
    "- Quand une demande implique des données ou une action, utilise les tools plutôt que d'inventer.",
    "- Si l'utilisateur demande aujourd'hui/hier/demain ou une date précise, appelle get_tasks_for_day avec une date ISO.",
    "- Pour une plage de dates, utilise list_tasks avec dueFrom/dueTo.",
    "- Si l'utilisateur veut ajouter un revenu ou une dépense, utilise create_budget_entry.",
    "- Si l'utilisateur veut modifier une tâche, utilise update_task.",
    "- Si l'utilisateur veut supprimer une tâche, utilise delete_task.",
    "- Si l'utilisateur veut créer/modifier/supprimer un projet, utilise create_project/update_project/delete_project.",
    "- Si l'utilisateur veut créer/modifier/supprimer un équipement, utilise create_equipment/update_equipment/delete_equipment.",
    "- Si l'utilisateur veut créer/modifier/supprimer une zone/catégorie/animal/personne, utilise les tools dédiés.",
    "- Si l'utilisateur veut gérer les listes d'achats (vider, supprimer, cocher article), utilise clear_shopping_list/delete_shopping_list/toggle_shopping_item.",
    "- Si l'utilisateur veut créer/modifier/supprimer une date importante, utilise create_important_date/update_important_date/delete_important_date.",
    "- Si l'utilisateur veut supprimer une écriture budget ponctuelle, utilise delete_budget_entry.",
    "- Si l'utilisateur veut une règle mensuelle récurrente de revenu/dépense, utilise create_budget_recurring_entry.",
    "- Si l'utilisateur veut modifier une règle mensuelle récurrente de revenu/dépense, utilise update_budget_recurring_entry.",
    "- Si l'utilisateur veut supprimer une règle mensuelle récurrente de revenu/dépense, utilise delete_budget_recurring_entry.",
    "- Si l'utilisateur demande un récap budget d'un mois, utilise list_monthly_budget.",
    "- Si l'utilisateur se trompe sur la date du jour, corrige en te basant sur la date actuelle fournie.",
    "- Si une action est ambiguë (par exemple plusieurs tâches possibles), demande une précision.",
    "- Quand une action est faite, confirme explicitement ce qui a été réalisé.",
    "- Prends en compte les pièces jointes (images/PDF) quand elles sont présentes.",
    "- Sois concis et concret.",
  ].join("\n");
}

function extractAssistantText(payload: Record<string, unknown>) {
  const outputText = payload.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = Array.isArray(payload.output)
    ? (payload.output as OpenAIResponseOutputItem[])
    : [];

  for (const item of output) {
    if (item.type !== "message") continue;
    const chunks = Array.isArray(item.content) ? item.content : [];
    const text = chunks
      .map((chunk) => (typeof chunk.text === "string" ? chunk.text : ""))
      .join("\n")
      .trim();
    if (text) return text;
  }

  return "";
}

function extractFunctionCalls(payload: Record<string, unknown>) {
  const output = Array.isArray(payload.output)
    ? (payload.output as OpenAIResponseOutputItem[])
    : [];

  return output.filter(
    (item) => item.type === "function_call" && item.name && item.call_id
  );
}

function parseFunctionArgs(rawArgs: string | undefined) {
  if (!rawArgs) return {};
  try {
    return JSON.parse(rawArgs);
  } catch {
    return {};
  }
}

async function runResponsesRequest(body: Record<string, unknown>, apiKey: string) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error ${response.status}: ${errorText}`);
  }

  return (await response.json()) as Record<string, unknown>;
}

function absolutePublicPath(relativePath: string) {
  return path.join(process.cwd(), "public", relativePath.replace(/^\/+/, ""));
}

async function buildUserContent(message: PersistedMessage) {
  const content: Array<Record<string, unknown>> = [];
  const text = message.content.trim();

  if (text) {
    content.push({
      type: "input_text",
      text,
    });
  }

  for (const attachment of message.attachments ?? []) {
    try {
      const bytes = await readFile(absolutePublicPath(attachment.path));
      const base64 = bytes.toString("base64");

      if (attachment.mimeType.startsWith("image/")) {
        content.push({
          type: "input_image",
          image_url: `data:${attachment.mimeType};base64,${base64}`,
        });
        continue;
      }

      if (attachment.mimeType === "application/pdf") {
        content.push({
          type: "input_file",
          filename: attachment.name,
          file_data: base64,
        });
      }
    } catch {
      content.push({
        type: "input_text",
        text: `Pièce jointe inaccessible: ${attachment.name}`,
      });
    }
  }

  if (!content.length) {
    content.push({
      type: "input_text",
      text: "(message vide)",
    });
  }

  return content;
}

async function toOpenAIInput(history: PersistedMessage[]) {
  const items: Array<{ role: "user" | "assistant"; content: unknown }> = [];

  for (const message of history) {
    if (message.role === "ASSISTANT") {
      items.push({
        role: "assistant",
        content: message.content,
      });
      continue;
    }

    items.push({
      role: "user",
      content: await buildUserContent(message),
    });
  }

  return items;
}

export async function runAgentTurn({
  history,
  context,
}: {
  history: PersistedMessage[];
  context: AgentToolContext;
}): Promise<AgentRunResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_AGENT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";

  if (!apiKey || apiKey.startsWith("sk-test")) {
    throw new Error(
      "OPENAI_API_KEY manquante ou invalide. Ajoutez une clé valide dans .env."
    );
  }

  const usedTools: string[] = [];
  const systemPrompt = buildSystemPrompt(new Date());
  let previousResponseId: string | undefined;
  let pendingInput: unknown = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...(await toOpenAIInput(history)),
  ];

  for (let step = 0; step < 8; step += 1) {
    const responsePayload = await runResponsesRequest(
      {
        model,
        input: pendingInput,
        ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
        tools: agentFunctionTools,
      },
      apiKey
    );

    const calls = extractFunctionCalls(responsePayload);
    if (!calls.length) {
      const assistantText =
        extractAssistantText(responsePayload) ||
        "Je n'ai pas réussi à produire une réponse exploitable.";

      return {
        assistantText,
        usedTools,
      };
    }

    const callOutputs: Array<{ type: string; call_id: string; output: string }> = [];

    for (const call of calls) {
      const args = parseFunctionArgs(call.arguments);
      const output = await executeAgentTool(call.name!, args, context);

      usedTools.push(call.name!);
      callOutputs.push({
        type: "function_call_output",
        call_id: call.call_id!,
        output,
      });
    }

    previousResponseId =
      typeof responsePayload.id === "string" ? responsePayload.id : previousResponseId;
    pendingInput = callOutputs;
  }

  return {
    assistantText:
      "J'ai atteint la limite d'étapes d'outil. Reformule la demande en plus court pour que je l'exécute.",
    usedTools,
  };
}
