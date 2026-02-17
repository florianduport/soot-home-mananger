import { access, mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

const TASK_IMAGE_MARKER_SUFFIX = ".generating";

function taskImagesDir() {
  return path.join(process.cwd(), "public", "task-images");
}

function taskMarkerPath(taskId: string) {
  return path.join(taskImagesDir(), `${taskId}${TASK_IMAGE_MARKER_SUFFIX}`);
}

export async function isTaskImageGenerating(taskId: string) {
  try {
    await access(taskMarkerPath(taskId));
    return true;
  } catch {
    return false;
  }
}

export async function markTaskImageGenerating(taskId: string) {
  await mkdir(taskImagesDir(), { recursive: true });
  await writeFile(taskMarkerPath(taskId), String(Date.now()));
}

export async function clearTaskImageGenerating(taskId: string) {
  try {
    await unlink(taskMarkerPath(taskId));
  } catch {
    // ignore missing marker
  }
}

export async function resolveTaskImageGeneratingSet(taskIds: string[]) {
  const checks = await Promise.all(
    taskIds.map(async (taskId) => ({ taskId, isGenerating: await isTaskImageGenerating(taskId) }))
  );

  const generating = new Set<string>();
  for (const check of checks) {
    if (check.isGenerating) {
      generating.add(check.taskId);
    }
  }
  return generating;
}
