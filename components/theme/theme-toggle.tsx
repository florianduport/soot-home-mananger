"use client";

import { Paintbrush } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { themeLabels } from "@/lib/theme/tokens";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const nextTheme = theme === "default" ? "ghibli" : "default";

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme(nextTheme)}
      className="h-8 gap-2 rounded-full border border-border bg-card text-xs"
      aria-label={`Activer ${themeLabels[nextTheme]}`}
    >
      <Paintbrush className="h-3.5 w-3.5" />
      {themeLabels[nextTheme]}
    </Button>
  );
}
