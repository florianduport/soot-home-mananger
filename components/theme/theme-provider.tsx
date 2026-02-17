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
}: {
  children: React.ReactNode;
  defaultTheme?: AppTheme;
}) {
  const [theme, setThemeState] = useState<AppTheme>(defaultTheme);
  const [ghibliMode, setGhibliModeState] = useState<GhibliMode>(DEFAULT_GHIBLI_MODE);
  const [backgroundImageUrl, setBackgroundImageUrlState] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme, ghibliMode);
  }, [theme, ghibliMode]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      try {
        const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
        if (isAppTheme(storedTheme)) {
          setThemeState(storedTheme);
        }
      } catch {
        // Ignore storage errors in private mode.
      }

      try {
        const storedGhibliMode = localStorage.getItem(GHIBLI_MODE_STORAGE_KEY);
        if (isGhibliMode(storedGhibliMode)) {
          setGhibliModeState(storedGhibliMode);
        }
      } catch {
        // Ignore storage errors in private mode.
      }

      try {
        const storedBackground = localStorage.getItem(APP_BACKGROUND_STORAGE_KEY);
        const normalized = storedBackground?.trim() ?? "";
        setBackgroundImageUrlState(normalized || null);
      } catch {
        // Ignore storage errors in private mode.
      }
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    } catch {
      // Ignore storage errors in private mode.
    }
  }, []);

  const setGhibliMode = useCallback((nextMode: GhibliMode) => {
    setGhibliModeState(nextMode);
    try {
      localStorage.setItem(GHIBLI_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Ignore storage errors in private mode.
    }
  }, []);

  const setBackgroundImage = useCallback((imageUrl: string | null) => {
    const normalized = imageUrl?.trim() ?? "";
    const nextUrl = normalized || null;

    setBackgroundImageUrlState(nextUrl);
    try {
      if (nextUrl) {
        localStorage.setItem(APP_BACKGROUND_STORAGE_KEY, nextUrl);
      } else {
        localStorage.removeItem(APP_BACKGROUND_STORAGE_KEY);
      }
    } catch {
      // Ignore storage errors in private mode.
    }
  }, []);

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
