import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const PROJECT_IMAGE_EXTENSIONS = ["png", "jpg", "webp", "gif"] as const;
const PROJECT_IMAGE_MARKER_SUFFIX = ".generating";

function projectImagesDir() {
  return path.join(process.cwd(), "public", "project-images");
}

function projectMarkerPath(projectId: string) {
  return path.join(projectImagesDir(), `${projectId}${PROJECT_IMAGE_MARKER_SUFFIX}`);
}

async function hasProjectImageFile(projectId: string) {
  const imagesDir = projectImagesDir();

  for (const extension of PROJECT_IMAGE_EXTENSIONS) {
    const absolutePath = path.join(imagesDir, `${projectId}.${extension}`);
    try {
      await access(absolutePath);
      return `/project-images/${projectId}.${extension}`;
    } catch {
      // try next extension
    }
  }

  return null;
}

export async function resolveProjectImageUrl(projectId: string) {
  const state = await resolveProjectImageState(projectId);
  return state.imageUrl;
}

export async function isProjectImageGenerating(projectId: string) {
  try {
    await access(projectMarkerPath(projectId));
    return true;
  } catch {
    return false;
  }
}

export async function markProjectImageGenerating(projectId: string) {
  await mkdir(projectImagesDir(), { recursive: true });
  await writeFile(projectMarkerPath(projectId), String(Date.now()));
}

export async function clearProjectImageGenerating(projectId: string) {
  try {
    await unlink(projectMarkerPath(projectId));
  } catch {
    // ignore missing marker
  }
}

export async function resolveProjectImageState(projectId: string) {
  const isGenerating = await isProjectImageGenerating(projectId);
  if (isGenerating) {
    return { imageUrl: null as string | null, isGenerating: true };
  }

  const imageUrl = await hasProjectImageFile(projectId);
  return {
    imageUrl,
    isGenerating: false,
  };
}

export async function removeStoredProjectImageVariants(projectId: string) {
  const imagesDir = projectImagesDir();

  for (const extension of PROJECT_IMAGE_EXTENSIONS) {
    const absolutePath = path.join(imagesDir, `${projectId}.${extension}`);
    try {
      await unlink(absolutePath);
    } catch {
      // ignore missing files
    }
  }
}
