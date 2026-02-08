"use client";

import { useEffect, useState } from "react";

function getInitialMessage(taskId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`taskCelebration:${taskId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { message?: string; timestamp?: number };
    if (!parsed.message || !parsed.timestamp) return null;
    const age = Date.now() - parsed.timestamp;
    if (age >= 5000) return null;
    return { message: parsed.message, remaining: 5000 - age };
  } catch {
    return null;
  }
}

export function TaskCompleteMessage({ taskId }: { taskId: string }) {
  const initial = getInitialMessage(taskId);
  const [message, setMessage] = useState<string | null>(
    initial ? initial.message : null
  );

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        taskId?: string;
        message?: string;
        timestamp?: number;
      };
      if (detail?.taskId !== taskId) return;
      if (!detail?.message) return;
      setMessage(detail.message);
      window.setTimeout(() => setMessage(null), 5000);
    };
    window.addEventListener("task:completed", handler as EventListener);
    if (initial?.remaining) {
      window.setTimeout(() => setMessage(null), initial.remaining);
    }
    return () => window.removeEventListener("task:completed", handler as EventListener);
  }, [taskId, initial?.remaining]);

  if (!message) return null;

  return (
    <div className="absolute right-4 top-16 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-400">
      {message}
    </div>
  );
}
