"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

type PendingEstimatesRefresherProps = {
  enabled: boolean;
  intervalMs?: number;
  maxDurationMs?: number;
};

export function PendingEstimatesRefresher({
  enabled,
  intervalMs = 2000,
  maxDurationMs = 60000,
}: PendingEstimatesRefresherProps) {
  const router = useRouter();
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      startedAtRef.current = null;
      return;
    }

    startedAtRef.current = Date.now();

    const intervalId = window.setInterval(() => {
      if (!startedAtRef.current) {
        return;
      }

      if (Date.now() - startedAtRef.current > maxDurationMs) {
        window.clearInterval(intervalId);
        return;
      }

      router.refresh();
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs, maxDurationMs, router]);

  return null;
}
