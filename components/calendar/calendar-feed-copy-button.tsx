"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function CalendarFeedCopyButton({
  url,
  labelCopy,
  labelCopied,
}: {
  url: string;
  labelCopy: string;
  labelCopied: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(timeout);
  }, [copied]);

  return (
    <Button
      type="button"
      variant="outline"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
    >
      {copied ? labelCopied : labelCopy}
    </Button>
  );
}
