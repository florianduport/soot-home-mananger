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
import { access, mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { authOptions } from "@/auth";
import { getBudgetRuntimeDelegates, withBudgetTablesGuard } from "@/lib/budget";
import { prisma } from "@/lib/db";
import {
  clearEquipmentImageGenerating,
  removeStoredEquipmentImageVariants,
} from "@/lib/equipment-images";
import { buildInviteUrl, hasEmailServerConfig, sendEmail } from "@/lib/email";
import { buildImportantDateOccurrences } from "@/lib/important-dates";
import {
  enqueueEquipmentIllustration,
  enqueueProjectIllustration,
  enqueueTaskIllustration,
} from "@/lib/illustrations";
import {
  clearProjectImageGenerating,
  removeStoredProjectImageVariants,
} from "@/lib/project-images";
import { clearTaskImageGenerating } from "@/lib/task-images";
import { z } from "zod";

const nameSchema = z
  .string()
  .min(2, "Le nom est trop court")
  .max(100, "Le nom est trop long");
const profileNamePartSchema = z
  .string()
  .trim()
  .max(80, "Le champ est trop long");

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
const budgetDocumentTypeSchema = z.enum([
  "RECEIPT",
  "INVOICE",
  "QUOTE",
  "WARRANTY",
  "OTHER",
]);
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
const USER_AVATAR_MAX_BYTES = 5 * 1024 * 1024;
const USER_AVATAR_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const USER_AVATAR_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;
const USER_AVATAR_CARTOONIFIED_SUFFIX = "-cartoonified.png";
const USER_AVATAR_ORIGINAL_SUFFIX = "-cartoonify-original";
const ENTITY_AVATAR_GHIBLI_SUFFIX = "-ghibli.png";
const ENTITY_AVATAR_ORIGINAL_SUFFIX = "-ghibli-original";
const ENTITY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const ENTITY_IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
const APP_BACKGROUND_MAX_BYTES = 10 * 1024 * 1024;
const APP_BACKGROUND_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif"] as const;
const USER_APP_BACKGROUND_ORIGINAL_SUFFIX = "-app-bg-original";
const USER_APP_BACKGROUND_GHIBLI_SUFFIX = "-app-bg-ghibli.png";
const USER_APP_BACKGROUND_GENERATED_SUFFIX = "-app-bg-generated.png";

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
const DEFAULT_ONBOARDING_ZONE_NAMES = ["Intérieur", "Jardin"] as const;
const DEFAULT_ONBOARDING_CATEGORY_NAMES = [
  "Entretien",
  "Bricolage",
  "Administratif",
] as const;
const DEFAULT_ONBOARDING_TASK_TITLES = [
  "Faire le tour de la maison",
  "Préparer une première liste d'achats",
] as const;
type ParsedOnboardingPerson = {
  name: string;
  relation: string | null;
};
type ParsedHouseOnboarding = {
  hasProvidedAnswers: boolean;
  people: ParsedOnboardingPerson[];
  zoneNames: string[];
  projectNames: string[];
  taskTitles: string[];
};

function getOptionalOnboardingInput(formData: FormData, fieldName: string) {
  const raw = formData.get(fieldName);
  if (typeof raw !== "string") {
    return "";
  }
  return raw.trim();
}

function dedupeTextList(values: string[]) {
  const seen = new Set<string>();
  const uniqueValues: string[] = [];

  for (const value of values) {
    const key = value.toLocaleLowerCase("fr-FR");
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    uniqueValues.push(value);
  }

  return uniqueValues;
}

function parseOnboardingList(
  value: string,
  { maxItems = 8, maxLength = 120 }: { maxItems?: number; maxLength?: number } = {}
) {
  if (!value) {
    return [];
  }

  const parsed = value
    .split(/[\n,;]+/g)
    .map((item) =>
      item
        .trim()
        .replace(/^[-*]\s*/, "")
        .replace(/^\d+[.)]\s*/, "")
    )
    .filter(Boolean)
    .map((item) => item.slice(0, maxLength));

  return dedupeTextList(parsed).slice(0, maxItems);
}

function parseOnboardingPeople(value: string, maxItems = 6) {
  return parseOnboardingList(value, { maxItems, maxLength: 180 })
    .map((item) => {
      const parenthesisMatch = item.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
      if (parenthesisMatch) {
        return {
          name: parenthesisMatch[1].trim().slice(0, 80),
          relation: parenthesisMatch[2].trim().slice(0, 80) || null,
        };
      }

      const colonIndex = item.indexOf(":");
      if (colonIndex > 0) {
        const name = item.slice(0, colonIndex).trim().slice(0, 80);
        const relation = item.slice(colonIndex + 1).trim().slice(0, 80);
        return {
          name,
          relation: relation || null,
        };
      }

      return {
        name: item.trim().slice(0, 80),
        relation: null,
      };
    })
    .filter((person) => person.name.length > 0);
}

function parseHouseOnboarding(formData: FormData): ParsedHouseOnboarding {
  const onboardingPeopleRaw = getOptionalOnboardingInput(
    formData,
    "onboardingPeople"
  );
  const onboardingZonesRaw = getOptionalOnboardingInput(formData, "onboardingZones");
  const onboardingProjectsRaw = getOptionalOnboardingInput(
    formData,
    "onboardingProjects"
  );
  const onboardingTasksRaw = getOptionalOnboardingInput(formData, "onboardingTasks");
  const hasProvidedAnswers = [
    onboardingPeopleRaw,
    onboardingZonesRaw,
    onboardingProjectsRaw,
    onboardingTasksRaw,
  ].some((value) => value.length > 0);

  const people = parseOnboardingPeople(onboardingPeopleRaw);
  const zoneNames = dedupeTextList([
    ...DEFAULT_ONBOARDING_ZONE_NAMES,
    ...parseOnboardingList(onboardingZonesRaw, { maxItems: 8, maxLength: 80 }),
  ]);
  const projectNames = parseOnboardingList(onboardingProjectsRaw, {
    maxItems: 4,
    maxLength: 120,
  });
  const parsedTaskTitles = parseOnboardingList(onboardingTasksRaw, {
    maxItems: 8,
    maxLength: 180,
  });
  const taskTitles = parsedTaskTitles.length
    ? parsedTaskTitles
    : hasProvidedAnswers
      ? [...DEFAULT_ONBOARDING_TASK_TITLES]
      : [];

  return {
    hasProvidedAnswers,
    people,
    zoneNames,
    projectNames,
    taskTitles,
  };
}

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

function isNotificationTableUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
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
    include: {
      house: {
        select: {
          clientStatus: true,
          createdById: true,
        },
      },
    },
  });

  if (!membership) {
    throw new Error("Forbidden");
  }

  if (membership.house.clientStatus === "INACTIVE") {
    throw new Error("Ce client est désactivé. Contacte le propriétaire principal.");
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

export async function requirePrincipalOwner(userId: string, houseId: string) {
  const membership = await requireOwner(userId, houseId);
  if (membership.house.createdById !== userId) {
    throw new Error("Seul le propriétaire principal peut effectuer cette action.");
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

function isAvatarColumnUnavailableError(error: unknown, entity: "animal" | "person") {
  const entityToken = entity.toLowerCase();

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code !== "P2021" && error.code !== "P2022") {
      return false;
    }

    const meta = error.meta as { column?: unknown } | undefined;
    const column = typeof meta?.column === "string" ? meta.column.toLowerCase() : "";
    const message = error.message.toLowerCase();
    return (
      column.includes("imageurl") ||
      (message.includes("imageurl") && message.includes(entityToken))
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    const message = error.message.toLowerCase();
    return (
      message.includes("imageurl") &&
      (message.includes("unknown argument") || message.includes("unknown field"))
    );
  }

  return false;
}

function avatarSchemaUpgradeMessage() {
  return "La base n'est pas à jour pour les avatars Animaux/Personnes. Lance `npm run db:push` puis recharge.";
}

async function loadAnimalForAvatarActions(animalId: string) {
  try {
    return await prisma.animal.findUnique({
      where: { id: animalId },
      select: {
        id: true,
        houseId: true,
        name: true,
        species: true,
        imageUrl: true,
      },
    });
  } catch (error) {
    if (!isAvatarColumnUnavailableError(error, "animal")) {
      throw error;
    }

    const fallback = await prisma.animal.findUnique({
      where: { id: animalId },
      select: {
        id: true,
        houseId: true,
        name: true,
        species: true,
      },
    });
    return fallback ? { ...fallback, imageUrl: null as string | null } : null;
  }
}

async function loadPersonForAvatarActions(personId: string) {
  try {
    return await prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        houseId: true,
        name: true,
        relation: true,
        imageUrl: true,
      },
    });
  } catch (error) {
    if (!isAvatarColumnUnavailableError(error, "person")) {
      throw error;
    }

    const fallback = await prisma.person.findUnique({
      where: { id: personId },
      select: {
        id: true,
        houseId: true,
        name: true,
        relation: true,
      },
    });
    return fallback ? { ...fallback, imageUrl: null as string | null } : null;
  }
}

async function updateAnimalAvatarUrl(animalId: string, imageUrl: string | null) {
  try {
    await prisma.animal.update({
      where: { id: animalId },
      data: { imageUrl },
    });
  } catch (error) {
    if (isAvatarColumnUnavailableError(error, "animal")) {
      throw new Error(avatarSchemaUpgradeMessage());
    }
    throw error;
  }
}

async function updatePersonAvatarUrl(personId: string, imageUrl: string | null) {
  try {
    await prisma.person.update({
      where: { id: personId },
      data: { imageUrl },
    });
  } catch (error) {
    if (isAvatarColumnUnavailableError(error, "person")) {
      throw new Error(avatarSchemaUpgradeMessage());
    }
    throw error;
  }
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
  model:
    | "zone"
    | "category"
    | "animal"
    | "person"
    | "project"
    | "equipment"
    | "task"
    | "vendor",
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
  if (model === "task") {
    const record = await prisma.task.findFirst({
      where: { id, houseId },
      select: { id: true },
    });
    return record ? id : null;
  }
  if (model === "vendor") {
    const record = await prisma.vendor.findFirst({
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

function parseTagsInput(value?: string | null) {
  if (!value) return [];
  const tags = value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const tag of tags) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(tag);
  }
  return unique.slice(0, 12);
}

function parseAmountCentsInput(value: FormDataEntryValue | null, fieldName: string) {
  const raw = z.string().trim().parse(value);

  const normalized = raw.replace(/\s/g, "").replace(",", ".");
  const amount = Number(normalized);

  if (!Number.isFinite(amount)) {
    throw new Error(`${fieldName} est invalide`);
  }

  if (amount <= 0) {
    throw new Error(`${fieldName} doit être strictement positif`);
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
  documentType: z.enum(["RECEIPT", "INVOICE", "QUOTE", "WARRANTY", "OTHER"]).optional(),
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

function resolveUserAvatarExtension(mimeType: string) {
  return USER_AVATAR_MIME_TO_EXT[mimeType];
}

function resolveEntityImageExtension(mimeType: string) {
  return ENTITY_IMAGE_MIME_TO_EXT[mimeType];
}

function resolveImageMimeTypeFromExtension(extension: string) {
  if (extension === "png") return "image/png";
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "gif") return "image/gif";
  return null;
}

function resolveUserAvatarsDir() {
  return path.join(process.cwd(), "public", "user-avatars");
}

function resolveAppBackgroundsDir() {
  return path.join(process.cwd(), "public", "app-backgrounds");
}

function resolveUserAppBackgroundOriginalFilename(userId: string, extension: string) {
  return `${userId}${USER_APP_BACKGROUND_ORIGINAL_SUFFIX}.${extension}`;
}

function resolveUserAppBackgroundGhibliFilename(userId: string) {
  return `${userId}${USER_APP_BACKGROUND_GHIBLI_SUFFIX}`;
}

function resolveUserAppBackgroundGeneratedFilename(userId: string) {
  return `${userId}${USER_APP_BACKGROUND_GENERATED_SUFFIX}`;
}

function resolveUserAppBackgroundUrl(filename: string) {
  return `/app-backgrounds/${filename}`;
}

function resolveVersionedImageUrl(imageUrl: string) {
  const separator = imageUrl.includes("?") ? "&" : "?";
  return `${imageUrl}${separator}v=${Date.now()}`;
}

type AvatarEntityKind = "animal" | "person";

function resolveEntityAvatarsFolder(kind: AvatarEntityKind) {
  return kind === "animal" ? "animal-avatars" : "person-avatars";
}

function resolveEntityAvatarPrefix(kind: AvatarEntityKind) {
  return kind === "animal" ? "/animal-avatars/" : "/person-avatars/";
}

function resolveEntityAvatarsDir(kind: AvatarEntityKind) {
  return path.join(process.cwd(), "public", resolveEntityAvatarsFolder(kind));
}

function normalizeLocalImageUrl(imageUrl: string) {
  return imageUrl.split(/[?#]/, 1)[0] ?? imageUrl;
}

function resolveLocalPublicImagePath(imageUrl: string) {
  const normalizedUrl = normalizeLocalImageUrl(imageUrl);
  if (!normalizedUrl.startsWith("/")) {
    return null;
  }
  return path.join(process.cwd(), "public", normalizedUrl.replace(/^\//, ""));
}

function resolveUserAvatarCartoonifiedFilename(userId: string) {
  return `${userId}${USER_AVATAR_CARTOONIFIED_SUFFIX}`;
}

function resolveUserAvatarCartoonifiedUrl(userId: string) {
  return `/user-avatars/${resolveUserAvatarCartoonifiedFilename(userId)}`;
}

function resolveUserAvatarOriginalFilename(userId: string, extension: string) {
  return `${userId}${USER_AVATAR_ORIGINAL_SUFFIX}.${extension}`;
}

function resolveEntityAvatarGhibliFilename(entityId: string) {
  return `${entityId}${ENTITY_AVATAR_GHIBLI_SUFFIX}`;
}

function resolveEntityAvatarGhibliUrl(kind: AvatarEntityKind, entityId: string) {
  return `${resolveEntityAvatarPrefix(kind)}${resolveEntityAvatarGhibliFilename(entityId)}`;
}

function resolveEntityAvatarOriginalFilename(entityId: string, extension: string) {
  return `${entityId}${ENTITY_AVATAR_ORIGINAL_SUFFIX}.${extension}`;
}

async function resolveUserAvatarOriginalBackupUrl(userId: string) {
  const avatarsDir = resolveUserAvatarsDir();
  for (const extension of USER_AVATAR_EXTENSIONS) {
    const filename = resolveUserAvatarOriginalFilename(userId, extension);
    const absolutePath = path.join(avatarsDir, filename);
    try {
      await access(absolutePath);
      return `/user-avatars/${filename}`;
    } catch {
      // try next extension
    }
  }
  return null;
}

async function resolveUserAppBackgroundOriginalUrl(userId: string) {
  const backgroundsDir = resolveAppBackgroundsDir();
  for (const extension of APP_BACKGROUND_EXTENSIONS) {
    const filename = resolveUserAppBackgroundOriginalFilename(userId, extension);
    const absolutePath = path.join(backgroundsDir, filename);
    try {
      await access(absolutePath);
      return resolveUserAppBackgroundUrl(filename);
    } catch {
      // try next extension
    }
  }
  return null;
}

async function resolveEntityAvatarOriginalBackupUrl(
  kind: AvatarEntityKind,
  entityId: string
) {
  const avatarsDir = resolveEntityAvatarsDir(kind);
  for (const extension of USER_AVATAR_EXTENSIONS) {
    const filename = resolveEntityAvatarOriginalFilename(entityId, extension);
    const absolutePath = path.join(avatarsDir, filename);
    try {
      await access(absolutePath);
      return `${resolveEntityAvatarPrefix(kind)}${filename}`;
    } catch {
      // try next extension
    }
  }
  return null;
}

async function removeUserAvatarOriginalBackups(userId: string) {
  const avatarsDir = resolveUserAvatarsDir();
  for (const extension of USER_AVATAR_EXTENSIONS) {
    const filename = resolveUserAvatarOriginalFilename(userId, extension);
    const absolutePath = path.join(avatarsDir, filename);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files
    }
  }
}

async function removeUserAppBackgroundOriginalBackups(userId: string) {
  const backgroundsDir = resolveAppBackgroundsDir();
  for (const extension of APP_BACKGROUND_EXTENSIONS) {
    const filename = resolveUserAppBackgroundOriginalFilename(userId, extension);
    const absolutePath = path.join(backgroundsDir, filename);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files
    }
  }
}

async function removeUserAppBackgroundGeneratedImages(userId: string) {
  const backgroundsDir = resolveAppBackgroundsDir();
  const filenames = [
    resolveUserAppBackgroundGhibliFilename(userId),
    resolveUserAppBackgroundGeneratedFilename(userId),
  ];

  await Promise.all(
    filenames.map(async (filename) => {
      const absolutePath = path.join(backgroundsDir, filename);
      try {
        await unlink(absolutePath);
      } catch {
        // ignore missing files
      }
    })
  );
}

async function removeEntityAvatarOriginalBackups(kind: AvatarEntityKind, entityId: string) {
  const avatarsDir = resolveEntityAvatarsDir(kind);
  for (const extension of USER_AVATAR_EXTENSIONS) {
    const filename = resolveEntityAvatarOriginalFilename(entityId, extension);
    const absolutePath = path.join(avatarsDir, filename);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files
    }
  }
}

async function removeUserAvatarCartoonifiedImage(userId: string) {
  const absolutePath = path.join(
    resolveUserAvatarsDir(),
    resolveUserAvatarCartoonifiedFilename(userId)
  );
  try {
    await unlink(absolutePath);
  } catch {
    // ignore missing file
  }
}

async function removeUserAvatarCartoonifyArtifacts(userId: string) {
  await Promise.all([
    removeUserAvatarOriginalBackups(userId),
    removeUserAvatarCartoonifiedImage(userId),
  ]);
}

async function removeEntityAvatarGhibliImage(kind: AvatarEntityKind, entityId: string) {
  const absolutePath = path.join(
    resolveEntityAvatarsDir(kind),
    resolveEntityAvatarGhibliFilename(entityId)
  );
  try {
    await unlink(absolutePath);
  } catch {
    // ignore missing file
  }
}

async function removeEntityAvatarGhibliArtifacts(kind: AvatarEntityKind, entityId: string) {
  await Promise.all([
    removeEntityAvatarOriginalBackups(kind, entityId),
    removeEntityAvatarGhibliImage(kind, entityId),
  ]);
}

async function loadLocalImageAsDataUrl(imageUrl: string) {
  const filePath = resolveLocalPublicImagePath(imageUrl);
  if (!filePath) {
    return null;
  }

  const extension = path.extname(filePath).replace(".", "").toLowerCase();
  const mimeType = resolveImageMimeTypeFromExtension(extension);
  if (!mimeType) {
    return null;
  }

  try {
    const buffer = await readFile(filePath);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

async function describeUserAvatarReference({
  userName,
  imageUrl,
}: {
  userName: string | null;
  imageUrl: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    return null;
  }

  const imageDataUrl = await loadLocalImageAsDataUrl(imageUrl);
  if (!imageDataUrl) {
    return null;
  }

  const model =
    process.env.OPENAI_PROFILE_REFERENCE_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";

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
          content: [
            {
              type: "input_text",
              text: `Décris brièvement (max 20 mots) les repères visuels d'un portrait avatar ${
                userName ? `de ${userName}` : "d'utilisateur"
              } pour une illustration style Ghibli.`,
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const text = extractOpenAIOutputText(payload);
  if (!text) {
    return null;
  }

  return text.replace(/\s+/g, " ").trim();
}

async function describeEntityAvatarReference({
  imageUrl,
  targetName,
  targetType,
}: {
  imageUrl: string;
  targetName: string;
  targetType: "animal" | "personne";
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    return null;
  }

  const imageDataUrl = await loadLocalImageAsDataUrl(imageUrl);
  if (!imageDataUrl) {
    return null;
  }

  const model =
    process.env.OPENAI_PROFILE_REFERENCE_MODEL ||
    process.env.OPENAI_MODEL ||
    "gpt-4.1-mini";

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
          content: [
            {
              type: "input_text",
              text: `Décris brièvement (max 20 mots) des repères visuels d'un avatar de ${targetType} nommé ${targetName}, pour une illustration style Ghibli.`,
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const text = extractOpenAIOutputText(payload);
  if (!text) {
    return null;
  }

  return text.replace(/\s+/g, " ").trim();
}

async function removeStoredEntityImage(
  imageUrl: string | null | undefined,
  options: { prefix: string; folder: string }
) {
  if (!imageUrl) {
    return;
  }

  const normalizedUrl = normalizeLocalImageUrl(imageUrl);
  if (!normalizedUrl.startsWith(options.prefix)) {
    return;
  }

  const filename = path.basename(normalizedUrl);
  const absolutePath = path.join(process.cwd(), "public", options.folder, filename);

  try {
    await unlink(absolutePath);
  } catch {
    // ignore missing or locked files
  }
}

async function removeStoredHouseIcon(iconUrl?: string | null) {
  await removeStoredEntityImage(iconUrl, {
    prefix: "/house-icons/",
    folder: "house-icons",
  });
}

async function removeStoredUserAvatar(avatarUrl?: string | null) {
  await removeStoredEntityImage(avatarUrl, {
    prefix: "/user-avatars/",
    folder: "user-avatars",
  });
}

async function removeStoredAnimalAvatar(avatarUrl?: string | null) {
  await removeStoredEntityImage(avatarUrl, {
    prefix: "/animal-avatars/",
    folder: "animal-avatars",
  });
}

async function removeStoredPersonAvatar(avatarUrl?: string | null) {
  await removeStoredEntityImage(avatarUrl, {
    prefix: "/person-avatars/",
    folder: "person-avatars",
  });
}

async function removeStoredTaskImage(imageUrl?: string | null) {
  await removeStoredEntityImage(imageUrl, {
    prefix: "/task-images/",
    folder: "task-images",
  });
}

async function generateImageBufferFromPrompt(prompt: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    console.warn("OpenAI image generation skipped: missing API key.");
    return null;
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
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
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error("OpenAI image generation failed.", response.status, errorText);
    return null;
  }

  const data = await response.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (b64) {
    return Buffer.from(b64, "base64");
  }

  if (data?.data?.[0]?.url) {
    const imageResponse = await fetch(data.data[0].url);
    if (!imageResponse.ok) {
      console.error("OpenAI image download failed.", imageResponse.status);
      return null;
    }
    const arrayBuffer = await imageResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  console.error("OpenAI image generation returned empty payload.");
  return null;
}

async function generateImageBufferFromPromptWithReferenceImage({
  prompt,
  referenceImageUrl,
}: {
  prompt: string;
  referenceImageUrl: string;
}) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith("sk-test")) {
    console.warn("OpenAI image generation skipped: missing API key.");
    return null;
  }

  const referenceImagePath = resolveLocalPublicImagePath(referenceImageUrl);
  if (!referenceImagePath) {
    return generateImageBufferFromPrompt(prompt);
  }

  const extension = path.extname(referenceImagePath).replace(".", "").toLowerCase();
  const resolvedMimeType = resolveImageMimeTypeFromExtension(extension);
  if (!resolvedMimeType) {
    return generateImageBufferFromPrompt(prompt);
  }
  const referenceMimeType: string = resolvedMimeType;

  let referenceBuffer: Buffer;
  try {
    referenceBuffer = await readFile(referenceImagePath);
  } catch {
    return generateImageBufferFromPrompt(prompt);
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

  async function requestImageEdit(fieldName: "image" | "image[]") {
    const formData = new FormData();
    const referenceArrayBuffer = referenceBuffer.buffer.slice(
      referenceBuffer.byteOffset,
      referenceBuffer.byteOffset + referenceBuffer.byteLength
    ) as ArrayBuffer;
    const referenceBlob = new Blob([referenceArrayBuffer], { type: referenceMimeType });
    formData.append("model", model);
    formData.append("prompt", prompt);
    formData.append("size", "1024x1024");
    formData.append("output_format", "png");
    formData.append(fieldName, referenceBlob, `reference.${extension || "png"}`);

    let response: Response;
    try {
      response = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: formData,
      });
    } catch (error) {
      console.error("OpenAI image edit failed (network).", error);
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI image edit failed.", response.status, errorText);
      return null;
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (b64) {
      return Buffer.from(b64, "base64");
    }

    if (data?.data?.[0]?.url) {
      const imageResponse = await fetch(data.data[0].url);
      if (!imageResponse.ok) {
        console.error("OpenAI image download failed.", imageResponse.status);
        return null;
      }
      const arrayBuffer = await imageResponse.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    console.error("OpenAI image edit returned empty payload.");
    return null;
  }

  // Some model versions require `image[]`, others accept `image`.
  const editedWithArrayField = await requestImageEdit("image[]");
  if (editedWithArrayField) {
    return editedWithArrayField;
  }

  return requestImageEdit("image");
}

export async function regenerateTaskImage(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: {
      houseId: true,
      title: true,
      description: true,
      personId: true,
      assigneeId: true,
    },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  await enqueueTaskIllustration({
    houseId: task.houseId,
    userId,
    taskId,
    title: task.title,
    description: task.description,
    personId: task.personId,
    assigneeId: task.assigneeId,
    replaceExisting: true,
  });

  revalidateApp();
  revalidatePath(`/app/tasks/${taskId}`);
}

export async function uploadTaskImage(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));
  const imageFile = formData.get("imageFile");

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, houseId: true, imageUrl: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  if (!(imageFile instanceof File) || imageFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (imageFile.size > ENTITY_IMAGE_MAX_BYTES) {
    throw new Error("L'image est trop lourde (8 Mo max)");
  }

  const extension = resolveEntityImageExtension(imageFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const imagesDir = path.join(process.cwd(), "public", "task-images");
  await mkdir(imagesDir, { recursive: true });

  const filename = `${taskId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const filePath = path.join(imagesDir, filename);
  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
  await writeFile(filePath, imageBuffer);

  const newImageUrl = `/task-images/${filename}`;
  await prisma.task.update({
    where: { id: taskId },
    data: { imageUrl: newImageUrl },
  });

  await removeStoredTaskImage(task.imageUrl);
  await clearTaskImageGenerating(taskId);

  revalidateApp();
  revalidatePath(`/app/tasks/${taskId}`);
}

export async function regenerateProjectImage(formData: FormData) {
  const userId = await requireUser();
  const projectId = z.string().cuid().parse(formData.get("projectId"));

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, houseId: true, name: true, description: true },
  });

  if (!project) {
    throw new Error("Projet introuvable");
  }

  await requireOwner(userId, project.houseId);

  await enqueueProjectIllustration({
    userId,
    projectId: project.id,
    name: project.name,
    description: project.description,
    replaceExisting: true,
  });

  revalidateApp();
  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${projectId}`);
}

export async function uploadProjectImage(formData: FormData) {
  const userId = await requireUser();
  const projectId = z.string().cuid().parse(formData.get("projectId"));
  const imageFile = formData.get("imageFile");

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, houseId: true },
  });

  if (!project) {
    throw new Error("Projet introuvable");
  }

  await requireOwner(userId, project.houseId);

  if (!(imageFile instanceof File) || imageFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (imageFile.size > ENTITY_IMAGE_MAX_BYTES) {
    throw new Error("L'image est trop lourde (8 Mo max)");
  }

  const extension = resolveEntityImageExtension(imageFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const imagesDir = path.join(process.cwd(), "public", "project-images");
  await mkdir(imagesDir, { recursive: true });
  await removeStoredProjectImageVariants(projectId);

  const filename = `${projectId}.${extension}`;
  const filePath = path.join(imagesDir, filename);
  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
  await writeFile(filePath, imageBuffer);
  await clearProjectImageGenerating(projectId);

  revalidateApp();
  revalidatePath("/app/projects");
  revalidatePath(`/app/projects/${projectId}`);
}

export async function regenerateEquipmentImage(formData: FormData) {
  const userId = await requireUser();
  const equipmentId = z.string().cuid().parse(formData.get("equipmentId"));

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, houseId: true, name: true, location: true, category: true },
  });

  if (!equipment) {
    throw new Error("Équipement introuvable");
  }

  await requireOwner(userId, equipment.houseId);

  await enqueueEquipmentIllustration({
    userId,
    equipmentId: equipment.id,
    name: equipment.name,
    location: equipment.location,
    category: equipment.category,
    replaceExisting: true,
  });

  revalidateApp();
  revalidatePath("/app/equipment");
}

export async function uploadEquipmentImage(formData: FormData) {
  const userId = await requireUser();
  const equipmentId = z.string().cuid().parse(formData.get("equipmentId"));
  const imageFile = formData.get("imageFile");

  const equipment = await prisma.equipment.findUnique({
    where: { id: equipmentId },
    select: { id: true, houseId: true },
  });

  if (!equipment) {
    throw new Error("Équipement introuvable");
  }

  await requireOwner(userId, equipment.houseId);

  if (!(imageFile instanceof File) || imageFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (imageFile.size > ENTITY_IMAGE_MAX_BYTES) {
    throw new Error("L'image est trop lourde (8 Mo max)");
  }

  const extension = resolveEntityImageExtension(imageFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const imagesDir = path.join(process.cwd(), "public", "equipment-images");
  await mkdir(imagesDir, { recursive: true });
  await removeStoredEquipmentImageVariants(equipmentId);

  const filename = `${equipmentId}.${extension}`;
  const filePath = path.join(imagesDir, filename);
  const imageBuffer = Buffer.from(await imageFile.arrayBuffer());
  await writeFile(filePath, imageBuffer);
  await clearEquipmentImageGenerating(equipmentId);

  revalidateApp();
  revalidatePath("/app/equipment");
}

function revalidateApp() {
  revalidatePath("/");
  revalidatePath("/login");
  revalidatePath("/setup/house");
  revalidatePath("/client-inactif");
  revalidatePath("/app");
  revalidatePath("/app/profile");
  revalidatePath("/app/tasks");
  revalidatePath("/app/projects");
  revalidatePath("/app/equipment");
  revalidatePath("/app/calendar");
  revalidatePath("/app/budgets");
  revalidatePath("/app/documents");
  revalidatePath("/app/shopping-lists");
  revalidatePath("/app/house");
  revalidatePath("/app/settings");
  revalidatePath("/app/notifications");
}

export async function uploadAppBackground(formData: FormData) {
  const userId = await requireUser();
  const backgroundFile = formData.get("backgroundFile");

  if (!(backgroundFile instanceof File) || backgroundFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (backgroundFile.size > APP_BACKGROUND_MAX_BYTES) {
    throw new Error("L'image est trop lourde (10 Mo max)");
  }

  const extension = resolveEntityImageExtension(backgroundFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const backgroundsDir = resolveAppBackgroundsDir();
  await mkdir(backgroundsDir, { recursive: true });

  await removeUserAppBackgroundOriginalBackups(userId);
  await removeUserAppBackgroundGeneratedImages(userId);

  const filename = resolveUserAppBackgroundOriginalFilename(userId, extension);
  const filePath = path.join(backgroundsDir, filename);
  const imageBuffer = Buffer.from(await backgroundFile.arrayBuffer());
  await writeFile(filePath, imageBuffer);

  return { imageUrl: resolveVersionedImageUrl(resolveUserAppBackgroundUrl(filename)) };
}

export async function generateAppBackgroundGhibli(formData: FormData) {
  const userId = await requireUser();
  const promptRaw = formData.get("prompt");
  const promptHint = z
    .string()
    .trim()
    .max(240, "Le prompt est trop long")
    .optional()
    .parse(typeof promptRaw === "string" ? promptRaw : undefined);

  const prompt = [
    "Illustration panoramique style Ghibli pour fond d'application web.",
    "Ambiance chaleureuse, poétique, artisanale, lumière naturelle, sans personnages, sans texte.",
    promptHint ? `Contexte: ${promptHint}.` : "",
    "Composition lisible derrière une interface, équilibrée, avec zones de repos visuel.",
  ]
    .filter(Boolean)
    .join(" ");

  const generatedBuffer = await generateImageBufferFromPrompt(prompt);
  if (!generatedBuffer) {
    throw new Error("La génération du fond a échoué. Réessaie dans quelques instants.");
  }

  const backgroundsDir = resolveAppBackgroundsDir();
  await mkdir(backgroundsDir, { recursive: true });

  const filename = resolveUserAppBackgroundGeneratedFilename(userId);
  const filePath = path.join(backgroundsDir, filename);
  await writeFile(filePath, generatedBuffer);

  return { imageUrl: resolveVersionedImageUrl(resolveUserAppBackgroundUrl(filename)) };
}

export async function ghiblifyUploadedAppBackground() {
  const userId = await requireUser();
  const originalBackgroundUrl = await resolveUserAppBackgroundOriginalUrl(userId);

  if (!originalBackgroundUrl) {
    throw new Error(
      "Importe d'abord une photo avant d'appliquer le style Ghibli au fond."
    );
  }

  const prompt = [
    "Transformer cette photo en illustration style Ghibli pour un fond d'application.",
    "Conserver les volumes principaux, les couleurs harmonieuses et une ambiance douce.",
    "Résultat: peinture détaillée, sans texte, sans personnages.",
  ].join(" ");

  const ghibliBuffer = await generateImageBufferFromPromptWithReferenceImage({
    prompt,
    referenceImageUrl: originalBackgroundUrl,
  });
  if (!ghibliBuffer) {
    throw new Error(
      "La ghiblification du fond a échoué. Réessaie dans quelques instants."
    );
  }

  const backgroundsDir = resolveAppBackgroundsDir();
  await mkdir(backgroundsDir, { recursive: true });

  const filename = resolveUserAppBackgroundGhibliFilename(userId);
  const filePath = path.join(backgroundsDir, filename);
  await writeFile(filePath, ghibliBuffer);

  return { imageUrl: resolveVersionedImageUrl(resolveUserAppBackgroundUrl(filename)) };
}

export async function createHouse(formData: FormData) {
  const userId = await requireUser();
  const name = nameSchema.parse(formData.get("name"));
  const onboarding = parseHouseOnboarding(formData);
  const isOnboardingCompleted = onboarding.hasProvidedAnswers;

  const existingMembership = await prisma.houseMember.findFirst({
    where: { userId },
    select: { id: true },
  });

  if (existingMembership) {
    throw new Error("Tu appartiens déjà à une maison.");
  }

  await prisma.house.create({
    data: {
      name,
      createdById: userId,
      isOnboardingCompleted,
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
      ...(isOnboardingCompleted
        ? {
            zones: {
              create: onboarding.zoneNames.map((zoneName) => ({ name: zoneName })),
            },
            categories: {
              create: DEFAULT_ONBOARDING_CATEGORY_NAMES.map((categoryName) => ({
                name: categoryName,
              })),
            },
          }
        : {}),
      ...(onboarding.people.length
        ? {
            people: {
              create: onboarding.people.map((person) => ({
                name: person.name,
                relation: person.relation,
              })),
            },
          }
        : {}),
      ...(onboarding.projectNames.length
        ? {
            projects: {
              create: onboarding.projectNames.map((projectName) => ({
                name: projectName,
              })),
            },
          }
        : {}),
      ...(onboarding.taskTitles.length
        ? {
            tasks: {
              create: onboarding.taskTitles.map((taskTitle) => ({
                title: taskTitle,
                createdById: userId,
              })),
            },
          }
        : {}),
    },
  });

  revalidateApp();
  redirect(isOnboardingCompleted ? "/app" : "/setup/house");
}

export async function completeHouseOnboarding(formData: FormData) {
  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));
  const onboarding = parseHouseOnboarding(formData);

  if (!onboarding.hasProvidedAnswers) {
    throw new Error("Complète au moins une réponse d'onboarding.");
  }

  await requireMembership(userId, houseId);

  await prisma.$transaction(async (tx) => {
    const updateResult = await tx.house.updateMany({
      where: { id: houseId, isOnboardingCompleted: false },
      data: {
        name,
        isOnboardingCompleted: true,
      },
    });

    if (updateResult.count === 0) {
      return;
    }

    await tx.zone.createMany({
      data: onboarding.zoneNames.map((zoneName) => ({ houseId, name: zoneName })),
      skipDuplicates: true,
    });

    await tx.category.createMany({
      data: DEFAULT_ONBOARDING_CATEGORY_NAMES.map((categoryName) => ({
        houseId,
        name: categoryName,
      })),
      skipDuplicates: true,
    });

    if (onboarding.people.length) {
      await tx.person.createMany({
        data: onboarding.people.map((person) => ({
          houseId,
          name: person.name,
          relation: person.relation,
        })),
      });
    }

    if (onboarding.projectNames.length) {
      await tx.project.createMany({
        data: onboarding.projectNames.map((projectName) => ({
          houseId,
          name: projectName,
        })),
      });
    }

    if (onboarding.taskTitles.length) {
      await tx.task.createMany({
        data: onboarding.taskTitles.map((taskTitle) => ({
          houseId,
          title: taskTitle,
          createdById: userId,
        })),
      });
    }
  });

  revalidateApp();
  redirect("/app");
}

export async function updateUserProfile(formData: FormData) {
  const userId = await requireUser();
  const firstName = profileNamePartSchema.parse(formData.get("firstName"));
  const lastName = profileNamePartSchema.parse(formData.get("lastName"));
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  if (!fullName) {
    throw new Error("Le prénom ou le nom est requis");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { name: fullName },
  });

  revalidateApp();
}

export async function uploadUserAvatar(formData: FormData) {
  const userId = await requireUser();
  const avatarFile = formData.get("avatarFile");

  if (!(avatarFile instanceof File) || avatarFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (avatarFile.size > USER_AVATAR_MAX_BYTES) {
    throw new Error("L'image est trop lourde (5 Mo max)");
  }

  const extension = resolveUserAvatarExtension(avatarFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, image: true },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  const avatarsDir = resolveUserAvatarsDir();
  await mkdir(avatarsDir, { recursive: true });

  const filename = `${userId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const avatarPath = path.join(avatarsDir, filename);
  const avatarBuffer = Buffer.from(await avatarFile.arrayBuffer());
  await writeFile(avatarPath, avatarBuffer);

  const newAvatarUrl = `/user-avatars/${filename}`;
  await prisma.user.update({
    where: { id: userId },
    data: { image: newAvatarUrl },
  });
  await removeStoredUserAvatar(user.image);
  await removeUserAvatarCartoonifyArtifacts(userId);

  revalidateApp();
}

export async function cartoonifyUserAvatar() {
  const userId = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, image: true },
  });

  if (!user?.image) {
    throw new Error("Aucun avatar à transformer.");
  }

  if (!user.image.startsWith("/user-avatars/")) {
    throw new Error("Importe d'abord un avatar local avant de lancer le style Ghibli.");
  }

  const currentAvatarPath = resolveLocalPublicImagePath(user.image);
  if (!currentAvatarPath) {
    throw new Error("Avatar introuvable.");
  }

  const avatarsDir = resolveUserAvatarsDir();
  await mkdir(avatarsDir, { recursive: true });

  let originalAvatarUrl = await resolveUserAvatarOriginalBackupUrl(userId);
  if (!originalAvatarUrl) {
    const extension = path.extname(currentAvatarPath).replace(".", "").toLowerCase();
    const mimeType = resolveImageMimeTypeFromExtension(extension);
    if (!mimeType) {
      throw new Error("Format d'image non supporté pour le style Ghibli.");
    }

    const sourceBuffer = await readFile(currentAvatarPath);
    const originalFilename = resolveUserAvatarOriginalFilename(userId, extension);
    const originalPath = path.join(avatarsDir, originalFilename);

    await removeUserAvatarOriginalBackups(userId);
    await writeFile(originalPath, sourceBuffer);

    originalAvatarUrl = `/user-avatars/${originalFilename}`;
  }
  if (!originalAvatarUrl) {
    throw new Error("L'image d'origine est introuvable.");
  }

  const referenceDescription = await describeUserAvatarReference({
    userName: user.name ?? null,
    imageUrl: originalAvatarUrl,
  });
  const prompt = [
    "Illustration style Ghibli, chaleureuse, artisanale et colorée d'un avatar portrait.",
    referenceDescription ? `Repères visuels: ${referenceDescription}.` : "",
    "Style: ambiance Ghibli, doux, narratif, sans texte, cadrage portrait.",
  ]
    .filter(Boolean)
    .join(" ");

  const cartoonBuffer = await generateImageBufferFromPromptWithReferenceImage({
    prompt,
    referenceImageUrl: originalAvatarUrl,
  });
  if (!cartoonBuffer) {
    throw new Error(
      "La génération en style Ghibli a échoué. Réessaie dans quelques instants."
    );
  }

  const cartoonFilename = resolveUserAvatarCartoonifiedFilename(userId);
  const cartoonPath = path.join(avatarsDir, cartoonFilename);
  await writeFile(cartoonPath, cartoonBuffer);

  const cartoonUrl = resolveUserAvatarCartoonifiedUrl(userId);
  await prisma.user.update({
    where: { id: userId },
    data: { image: cartoonUrl },
  });

  if (user.image !== cartoonUrl && user.image !== originalAvatarUrl) {
    await removeStoredUserAvatar(user.image);
  }

  revalidateApp();
}

export async function restoreUserAvatar() {
  const userId = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, image: true },
  });

  if (!user?.image) {
    throw new Error("Aucun avatar à restaurer.");
  }

  const cartoonUrl = resolveUserAvatarCartoonifiedUrl(userId);
  if (user.image !== cartoonUrl) {
    return;
  }

  const originalAvatarUrl = await resolveUserAvatarOriginalBackupUrl(userId);
  if (!originalAvatarUrl) {
    throw new Error("L'image d'origine est introuvable.");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { image: originalAvatarUrl },
  });

  await removeStoredUserAvatar(cartoonUrl);
  revalidateApp();
}

export async function removeUserAvatar() {
  const userId = await requireUser();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, image: true },
  });

  if (!user) {
    throw new Error("Utilisateur introuvable");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { image: null },
  });

  await removeStoredUserAvatar(user.image);
  await removeUserAvatarCartoonifyArtifacts(userId);
  revalidateApp();
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

export async function createVendor(formData: FormData) {
  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));
  const company = optionalString.parse(formData.get("company")?.toString());
  const emailRaw = optionalString.parse(formData.get("email")?.toString());
  const email = emailRaw ? emailSchema.parse(emailRaw) : null;
  const phone = optionalString.parse(formData.get("phone")?.toString());
  const website = optionalString.parse(formData.get("website")?.toString());
  const address = optionalString.parse(formData.get("address")?.toString());
  const notes = optionalString.parse(formData.get("notes")?.toString());
  const ratingRaw = optionalNumber.parse(formData.get("rating")?.toString());
  const rating = Number.isFinite(ratingRaw)
    ? Math.max(1, Math.min(5, Math.round(ratingRaw as number)))
    : null;
  const tags = parseTagsInput(optionalString.parse(formData.get("tags")?.toString()));

  await requireOwner(userId, houseId);

  await prisma.vendor.create({
    data: {
      houseId,
      name,
      company,
      email,
      phone,
      website,
      address,
      notes,
      rating,
      tags,
    },
  });

  revalidateApp();
}

export async function updateVendor(formData: FormData) {
  const userId = await requireUser();
  const vendorId = cuidSchema.parse(formData.get("vendorId"));
  const name = nameSchema.parse(formData.get("name"));
  const company = optionalString.parse(formData.get("company")?.toString());
  const emailRaw = optionalString.parse(formData.get("email")?.toString());
  const email = emailRaw ? emailSchema.parse(emailRaw) : null;
  const phone = optionalString.parse(formData.get("phone")?.toString());
  const website = optionalString.parse(formData.get("website")?.toString());
  const address = optionalString.parse(formData.get("address")?.toString());
  const notes = optionalString.parse(formData.get("notes")?.toString());
  const ratingRaw = optionalNumber.parse(formData.get("rating")?.toString());
  const rating = Number.isFinite(ratingRaw)
    ? Math.max(1, Math.min(5, Math.round(ratingRaw as number)))
    : null;
  const tags = parseTagsInput(optionalString.parse(formData.get("tags")?.toString()));

  const vendor = await requireHouseEntity(
    await prisma.vendor.findUnique({ where: { id: vendorId } })
  );
  await requireOwner(userId, vendor.houseId);

  await prisma.vendor.update({
    where: { id: vendorId },
    data: {
      name,
      company,
      email,
      phone,
      website,
      address,
      notes,
      rating,
      tags,
    },
  });

  revalidateApp();
  revalidatePath(`/app/vendors/${vendorId}`);
}

export async function deleteVendor(formData: FormData) {
  const userId = await requireUser();
  const vendorId = cuidSchema.parse(formData.get("vendorId"));

  const vendor = await requireHouseEntity(
    await prisma.vendor.findUnique({ where: { id: vendorId } })
  );
  await requireOwner(userId, vendor.houseId);

  await prisma.vendor.delete({ where: { id: vendorId } });

  revalidateApp();
  revalidatePath("/app/vendors");
}

export async function createProject(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const name = nameSchema.parse(formData.get("name"));
  const description = optionalString.parse(formData.get("description")?.toString());
  const startsAt = parseDateInput(formData.get("startsAt")?.toString());
  const endsAt = parseDateInput(formData.get("endsAt")?.toString());

  await requireOwner(userId, houseId);

  const createdProject = await prisma.project.create({
    data: {
      houseId,
      name,
      description,
      startsAt,
      endsAt,
    },
    select: { id: true },
  });

  await enqueueProjectIllustration({
    userId,
    projectId: createdProject.id,
    name,
    description,
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
  revalidatePath(`/app/projects/${projectId}`);
}

export async function deleteProject(formData: FormData) {
  const userId = await requireUser();
  const projectId = cuidSchema.parse(formData.get("projectId"));
  const redirectToProjects = z
    .enum(["0", "1"])
    .optional()
    .parse(formData.get("redirectToProjects")?.toString());

  const project = await requireHouseEntity(
    await prisma.project.findUnique({ where: { id: projectId } })
  );
  await requireOwner(userId, project.houseId);

  await prisma.project.delete({ where: { id: projectId } });
  await removeStoredProjectImageVariants(projectId);
  await clearProjectImageGenerating(projectId);

  revalidateApp();
  revalidatePath(`/app/projects/${projectId}`);

  if (redirectToProjects === "1") {
    redirect("/app/projects");
  }
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

  const createdEquipment = await prisma.equipment.create({
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
    select: { id: true },
  });

  await enqueueEquipmentIllustration({
    userId,
    equipmentId: createdEquipment.id,
    name,
    location,
    category,
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
  await removeStoredEquipmentImageVariants(equipmentId);
  await clearEquipmentImageGenerating(equipmentId);

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

export async function deleteShoppingListItem(formData: FormData) {
  const userId = await requireUser();
  const itemId = cuidSchema.parse(formData.get("itemId"));

  const item = await requireShoppingItemEntity(itemId);
  await requireMembership(userId, item.shoppingList.houseId);

  await withShoppingTablesGuard(() =>
    prisma.shoppingListItem.delete({
      where: { id: itemId },
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
  const vendorId = await resolveRelationId(
    houseId,
    "vendor",
    optionalString.parse(formData.get("vendorId")?.toString())
  );
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
  const supplierLookup = extraction.supplier?.trim() || null;
  const matchedVendor = supplierLookup
    ? await prisma.vendor.findFirst({
        where: {
          houseId,
          OR: [
            { name: { equals: supplierLookup, mode: "insensitive" } },
            { company: { equals: supplierLookup, mode: "insensitive" } },
          ],
        },
        select: { id: true },
      })
    : null;
  const resolvedVendorId = vendorId ?? matchedVendor?.id ?? null;

  await withBudgetTablesGuard(() =>
    prisma.$transaction(async (tx) => {
      const document = await tx.budgetDocument.create({
        data: {
          houseId,
          uploadedById: userId,
          vendorId: resolvedVendorId,
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

export async function uploadVaultDocument(formData: FormData) {
  const userId = await requireUser();
  const houseId = cuidSchema.parse(formData.get("houseId"));
  const vendorId = await resolveRelationId(
    houseId,
    "vendor",
    optionalString.parse(formData.get("vendorId")?.toString())
  );
  const taskId = await resolveRelationId(
    houseId,
    "task",
    optionalString.parse(formData.get("taskId")?.toString())
  );
  const equipmentId = await resolveRelationId(
    houseId,
    "equipment",
    optionalString.parse(formData.get("equipmentId")?.toString())
  );
  const documentType = budgetDocumentTypeSchema.parse(
    formData.get("documentType")?.toString() || "OTHER"
  ) as BudgetDocumentType;
  const issuedOnRaw = optionalString.parse(formData.get("issuedOn")?.toString());
  const warrantyEndsOnRaw = optionalString.parse(
    formData.get("warrantyEndsOn")?.toString()
  );
  const supplier = optionalString.parse(formData.get("supplier")?.toString()) || null;
  const notes = budgetNotesSchema.parse(formData.get("notes")?.toString());
  const file = formData.get("document");

  await requireMembership(userId, houseId);

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

  if (issuedOnRaw && !ISO_DATE_REGEX.test(issuedOnRaw)) {
    throw new Error("La date d'émission doit être au format YYYY-MM-DD");
  }

  if (warrantyEndsOnRaw && !ISO_DATE_REGEX.test(warrantyEndsOnRaw)) {
    throw new Error("La date de garantie doit être au format YYYY-MM-DD");
  }

  const issuedOn = issuedOnRaw ? new Date(`${issuedOnRaw}T12:00:00`) : null;
  const warrantyEndsOn = warrantyEndsOnRaw
    ? new Date(`${warrantyEndsOnRaw}T12:00:00`)
    : null;

  const extension = resolveBudgetDocumentExtension(mimeType);
  const docsDir = path.join(process.cwd(), "public", "vault-documents", houseId);
  await mkdir(docsDir, { recursive: true });

  const fileName = `${Date.now()}-${randomBytes(6).toString("hex")}.${extension}`;
  const absolutePath = path.join(docsDir, fileName);
  const relativePath = `/vault-documents/${houseId}/${fileName}`;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  await writeFile(absolutePath, fileBuffer);

  await prisma.budgetDocument.create({
    data: {
      houseId,
      uploadedById: userId,
      vendorId,
      taskId,
      equipmentId,
      name: file.name,
      mimeType,
      sizeBytes: file.size,
      path: relativePath,
      documentType,
      issuedOn,
      warrantyEndsOn,
      supplier,
      notes: notes || null,
    },
  });

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
    await prisma.animal.findUnique({
      where: { id: animalId },
      select: { id: true, houseId: true },
    })
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

  const animal = await requireHouseEntity(await loadAnimalForAvatarActions(animalId));
  await requireOwner(userId, animal.houseId);

  await prisma.animal.delete({ where: { id: animalId } });
  await removeStoredAnimalAvatar(animal.imageUrl);
  await removeEntityAvatarGhibliArtifacts("animal", animalId);

  revalidateApp();
}

export async function updatePerson(formData: FormData) {
  const userId = await requireUser();
  const personId = cuidSchema.parse(formData.get("personId"));
  const name = nameSchema.parse(formData.get("name"));
  const relation = optionalString.parse(formData.get("relation")?.toString());

  const person = await requireHouseEntity(
    await prisma.person.findUnique({
      where: { id: personId },
      select: { id: true, houseId: true },
    })
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

  const person = await requireHouseEntity(await loadPersonForAvatarActions(personId));
  await requireOwner(userId, person.houseId);

  await prisma.person.delete({ where: { id: personId } });
  await removeStoredPersonAvatar(person.imageUrl);
  await removeEntityAvatarGhibliArtifacts("person", personId);

  revalidateApp();
}

export async function uploadAnimalAvatar(formData: FormData) {
  const userId = await requireUser();
  const animalId = cuidSchema.parse(formData.get("animalId"));
  const avatarFile = formData.get("avatarFile");

  if (!(avatarFile instanceof File) || avatarFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (avatarFile.size > USER_AVATAR_MAX_BYTES) {
    throw new Error("L'image est trop lourde (5 Mo max)");
  }

  const extension = resolveUserAvatarExtension(avatarFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const animal = await requireHouseEntity(await loadAnimalForAvatarActions(animalId));
  await requireOwner(userId, animal.houseId);

  const avatarsDir = resolveEntityAvatarsDir("animal");
  await mkdir(avatarsDir, { recursive: true });

  const filename = `${animalId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const avatarPath = path.join(avatarsDir, filename);
  const avatarBuffer = Buffer.from(await avatarFile.arrayBuffer());
  await writeFile(avatarPath, avatarBuffer);

  const newAvatarUrl = `${resolveEntityAvatarPrefix("animal")}${filename}`;
  await updateAnimalAvatarUrl(animalId, newAvatarUrl);

  await removeStoredAnimalAvatar(animal.imageUrl);
  await removeEntityAvatarGhibliArtifacts("animal", animalId);
  revalidateApp();
}

export async function applyAnimalAvatarGhibliStyle(formData: FormData) {
  const userId = await requireUser();
  const animalId = cuidSchema.parse(formData.get("animalId"));

  const animal = await requireHouseEntity(await loadAnimalForAvatarActions(animalId));
  await requireOwner(userId, animal.houseId);

  if (!animal.imageUrl) {
    throw new Error("Aucun avatar à transformer.");
  }

  const avatarPrefix = resolveEntityAvatarPrefix("animal");
  if (!animal.imageUrl.startsWith(avatarPrefix)) {
    throw new Error("Importe d'abord un avatar local avant d'appliquer le style Ghibli.");
  }

  const currentAvatarPath = resolveLocalPublicImagePath(animal.imageUrl);
  if (!currentAvatarPath) {
    throw new Error("Avatar introuvable.");
  }

  const avatarsDir = resolveEntityAvatarsDir("animal");
  await mkdir(avatarsDir, { recursive: true });

  let originalAvatarUrl = await resolveEntityAvatarOriginalBackupUrl("animal", animalId);
  if (!originalAvatarUrl) {
    const extension = path.extname(currentAvatarPath).replace(".", "").toLowerCase();
    const mimeType = resolveImageMimeTypeFromExtension(extension);
    if (!mimeType) {
      throw new Error("Format d'image non supporté pour le style Ghibli.");
    }

    const sourceBuffer = await readFile(currentAvatarPath);
    const originalFilename = resolveEntityAvatarOriginalFilename(animalId, extension);
    const originalPath = path.join(avatarsDir, originalFilename);

    await removeEntityAvatarOriginalBackups("animal", animalId);
    await writeFile(originalPath, sourceBuffer);

    originalAvatarUrl = `${avatarPrefix}${originalFilename}`;
  }

  const referenceDescription = await describeEntityAvatarReference({
    imageUrl: originalAvatarUrl,
    targetName: animal.name,
    targetType: "animal",
  });
  const prompt = [
    "Illustration style Ghibli, chaleureuse, artisanale et colorée d'un avatar animal.",
    `Sujet: ${animal.name}.`,
    animal.species ? `Espèce: ${animal.species}.` : "",
    referenceDescription ? `Repères visuels: ${referenceDescription}.` : "",
    "Style: ambiance Ghibli, doux, narratif, sans texte, cadrage portrait.",
  ]
    .filter(Boolean)
    .join(" ");

  const ghibliBuffer = await generateImageBufferFromPromptWithReferenceImage({
    prompt,
    referenceImageUrl: originalAvatarUrl,
  });
  if (!ghibliBuffer) {
    throw new Error(
      "La génération en style Ghibli a échoué. Réessaie dans quelques instants."
    );
  }

  const ghibliFilename = resolveEntityAvatarGhibliFilename(animalId);
  const ghibliPath = path.join(avatarsDir, ghibliFilename);
  await writeFile(ghibliPath, ghibliBuffer);

  const ghibliUrl = resolveEntityAvatarGhibliUrl("animal", animalId);
  await updateAnimalAvatarUrl(animalId, ghibliUrl);

  if (animal.imageUrl !== ghibliUrl && animal.imageUrl !== originalAvatarUrl) {
    await removeStoredAnimalAvatar(animal.imageUrl);
  }

  revalidateApp();
}

export async function restoreAnimalAvatar(formData: FormData) {
  const userId = await requireUser();
  const animalId = cuidSchema.parse(formData.get("animalId"));

  const animal = await requireHouseEntity(await loadAnimalForAvatarActions(animalId));
  await requireOwner(userId, animal.houseId);

  if (!animal.imageUrl) {
    throw new Error("Aucun avatar à restaurer.");
  }

  const ghibliUrl = resolveEntityAvatarGhibliUrl("animal", animalId);
  if (animal.imageUrl !== ghibliUrl) {
    return;
  }

  const originalAvatarUrl = await resolveEntityAvatarOriginalBackupUrl("animal", animalId);
  if (!originalAvatarUrl) {
    throw new Error("L'image d'origine est introuvable.");
  }

  await updateAnimalAvatarUrl(animalId, originalAvatarUrl);

  await removeStoredAnimalAvatar(ghibliUrl);
  revalidateApp();
}

export async function removeAnimalAvatar(formData: FormData) {
  const userId = await requireUser();
  const animalId = cuidSchema.parse(formData.get("animalId"));

  const animal = await requireHouseEntity(await loadAnimalForAvatarActions(animalId));
  await requireOwner(userId, animal.houseId);

  await updateAnimalAvatarUrl(animalId, null);

  await removeStoredAnimalAvatar(animal.imageUrl);
  await removeEntityAvatarGhibliArtifacts("animal", animalId);
  revalidateApp();
}

export async function uploadPersonAvatar(formData: FormData) {
  const userId = await requireUser();
  const personId = cuidSchema.parse(formData.get("personId"));
  const avatarFile = formData.get("avatarFile");

  if (!(avatarFile instanceof File) || avatarFile.size === 0) {
    throw new Error("Aucune image sélectionnée");
  }

  if (avatarFile.size > USER_AVATAR_MAX_BYTES) {
    throw new Error("L'image est trop lourde (5 Mo max)");
  }

  const extension = resolveUserAvatarExtension(avatarFile.type);
  if (!extension) {
    throw new Error("Format d'image non supporté (PNG, JPG, WEBP, GIF)");
  }

  const person = await requireHouseEntity(await loadPersonForAvatarActions(personId));
  await requireOwner(userId, person.houseId);

  const avatarsDir = resolveEntityAvatarsDir("person");
  await mkdir(avatarsDir, { recursive: true });

  const filename = `${personId}-${Date.now()}-${randomBytes(4).toString("hex")}.${extension}`;
  const avatarPath = path.join(avatarsDir, filename);
  const avatarBuffer = Buffer.from(await avatarFile.arrayBuffer());
  await writeFile(avatarPath, avatarBuffer);

  const newAvatarUrl = `${resolveEntityAvatarPrefix("person")}${filename}`;
  await updatePersonAvatarUrl(personId, newAvatarUrl);

  await removeStoredPersonAvatar(person.imageUrl);
  await removeEntityAvatarGhibliArtifacts("person", personId);
  revalidateApp();
}

export async function applyPersonAvatarGhibliStyle(formData: FormData) {
  const userId = await requireUser();
  const personId = cuidSchema.parse(formData.get("personId"));

  const person = await requireHouseEntity(await loadPersonForAvatarActions(personId));
  await requireOwner(userId, person.houseId);

  if (!person.imageUrl) {
    throw new Error("Aucun avatar à transformer.");
  }

  const avatarPrefix = resolveEntityAvatarPrefix("person");
  if (!person.imageUrl.startsWith(avatarPrefix)) {
    throw new Error("Importe d'abord un avatar local avant d'appliquer le style Ghibli.");
  }

  const currentAvatarPath = resolveLocalPublicImagePath(person.imageUrl);
  if (!currentAvatarPath) {
    throw new Error("Avatar introuvable.");
  }

  const avatarsDir = resolveEntityAvatarsDir("person");
  await mkdir(avatarsDir, { recursive: true });

  let originalAvatarUrl = await resolveEntityAvatarOriginalBackupUrl("person", personId);
  if (!originalAvatarUrl) {
    const extension = path.extname(currentAvatarPath).replace(".", "").toLowerCase();
    const mimeType = resolveImageMimeTypeFromExtension(extension);
    if (!mimeType) {
      throw new Error("Format d'image non supporté pour le style Ghibli.");
    }

    const sourceBuffer = await readFile(currentAvatarPath);
    const originalFilename = resolveEntityAvatarOriginalFilename(personId, extension);
    const originalPath = path.join(avatarsDir, originalFilename);

    await removeEntityAvatarOriginalBackups("person", personId);
    await writeFile(originalPath, sourceBuffer);

    originalAvatarUrl = `${avatarPrefix}${originalFilename}`;
  }

  const referenceDescription = await describeEntityAvatarReference({
    imageUrl: originalAvatarUrl,
    targetName: person.name,
    targetType: "personne",
  });
  const prompt = [
    "Illustration style Ghibli, chaleureuse, artisanale et colorée d'un avatar portrait.",
    `Sujet: ${person.name}.`,
    person.relation ? `Contexte: ${person.relation}.` : "",
    referenceDescription ? `Repères visuels: ${referenceDescription}.` : "",
    "Style: ambiance Ghibli, doux, narratif, sans texte, cadrage portrait.",
  ]
    .filter(Boolean)
    .join(" ");

  const ghibliBuffer = await generateImageBufferFromPrompt(prompt);
  if (!ghibliBuffer) {
    throw new Error(
      "La génération en style Ghibli a échoué. Réessaie dans quelques instants."
    );
  }

  const ghibliFilename = resolveEntityAvatarGhibliFilename(personId);
  const ghibliPath = path.join(avatarsDir, ghibliFilename);
  await writeFile(ghibliPath, ghibliBuffer);

  const ghibliUrl = resolveEntityAvatarGhibliUrl("person", personId);
  await updatePersonAvatarUrl(personId, ghibliUrl);

  if (person.imageUrl !== ghibliUrl && person.imageUrl !== originalAvatarUrl) {
    await removeStoredPersonAvatar(person.imageUrl);
  }

  revalidateApp();
}

export async function restorePersonAvatar(formData: FormData) {
  const userId = await requireUser();
  const personId = cuidSchema.parse(formData.get("personId"));

  const person = await requireHouseEntity(await loadPersonForAvatarActions(personId));
  await requireOwner(userId, person.houseId);

  if (!person.imageUrl) {
    throw new Error("Aucun avatar à restaurer.");
  }

  const ghibliUrl = resolveEntityAvatarGhibliUrl("person", personId);
  if (person.imageUrl !== ghibliUrl) {
    return;
  }

  const originalAvatarUrl = await resolveEntityAvatarOriginalBackupUrl("person", personId);
  if (!originalAvatarUrl) {
    throw new Error("L'image d'origine est introuvable.");
  }

  await updatePersonAvatarUrl(personId, originalAvatarUrl);

  await removeStoredPersonAvatar(ghibliUrl);
  revalidateApp();
}

export async function removePersonAvatar(formData: FormData) {
  const userId = await requireUser();
  const personId = cuidSchema.parse(formData.get("personId"));

  const person = await requireHouseEntity(await loadPersonForAvatarActions(personId));
  await requireOwner(userId, person.houseId);

  await updatePersonAvatarUrl(personId, null);

  await removeStoredPersonAvatar(person.imageUrl);
  await removeEntityAvatarGhibliArtifacts("person", personId);
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
      where: { userId: existingUser.id },
      include: {
        house: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });
    if (existingMember) {
      if (existingMember.houseId === houseId) {
        throw new Error("Cet utilisateur est déjà membre de la maison.");
      }
      throw new Error(
        `Cet utilisateur appartient déjà à la maison "${existingMember.house.name}".`
      );
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
      subject: `Invitation Soot pour ${house.name}`,
      text: [
        `${inviterLabel} vous invite à rejoindre la maison "${house.name}" sur Soot.`,
        "",
        `Cliquez sur ce lien pour accepter l'invitation: ${inviteUrl}`,
        "",
        "Ce lien expire dans 7 jours.",
      ].join("\n"),
      html: [
        `<p><strong>${inviterLabel}</strong> vous invite à rejoindre la maison <strong>${house.name}</strong> sur Soot.</p>`,
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
  const dueDate = parseRequiredDateInput(formData.get("dueDate"), "L'échéance");
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
  const vendorId = await resolveRelationId(
    houseId,
    "vendor",
    optionalString.parse(formData.get("vendorId")?.toString())
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
    const template = await prisma.task.create({
      data: {
        houseId,
        title,
        description,
        dueDate,
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
        vendorId,
      },
    });

    const instance = await prisma.task.create({
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
        vendorId,
        parentId: template.id,
      },
    });

    await enqueueTaskIllustration({
      houseId,
      userId,
      taskId: instance.id,
      title,
      description,
      personId,
      assigneeId: validAssigneeId,
    });
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
        vendorId,
      },
    });

    await enqueueTaskIllustration({
      houseId,
      userId,
      taskId: created.id,
      title,
      description,
      personId,
      assigneeId: validAssigneeId,
    });
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
    select: { houseId: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  await prisma.task.update({
    where: { id: taskId },
    data: { status },
  });

  revalidateApp();
}

export async function updateTaskAssignee(formData: FormData) {
  const userId = await requireUser();
  const taskId = z.string().cuid().parse(formData.get("taskId"));
  const assigneeIdRaw = optionalString.parse(formData.get("assigneeId")?.toString());

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { houseId: true },
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
  const vendorId = await resolveRelationId(
    task.houseId,
    "vendor",
    optionalString.parse(formData.get("vendorId")?.toString())
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
          vendorId,
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
            vendorId,
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
              vendorId,
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
          vendorId,
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
        vendorId,
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
        vendorId,
        assigneeId,
        status,
      },
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
    select: { houseId: true, isTemplate: true, imageUrl: true },
  });

  if (!task) {
    throw new Error("Task not found");
  }

  await requireMembership(userId, task.houseId);

  if (task.isTemplate) {
    const seriesTasks = await prisma.task.findMany({
      where: {
        OR: [{ id: taskId }, { parentId: taskId }],
      },
      select: { id: true, imageUrl: true },
    });

    await prisma.$transaction([
      prisma.task.deleteMany({ where: { parentId: taskId } }),
      prisma.task.delete({ where: { id: taskId } }),
    ]);

    for (const seriesTask of seriesTasks) {
      await removeStoredTaskImage(seriesTask.imageUrl);
      await clearTaskImageGenerating(seriesTask.id);
    }
  } else {
    await prisma.task.delete({ where: { id: taskId } });
    await removeStoredTaskImage(task.imageUrl);
    await clearTaskImageGenerating(taskId);
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
    select: { houseId: true },
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

    await enqueueTaskIllustration({
      houseId: suggestion.houseId,
      userId,
      taskId: instance.id,
      title: suggestion.title,
      description: suggestion.description,
    });
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

    await enqueueTaskIllustration({
      houseId: suggestion.houseId,
      userId,
      taskId: created.id,
      title: suggestion.title,
      description: suggestion.description,
    });
  }

  await prisma.taskSuggestion.delete({ where: { id: suggestionId } });

  revalidateApp();
}

export async function acceptHouseInvite(formData: FormData) {
  const { id: userId, email } = await requireSessionUser();
  const token = z.string().min(10).parse(formData.get("token"));

  const invite = await prisma.houseInvite.findUnique({
    where: { token },
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
    const house = await prisma.house.findUnique({
      where: { id: invite.houseId },
      select: {
        clientStatus: true,
        isOnboardingCompleted: true,
      },
    });

    if (house?.clientStatus === "INACTIVE") {
      redirect("/client-inactif");
    }

    if (house && !house.isOnboardingCompleted) {
      redirect("/setup/house");
    }

    redirect("/app");
  }

  if (!email || email.toLowerCase() !== invite.email.toLowerCase()) {
    throw new Error("Email de session différent de l'invitation");
  }

  const currentMembership = await prisma.houseMember.findFirst({
    where: { userId },
    select: { houseId: true },
  });

  if (currentMembership && currentMembership.houseId !== invite.houseId) {
    throw new Error(
      "Tu appartiens déjà à une autre maison. Un compte ne peut être lié qu'à une seule maison."
    );
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

  const house = await prisma.house.findUnique({
    where: { id: invite.houseId },
    select: {
      clientStatus: true,
      isOnboardingCompleted: true,
    },
  });

  revalidateApp();
  if (house?.clientStatus === "INACTIVE") {
    redirect("/client-inactif");
  }
  if (house && !house.isOnboardingCompleted) {
    redirect("/setup/house");
  }
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

export async function importMarketplaceTemplate(formData: FormData) {
  const userId = await requireUser();
  const houseId = z.string().cuid().parse(formData.get("houseId"));
  const templateId = z.string().min(1).parse(formData.get("templateId"));

  await requireMembership(userId, houseId);

  const { getMarketplaceTemplate } = await import("@/lib/marketplace-templates");
  const template = getMarketplaceTemplate(templateId);

  if (!template) {
    throw new Error("Modèle introuvable");
  }

  const baseDate = new Date();
  baseDate.setHours(12, 0, 0, 0);
  const dueDate =
    typeof template.defaultDueOffsetDays === "number"
      ? new Date(baseDate.getTime() + template.defaultDueOffsetDays * 24 * 60 * 60 * 1000)
      : null;

  if (template.recurrenceUnit) {
    const createdTemplate = await prisma.task.create({
      data: {
        houseId,
        title: template.title,
        description: template.description,
        dueDate,
        isTemplate: true,
        recurrenceUnit: template.recurrenceUnit,
        recurrenceInterval: template.recurrenceInterval ?? 1,
        reminderOffsetDays: template.reminderOffsetDays,
        createdById: userId,
      },
    });

    const instance = await prisma.task.create({
      data: {
        houseId,
        title: template.title,
        description: template.description,
        dueDate,
        reminderOffsetDays: template.reminderOffsetDays,
        createdById: userId,
        parentId: createdTemplate.id,
      },
    });

    await enqueueTaskIllustration({
      houseId,
      userId,
      taskId: instance.id,
      title: template.title,
      description: template.description,
    });
  } else {
    const created = await prisma.task.create({
      data: {
        houseId,
        title: template.title,
        description: template.description,
        dueDate,
        reminderOffsetDays: template.reminderOffsetDays,
        createdById: userId,
      },
    });

    await enqueueTaskIllustration({
      houseId,
      userId,
      taskId: created.id,
      title: template.title,
      description: template.description,
    });
  }

  revalidateApp();
}

export async function markNotificationRead(formData: FormData) {
  const userId = await requireUser();
  const notificationId = z.string().cuid().parse(formData.get("notificationId"));

  try {
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId,
      },
      data: {
        readAt: new Date(),
      },
    });
  } catch (error) {
    if (!isNotificationTableUnavailableError(error)) {
      throw error;
    }
  }

  revalidatePath("/app/notifications");
}

export async function markAllNotificationsRead() {
  const userId = await requireUser();

  try {
    await prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
      },
    });
  } catch (error) {
    if (!isNotificationTableUnavailableError(error)) {
      throw error;
    }
  }

  revalidatePath("/app/notifications");
}
