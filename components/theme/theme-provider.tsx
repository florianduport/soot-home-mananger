"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  APP_BACKGROUND_STORAGE_KEY,
  DEFAULT_GHIBLI_MODE,
  DEFAULT_THEME,
  GHIBLI_MODE_STORAGE_KEY,
  isGhibliMode,
  isAppTheme,
  resolveThemeTokens,
  THEME_STORAGE_KEY,
  type AppTheme,
  type GhibliMode,
} from "@/lib/theme/tokens";

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  ghibliMode: GhibliMode;
  setGhibliMode: (mode: GhibliMode) => void;
  backgroundImageUrl: string | null;
  setBackgroundImage: (imageUrl: string | null) => void;
  clearBackgroundImage: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const LEGACY_THEME_STORAGE_KEY = "soot-theme";
const LEGACY_BACKGROUND_STORAGE_KEY = "soot-background-image";
const LEGACY_GHIBLI_MODE_STORAGE_KEY = "soot-ghibli-mode";

function applyTheme(theme: AppTheme, ghibliMode: GhibliMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  if (theme === "ghibli") {
    root.dataset.ghibliMode = ghibliMode;
  } else {
    delete root.dataset.ghibliMode;
  }

  const tokens = resolveThemeTokens(theme, ghibliMode);
  Object.entries(tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

export function ThemeProvider({
  children,
  defaultTheme = DEFAULT_THEME,
  storageScope = null,
}: {
  children: React.ReactNode;
  defaultTheme?: AppTheme;
  storageScope?: string | null;
}) {
  const [theme, setThemeState] = useState<AppTheme>(defaultTheme);
  const [ghibliMode, setGhibliModeState] = useState<GhibliMode>(DEFAULT_GHIBLI_MODE);
  const [backgroundImageUrl, setBackgroundImageUrlState] = useState<string | null>(null);

  const scopedThemeStorageKey = storageScope
    ? `${THEME_STORAGE_KEY}:${storageScope}`
    : THEME_STORAGE_KEY;
  const scopedGhibliModeStorageKey = storageScope
    ? `${GHIBLI_MODE_STORAGE_KEY}:${storageScope}`
    : GHIBLI_MODE_STORAGE_KEY;
  const scopedBackgroundStorageKey = storageScope
    ? `${APP_BACKGROUND_STORAGE_KEY}:${storageScope}`
    : APP_BACKGROUND_STORAGE_KEY;

  useEffect(() => {
    applyTheme(theme, ghibliMode);
  }, [theme, ghibliMode]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      try {
        const storedTheme =
          localStorage.getItem(scopedThemeStorageKey) ||
          localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
        if (isAppTheme(storedTheme)) {
          setThemeState(storedTheme);
          localStorage.setItem(scopedThemeStorageKey, storedTheme);
        }
      } catch {
        // Ignore storage errors in private mode.
      }

      try {
        const storedGhibliMode =
          localStorage.getItem(scopedGhibliModeStorageKey) ||
          localStorage.getItem(LEGACY_GHIBLI_MODE_STORAGE_KEY);
        if (isGhibliMode(storedGhibliMode)) {
          setGhibliModeState(storedGhibliMode);
          localStorage.setItem(scopedGhibliModeStorageKey, storedGhibliMode);
        }
      } catch {
        // Ignore storage errors in private mode.
      }

      try {
        const storedBackground =
          localStorage.getItem(scopedBackgroundStorageKey) ||
          localStorage.getItem(LEGACY_BACKGROUND_STORAGE_KEY);
        const normalized = storedBackground?.trim() ?? "";
        setBackgroundImageUrlState(normalized || null);
        if (normalized) {
          localStorage.setItem(scopedBackgroundStorageKey, normalized);
        }
      } catch {
        // Ignore storage errors in private mode.
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [scopedBackgroundStorageKey, scopedGhibliModeStorageKey, scopedThemeStorageKey]);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(scopedThemeStorageKey, nextTheme);
    } catch {
      // Ignore storage errors in private mode.
    }
  }, [scopedThemeStorageKey]);

  const setGhibliMode = useCallback((nextMode: GhibliMode) => {
    setGhibliModeState(nextMode);
    try {
      localStorage.setItem(scopedGhibliModeStorageKey, nextMode);
    } catch {
      // Ignore storage errors in private mode.
    }
  }, [scopedGhibliModeStorageKey]);

  const setBackgroundImage = useCallback((imageUrl: string | null) => {
    const normalized = imageUrl?.trim() ?? "";
    const nextUrl = normalized || null;

    setBackgroundImageUrlState(nextUrl);
    try {
      if (nextUrl) {
        localStorage.setItem(scopedBackgroundStorageKey, nextUrl);
      } else {
        localStorage.removeItem(scopedBackgroundStorageKey);
      }
    } catch {
      // Ignore storage errors in private mode.
    }
  }, [scopedBackgroundStorageKey]);

  const clearBackgroundImage = useCallback(() => {
    setBackgroundImage(null);
  }, [setBackgroundImage]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      ghibliMode,
      setGhibliMode,
      backgroundImageUrl,
      setBackgroundImage,
      clearBackgroundImage,
    }),
    [
      theme,
      setTheme,
      ghibliMode,
      setGhibliMode,
      backgroundImageUrl,
      setBackgroundImage,
      clearBackgroundImage,
    ]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }

  return context;
}
