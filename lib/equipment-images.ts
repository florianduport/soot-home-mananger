import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const EQUIPMENT_IMAGE_EXTENSIONS = ["png", "jpg", "webp", "gif"] as const;
const EQUIPMENT_IMAGE_MARKER_SUFFIX = ".generating";

function equipmentImagesDir() {
  return path.join(process.cwd(), "public", "equipment-images");
}

function equipmentMarkerPath(equipmentId: string) {
  return path.join(
    equipmentImagesDir(),
    `${equipmentId}${EQUIPMENT_IMAGE_MARKER_SUFFIX}`
  );
}

async function hasEquipmentImageFile(equipmentId: string) {
  const imagesDir = equipmentImagesDir();

  for (const extension of EQUIPMENT_IMAGE_EXTENSIONS) {
    const absolutePath = path.join(imagesDir, `${equipmentId}.${extension}`);
    try {
      await access(absolutePath);
      return `/equipment-images/${equipmentId}.${extension}`;
    } catch {
      // try next extension
    }
  }

  return null;
}

export async function resolveEquipmentImageUrl(equipmentId: string) {
  const state = await resolveEquipmentImageState(equipmentId);
  return state.imageUrl;
}

export async function isEquipmentImageGenerating(equipmentId: string) {
  try {
    await access(equipmentMarkerPath(equipmentId));
    return true;
  } catch {
    return false;
  }
}

export async function markEquipmentImageGenerating(equipmentId: string) {
  await mkdir(equipmentImagesDir(), { recursive: true });
  await writeFile(equipmentMarkerPath(equipmentId), String(Date.now()));
}

export async function clearEquipmentImageGenerating(equipmentId: string) {
  try {
    await unlink(equipmentMarkerPath(equipmentId));
  } catch {
    // ignore missing marker
  }
}

export async function resolveEquipmentImageState(equipmentId: string) {
  const isGenerating = await isEquipmentImageGenerating(equipmentId);
  if (isGenerating) {
    return { imageUrl: null as string | null, isGenerating: true };
  }

  const imageUrl = await hasEquipmentImageFile(equipmentId);
  return {
    imageUrl,
    isGenerating: false,
  };
}

export async function removeStoredEquipmentImageVariants(equipmentId: string) {
  const imagesDir = equipmentImagesDir();

  for (const extension of EQUIPMENT_IMAGE_EXTENSIONS) {
    const absolutePath = path.join(imagesDir, `${equipmentId}.${extension}`);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files
    }
  }
}
