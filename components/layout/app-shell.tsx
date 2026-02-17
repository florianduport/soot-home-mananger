"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { AgentChat } from "@/components/agent/agent-chat";
import { useTheme } from "@/hooks/use-theme";

export function AppShell({
  houseName,
  houseIconUrl,
  userName,
  userEmail,
  userImage,
  children,
}: {
  houseName: string;
  houseIconUrl?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userImage?: string | null;
  children: React.ReactNode;
}) {
  const { backgroundImageUrl } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const hasCustomBackground = Boolean(backgroundImageUrl);

  const shellStyle: CSSProperties | undefined = hasCustomBackground
    ? {
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.3), rgba(15, 23, 42, 0.5)), url(${backgroundImageUrl})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }
    : undefined;

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      try {
        setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
      } catch {
        // ignore storage errors
      }
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  const closeMobileMenu = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
    setMobileMenuOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeMobileMenu();
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
      }
    };

    mediaQuery.addEventListener("change", closeOnDesktop);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      mediaQuery.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("keydown", onEscape);
    };
  }, [mobileMenuOpen, closeMobileMenu]);

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("sidebar-collapsed", String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  };

  return (
    <div
      className={`app-theme-shell min-h-dvh ${hasCustomBackground ? "app-theme-shell--image" : ""}`}
      style={shellStyle}
    >
      <div className="flex min-h-dvh">
        <Sidebar
          houseName={houseName}
          houseIconUrl={houseIconUrl}
          userName={userName}
          userEmail={userEmail}
          userImage={userImage}
          collapsed={collapsed}
          onToggle={toggle}
        />

        <div
          className={`min-w-0 flex-1 p-4 sm:p-6 lg:p-10 ${
            collapsed ? "lg:ml-20" : "lg:ml-72"
          }`}
        >
          <div className="app-shell-content mx-auto flex min-w-0 w-full max-w-6xl flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition hover:bg-muted"
                title="Ouvrir la navigation"
              >
                <Menu className="h-4 w-4" />
                <span className="sr-only">Ouvrir la navigation</span>
              </button>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">
                  Maison
                </p>
                <p className="truncate text-sm font-semibold">{houseName}</p>
              </div>
            </div>
            {children}
          </div>
        </div>
      </div>

      <button
        type="button"
        aria-label="Fermer le menu"
        onClick={closeMobileMenu}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          mobileMenuOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <Sidebar
        houseName={houseName}
        houseIconUrl={houseIconUrl}
        userName={userName}
        userEmail={userEmail}
        userImage={userImage}
        collapsed={false}
        mobile
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />

      <AgentChat />
    </div>
  );
}
