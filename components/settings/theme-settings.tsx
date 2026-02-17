"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTheme } from "@/hooks/use-theme";
import { isAppTheme, themeLabels, type AppTheme } from "@/lib/theme/tokens";

const themes: AppTheme[] = ["default", "ghibli"];

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <Label htmlFor="theme-select">Thème global</Label>
        <p className="text-xs text-muted-foreground">
          Ce choix est appliqué à toute l&apos;application et sauvegardé localement.
        </p>
      </div>
      <Select
        value={theme}
        onValueChange={(value) => {
          if (isAppTheme(value)) {
            setTheme(value);
          }
        }}
      >
        <SelectTrigger id="theme-select" className="w-full sm:w-64">
          <SelectValue placeholder="Choisir un thème" />
        </SelectTrigger>
        <SelectContent>
          {themes.map((themeName) => (
            <SelectItem key={themeName} value={themeName}>
              {themeLabels[themeName]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
