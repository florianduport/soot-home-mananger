"use client";

import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";

export function ThemeToggle() {
  const { theme, setTheme, systemTheme } = useTheme();
  const resolved = theme === "system" ? systemTheme : theme;
  const isDark = resolved === "dark";

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">Mode sombre</p>
        <p className="text-xs text-muted-foreground">
          Par défaut, suit le thème système.
        </p>
      </div>
      <div className="flex items-center gap-3 self-start sm:self-auto">
        <button
          type="button"
          className={`text-xs font-medium ${
            theme === "system" ? "text-foreground" : "text-muted-foreground"
          }`}
          onClick={() => setTheme("system")}
        >
          Auto
        </button>
        <Switch
          checked={theme === "dark" || (theme === "system" && isDark)}
          onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
          aria-label="Activer le mode sombre"
        />
      </div>
    </div>
  );
}
