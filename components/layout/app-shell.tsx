"use client";

import type { CSSProperties } from "react";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, House, ListTodo, Menu, Plus, Settings } from "lucide-react";
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
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileActionsOpen, setMobileActionsOpen] = useState(false);
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

  const closeMobileActions = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      active.blur();
    }
    setMobileActionsOpen(false);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen && !mobileActionsOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const mediaQuery = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) {
        closeMobileMenu();
        closeMobileActions();
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMobileMenu();
        closeMobileActions();
      }
    };

    mediaQuery.addEventListener("change", closeOnDesktop);
    window.addEventListener("keydown", onEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      mediaQuery.removeEventListener("change", closeOnDesktop);
      window.removeEventListener("keydown", onEscape);
    };
  }, [mobileActionsOpen, mobileMenuOpen, closeMobileActions, closeMobileMenu]);

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
          <div className="app-shell-content mx-auto flex min-w-0 w-full max-w-6xl flex-col gap-4 pb-24 sm:gap-6 sm:pb-28 lg:pb-0">
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
        onClick={() => {
          closeMobileMenu();
          closeMobileActions();
        }}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity lg:hidden ${
          mobileMenuOpen || mobileActionsOpen
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        <ul className="mx-auto grid max-w-md grid-cols-5 items-end gap-1">
          <li>
            <Link
              href="/app"
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                pathname === "/app" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <House className="h-4 w-4" />
              Aujourd&apos;hui
            </Link>
          </li>
          <li>
            <Link
              href="/app/tasks"
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                pathname.startsWith("/app/tasks") ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              <ListTodo className="h-4 w-4" />
              Tâches
            </Link>
          </li>
          <li className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                setMobileActionsOpen((prev) => !prev);
              }}
              className="inline-flex h-12 w-12 -translate-y-3 items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-lg transition hover:scale-[1.03]"
              aria-label="Ajouter"
            >
              <Plus className="h-5 w-5" />
            </button>
          </li>
          <li>
            <Link
              href="/app/calendar"
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                pathname.startsWith("/app/calendar")
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Calendrier
            </Link>
          </li>
          <li>
            <Link
              href="/app/house"
              className={`flex flex-col items-center gap-1 rounded-lg px-2 py-1 text-[11px] ${
                pathname.startsWith("/app/house")
                  ? "text-foreground"
                  : "text-muted-foreground"
              }`}
            >
              <House className="h-4 w-4" />
              Maison
            </Link>
          </li>
        </ul>
      </nav>

      <section
        className={`fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 mx-auto w-[min(92vw,28rem)] rounded-2xl border border-border bg-card p-3 shadow-xl transition lg:hidden ${
          mobileActionsOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-3 opacity-0"
        }`}
      >
        <p className="px-1 pb-2 text-xs uppercase tracking-widest text-muted-foreground">
          Ajouter
        </p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Link
            href="/app/tasks?create=1"
            onClick={closeMobileActions}
            className="rounded-xl border border-border bg-background px-3 py-2 font-medium hover:bg-muted"
          >
            Tâche
          </Link>
          <Link
            href="/app/calendar"
            onClick={closeMobileActions}
            className="rounded-xl border border-border bg-background px-3 py-2 font-medium hover:bg-muted"
          >
            Rendez-vous
          </Link>
          <Link
            href="/app/budgets"
            onClick={closeMobileActions}
            className="rounded-xl border border-border bg-background px-3 py-2 font-medium hover:bg-muted"
          >
            Dépense
          </Link>
          <Link
            href="/app/shopping-lists?create=1"
            onClick={closeMobileActions}
            className="rounded-xl border border-border bg-background px-3 py-2 font-medium hover:bg-muted"
          >
            Achat
          </Link>
        </div>
      </section>

      <AgentChat />
    </div>
  );
}
