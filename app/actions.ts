"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  BudgetDocumentType,
  BudgetEntrySource,
  BudgetEntryType,
  Prisma,
} from "@prisma/client";
import { randomBytes } from "crypto";
import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/auth";
import { getBudgetRuntimeDelegates, withBudgetTablesGuard } from "@/lib/budget";
import { prisma } from "@/lib/db";
import { buildInviteUrl, hasEmailServerConfig, sendEmail } from "@/lib/email";
import { buildImportantDateOccurrences } from "@/lib/important-dates";
import {
  notifyInviteAccepted,
  notifyProjectCreated,
  notifyTaskAssigned,
  notifyTaskCommented,
  notifyTaskStatusChanged,
} from "@/lib/notifications";
import { z } from "zod";

const nameSchema = z
  .string()
  .min(2, "Le nom est trop court")
  .max(100, "Le nom est trop long");

const optionalString = z.string().trim().optional();
const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value) : undefined));
const cuidSchema = z.string().cuid();
const emailSchema = z.string().trim().email("Email invalide").toLowerCase();
const commentSchema = z
  .string()
  .trim()
  .min(2, "Le commentaire est trop court")
  .max(2000, "Le commentaire est trop long");
const shoppingItemSchema = z
  .string()
  .trim()
  .min(1, "L'article est vide")
  .max(200, "L'article est trop long");
const budgetLabelSchema = z
  .string()
  .trim()
  .min(1, "Le libellé est requis")
  .max(200, "Le libellé est trop long");
const budgetNotesSchema = z.string().trim().max(2000).optional();
const budgetTypeSchema = z.enum(["INCOME", "EXPENSE"]);
const budgetDocumentTypeSchema = z.enum(["RECEIPT", "INVOICE", "QUOTE", "OTHER"]);
const importantDateTypeSchema = z.enum([
  "BIRTHDAY",
  "ANNIVERSARY",
  "EVENT",
  "OTHER",
]);
const importantDateTitleSchema = z
  .string()
  .trim()
  .min(2, "Le titre est trop court")
  .max(120, "Le titre est trop long");
const importantDateDescriptionSchema = z.string().trim().max(500).optional();
const shoppingItemEstimateSchema = z.object({
  estimatedCostCents: z.number().int().min(0).max(200_000),
});
const HOUSE_ICON_MAX_BYTES = 5 * 1024 * 1024;
const HOUSE_ICON_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const recurrenceUnitSchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);
const SHOPPING_TABLES_UNAVAILABLE_MESSAGE =
  "Les listes d'achats ne sont pas encore disponibles: lance `npm run db:push` puis recharge la page.";
const BUDGET_ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);
const BUDGET_DOCUMENT_MAX_BYTES = 20 * 1024 * 1024;
const BUDGET_MONTH_REGEX = /^\d{4}-\d{2}$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isShoppingTableUnavailableError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")) ||
    (error instanceof TypeError &&
      error.message.includes("Cannot read properties of undefined"))
  );
}

function isEstimatedCostFieldUnavailableError(error: unknown) {
  if (error instanceof Prisma.PrismaClientValidationError) {
    const message = error.message.toLowerCase();
    return (
      message.includes("estimatedcostcents") &&
      (message.includes("unknown argument") || message.includes("unknown field"))
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code !== "P2022") {
      return false;
    }

    const meta = error.meta as { column?: unknown } | undefined;
    const metaColumn = typeof meta?.column === "string" ? meta.column.toLowerCase() : "";
    const message = error.message.toLowerCase();

    return (
      metaColumn.includes("estimatedcostcents") ||
      message.includes("estimatedcostcents")
    );
  }

  return false;
}

async function withShoppingTablesGuard<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (isShoppingTableUnavailableError(error)) {
      throw new Error(SHOPPING_TABLES_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }
}

async function requireUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return session.user.id;
}

async function requireSessionUser() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }
  return {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email ?? null,
  };
}

async function requireMembership(userId: string, houseId: string) {
  const membership = await prisma.houseMember.findFirst({
    where: { userId, houseId },
  });

  if (!membership) {
    throw new Error("Forbidden");
  }

  return membership;
}

async function requireOwner(userId: string, houseId: string) {
  const membership = await requireMembership(userId, houseId);
  if (membership.role !== "OWNER") {
    throw new Error("Forbidden");
  }
  return membership;
}

async function requireHouseEntity<T extends { houseId: string }>(
  entity: T | null
) {
  if (!entity) {
    throw new Error("Ressource introuvable");
  }
  return entity;
}

async function requireShoppingListEntity(shoppingListId: string) {
  const shoppingList = await withShoppingTablesGuard(() =>
    prisma.shoppingList.findUnique({
      where: { id: shoppingListId },
      select: { id: true, houseId: true, name: true },
    })
  );

  if (!shoppingList) {
    throw new Error("Liste d'achat introuvable");
  }

  return shoppingList;
}

async function requireShoppingItemEntity(itemId: string) {
  const item = await withShoppingTablesGuard(() =>
    prisma.shoppingListItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        name: true,
        estimatedCostCents: true,
        shoppingListId: true,
        shoppingList: {
          select: { houseId: true },
        },
      },
    })
  );

  if (!item) {
    throw new Error("Article introuvable");
  }

  return item;
}

async function resolveRelationId(
  houseId: string,
  model: "zone" | "category" | "animal" | "person" | "project" | "equipment",
  id: string | undefined
) {
  if (!id) return null;
  if (model === "zone") {
    const record = await prisma.zone.findFirst({
      where: { id, houseId },
      select: { id: true },
    });
    return record ? id : null;
  }
  if (model === "category") {
    const record = await prisma.category.findFirst({
      where: { id, houseId },
      select: { id: true },
    });
    return record ? id : null;
  }
  if (model === "animal") {
    const record = await prisma.animal.findFirst({
      where: { id, houseId },
      select: { id: true },
    });
    return record ? id : null;
  }
  if (model === "project") {
    const record = await prisma.project.findFirst({
      where: { id, houseId },
      select: { id: true },
    });
    return record ? id : null;
  }
  if (model === "equipment") {
    const record = await prisma.equipment.findFirst({
      where: { id, houseId },
      select: { id: true },
    });
    return record ? id : null;
  }
  const record = await prisma.person.findFirst({
    where: { id, houseId },
    select: { id: true },
  });
  return record ? id : null;
}

function parseDateInput(value?: string | null) {
  if (!value) return null;
  return new Date(`${value}T12:00:00`);
}

function parseRequiredDateInput(value: FormDataEntryValue | null, fieldName: string) {
  const raw = z.string().trim().parse(value);

  if (!ISO_DATE_REGEX.test(raw)) {
    throw new Error(`${fieldName} doit être au format YYYY-MM-DD`);
  }

  const parsed = parseDateInput(raw);
  if (!parsed || Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} est invalide`);
  }
  return parsed;
}

function parseMonthInput(value: FormDataEntryValue | null, fieldName: string) {
  const raw = z.string().trim().parse(value);

  if (!BUDGET_MONTH_REGEX.test(raw)) {
    throw new Error(`${fieldName} doit être au format YYYY-MM`);
  }

  const [year, month] = raw.split("-").map(Number);
  if (month < 1 || month > 12) {
    throw new Error(`${fieldName} est invalide`);
  }

  return new Date(year, month - 1, 1, 12, 0, 0, 0);
}

function parseOptionalMonthInput(value: FormDataEntryValue | null, fieldName: string) {
  if (!value) return null;
  return parseMonthInput(value, fieldName);
}

function parseAmountCentsInput(value: FormDataEntryValue | null, fieldName: string) {
  const raw = z.string().trim().parse(value);

  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new Error(`${fieldName} est invalide`);
  }

  if (amount < 0) {
    throw new Error(`${fieldName} doit être positif`);
  }

  if (amount > 1_000_000) {
    throw new Error(`${fieldName} est trop élevé`);
  }

  return Math.round(amount * 100);
}

function parseOptionalDayOfMonth(value: FormDataEntryValue | null) {
  if (!value) return null;
  const raw = z.string().trim().parse(value);
  if (!raw) return null;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) {
    throw new Error("Le jour du mois doit être entre 1 et 31");
  }
  return parsed;
}

function resolveBudgetDocumentExtension(mimeType: string) {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  if (mimeType === "image/heic") return "heic";
  if (mimeType === "image/heif") return "heif";
  return "bin";
}

const budgetDocumentExtractionSchema = z.object({
  label: z.string().trim().min(1).max(200),
  amountCents: z.number().int().min(0).max(1_000_000_000),
  occurredOn: z
    .string()
    .trim()
    .regex(ISO_DATE_REGEX)
    .optional(),
  isForecast: z.boolean().optional(),
  documentType: z.enum(["RECEIPT", "INVOICE", "QUOTE", "OTHER"]).optional(),
  supplier: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(1000).optional(),
});

type BudgetDocumentExtraction = z.infer<typeof budgetDocumentExtractionSchema>;

async function extractBudgetDocumentWithOpenAI({
  file,
  fallbackMonth,
}: {
  file: File;
  fallbackMonth?: string | null;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    throw new Error(
      "OPENAI_API_KEY manquante ou invalide. Ajoutez une clé valide dans .env."
    );
  }

  const model =
    process.env.OPENAI_BUDGET_MODEL ||
    process.env.OPENAI_AGENT_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const userPrompt = [
    "Tu extrais des informations de dépense depuis un justificatif (ticket, facture, devis).",
    `Date actuelle: ${todayIso}.`,
    fallbackMonth
      ? `Mois de fallback si la date exacte est introuvable: ${fallbackMonth}.`
      : "Si la date exacte est introuvable, utilise la date actuelle.",
    "Montant attendu: total TTC payé ou prévu.",
    "isForecast doit être true pour un devis non payé ou une dépense future.",
    "Réponds strictement dans le JSON demandé.",
  ].join("\n");

  const content: Array<Record<string, unknown>> = [
    { type: "input_text", text: userPrompt },
  ];

  if (file.type === "application/pdf") {
    content.push({
      type: "input_file",
      filename: file.name,
      file_data: base64,
    });
  } else {
    content.push({
      type: "input_image",
      image_url: `data:${file.type};base64,${base64}`,
    });
  }

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
          content,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "budget_document_extraction",
          schema: {
            type: "object",
            properties: {
              label: {
                type: "string",
                minLength: 1,
                maxLength: 200,
              },
              amountCents: {
                type: "integer",
                minimum: 0,
                maximum: 1000000000,
              },
              occurredOn: {
                type: "string",
                pattern: "^\\d{4}-\\d{2}-\\d{2}$",
              },
              isForecast: {
                type: "boolean",
              },
              documentType: {
                type: "string",
                enum: ["RECEIPT", "INVOICE", "QUOTE", "OTHER"],
              },
              supplier: {
                type: "string",
                maxLength: 200,
              },
              notes: {
                type: "string",
                maxLength: 1000,
              },
            },
            required: ["label", "amountCents"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const outputText = extractOpenAIOutputText(payload);
  if (!outputText) {
    throw new Error("L'extraction du document n'a pas produit de résultat.");
  }

  const parsed = JSON.parse(outputText);
  return budgetDocumentExtractionSchema.parse(parsed);
}

function resolveDocumentDate(
  extraction: BudgetDocumentExtraction,
  fallbackMonth: string | null
) {
  if (extraction.occurredOn) {
    const parsed = parseDateInput(extraction.occurredOn);
    if (parsed && !Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (fallbackMonth && BUDGET_MONTH_REGEX.test(fallbackMonth)) {
    const [year, month] = fallbackMonth.split("-").map(Number);
    return new Date(year, month - 1, 1, 12, 0, 0, 0);
  }

  return new Date();
}

function extractOpenAIOutputText(payload: Record<string, unknown>) {
  const outputText = payload.output_text;
  if (typeof outputText === "string" && outputText.trim()) {
    return outputText.trim();
  }

  const output = Array.isArray(payload.output)
    ? (payload.output as Array<{
        content?: Array<{ type?: string; text?: string }>;
      }>)
    : [];

  for (const item of output) {
    const chunks = Array.isArray(item.content) ? item.content : [];
    for (const chunk of chunks) {
      if (typeof chunk.text === "string" && chunk.text.trim()) {
        return chunk.text.trim();
      }
    }
  }

  return "";
}

function clampEstimatedShoppingCostCents(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(200_000, Math.round(value)));
}

async function estimateShoppingItemCostWithOpenAI(itemName: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    return null;
  }

  const model = process.env.OPENAI_SHOPPING_MODEL || "gpt-4o-mini";
  const prompt = [
    "Tu estimes le prix TTC réaliste d'un article de courses en France métropolitaine.",
    `Article: "${itemName}"`,
    "Le montant doit représenter le prix total de cette ligne de liste de courses.",
    "Si la quantité est implicite ou ambiguë, choisis une estimation médiane réaliste.",
    "Réponds uniquement avec le JSON demandé.",
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "shopping_item_cost_estimate",
          schema: {
            type: "object",
            properties: {
              estimatedCostCents: {
                type: "integer",
                minimum: 0,
                maximum: 200000,
              },
            },
            required: ["estimatedCostCents"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const outputText = extractOpenAIOutputText(payload);
  if (!outputText) {
    return null;
  }

  const parsed = JSON.parse(outputText);
  const result = shoppingItemEstimateSchema.safeParse(parsed);
  if (!result.success) {
    return null;
  }

  return clampEstimatedShoppingCostCents(result.data.estimatedCostCents);
}

async function estimateShoppingItemCostWithOpenAITimebox(
  itemName: string,
  timeoutMs = 2000
) {
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });

    const estimate = await Promise.race([
      estimateShoppingItemCostWithOpenAI(itemName),
      timeoutPromise,
    ]);

    return estimate === null ? null : estimate;
  } catch {
    return null;
  }
}

async function persistShoppingItemEstimatedCost(
  itemId: string,
  estimatedCostCents: number
) {
  try {
    await prisma.shoppingListItem.update({
      where: { id: itemId },
      data: { estimatedCostCents },
    });
    revalidatePath("/app/shopping-lists");
    return true;
  } catch (error) {
    if (isEstimatedCostFieldUnavailableError(error)) {
      return tryPersistShoppingItemCostCentsWithRaw(itemId, estimatedCostCents);
    }

    if (isShoppingTableUnavailableError(error)) {
      return false;
    }
    throw error;
  }
}

async function refineShoppingItemEstimatedCost(itemId: string, itemName: string) {
  const refinedEstimate = await estimateShoppingItemCostWithOpenAI(itemName);
  if (refinedEstimate === null) {
    return;
  }
  await persistShoppingItemEstimatedCost(itemId, refinedEstimate);
}

async function tryPersistShoppingItemCostCentsWithRaw(
  itemId: string,
  estimatedCostCents: number
) {
  try {
    await prisma.$executeRaw`
      UPDATE "ShoppingListItem"
      SET "estimatedCostCents" = ${estimatedCostCents}
      WHERE "id" = ${itemId}
    `;
    revalidatePath("/app/shopping-lists");
    return true;
  } catch (error) {
    if (
      isEstimatedCostFieldUnavailableError(error) ||
      isShoppingTableUnavailableError(error)
    ) {
      return false;
    }
    console.warn("Raw shopping cost persistence skipped:", error);
    return false;
  }
}

function resolveHouseIconExtension(mimeType: string) {
  return HOUSE_ICON_MIME_TO_EXT[mimeType];
}

async function removeStoredHouseIcon(iconUrl?: string | null) {
  if (!iconUrl || !iconUrl.startsWith("/house-icons/")) {
    return;
  }

  const iconFilename = path.basename(iconUrl);
  const iconPath = path.join(process.cwd(), "public", "house-icons", iconFilename);

  try {
    await unlink(iconPath);
  } catch {
    // ignore missing or locked files
  }
}

async function generateAndAttachTaskImage(
  taskId: string,
  title: string,
  description?: string | null
) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    console.warn("OpenAI image generation skipped: missing API key.");
    return;
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const prompt = `Illustration cartoon fun, chaleureuse et colorée de: ${title}. ${
    description ? `Détails: ${description}.` : ""
  } Style: illustration simple, propre, sans texte.`;

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt,
        size: "1024x1024",
        output_format: "png",
      }),
    });
  } catch (error) {
    console.error("OpenAI image generation failed (network).", error);
    return;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI image generation failed.", response.status, errorText);
    return;
  }

  const data = await response.json();
  const imagesDir = path.join(process.cwd(), "public", "task-images");
  await mkdir(imagesDir, { recursive: true });
  const filePath = path.join(imagesDir, `${taskId}.png`);

  const b64 = data?.data?.[0]?.b64_json;
  if (b64) {
    await writeFile(filePath, Buffer.from(b64, "base64"));
  } else if (data?.data?.[0]?.url) {
    const imageResponse = await fetch(data.data[0].url);
    if (!imageResponse.ok) {
      console.error("OpenAI image download failed.", imageResponse.status);
      return;
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));
  } else {
    console.error("OpenAI image generation returned empty payload.");
    return;
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { imageUrl: `/task-images/${taskId}.png` },
  });
}

export async function regenerateTaskImage(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { houseId: true, title: true, description: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  await generateAndAttachTaskImage(taskId, task.title, task.description);

  revalidateApp();
  revalidatePath(`/app/tasks/${taskId}`);
}

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/app");
  revalidatePath("/app/tasks");
  revalidatePath("/app/calendar");
  revalidatePath("/app/budgets");
  revalidatePath("/app/shopping-lists");
  revalidatePath("/app/settings");
  revalidatePath("/app/notifications");
}

export async function createHouse(formData: FormData) {
  const userId = await requireUser();
  const name = nameSchema.parse(formData.get("name"));

  await prisma.house.create({
    data: {
      name,
      createdById: userId,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
      zones: {
        create: [{ name: "Intérieur" }, { name: "Jardin" }],
      },
      categories: {
        create: [
          { name: "Entretien" },
          { name: "Bricolage" },
          { name: "Administratif" },
        ],
      },
    },
  });

  revalidateApp();
  redirect("/app");
}

export async function uploadHouseIcon(formData: FormData) {
  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const iconFile = formData.get("iconFile");

  await requireOwner(userId, houseId);

  if (!(iconFile instanceof File) || iconFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (iconFile.size > HOUSE_ICON_MAX_BYTES) {
    throw new Error("L'image est trop lourde (5 Mo max)");
  }

  const extension = resolveHouseIconExtension(iconFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const house = await prisma.house.findUnique({
    where: { id: houseId },
    select: { id: true, iconUrl: true },
  });

  if (!house) {
    throw new Error("Maison introuvable");
  }

  const houseIconsDir = path.join(process.cwd(), "public", "house-icons");
  await mkdir(houseIconsDir, { recursive: true });

  const filename = `${houseId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const iconPath = path.join(houseIconsDir, filename);
  const iconBuffer = Buffer.from(await iconFile.arrayBuffer());
  await writeFile(iconPath, iconBuffer);

  const newIconUrl = `/house-icons/${filename}`;
  await prisma.house.update({
    where: { id: houseId },
    data: {
      iconUrl: newIconUrl,
    },
  });
  await removeStoredHouseIcon(house.iconUrl);

  revalidateApp();
}

export async function removeHouseIcon(formData: FormData) {
  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));

  await requireOwner(userId, houseId);

  const house = await prisma.house.findUnique({
    where: { id: houseId },
    select: { id: true, iconUrl: true },
  });

  if (!house) {
    throw new Error("Maison introuvable");
  }

  await prisma.house.update({
    where: { id: houseId },
    data: { iconUrl: null },
  });

  await removeStoredHouseIcon(house.iconUrl);

  revalidateApp();
}

export async function createZone(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));

  await requireOwner(userId, houseId);

  await prisma.zone.create({
    data: { houseId, name },
  });

  revalidateApp();
}

export async function createCategory(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));

  await requireOwner(userId, houseId);

  await prisma.category.create({
    data: { houseId, name },
  });

  revalidateApp();
}

export async function createAnimal(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));
  const species = optionalString.parse(formData.get("species")?.toString());

  await requireOwner(userId, houseId);

  await prisma.animal.create({
    data: { houseId, name, species },
  });

  revalidateApp();
}

export async function createPerson(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));
  const relation = optionalString.parse(formData.get("relation")?.toString());

  await requireOwner(userId, houseId);

  await prisma.person.create({
    data: { houseId, name, relation },
  });

  revalidateApp();
}

export async function createProject(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));
  const description = optionalString.parse(formData.get("description")?.toString());
  const startsAt = parseDateInput(formData.get("startsAt")?.toString());
  const endsAt = parseDateInput(formData.get("endsAt")?.toString());

  await requireOwner(userId, houseId);

  const project = await prisma.project.create({
    data: {
      houseId,
      name,
      description,
      startsAt,
      endsAt,
    },
    select: { id: true, name: true },
  });

  await notifyProjectCreated({
    houseId,
    projectId: project.id,
    projectName: project.name,
    actorId: userId,
  });

  revalidateApp();
}

export async function updateProject(formData: FormData) {
  const userId = await requireUser();
  const projectId = cuidSchema.parse(formData.get("projectId"));
  const name = nameSchema.parse(formData.get("name"));
  const description = optionalString.parse(formData.get("description")?.toString());
  const startsAt = parseDateInput(formData.get("startsAt")?.toString());
  const endsAt = parseDateInput(formData.get("endsAt")?.toString());

  const project = await requireHouseEntity(
    await prisma.project.findUnique({ where: { id: projectId } })
  );
  await requireOwner(userId, project.houseId);

  await prisma.project.update({
    where: { id: projectId },
    data: { name, description, startsAt, endsAt },
  });

  revalidateApp();
}

export async function deleteProject(formData: FormData) {
  const userId = await requireUser();
  const projectId = cuidSchema.parse(formData.get("projectId"));

  const project = await requireHouseEntity(
    await prisma.project.findUnique({ where: { id: projectId } })
  );
  await requireOwner(userId, project.houseId);

  await prisma.project.delete({ where: { id: projectId } });

  revalidateApp();
}

export async function createEquipment(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));
  const location = optionalString.parse(formData.get("location")?.toString());
  const category = optionalString.parse(formData.get("category")?.toString());
  const purchasedAt = parseDateInput(formData.get("purchasedAt")?.toString());
  const installedAt = parseDateInput(formData.get("installedAt")?.toString());
  const lifespanMonths = optionalNumber.parse(
    formData.get("lifespanMonths")?.toString()
  );

  await requireOwner(userId, houseId);

  await prisma.equipment.create({
    data: {
      houseId,
      name,
      location,
      category,
      purchasedAt,
      installedAt,
      lifespanMonths:
        Number.isFinite(lifespanMonths) && lifespanMonths !== undefined
          ? lifespanMonths
          : null,
    },
  });

  revalidateApp();
}

export async function updateEquipment(formData: FormData) {
  const userId = await requireUser();
  const equipmentId = cuidSchema.parse(formData.get("equipmentId"));
  const name = nameSchema.parse(formData.get("name"));
  const location = optionalString.parse(formData.get("location")?.toString());
  const category = optionalString.parse(formData.get("category")?.toString());
  const purchasedAt = parseDateInput(formData.get("purchasedAt")?.toString());
  const installedAt = parseDateInput(formData.get("installedAt")?.toString());
  const lifespanMonths = optionalNumber.parse(
    formData.get("lifespanMonths")?.toString()
  );

  const equipment = await requireHouseEntity(
    await prisma.equipment.findUnique({ where: { id: equipmentId } })
  );
  await requireOwner(userId, equipment.houseId);

  await prisma.equipment.update({
    where: { id: equipmentId },
    data: {
      name,
      location,
      category,
      purchasedAt,
      installedAt,
      lifespanMonths:
        Number.isFinite(lifespanMonths) && lifespanMonths !== undefined
          ? lifespanMonths
          : null,
    },
  });

  revalidateApp();
}

export async function deleteEquipment(formData: FormData) {
  const userId = await requireUser();
  const equipmentId = cuidSchema.parse(formData.get("equipmentId"));

  const equipment = await requireHouseEntity(
    await prisma.equipment.findUnique({ where: { id: equipmentId } })
  );
  await requireOwner(userId, equipment.houseId);

  await prisma.equipment.delete({ where: { id: equipmentId } });

  revalidateApp();
}

export async function createShoppingList(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));

  await requireMembership(userId, houseId);

  await withShoppingTablesGuard(() =>
    prisma.shoppingList.create({
      data: {
        houseId,
        name,
      },
    })
  );

  revalidateApp();
}

export async function addShoppingListItem(formData: FormData) {
  const userId = await requireUser();
  const shoppingListId = cuidSchema.parse(formData.get("shoppingListId"));
  const name = shoppingItemSchema.parse(formData.get("name"));

  const shoppingList = await requireShoppingListEntity(shoppingListId);
  await requireMembership(userId, shoppingList.houseId);

  const createdItem = await withShoppingTablesGuard(() =>
    prisma.shoppingListItem.create({
      data: {
        shoppingListId,
        name,
      },
      select: { id: true, name: true },
    })
  );

  const aiEstimateCents = await estimateShoppingItemCostWithOpenAITimebox(name);

  if (aiEstimateCents !== null) {
    await persistShoppingItemEstimatedCost(createdItem.id, aiEstimateCents);
  } else {
    void refineShoppingItemEstimatedCost(createdItem.id, createdItem.name).catch(
      (error) => {
        console.warn("Shopping item estimate refinement skipped:", error);
      }
    );
  }

  revalidateApp();
}

export async function toggleShoppingListItem(formData: FormData) {
  const userId = await requireUser();
  const itemId = cuidSchema.parse(formData.get("itemId"));
  const completed = formData.get("completed")?.toString() === "true";

  const item = await requireShoppingItemEntity(itemId);
  await requireMembership(userId, item.shoppingList.houseId);

  await withShoppingTablesGuard(() =>
    prisma.shoppingListItem.update({
      where: { id: itemId },
      data: { completed },
    })
  );

  revalidateApp();
}

export async function clearShoppingList(formData: FormData) {
  const userId = await requireUser();
  const shoppingListId = cuidSchema.parse(formData.get("shoppingListId"));

  const shoppingList = await requireShoppingListEntity(shoppingListId);
  await requireMembership(userId, shoppingList.houseId);

  await withShoppingTablesGuard(() =>
    prisma.shoppingListItem.deleteMany({
      where: { shoppingListId },
    })
  );

  revalidateApp();
}

export async function deleteShoppingList(formData: FormData) {
  const userId = await requireUser();
  const shoppingListId = cuidSchema.parse(formData.get("shoppingListId"));

  const shoppingList = await requireShoppingListEntity(shoppingListId);
  await requireMembership(userId, shoppingList.houseId);

  await withShoppingTablesGuard(() =>
    prisma.shoppingList.delete({
      where: { id: shoppingListId },
    })
  );

  revalidateApp();
}

export async function createBudgetEntry(formData: FormData) {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
    );
  }

  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const type = budgetTypeSchema.parse(formData.get("type"));
  const label = budgetLabelSchema.parse(formData.get("label"));
  const amountCents = parseAmountCentsInput(formData.get("amount"), "Le montant");
  const occurredOn = parseRequiredDateInput(formData.get("occurredOn"), "La date");
  const notes = budgetNotesSchema.parse(formData.get("notes")?.toString());
  const isForecast = formData.get("isForecast")?.toString() === "true";

  await requireMembership(userId, houseId);

  await withBudgetTablesGuard(() =>
    prisma.budgetEntry.create({
      data: {
        houseId,
        createdById: userId,
        type,
        source: BudgetEntrySource.MANUAL,
        label,
        amountCents,
        occurredOn,
        isForecast,
        notes: notes || null,
      },
    })
  );

  revalidateApp();
}

export async function deleteBudgetEntry(formData: FormData) {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
    );
  }

  const userId = await requireUser();
  const entryId = cuidSchema.parse(formData.get("entryId"));

  const entry = await withBudgetTablesGuard(() =>
    prisma.budgetEntry.findUnique({
      where: { id: entryId },
      select: { id: true, houseId: true },
    })
  );

  if (!entry) {
    throw new Error("Écriture budget introuvable");
  }

  await requireMembership(userId, entry.houseId);

  await withBudgetTablesGuard(() =>
    prisma.budgetEntry.delete({
      where: { id: entryId },
    })
  );

  revalidateApp();
}

export async function createBudgetRecurringEntry(formData: FormData) {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
    );
  }

  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const type = budgetTypeSchema.parse(formData.get("type"));
  const label = budgetLabelSchema.parse(formData.get("label"));
  const amountCents = parseAmountCentsInput(formData.get("amount"), "Le montant");
  const dayOfMonth = parseOptionalDayOfMonth(formData.get("dayOfMonth"));
  const startMonth = parseMonthInput(formData.get("startMonth"), "Le mois de début");
  const endMonth = parseOptionalMonthInput(formData.get("endMonth"), "Le mois de fin");
  const notes = budgetNotesSchema.parse(formData.get("notes")?.toString());

  if (endMonth && endMonth.getTime() < startMonth.getTime()) {
    throw new Error("Le mois de fin doit être postérieur au mois de début");
  }

  await requireMembership(userId, houseId);

  await withBudgetTablesGuard(() =>
    prisma.budgetRecurringEntry.create({
      data: {
        houseId,
        createdById: userId,
        type,
        label,
        amountCents,
        dayOfMonth,
        startMonth,
        endMonth,
        notes: notes || null,
      },
    })
  );

  revalidateApp();
}

export async function deleteBudgetRecurringEntry(formData: FormData) {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
    );
  }

  const userId = await requireUser();
  const recurringEntryId = cuidSchema.parse(formData.get("recurringEntryId"));

  const recurringEntry = await withBudgetTablesGuard(() =>
    prisma.budgetRecurringEntry.findUnique({
      where: { id: recurringEntryId },
      select: { id: true, houseId: true },
    })
  );

  if (!recurringEntry) {
    throw new Error("Règle récurrente introuvable");
  }

  await requireMembership(userId, recurringEntry.houseId);

  await withBudgetTablesGuard(() =>
    prisma.budgetRecurringEntry.delete({
      where: { id: recurringEntryId },
    })
  );

  revalidateApp();
}

export async function convertShoppingItemToBudgetExpense(formData: FormData) {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
    );
  }

  const userId = await requireUser();
  const itemId = cuidSchema.parse(formData.get("itemId"));
  const amountCents = parseAmountCentsInput(formData.get("amount"), "Le montant");
  const occurredOn = parseRequiredDateInput(formData.get("occurredOn"), "La date");
  const notes = budgetNotesSchema.parse(formData.get("notes")?.toString());

  const item = await requireShoppingItemEntity(itemId);
  await requireMembership(userId, item.shoppingList.houseId);

  await withBudgetTablesGuard(async () => {
    const existing = await prisma.budgetEntry.findUnique({
      where: { shoppingListItemId: itemId },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Cet article est déjà converti en dépense.");
    }

    await prisma.$transaction([
      prisma.budgetEntry.create({
        data: {
          houseId: item.shoppingList.houseId,
          createdById: userId,
          type: BudgetEntryType.EXPENSE,
          source: BudgetEntrySource.SHOPPING_LIST,
          label: item.name,
          amountCents,
          occurredOn,
          isForecast: false,
          notes: notes || null,
          shoppingListItemId: item.id,
        },
      }),
      prisma.shoppingListItem.update({
        where: { id: item.id },
        data: { completed: true },
      }),
    ]);
  });

  revalidateApp();
}

export async function convertShoppingListToBudgetExpense(formData: FormData) {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
    );
  }

  const userId = await requireUser();
  const shoppingListId = cuidSchema.parse(formData.get("shoppingListId"));
  const amountCents = parseAmountCentsInput(formData.get("amount"), "Le montant");
  const occurredOn = parseRequiredDateInput(formData.get("occurredOn"), "La date");
  const notes = budgetNotesSchema.parse(formData.get("notes")?.toString());

  const shoppingList = await requireShoppingListEntity(shoppingListId);
  await requireMembership(userId, shoppingList.houseId);

  await withBudgetTablesGuard(async () => {
    const existing = await prisma.budgetEntry.findUnique({
      where: { shoppingListId },
      select: { id: true },
    });

    if (existing) {
      throw new Error("Cette liste est déjà convertie en dépense.");
    }

    await prisma.$transaction([
      prisma.budgetEntry.create({
        data: {
          houseId: shoppingList.houseId,
          createdById: userId,
          type: BudgetEntryType.EXPENSE,
          source: BudgetEntrySource.SHOPPING_LIST,
          label: `Courses - ${shoppingList.name}`,
          amountCents,
          occurredOn,
          isForecast: false,
          notes: notes || null,
          shoppingListId,
        },
      }),
      prisma.shoppingListItem.updateMany({
        where: { shoppingListId },
        data: { completed: true },
      }),
    ]);
  });

  revalidateApp();
}

export async function uploadBudgetDocumentAndCreateExpense(formData: FormData) {
  if (!getBudgetRuntimeDelegates()) {
    throw new Error(
      "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
    );
  }

  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const file = formData.get("document");
  const fallbackMonthRaw = formData.get("fallbackMonth")?.toString().trim() || null;
  const forceForecast = formData.get("forceForecast")?.toString() === "true";

  await requireMembership(userId, houseId);
  await withBudgetTablesGuard(() =>
    prisma.budgetEntry.findFirst({
      where: { houseId },
      select: { id: true },
    })
  );

  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Aucun document sélectionné");
  }

  const mimeType = file.type || "application/octet-stream";
  const isAllowed =
    BUDGET_ALLOWED_MIME_TYPES.has(mimeType) || mimeType.startsWith("image/");

  if (!isAllowed) {
    throw new Error("Formats autorisés: PDF et images");
  }

  if (file.size > BUDGET_DOCUMENT_MAX_BYTES) {
    throw new Error("Le document dépasse 20 Mo");
  }

  if (fallbackMonthRaw && !BUDGET_MONTH_REGEX.test(fallbackMonthRaw)) {
    throw new Error("Le mois de fallback doit être au format YYYY-MM");
  }

  const extraction = await extractBudgetDocumentWithOpenAI({
    file,
    fallbackMonth: fallbackMonthRaw,
  });
  const resolvedType = budgetDocumentTypeSchema.parse(
    extraction.documentType ?? "OTHER"
  ) as BudgetDocumentType;
  const amountCents = extraction.amountCents;

  if (amountCents <= 0) {
    throw new Error("Montant introuvable ou invalide dans le document");
  }

  const occurredOn = resolveDocumentDate(extraction, fallbackMonthRaw);
  const isForecast =
    forceForecast ||
    extraction.isForecast === true ||
    resolvedType === "QUOTE" ||
    occurredOn.getTime() > Date.now();

  const extension = resolveBudgetDocumentExtension(mimeType);
  const docsDir = path.join(process.cwd(), "public", "budget-documents", houseId);
  await mkdir(docsDir, { recursive: true });

  const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
  const absolutePath = path.join(docsDir, fileName);
  const relativePath = `/budget-documents/${houseId}/${fileName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, fileBuffer);

  const label = budgetLabelSchema.parse(extraction.label);
  const notesChunks = [extraction.notes, extraction.supplier ? `Fournisseur: ${extraction.supplier}` : null]
    .filter(Boolean)
    .join("\n");
  const notes = notesChunks ? notesChunks.slice(0, 2000) : null;

  await withBudgetTablesGuard(() =>
    prisma.$transaction(async (tx) => {
      const document = await tx.budgetDocument.create({
        data: {
          houseId,
          uploadedById: userId,
          name: file.name,
          mimeType,
          sizeBytes: file.size,
          path: relativePath,
          documentType: resolvedType,
          issuedOn: occurredOn,
          supplier: extraction.supplier ?? null,
          extractedLabel: label,
          extractedAmountCents: amountCents,
        },
      });

      await tx.budgetEntry.create({
        data: {
          houseId,
          createdById: userId,
          type: BudgetEntryType.EXPENSE,
          source: BudgetEntrySource.DOCUMENT,
          label,
          amountCents,
          occurredOn,
          isForecast,
          notes,
          documentId: document.id,
        },
      });
    })
  );

  revalidateApp();
}

export async function updateZone(formData: FormData) {
  const userId = await requireUser();
  const zoneId = cuidSchema.parse(formData.get("zoneId"));
  const name = nameSchema.parse(formData.get("name"));

  const zone = await requireHouseEntity(
    await prisma.zone.findUnique({ where: { id: zoneId } })
  );
  await requireOwner(userId, zone.houseId);

  await prisma.zone.update({
    where: { id: zoneId },
    data: { name },
  });

  revalidateApp();
}

export async function deleteZone(formData: FormData) {
  const userId = await requireUser();
  const zoneId = cuidSchema.parse(formData.get("zoneId"));

  const zone = await requireHouseEntity(
    await prisma.zone.findUnique({ where: { id: zoneId } })
  );
  await requireOwner(userId, zone.houseId);

  await prisma.zone.delete({ where: { id: zoneId } });

  revalidateApp();
}

export async function updateCategory(formData: FormData) {
  const userId = await requireUser();
  const categoryId = cuidSchema.parse(formData.get("categoryId"));
  const name = nameSchema.parse(formData.get("name"));

  const category = await requireHouseEntity(
    await prisma.category.findUnique({ where: { id: categoryId } })
  );
  await requireOwner(userId, category.houseId);

  await prisma.category.update({
    where: { id: categoryId },
    data: { name },
  });

  revalidateApp();
}

export async function deleteCategory(formData: FormData) {
  const userId = await requireUser();
  const categoryId = cuidSchema.parse(formData.get("categoryId"));

  const category = await requireHouseEntity(
    await prisma.category.findUnique({ where: { id: categoryId } })
  );
  await requireOwner(userId, category.houseId);

  await prisma.category.delete({ where: { id: categoryId } });

  revalidateApp();
}

export async function updateAnimal(formData: FormData) {
  const userId = await requireUser();
  const animalId = cuidSchema.parse(formData.get("animalId"));
  const name = nameSchema.parse(formData.get("name"));
  const species = optionalString.parse(formData.get("species")?.toString());

  const animal = await requireHouseEntity(
    await prisma.animal.findUnique({ where: { id: animalId } })
  );
  await requireOwner(userId, animal.houseId);

  await prisma.animal.update({
    where: { id: animalId },
    data: { name, species },
  });

  revalidateApp();
}

export async function deleteAnimal(formData: FormData) {
  const userId = await requireUser();
  const animalId = cuidSchema.parse(formData.get("animalId"));

  const animal = await requireHouseEntity(
    await prisma.animal.findUnique({ where: { id: animalId } })
  );
  await requireOwner(userId, animal.houseId);

  await prisma.animal.delete({ where: { id: animalId } });

  revalidateApp();
}

export async function updatePerson(formData: FormData) {
  const userId = await requireUser();
  const personId = cuidSchema.parse(formData.get("personId"));
  const name = nameSchema.parse(formData.get("name"));
  const relation = optionalString.parse(formData.get("relation")?.toString());

  const person = await requireHouseEntity(
    await prisma.person.findUnique({ where: { id: personId } })
  );
  await requireOwner(userId, person.houseId);

  await prisma.person.update({
    where: { id: personId },
    data: { name, relation },
  });

  revalidateApp();
}

export async function deletePerson(formData: FormData) {
  const userId = await requireUser();
  const personId = cuidSchema.parse(formData.get("personId"));

  const person = await requireHouseEntity(
    await prisma.person.findUnique({ where: { id: personId } })
  );
  await requireOwner(userId, person.houseId);

  await prisma.person.delete({ where: { id: personId } });

  revalidateApp();
}

export async function createImportantDate(formData: FormData) {
  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const title = importantDateTitleSchema.parse(formData.get("title"));
  const type = importantDateTypeSchema.parse(formData.get("type") ?? "OTHER");
  const date = parseRequiredDateInput(formData.get("date"), "La date");
  const description = importantDateDescriptionSchema.parse(
    formData.get("description")?.toString()
  );
  const isRecurringYearly = formData.get("isRecurringYearly")?.toString() !== "false";

  await requireMembership(userId, houseId);

  await prisma.importantDate.create({
    data: {
      houseId,
      createdById: userId,
      title,
      type,
      date,
      description: description || null,
      isRecurringYearly,
    },
  });

  revalidateApp();
}

export async function updateImportantDate(formData: FormData) {
  const userId = await requireUser();
  const importantDateId = cuidSchema.parse(formData.get("importantDateId"));
  const title = importantDateTitleSchema.parse(formData.get("title"));
  const type = importantDateTypeSchema.parse(formData.get("type") ?? "OTHER");
  const date = parseRequiredDateInput(formData.get("date"), "La date");
  const description = importantDateDescriptionSchema.parse(
    formData.get("description")?.toString()
  );
  const isRecurringYearly = formData.get("isRecurringYearly")?.toString() !== "false";

  const importantDate = await requireHouseEntity(
    await prisma.importantDate.findUnique({
      where: { id: importantDateId },
      select: { houseId: true },
    })
  );

  await requireMembership(userId, importantDate.houseId);

  await prisma.importantDate.update({
    where: { id: importantDateId },
    data: {
      title,
      type,
      date,
      description: description || null,
      isRecurringYearly,
    },
  });

  revalidateApp();
}

export async function deleteImportantDate(formData: FormData) {
  const userId = await requireUser();
  const importantDateId = cuidSchema.parse(formData.get("importantDateId"));

  const importantDate = await requireHouseEntity(
    await prisma.importantDate.findUnique({
      where: { id: importantDateId },
      select: { id: true, houseId: true },
    })
  );

  await requireMembership(userId, importantDate.houseId);

  await prisma.importantDate.delete({
    where: { id: importantDate.id },
  });

  revalidateApp();
}

export async function removeHouseMember(formData: FormData) {
  const userId = await requireUser();
  const memberId = cuidSchema.parse(formData.get("memberId"));

  const membership = await requireHouseEntity(
    await prisma.houseMember.findUnique({
      where: { id: memberId },
    })
  );

  await requireOwner(userId, membership.houseId);

  if (membership.userId === userId) {
    throw new Error("Impossible de se retirer soi-même.");
  }

  if (membership.role === "OWNER") {
    throw new Error("Impossible de retirer un propriétaire.");
  }

  await prisma.$transaction([
    prisma.task.updateMany({
      where: { houseId: membership.houseId, assigneeId: membership.userId },
      data: { assigneeId: null },
    }),
    prisma.houseMember.delete({ where: { id: memberId } }),
  ]);

  revalidateApp();
}

export async function createHouseInvite(formData: FormData) {
  const { id: userId, name: inviterName, email: inviterEmail } = await requireSessionUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const email = emailSchema.parse(formData.get("email"));

  await requireOwner(userId, houseId);

  const house = await prisma.house.findUnique({
    where: { id: houseId },
    select: { name: true },
  });

  if (!house) {
    throw new Error("Maison introuvable.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    const existingMember = await prisma.houseMember.findFirst({
      where: { houseId, userId: existingUser.id },
    });
    if (existingMember) {
      throw new Error("Cet utilisateur est déjà membre de la maison.");
    }
  }

  await prisma.houseInvite.updateMany({
    where: { houseId, email, status: "PENDING" },
    data: { status: "REVOKED" },
  });

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invite = await prisma.houseInvite.create({
    data: {
      houseId,
      email,
      token,
      role: "MEMBER",
      createdById: userId,
      expiresAt,
    },
  });

  const inviteUrl = buildInviteUrl(invite.token);
  const inviterLabel = inviterName || inviterEmail || "Un membre";

  if (hasEmailServerConfig()) {
    await sendEmail({
      to: email,
      subject: `Invitation Homanager pour ${house.name}`,
      text: [
        `${inviterLabel} vous invite à rejoindre la maison "${house.name}" sur Homanager.`,
        "",
        `Cliquez sur ce lien pour accepter l'invitation: ${inviteUrl}`,
        "",
        "Ce lien expire dans 7 jours.",
      ].join("\n"),
      html: [
        `<p><strong>${inviterLabel}</strong> vous invite à rejoindre la maison <strong>${house.name}</strong> sur Homanager.</p>`,
        `<p><a href="${inviteUrl}">Accepter l'invitation</a></p>`,
        "<p>Ce lien expire dans 7 jours.</p>",
      ].join(""),
    });
  } else {
    console.log("\n\nInvite link (dev):", inviteUrl, "\n\n");
  }

  revalidateApp();
}

export async function revokeHouseInvite(formData: FormData) {
  const userId = await requireUser();
  const inviteId = z.string().cuid().parse(formData.get("inviteId"));

  const invite = await prisma.houseInvite.findUnique({
    where: { id: inviteId },
    select: { houseId: true, status: true },
  });

  if (!invite) {
    throw new Error("Invitation introuvable");
  }

  await requireOwner(userId, invite.houseId);

  if (invite.status !== "PENDING") {
    return;
  }

  await prisma.houseInvite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });

  revalidateApp();
}

export async function createTask(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));

  await requireMembership(userId, houseId);

  const title = nameSchema.parse(formData.get("title"));
  const description = optionalString.parse(formData.get("description")?.toString());
  const dueDateRaw = formData.get("dueDate")?.toString();
  const dueDate = dueDateRaw ? new Date(`${dueDateRaw}T12:00:00`) : null;
  const zoneId = await resolveRelationId(
    houseId,
    "zone",
    optionalString.parse(formData.get("zoneId")?.toString())
  );
  const categoryId = await resolveRelationId(
    houseId,
    "category",
    optionalString.parse(formData.get("categoryId")?.toString())
  );
  const animalId = await resolveRelationId(
    houseId,
    "animal",
    optionalString.parse(formData.get("animalId")?.toString())
  );
  const personId = await resolveRelationId(
    houseId,
    "person",
    optionalString.parse(formData.get("personId")?.toString())
  );
  const projectId = await resolveRelationId(
    houseId,
    "project",
    optionalString.parse(formData.get("projectId")?.toString())
  );
  const equipmentId = await resolveRelationId(
    houseId,
    "equipment",
    optionalString.parse(formData.get("equipmentId")?.toString())
  );
  const assigneeId = optionalString.parse(formData.get("assigneeId")?.toString());
  const reminderOffsetDaysRaw = formData.get("reminderOffsetDays")?.toString();
  const reminderOffsetDays = reminderOffsetDaysRaw
    ? Number(reminderOffsetDaysRaw)
    : null;

  const recurrenceUnitRaw = optionalString.parse(
    formData.get("recurrenceUnit")?.toString()
  );
  const recurrenceUnit = recurrenceUnitRaw
    ? recurrenceUnitSchema.parse(recurrenceUnitRaw)
    : null;
  const recurrenceIntervalRaw = formData.get("recurrenceInterval")?.toString();
  const recurrenceInterval = recurrenceIntervalRaw
    ? Number(recurrenceIntervalRaw)
    : null;

  let validAssigneeId: string | null = null;
  if (assigneeId) {
    const isMember = await prisma.houseMember.findFirst({
      where: { houseId, userId: assigneeId },
      select: { id: true },
    });
    if (isMember) {
      validAssigneeId = assigneeId;
    }
  }

  if (recurrenceUnit) {
    const normalizedDueDate = dueDate ?? new Date();
    normalizedDueDate.setHours(12, 0, 0, 0);

    const template = await prisma.task.create({
      data: {
        houseId,
        title,
        description,
        dueDate: normalizedDueDate,
        isTemplate: true,
        recurrenceUnit,
        recurrenceInterval: Number.isFinite(recurrenceInterval)
          ? recurrenceInterval
          : 1,
        reminderOffsetDays:
          Number.isFinite(reminderOffsetDays) && reminderOffsetDays !== null
            ? reminderOffsetDays
            : null,
        createdById: userId,
        assigneeId: validAssigneeId,
        zoneId,
        categoryId,
        animalId,
        personId,
        projectId,
        equipmentId,
      },
    });

    const instance = await prisma.task.create({
      data: {
        houseId,
        title,
        description,
        dueDate: normalizedDueDate,
        reminderOffsetDays:
          Number.isFinite(reminderOffsetDays) && reminderOffsetDays !== null
            ? reminderOffsetDays
            : null,
        createdById: userId,
        assigneeId: validAssigneeId,
        zoneId,
        categoryId,
        animalId,
        personId,
        projectId,
        equipmentId,
        parentId: template.id,
      },
    });

    if (validAssigneeId) {
      await notifyTaskAssigned({
        houseId,
        taskId: instance.id,
        taskTitle: title,
        assigneeId: validAssigneeId,
        actorId: userId,
      });
    }

    await generateAndAttachTaskImage(instance.id, title, description);
  } else {
    const created = await prisma.task.create({
      data: {
        houseId,
        title,
        description,
        dueDate,
        reminderOffsetDays:
          Number.isFinite(reminderOffsetDays) && reminderOffsetDays !== null
            ? reminderOffsetDays
            : null,
        createdById: userId,
        assigneeId: validAssigneeId,
        zoneId,
        categoryId,
        animalId,
        personId,
        projectId,
        equipmentId,
      },
    });

    if (validAssigneeId) {
      await notifyTaskAssigned({
        houseId,
        taskId: created.id,
        taskTitle: title,
        assigneeId: validAssigneeId,
        actorId: userId,
      });
    }

    await generateAndAttachTaskImage(created.id, title, description);
  }

  revalidateApp();
}

export async function updateTaskStatus(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));
  const status =
    formData.get("status")?.toString() === "DONE" ? "DONE" : "TODO";

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      houseId: true,
      status: true,
      title: true,
      createdById: true,
      assigneeId: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  await prisma.task.update({
    where: { id: taskId },
    data: { status },
  });

  if (task.status !== status && status === "DONE") {
    const recipients = [task.createdById, task.assigneeId].filter(
      (id): id is string => Boolean(id)
    );
    await Promise.all(
      recipients.map((recipientId) =>
        notifyTaskStatusChanged({
          houseId: task.houseId,
          taskId,
          taskTitle: task.title,
          recipientId,
          actorId: userId,
          status,
        })
      )
    );
  }

  revalidateApp();
}

export async function updateTaskAssignee(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));
  const assigneeIdRaw = optionalString.parse(formData.get("assigneeId")?.toString());

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { houseId: true, assigneeId: true, title: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  let assigneeId: string | null = null;
  if (assigneeIdRaw) {
    const isMember = await prisma.houseMember.findFirst({
      where: { houseId: task.houseId, userId: assigneeIdRaw },
      select: { id: true },
    });
    if (isMember) {
      assigneeId = assigneeIdRaw;
    }
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { assigneeId },
  });

  if (assigneeId && assigneeId !== task.assigneeId) {
    await notifyTaskAssigned({
      houseId: task.houseId,
      taskId,
      taskTitle: task.title,
      assigneeId,
      actorId: userId,
    });
  }

  revalidateApp();
}

export async function updateTask(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      id: true,
      houseId: true,
      parentId: true,
      isTemplate: true,
      dueDate: true,
      recurrenceUnit: true,
      recurrenceInterval: true,
      createdById: true,
      assigneeId: true,
      parent: {
        select: {
          id: true,
          dueDate: true,
          recurrenceUnit: true,
          recurrenceInterval: true,
          createdById: true,
        },
      },
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  const title = nameSchema.parse(formData.get("title"));
  const description = optionalString.parse(formData.get("description")?.toString());
  const dueDateRaw = formData.get("dueDate")?.toString();
  const dueDate = dueDateRaw ? new Date(`${dueDateRaw}T12:00:00`) : null;
  const reminderOffsetDays = optionalNumber.parse(
    formData.get("reminderOffsetDays")?.toString()
  );
  const recurrenceUnitRaw = optionalString.parse(
    formData.get("recurrenceUnit")?.toString()
  );
  const recurrenceUnit = recurrenceUnitRaw
    ? recurrenceUnitSchema.parse(recurrenceUnitRaw)
    : null;
  const recurrenceIntervalRaw = formData.get("recurrenceInterval")?.toString();
  const recurrenceInterval = recurrenceIntervalRaw
    ? Number(recurrenceIntervalRaw)
    : null;

  const zoneId = await resolveRelationId(
    task.houseId,
    "zone",
    optionalString.parse(formData.get("zoneId")?.toString())
  );
  const categoryId = await resolveRelationId(
    task.houseId,
    "category",
    optionalString.parse(formData.get("categoryId")?.toString())
  );
  const animalId = await resolveRelationId(
    task.houseId,
    "animal",
    optionalString.parse(formData.get("animalId")?.toString())
  );
  const personId = await resolveRelationId(
    task.houseId,
    "person",
    optionalString.parse(formData.get("personId")?.toString())
  );
  const projectId = await resolveRelationId(
    task.houseId,
    "project",
    optionalString.parse(formData.get("projectId")?.toString())
  );
  const equipmentId = await resolveRelationId(
    task.houseId,
    "equipment",
    optionalString.parse(formData.get("equipmentId")?.toString())
  );

  const assigneeIdRaw = optionalString.parse(formData.get("assigneeId")?.toString());
  let assigneeId: string | null = null;
  if (assigneeIdRaw) {
    const isMember = await prisma.houseMember.findFirst({
      where: { houseId: task.houseId, userId: assigneeIdRaw },
      select: { id: true },
    });
    if (isMember) assigneeId = assigneeIdRaw;
  }

  const status =
    formData.get("status")?.toString() === "DONE" ? "DONE" : "TODO";

  const cleanedReminderOffsetDays =
    Number.isFinite(reminderOffsetDays) && reminderOffsetDays !== undefined
      ? reminderOffsetDays
      : null;
  const seriesTemplate = task.parentId ? task.parent : task.isTemplate ? task : null;
  const templateId = task.parentId ?? (task.isTemplate ? taskId : null);

  if (recurrenceUnit) {
    const normalizedDueDate = (dueDate ?? task.dueDate ?? new Date());
    normalizedDueDate.setHours(12, 0, 0, 0);
    const intervalValue =
      Number.isFinite(recurrenceInterval) && recurrenceInterval !== null
        ? recurrenceInterval
        : 1;

    if (templateId) {
      await prisma.task.update({
        where: { id: templateId },
        data: {
          title,
          description,
          dueDate: normalizedDueDate,
          recurrenceUnit,
          recurrenceInterval: intervalValue,
          reminderOffsetDays: cleanedReminderOffsetDays,
          createdById: seriesTemplate?.createdById ?? userId,
          assigneeId,
          zoneId,
          categoryId,
          animalId,
          personId,
          projectId,
          equipmentId,
        },
      });

      if (!task.isTemplate) {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            title,
            description,
            dueDate: normalizedDueDate,
            reminderOffsetDays: cleanedReminderOffsetDays,
            zoneId,
            categoryId,
            animalId,
            personId,
            projectId,
            equipmentId,
            assigneeId,
            status,
            parentId: templateId,
            isTemplate: false,
          },
        });

        await prisma.task.deleteMany({
          where: {
            parentId: templateId,
            NOT: { id: taskId },
          },
        });
      } else {
        await prisma.task.deleteMany({ where: { parentId: templateId } });
      }
    } else {
      const existingTemplate = await prisma.task.findFirst({
        where: {
          houseId: task.houseId,
          isTemplate: true,
          title: { equals: title, mode: "insensitive" },
          recurrenceUnit,
          recurrenceInterval: intervalValue,
          dueDate: normalizedDueDate,
        },
        select: { id: true },
      });

      const template = existingTemplate
        ? { id: existingTemplate.id }
        : await prisma.task.create({
            data: {
              houseId: task.houseId,
              title,
              description,
              dueDate: normalizedDueDate,
              isTemplate: true,
              recurrenceUnit,
              recurrenceInterval: intervalValue,
              reminderOffsetDays: cleanedReminderOffsetDays,
              createdById: task.createdById ?? userId,
              assigneeId,
              zoneId,
              categoryId,
              animalId,
              personId,
              projectId,
              equipmentId,
            },
            select: { id: true },
          });

      await prisma.task.update({
        where: { id: taskId },
        data: {
          title,
          description,
          dueDate: normalizedDueDate,
          reminderOffsetDays: cleanedReminderOffsetDays,
          zoneId,
          categoryId,
          animalId,
          personId,
          projectId,
          equipmentId,
          assigneeId,
          status,
          parentId: template.id,
          isTemplate: false,
        },
      });
    }
  } else if (templateId) {
    const templateDueDate = seriesTemplate?.dueDate ?? null;
    const shouldUseTemplateDate =
      Boolean(task.parentId && templateDueDate && task.dueDate && dueDate) &&
      task.dueDate!.getTime() === dueDate!.getTime();
    const resolvedDueDate = shouldUseTemplateDate ? templateDueDate : dueDate;

    await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        dueDate: resolvedDueDate,
        reminderOffsetDays: cleanedReminderOffsetDays,
        zoneId,
        categoryId,
        animalId,
        personId,
        projectId,
        equipmentId,
        assigneeId,
        status,
        parentId: null,
        isTemplate: false,
        recurrenceUnit: null,
        recurrenceInterval: null,
      },
    });

    const templateIdsToRemove = new Set<string>([templateId]);
    if (seriesTemplate?.recurrenceUnit && seriesTemplate?.dueDate) {
      const duplicates = await prisma.task.findMany({
        where: {
          houseId: task.houseId,
          isTemplate: true,
          id: { not: seriesTemplate.id },
          title: { equals: title, mode: "insensitive" },
          recurrenceUnit: seriesTemplate.recurrenceUnit,
          recurrenceInterval: seriesTemplate.recurrenceInterval ?? 1,
          dueDate: seriesTemplate.dueDate,
        },
        select: { id: true },
      });
      duplicates.forEach((item) => templateIdsToRemove.add(item.id));
    }

    const ids = Array.from(templateIdsToRemove);
    await prisma.$transaction([
      prisma.task.deleteMany({
        where: {
          parentId: { in: ids },
          NOT: { id: taskId },
        },
      }),
      prisma.task.deleteMany({
        where: {
          id: { in: ids.filter((id) => id !== taskId) },
          isTemplate: true,
        },
      }),
    ]);
  } else {
    await prisma.task.update({
      where: { id: taskId },
      data: {
        title,
        description,
        dueDate,
        reminderOffsetDays: cleanedReminderOffsetDays,
        zoneId,
        categoryId,
        animalId,
        personId,
        projectId,
        equipmentId,
        assigneeId,
        status,
      },
    });
  }

  if (assigneeId && assigneeId !== task.assigneeId) {
    await notifyTaskAssigned({
      houseId: task.houseId,
      taskId,
      taskTitle: title,
      assigneeId,
      actorId: userId,
    });
  }

  revalidateApp();
  revalidatePath(`/app/tasks/${taskId}`);
}

export async function deleteTask(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { houseId: true, isTemplate: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  if (task.isTemplate) {
    await prisma.$transaction([
      prisma.task.deleteMany({ where: { parentId: taskId } }),
      prisma.task.delete({ where: { id: taskId } }),
    ]);
  } else {
    await prisma.task.delete({ where: { id: taskId } });
  }

  revalidateApp();
  revalidatePath("/app/tasks");
  redirect("/app/tasks");
}

export async function addTaskComment(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));
  const content = commentSchema.parse(formData.get("content"));

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { houseId: true, title: true, createdById: true, assigneeId: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  await prisma.taskComment.create({
    data: {
      taskId,
      authorId: userId,
      content,
    },
  });

  const recipients = [task.createdById, task.assigneeId].filter(
    (id): id is string => Boolean(id)
  );
  await Promise.all(
    recipients.map((recipientId) =>
      notifyTaskCommented({
        houseId: task.houseId,
        taskId,
        taskTitle: task.title,
        recipientId,
        actorId: userId,
      })
    )
  );

  revalidateApp();
  revalidatePath(`/app/tasks/${taskId}`);
}

export async function updateTaskSuggestion(formData: FormData) {
  const userId = await requireUser();
  const suggestionId = cuidSchema.parse(formData.get("suggestionId"));

  const suggestion = await prisma.taskSuggestion.findUnique({
    where: { id: suggestionId },
    select: { houseId: true },
  });

  if (!suggestion) {
    throw new Error("Suggestion introuvable");
  }

  await requireMembership(userId, suggestion.houseId);

  const title = nameSchema.parse(formData.get("title"));
  const description = optionalString.parse(formData.get("description")?.toString());
  const dueDate = parseDateInput(formData.get("dueDate")?.toString());
  const reminderOffsetDays = optionalNumber.parse(
    formData.get("reminderOffsetDays")?.toString()
  );

  const recurrenceUnitRaw = optionalString.parse(
    formData.get("recurrenceUnit")?.toString()
  );
  const recurrenceUnit = recurrenceUnitRaw
    ? recurrenceUnitSchema.parse(recurrenceUnitRaw)
    : null;
  const recurrenceIntervalRaw = formData.get("recurrenceInterval")?.toString();
  const recurrenceInterval = recurrenceIntervalRaw
    ? Number(recurrenceIntervalRaw)
    : null;

  const zoneId = await resolveRelationId(
    suggestion.houseId,
    "zone",
    optionalString.parse(formData.get("zoneId")?.toString())
  );
  const categoryId = await resolveRelationId(
    suggestion.houseId,
    "category",
    optionalString.parse(formData.get("categoryId")?.toString())
  );
  const projectId = await resolveRelationId(
    suggestion.houseId,
    "project",
    optionalString.parse(formData.get("projectId")?.toString())
  );
  const equipmentId = await resolveRelationId(
    suggestion.houseId,
    "equipment",
    optionalString.parse(formData.get("equipmentId")?.toString())
  );

  await prisma.taskSuggestion.update({
    where: { id: suggestionId },
    data: {
      title,
      description,
      dueDate,
      reminderOffsetDays:
        Number.isFinite(reminderOffsetDays) && reminderOffsetDays !== undefined
          ? reminderOffsetDays
          : null,
      recurrenceUnit,
      recurrenceInterval:
        Number.isFinite(recurrenceInterval) && recurrenceInterval !== null
          ? recurrenceInterval
          : null,
      zoneId,
      categoryId,
      projectId,
      equipmentId,
    },
  });

  revalidateApp();
}

export async function deleteTaskSuggestion(formData: FormData) {
  const userId = await requireUser();
  const suggestionId = cuidSchema.parse(formData.get("suggestionId"));

  const suggestion = await prisma.taskSuggestion.findUnique({
    where: { id: suggestionId },
    select: { houseId: true },
  });

  if (!suggestion) {
    throw new Error("Suggestion introuvable");
  }

  await requireMembership(userId, suggestion.houseId);

  await prisma.taskSuggestion.delete({ where: { id: suggestionId } });

  revalidateApp();
}

export async function applyTaskSuggestion(formData: FormData) {
  const userId = await requireUser();
  const suggestionId = cuidSchema.parse(formData.get("suggestionId"));

  const suggestion = await prisma.taskSuggestion.findUnique({
    where: { id: suggestionId },
  });

  if (!suggestion) {
    throw new Error("Suggestion introuvable");
  }

  await requireMembership(userId, suggestion.houseId);

  if (suggestion.recurrenceUnit) {
    const normalizedDueDate = suggestion.dueDate ?? new Date();
    normalizedDueDate.setHours(12, 0, 0, 0);

    const template = await prisma.task.create({
      data: {
        houseId: suggestion.houseId,
        title: suggestion.title,
        description: suggestion.description,
        dueDate: normalizedDueDate,
        isTemplate: true,
        recurrenceUnit: suggestion.recurrenceUnit,
        recurrenceInterval: suggestion.recurrenceInterval ?? 1,
        reminderOffsetDays: suggestion.reminderOffsetDays,
        createdById: userId,
        zoneId: suggestion.zoneId,
        categoryId: suggestion.categoryId,
        projectId: suggestion.projectId,
        equipmentId: suggestion.equipmentId,
      },
    });

    const instance = await prisma.task.create({
      data: {
        houseId: suggestion.houseId,
        title: suggestion.title,
        description: suggestion.description,
        dueDate: normalizedDueDate,
        reminderOffsetDays: suggestion.reminderOffsetDays,
        createdById: userId,
        zoneId: suggestion.zoneId,
        categoryId: suggestion.categoryId,
        projectId: suggestion.projectId,
        equipmentId: suggestion.equipmentId,
        parentId: template.id,
      },
    });

    await generateAndAttachTaskImage(
      instance.id,
      suggestion.title,
      suggestion.description
    );
  } else {
    const created = await prisma.task.create({
      data: {
        houseId: suggestion.houseId,
        title: suggestion.title,
        description: suggestion.description,
        dueDate: suggestion.dueDate,
        reminderOffsetDays: suggestion.reminderOffsetDays,
        createdById: userId,
        zoneId: suggestion.zoneId,
        categoryId: suggestion.categoryId,
        projectId: suggestion.projectId,
        equipmentId: suggestion.equipmentId,
      },
    });

    await generateAndAttachTaskImage(
      created.id,
      suggestion.title,
      suggestion.description
    );
  }

  await prisma.taskSuggestion.delete({ where: { id: suggestionId } });

  revalidateApp();
}

export async function acceptHouseInvite(formData: FormData) {
  const { id: userId, email, name } = await requireSessionUser();
  const token = z.string().min(10).parse(formData.get("token"));

  const invite = await prisma.houseInvite.findUnique({
    where: { token },
    select: {
      id: true,
      houseId: true,
      status: true,
      expiresAt: true,
      email: true,
      role: true,
      createdById: true,
    },
  });

  if (!invite) {
    throw new Error("Invitation introuvable");
  }

  const now = new Date();
  if (invite.expiresAt < now) {
    await prisma.houseInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    throw new Error("Invitation expirée");
  }

  if (invite.status !== "PENDING") {
    redirect("/app");
  }

  if (!email || email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error("Email de session différent de l'invitation");
  }

  await prisma.$transaction(async (tx) => {
    const existing = await tx.houseMember.findFirst({
      where: { houseId: invite.houseId, userId },
    });
    if (!existing) {
      await tx.houseMember.create({
        data: {
          houseId: invite.houseId,
          userId,
          role: invite.role,
        },
      });
    }

    await tx.houseInvite.update({
      where: { id: invite.id },
      data: { status: "ACCEPTED", acceptedAt: new Date() },
    });
  });

  if (invite.createdById) {
    await notifyInviteAccepted({
      houseId: invite.houseId,
      inviterId: invite.createdById,
      inviteeName: name,
    });
  }

  revalidateApp();
  redirect("/app");
}

export async function generateSuggestedTasks(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const focus = optionalString.parse(formData.get("focus")?.toString()) ?? "";
  const horizonDaysRaw = formData.get("horizonDays")?.toString();
  const horizonDays = z
    .coerce
    .number()
    .min(7)
    .max(180)
    .parse(horizonDaysRaw ?? "30");

  await requireMembership(userId, houseId);

  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

  if (!apiKey || apiKey.startsWith("sk-test")) {
    throw new Error("OPENAI_API_KEY manquante ou invalide");
  }

  const [zones, categories, projects, equipments, importantDates] = await Promise.all([
    prisma.zone.findMany({ where: { houseId } }),
    prisma.category.findMany({ where: { houseId } }),
    prisma.project.findMany({ where: { houseId } }),
    prisma.equipment.findMany({ where: { houseId } }),
    prisma.importantDate.findMany({ where: { houseId } }),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const horizonDate = new Date(today);
  horizonDate.setDate(horizonDate.getDate() + horizonDays);
  const upcomingImportantDates = buildImportantDateOccurrences(
    importantDates.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      date: item.date,
      type: item.type,
      isRecurringYearly: item.isRecurringYearly,
    })),
    { from: today, to: horizonDate }
  ).slice(0, 30);

  const importantDateLabel: Record<string, string> = {
    BIRTHDAY: "Anniversaire",
    ANNIVERSARY: "Commémoration",
    EVENT: "Événement",
    OTHER: "Date importante",
  };
  const importantDatesContext =
    upcomingImportantDates.length === 0
      ? "aucune"
      : upcomingImportantDates
          .map((item) => {
            const dateStr = item.occurrenceDate.toISOString().slice(0, 10);
            const typeLabel = importantDateLabel[item.type] ?? "Date importante";
            return `${dateStr} - ${typeLabel}: ${item.title}`;
          })
          .join("; ");

  const prompt = `Tu es un assistant pour organiser une maison. Propose des tâches utiles pour les ${horizonDays} prochains jours.\n\nContexte: ${focus || "aucun"}\nZones disponibles: ${zones.map((z) => z.name).join(", ") || "aucune"}\nCatégories disponibles: ${categories.map((c) => c.name).join(", ") || "aucune"}\nProjets disponibles: ${projects.map((p) => p.name).join(", ") || "aucun"}\nÉquipements disponibles: ${equipments.map((e) => e.name).join(", ") || "aucun"}\nDates importantes à considérer (non-tâches): ${importantDatesContext}\n\nSi une date importante existe, propose surtout les tâches de préparation utiles (cadeau, réservation, planification), sans recréer la date importante elle-même comme tâche.\n\nRéponds uniquement en JSON avec la clé "tasks" (tableau). Chaque tâche: title (string), description (optionnel), dueDate (YYYY-MM-DD), reminderOffsetDays (optionnel entier), zone (optionnel), category (optionnel), project (optionnel), equipment (optionnel), recurrenceUnit (optionnel: DAILY|WEEKLY|MONTHLY|YEARLY), recurrenceInterval (optionnel entier).`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      text: {
        format: {
          type: "json_schema",
          name: "task_suggestions",
          schema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    description: { type: "string" },
                    dueDate: { type: "string" },
                    reminderOffsetDays: { type: "integer", minimum: 0 },
                    zone: { type: "string" },
                    category: { type: "string" },
                    project: { type: "string" },
                    equipment: { type: "string" },
                    recurrenceUnit: {
                      type: "string",
                      enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
                    },
                    recurrenceInterval: { type: "integer", minimum: 1 },
                  },
                  required: ["title", "dueDate"],
                },
              },
            },
            required: ["tasks"],
            additionalProperties: false,
          },
          strict: true,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI error: ${errorText}`);
  }

  const data = await response.json();
  const content =
    data.output_text ??
    data.output?.[0]?.content?.find((item: { type?: string }) => item.type === "output_text")
      ?.text ??
    data.output?.[0]?.content?.[0]?.text ??
    "";
  if (!content) {
    throw new Error("Réponse OpenAI vide");
  }
  const parsed = JSON.parse(content);

  const zoneMap = new Map(zones.map((zone) => [zone.name.toLowerCase(), zone.id]));
  const categoryMap = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id])
  );
  const projectMap = new Map(
    projects.map((project) => [project.name.toLowerCase(), project.id])
  );
  const equipmentMap = new Map(
    equipments.map((equipment) => [equipment.name.toLowerCase(), equipment.id])
  );

  await prisma.taskSuggestion.deleteMany({ where: { houseId } });

  for (const suggestion of parsed.tasks ?? []) {
    const dueDate = suggestion.dueDate
      ? new Date(`${suggestion.dueDate}T12:00:00`)
      : null;
    const zoneId = suggestion.zone
      ? zoneMap.get(String(suggestion.zone).toLowerCase())
      : undefined;
    const categoryId = suggestion.category
      ? categoryMap.get(String(suggestion.category).toLowerCase())
      : undefined;
    const projectId = suggestion.project
      ? projectMap.get(String(suggestion.project).toLowerCase())
      : undefined;
    const equipmentId = suggestion.equipment
      ? equipmentMap.get(String(suggestion.equipment).toLowerCase())
      : undefined;

    await prisma.taskSuggestion.create({
      data: {
        houseId,
        title: suggestion.title,
        description: suggestion.description ?? "Suggestion automatique",
        dueDate,
        reminderOffsetDays:
          Number.isFinite(suggestion.reminderOffsetDays) &&
          suggestion.reminderOffsetDays !== null
            ? suggestion.reminderOffsetDays
            : null,
        recurrenceUnit: suggestion.recurrenceUnit ?? null,
        recurrenceInterval: suggestion.recurrenceInterval ?? null,
        zoneId: zoneId ?? null,
        categoryId: categoryId ?? null,
        projectId: projectId ?? null,
        equipmentId: equipmentId ?? null,
      },
    });
  }

  revalidateApp();
}

export async function markNotificationRead(formData: FormData) {
  const userId = await requireUser();
  const notificationId = z.string().cuid().parse(formData.get("notificationId"));

  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { readAt: new Date() },
  });

  revalidateApp();
  revalidatePath("/app/notifications");
}

export async function markAllNotificationsRead() {
  const userId = await requireUser();

  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });

  revalidateApp();
  revalidatePath("/app/notifications");
}
