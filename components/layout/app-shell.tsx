"use client";

import { useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/sidebar";
import { AgentChat } from "@/components/agent/agent-chat";

export function AppShell({
  houseName,
  houseIconUrl,
  userName,
  userEmail,
  unreadNotifications,
  children,
}: {
  houseName: string;
  houseIconUrl?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  unreadNotifications?: number;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="flex min-h-screen">
        <Sidebar
          houseName={houseName}
          houseIconUrl={houseIconUrl}
          userName={userName}
          userEmail={userEmail}
          unreadNotifications={unreadNotifications}
          collapsed={collapsed}
          onToggle={toggle}
        />

        <div
          className={`min-w-0 flex-1 p-4 sm:p-6 lg:p-10 ${
            collapsed ? "lg:ml-20" : "lg:ml-72"
          }`}
        >
          <div className="mx-auto flex min-w-0 w-full max-w-6xl flex-col gap-4 sm:gap-6">
            <div className="flex items-center gap-3 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white/90 text-slate-900 shadow-sm transition hover:bg-slate-100 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
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
        unreadNotifications={unreadNotifications}
        collapsed={false}
        mobile
        isOpen={mobileMenuOpen}
        onClose={closeMobileMenu}
      />

      <AgentChat />
    </div>
  );
}
