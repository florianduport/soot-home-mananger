"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "@/components/theme/theme-provider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/* Wrap the app once to expose useTheme() and apply CSS variables globally. */}
      <ThemeProvider>{children}</ThemeProvider>
    </SessionProvider>
  );
}
