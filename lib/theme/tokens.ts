export type AppTheme = "default" | "ghibli";
export type GhibliMode = "light" | "dark";

type ThemeTokens = Record<string, string>;

export const THEME_STORAGE_KEY = "soot-theme";
export const APP_BACKGROUND_STORAGE_KEY = "soot-background-image";
export const GHIBLI_MODE_STORAGE_KEY = "soot-ghibli-mode";
export const DEFAULT_THEME: AppTheme = "default";
export const DEFAULT_GHIBLI_MODE: GhibliMode = "light";

export const themeLabels: Record<AppTheme, string> = {
  default: "Thème standard",
  ghibli: "Ghibli",
};

export const ghibliModeLabels: Record<GhibliMode, string> = {
  light: "Ghibli clair",
  dark: "Ghibli sombre",
};

const defaultTokens: ThemeTokens = {
  "--radius": "0.625rem",
  "--background": "oklch(1 0 0)",
  "--foreground": "oklch(0.129 0.042 264.695)",
  "--surface": "oklch(1 0 0)",
  "--text-primary": "oklch(0.129 0.042 264.695)",
  "--text-secondary": "oklch(0.554 0.046 257.417)",
  "--card": "oklch(1 0 0)",
  "--card-foreground": "oklch(0.129 0.042 264.695)",
  "--popover": "oklch(1 0 0)",
  "--popover-foreground": "oklch(0.129 0.042 264.695)",
  "--primary": "oklch(0.208 0.042 265.755)",
  "--primary-foreground": "oklch(0.984 0.003 247.858)",
  "--secondary": "oklch(0.968 0.007 247.896)",
  "--secondary-foreground": "oklch(0.208 0.042 265.755)",
  "--muted": "oklch(0.968 0.007 247.896)",
  "--muted-foreground": "oklch(0.554 0.046 257.417)",
  "--accent": "oklch(0.968 0.007 247.896)",
  "--accent-foreground": "oklch(0.208 0.042 265.755)",
  "--destructive": "oklch(0.577 0.245 27.325)",
  "--border": "oklch(0.929 0.013 255.508)",
  "--input": "oklch(0.929 0.013 255.508)",
  "--ring": "oklch(0.704 0.04 256.788)",
  "--chart-1": "oklch(0.646 0.222 41.116)",
  "--chart-2": "oklch(0.6 0.118 184.704)",
  "--chart-3": "oklch(0.398 0.07 227.392)",
  "--chart-4": "oklch(0.828 0.189 84.429)",
  "--chart-5": "oklch(0.769 0.188 70.08)",
  "--sidebar": "oklch(0.984 0.003 247.858)",
  "--sidebar-foreground": "oklch(0.129 0.042 264.695)",
  "--sidebar-primary": "oklch(0.208 0.042 265.755)",
  "--sidebar-primary-foreground": "oklch(0.984 0.003 247.858)",
  "--sidebar-accent": "oklch(0.968 0.007 247.896)",
  "--sidebar-accent-foreground": "oklch(0.208 0.042 265.755)",
  "--sidebar-border": "oklch(0.929 0.013 255.508)",
  "--sidebar-ring": "oklch(0.704 0.04 256.788)",
  "--accent-amber": "#d8a974",
  "--accent-moss": "#7b9684",
  "--shadow-soft": "0px 4px 12px rgba(0, 0, 0, 0.08)",
  "--shadow-elevated": "0px 12px 32px rgba(15, 23, 42, 0.1)",
  "--paper-grain":
    "radial-gradient(circle at 1px 1px, rgba(15, 23, 42, 0.03) 1px, transparent 0)",
  "--app-gradient-from": "#f8fafc",
  "--app-gradient-via": "#ffffff",
  "--app-gradient-to": "#e2e8f0",
  "--ghibli-outline-button-bg": "transparent",
  "--ghibli-outline-button-hover-bg": "transparent",
  "--ghibli-outline-button-border": "var(--border)",
  "--page-header-bg": "rgba(255, 255, 255, 0.7)",
  "--page-header-border": "rgba(148, 163, 184, 0.45)",
  "--page-header-title-color": "var(--foreground)",
  "--color-slate-50": "#f8fafc",
  "--color-slate-100": "#f1f5f9",
  "--color-slate-200": "#e2e8f0",
  "--color-slate-300": "#cbd5e1",
  "--color-slate-400": "#94a3b8",
  "--color-slate-500": "#64748b",
  "--color-slate-600": "#475569",
  "--color-slate-700": "#334155",
  "--color-slate-800": "#1e293b",
  "--color-slate-900": "#0f172a",
  "--color-slate-950": "#020617",
};

const ghibliLightTokens: ThemeTokens = {
  "--radius": "0.75rem",
  "--background": "#efe3cc",
  "--foreground": "#2f3a2d",
  "--surface": "#f4ead7",
  "--text-primary": "#2f3a2d",
  "--text-secondary": "#6a6957",
  "--card": "#f3e8d3",
  "--card-foreground": "#2f3a2d",
  "--popover": "#f7eddc",
  "--popover-foreground": "#2f3a2d",
  "--primary": "#6f8a60",
  "--primary-foreground": "#f4ead7",
  "--secondary": "#d9ccb4",
  "--secondary-foreground": "#2f3a2d",
  "--muted": "#e3d8c2",
  "--muted-foreground": "#6a6957",
  "--accent": "#9db18f",
  "--accent-foreground": "#213122",
  "--destructive": "#b85c5c",
  "--border": "#b9ab90",
  "--input": "#c7b99d",
  "--ring": "#6f8a60",
  "--chart-1": "#6f8a60",
  "--chart-2": "#b48a5a",
  "--chart-3": "#5d7d70",
  "--chart-4": "#d6b47f",
  "--chart-5": "#8f7351",
  "--sidebar": "#253628",
  "--sidebar-foreground": "#efe3cc",
  "--sidebar-primary": "#d7b07a",
  "--sidebar-primary-foreground": "#273626",
  "--sidebar-accent": "#324737",
  "--sidebar-accent-foreground": "#efe3cc",
  "--sidebar-border": "#5a6b58",
  "--sidebar-ring": "#9db18f",
  "--accent-amber": "#d7b07a",
  "--accent-moss": "#6f8a60",
  "--shadow-soft": "0px 4px 12px rgba(62, 57, 45, 0.14)",
  "--shadow-elevated": "0px 18px 40px rgba(51, 46, 35, 0.2)",
  "--paper-grain":
    "radial-gradient(circle at 1px 1px, rgba(47, 58, 45, 0.08) 1px, transparent 0)",
  "--app-gradient-from": "#f2e7d1",
  "--app-gradient-via": "#efe3cc",
  "--app-gradient-to": "#e0d2b7",
  "--ghibli-outline-button-bg": "rgba(111, 138, 96, 0.24)",
  "--ghibli-outline-button-hover-bg": "rgba(111, 138, 96, 0.4)",
  "--ghibli-outline-button-border": "rgba(111, 138, 96, 0.62)",
  "--page-header-bg": "rgba(243, 232, 211, 0.64)",
  "--page-header-border": "rgba(104, 123, 87, 0.46)",
  "--page-header-title-color": "#243327",
  "--color-slate-50": "#f7f0e2",
  "--color-slate-100": "#efe3cc",
  "--color-slate-200": "#dcccaf",
  "--color-slate-300": "#c6b28e",
  "--color-slate-400": "#9ea97f",
  "--color-slate-500": "#7f8f6d",
  "--color-slate-600": "#67765b",
  "--color-slate-700": "#4c5c49",
  "--color-slate-800": "#334437",
  "--color-slate-900": "#253628",
  "--color-slate-950": "#1a271d",
};

const ghibliDarkTokens: ThemeTokens = {
  "--radius": "0.75rem",
  "--background": "#16241c",
  "--foreground": "#e8dcc6",
  "--surface": "#203228",
  "--text-primary": "#e8dcc6",
  "--text-secondary": "#c8bda8",
  "--card": "#1f3228",
  "--card-foreground": "#e8dcc6",
  "--popover": "#23372c",
  "--popover-foreground": "#e8dcc6",
  "--primary": "#e1c79a",
  "--primary-foreground": "#1e2b22",
  "--secondary": "#294035",
  "--secondary-foreground": "#e8dcc6",
  "--muted": "#25382f",
  "--muted-foreground": "#c8bda8",
  "--accent": "#7f9d72",
  "--accent-foreground": "#112015",
  "--destructive": "#c47c7c",
  "--border": "#496053",
  "--input": "#4e6658",
  "--ring": "#d2b88b",
  "--chart-1": "#e1c79a",
  "--chart-2": "#7f9d72",
  "--chart-3": "#8aa990",
  "--chart-4": "#b59263",
  "--chart-5": "#d9ba86",
  "--sidebar": "#132118",
  "--sidebar-foreground": "#e8dcc6",
  "--sidebar-primary": "#e1c79a",
  "--sidebar-primary-foreground": "#1e2b22",
  "--sidebar-accent": "#1d2f24",
  "--sidebar-accent-foreground": "#e8dcc6",
  "--sidebar-border": "#3f5549",
  "--sidebar-ring": "#d2b88b",
  "--accent-amber": "#e1c79a",
  "--accent-moss": "#7f9d72",
  "--shadow-soft": "0px 4px 12px rgba(0, 0, 0, 0.18)",
  "--shadow-elevated": "0px 18px 40px rgba(0, 0, 0, 0.32)",
  "--paper-grain":
    "radial-gradient(circle at 1px 1px, rgba(232, 220, 198, 0.05) 1px, transparent 0)",
  "--app-gradient-from": "#16241c",
  "--app-gradient-via": "#1c2f24",
  "--app-gradient-to": "#1a2a21",
  "--ghibli-outline-button-bg": "rgba(225, 199, 154, 0.24)",
  "--ghibli-outline-button-hover-bg": "rgba(225, 199, 154, 0.4)",
  "--ghibli-outline-button-border": "rgba(225, 199, 154, 0.64)",
  "--page-header-bg": "rgba(19, 33, 24, 0.62)",
  "--page-header-border": "rgba(96, 123, 107, 0.52)",
  "--page-header-title-color": "#f1e3cc",
  "--color-slate-50": "#e8dcc6",
  "--color-slate-100": "#d8ccb4",
  "--color-slate-200": "#c8bda8",
  "--color-slate-300": "#9fad97",
  "--color-slate-400": "#7f9d72",
  "--color-slate-500": "#65866f",
  "--color-slate-600": "#4f6c5c",
  "--color-slate-700": "#3a5146",
  "--color-slate-800": "#2a3d33",
  "--color-slate-900": "#1d2f24",
  "--color-slate-950": "#132118",
};

export const themeTokens: Record<AppTheme, ThemeTokens> = {
  default: defaultTokens,
  ghibli: ghibliLightTokens,
};

export function resolveThemeTokens(theme: AppTheme, ghibliMode: GhibliMode) {
  if (theme === "ghibli") {
    return ghibliMode === "dark" ? ghibliDarkTokens : ghibliLightTokens;
  }
  return defaultTokens;
}

export function isAppTheme(value: string | null | undefined): value is AppTheme {
  return value === "default" || value === "ghibli";
}

export function isGhibliMode(value: string | null | undefined): value is GhibliMode {
  return value === "light" || value === "dark";
}
