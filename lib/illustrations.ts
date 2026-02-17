import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import {
  clearEquipmentImageGenerating,
  markEquipmentImageGenerating,
  removeStoredEquipmentImageVariants,
  resolveEquipmentImageState,
} from "@/lib/equipment-images";
import {
  clearProjectImageGenerating,
  markProjectImageGenerating,
  removeStoredProjectImageVariants,
  resolveProjectImageState,
} from "@/lib/project-images";
import {
  clearTaskImageGenerating,
  markTaskImageGenerating,
} from "@/lib/task-images";

const profileReferenceCache = new Map<string, Promise<string | null>>();

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function tokenizeName(value?: string | null) {
  if (!value) return [];
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 2);
}

function scoreNameTokenOverlap(a: string | null | undefined, b: string | null | undefined) {
  const aTokens = tokenizeName(a);
  const bTokens = new Set(tokenizeName(b));
  if (!aTokens.length || !bTokens.size) return 0;

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  return overlap;
}

function isSamePerson(candidate: string | null | undefined, currentUserName: string | null) {
  if (!candidate || !currentUserName) return false;

  const candidateTokens = tokenizeName(candidate);
  const currentUserTokens = new Set(tokenizeName(currentUserName));
  return candidateTokens.some((token) => currentUserTokens.has(token));
}

function extractObviousTargetName(title: string, description?: string | null) {
  const text = `${title} ${description ?? ""}`.trim();
  if (!text) return null;

  const anniversaryMatch =
    text.match(/anniversaire\s+(?:de\s+)?([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,})/iu) ??
    text.match(/([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,})\s*(?:-|:)?\s*anniversaire/iu);

  if (!anniversaryMatch?.[1]) {
    return null;
  }

  return anniversaryMatch[1];
}

function shouldUseCurrentUserAsReference({
  title,
  description,
  currentUserName,
  relatedPersonName,
}: {
  title: string;
  description?: string | null;
  currentUserName: string | null;
  relatedPersonName?: string | null;
}) {
  if (relatedPersonName && !isSamePerson(relatedPersonName, currentUserName)) {
    return false;
  }

  const obviousTargetName = extractObviousTargetName(title, description);
  if (obviousTargetName && !isSamePerson(obviousTargetName, currentUserName)) {
    return false;
  }

  return true;
}

function resolveMimeTypeFromFile(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";
  return null;
}

async function loadLocalImageAsDataUrl(imageUrl: string) {
  if (!imageUrl.startsWith("/")) return null;

  const filePath = path.join(process.cwd(), "public", imageUrl.replace(/^\//, ""));
  const mimeType = resolveMimeTypeFromFile(filePath);
  if (!mimeType) return null;

  try {
    const buffer = await readFile(filePath);
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

function extractResponseText(payload: Record<string, unknown>) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const output = Array.isArray(payload.output)
    ? (payload.output as Array<{ content?: Array<{ text?: string }> }>)
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

async function describeProfileReferenceFromImage({
  profileName,
  imageUrl,
}: {
  profileName: string | null;
  imageUrl: string;
}) {
  const cacheKey = `${profileName ?? "user"}:${imageUrl}`;
  const existing = profileReferenceCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const job = (async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey || apiKey.startsWith("sk-test")) return null;

    const imageDataUrl = await loadLocalImageAsDataUrl(imageUrl);
    if (!imageDataUrl) return null;

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
                text:
                  "Décris brièvement (max 18 mots) des repères visuels non sensibles pour illustrer cette personne en style Ghibli chaleureux.",
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
    const description = extractResponseText(payload);
    if (!description) return null;
    return description.replace(/\s+/g, " ").trim();
  })();

  profileReferenceCache.set(cacheKey, job);
  return job;
}

async function buildUserReferencePrompt({
  userId,
  title,
  description,
  relatedPersonName,
}: {
  userId: string;
  title: string;
  description?: string | null;
  relatedPersonName?: string | null;
}) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true },
  });
  if (!user?.image) return null;

  const shouldUse = shouldUseCurrentUserAsReference({
    title,
    description,
    currentUserName: user.name ?? null,
    relatedPersonName,
  });
  if (!shouldUse) {
    return null;
  }

  const profileDescription = await describeProfileReferenceFromImage({
    profileName: user.name ?? null,
    imageUrl: user.image,
  });
  if (!profileDescription) {
    return null;
  }

  return `Repère personnage principal: ${profileDescription}.`;
}

async function resolvePersonLinkedProfile({
  houseId,
  personId,
}: {
  houseId: string;
  personId: string;
}) {
  let person:
    | { name: string; houseId: string; imageUrl: string | null }
    | { name: string; houseId: string; imageUrl: null }
    | null = null;

  try {
    person = await prisma.person.findUnique({
      where: { id: personId },
      select: { name: true, houseId: true, imageUrl: true },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
    if (message.includes("imageurl")) {
      const fallback = await prisma.person.findUnique({
        where: { id: personId },
        select: { name: true, houseId: true },
      });
      person = fallback ? { ...fallback, imageUrl: null } : null;
    } else {
      throw error;
    }
  }

  if (!person || person.houseId !== houseId || !person.name) {
    return null;
  }

  if (person.imageUrl) {
    return {
      name: person.name,
      imageUrl: person.imageUrl,
    };
  }

  const direct = await prisma.houseMember.findFirst({
    where: {
      houseId,
      user: {
        name: { equals: person.name, mode: "insensitive" },
        image: { not: null },
      },
    },
    select: {
      user: {
        select: { name: true, image: true },
      },
    },
  });

  if (direct?.user.image) {
    return {
      name: direct.user.name ?? person.name,
      imageUrl: direct.user.image,
    };
  }

  const candidates = await prisma.houseMember.findMany({
    where: {
      houseId,
      user: {
        image: { not: null },
      },
    },
    select: {
      user: {
        select: { name: true, image: true },
      },
    },
  });

  let best: { name: string | null; image: string } | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    if (!candidate.user.image) continue;
    const score = scoreNameTokenOverlap(person.name, candidate.user.name);
    if (score > bestScore) {
      bestScore = score;
      best = { name: candidate.user.name, image: candidate.user.image };
    }
  }

  if (!best || bestScore === 0) {
    return null;
  }

  return {
    name: best.name ?? person.name,
    imageUrl: best.image,
  };
}

async function resolveTaskReferenceProfile({
  houseId,
  personId,
  assigneeId,
  currentUserId,
}: {
  houseId: string;
  personId?: string | null;
  assigneeId?: string | null;
  currentUserId: string;
}) {
  if (personId) {
    const personProfile = await resolvePersonLinkedProfile({ houseId, personId });
    if (personProfile?.imageUrl) {
      return personProfile;
    }
  }

  if (assigneeId) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: { name: true, image: true },
    });
    if (assignee?.image) {
      return {
        name: assignee.name ?? null,
        imageUrl: assignee.image,
      };
    }
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    select: { name: true, image: true },
  });
  if (!currentUser?.image) {
    return null;
  }

  return {
    name: currentUser.name ?? null,
    imageUrl: currentUser.image,
  };
}

async function buildTaskReferencePrompt({
  houseId,
  currentUserId,
  personId,
  assigneeId,
}: {
  houseId: string;
  currentUserId: string;
  personId?: string | null;
  assigneeId?: string | null;
}) {
  const profile = await resolveTaskReferenceProfile({
    houseId,
    personId,
    assigneeId,
    currentUserId,
  });

  if (!profile?.imageUrl) {
    return null;
  }

  const profileDescription = await describeProfileReferenceFromImage({
    profileName: profile.name ?? null,
    imageUrl: profile.imageUrl,
  });

  if (!profileDescription) {
    return null;
  }

  return `Repère personnage principal: ${profileDescription}.`;
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

async function generateTaskIllustration({
  houseId,
  userId,
  taskId,
  title,
  description,
  personId,
  assigneeId,
  replaceExisting = false,
}: {
  houseId: string;
  userId: string;
  taskId: string;
  title: string;
  description?: string | null;
  personId?: string | null;
  assigneeId?: string | null;
  replaceExisting?: boolean;
}) {
  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { imageUrl: true },
    });
    if (!task) return;

    if (!replaceExisting && task.imageUrl) {
      return;
    }

    const userReferencePrompt = await buildTaskReferencePrompt({
      houseId,
      currentUserId: userId,
      personId,
      assigneeId,
    });
    const prompt = `Illustration style Ghibli, chaleureuse, artisanale et colorée de: ${title}. ${
      description ? `Détails: ${description}.` : ""
    } ${userReferencePrompt ?? ""} Style: ambiance Ghibli, doux, narratif, sans texte.`;

    const imageBuffer = await generateImageBufferFromPrompt(prompt);
    if (!imageBuffer) return;

    const imagesDir = path.join(process.cwd(), "public", "task-images");
    await mkdir(imagesDir, { recursive: true });
    const newImageUrl = `/task-images/${taskId}.png`;
    const filePath = path.join(imagesDir, `${taskId}.png`);
    await writeFile(filePath, imageBuffer);

    await prisma.task.update({
      where: { id: taskId },
      data: { imageUrl: newImageUrl },
    });

    if (
      task.imageUrl &&
      task.imageUrl.startsWith("/task-images/") &&
      task.imageUrl !== newImageUrl
    ) {
      const previousFilename = path.basename(task.imageUrl);
      const previousFilePath = path.join(imagesDir, previousFilename);
      try {
        await unlink(previousFilePath);
      } catch {
        // ignore missing previous image
      }
    }

  } finally {
    await clearTaskImageGenerating(taskId);
  }
}

async function generateProjectIllustration({
  userId,
  projectId,
  name,
  description,
  replaceExisting = false,
}: {
  userId: string;
  projectId: string;
  name: string;
  description?: string | null;
  replaceExisting?: boolean;
}) {
  try {
    if (!replaceExisting) {
      const existingState = await resolveProjectImageState(projectId);
      if (existingState.imageUrl) {
        return;
      }
    }

    const userReferencePrompt = await buildUserReferencePrompt({
      userId,
      title: name,
      description,
    });
    const prompt = `Illustration style Ghibli, chaleureuse, artisanale et colorée de projet maison: ${name}. ${
      description ? `Détails: ${description}.` : ""
    } ${userReferencePrompt ?? ""} Style: ambiance Ghibli, doux, narratif, sans texte.`;

    const imageBuffer = await generateImageBufferFromPrompt(prompt);
    if (!imageBuffer) return;

    const imagesDir = path.join(process.cwd(), "public", "project-images");
    await mkdir(imagesDir, { recursive: true });
    await removeStoredProjectImageVariants(projectId);
    const filePath = path.join(imagesDir, `${projectId}.png`);
    await writeFile(filePath, imageBuffer);

  } finally {
    await clearProjectImageGenerating(projectId);
  }
}

async function generateEquipmentIllustration({
  equipmentId,
  name,
  location,
  category,
  replaceExisting = false,
}: {
  equipmentId: string;
  name: string;
  location?: string | null;
  category?: string | null;
  replaceExisting?: boolean;
}) {
  try {
    if (!replaceExisting) {
      const existingState = await resolveEquipmentImageState(equipmentId);
      if (existingState.imageUrl) {
        return;
      }
    }

    const details: string[] = [];
    if (location) details.push(`Emplacement: ${location}.`);
    if (category) details.push(`Catégorie: ${category}.`);

    const prompt = `Illustration style Ghibli, chaleureuse, artisanale et colorée d'équipement maison: ${name}. ${
      details.join(" ") || ""
    } Style: ambiance Ghibli, doux, narratif, sans texte, sans personnage humain, focus sur l'équipement uniquement.`;

    const imageBuffer = await generateImageBufferFromPrompt(prompt);
    if (!imageBuffer) return;

    const imagesDir = path.join(process.cwd(), "public", "equipment-images");
    await mkdir(imagesDir, { recursive: true });
    await removeStoredEquipmentImageVariants(equipmentId);
    const filePath = path.join(imagesDir, `${equipmentId}.png`);
    await writeFile(filePath, imageBuffer);

  } finally {
    await clearEquipmentImageGenerating(equipmentId);
  }
}

function runDetached(job: () => Promise<void>, label: string) {
  void Promise.resolve()
    .then(job)
    .catch((error) => {
      console.error(label, error);
    });
}

export async function enqueueTaskIllustration(params: {
  houseId: string;
  userId: string;
  taskId: string;
  title: string;
  description?: string | null;
  personId?: string | null;
  assigneeId?: string | null;
  replaceExisting?: boolean;
}) {
  await markTaskImageGenerating(params.taskId);
  runDetached(
    () => generateTaskIllustration(params),
    `Task illustration job failed (${params.taskId})`
  );
}

export async function enqueueProjectIllustration(params: {
  userId: string;
  projectId: string;
  name: string;
  description?: string | null;
  replaceExisting?: boolean;
}) {
  await markProjectImageGenerating(params.projectId);
  runDetached(
    () => generateProjectIllustration(params),
    `Project illustration job failed (${params.projectId})`
  );
}

export async function enqueueEquipmentIllustration(params: {
  userId: string;
  equipmentId: string;
  name: string;
  location?: string | null;
  category?: string | null;
  replaceExisting?: boolean;
}) {
  await markEquipmentImageGenerating(params.equipmentId);
  runDetached(
    () => generateEquipmentIllustration(params),
    `Equipment illustration job failed (${params.equipmentId})`
  );
}
