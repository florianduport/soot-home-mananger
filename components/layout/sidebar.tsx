"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare2,
  Hammer,
  Home,
  Landmark,
  Bell,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  Settings,
  X,
} from "lucide-react";
import { SignOutButton } from "@/components/auth/sign-out-button";

const primaryNav = [
  { href: "/app", label: "Vue globale", icon: Home },
  { href: "/app/notifications", label: "Notifications", icon: Bell },
  { href: "/app/tasks", label: "Tâches", icon: CheckSquare2 },
  { href: "/app/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/app/budgets", label: "Budgets", icon: Landmark },
  { href: "/app/shopping-lists", label: "Listes d'achats", icon: ShoppingCart },
  { href: "/app/projects", label: "Projets", icon: Hammer },
  { href: "/app/equipment", label: "Équipements", icon: Package },
];

const secondaryNav = [{ href: "/app/settings", label: "Réglages", icon: Settings }];

export function Sidebar({
  houseName,
  houseIconUrl,
  userName,
  userEmail,
  unreadNotifications = 0,
  collapsed = false,
  onToggle,
  mobile = false,
  isOpen = true,
  onClose,
}: {
  houseName: string;
  houseIconUrl?: string | null;
  userName?: string | null;
  userEmail?: string | null;
  unreadNotifications?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  mobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const isCollapsed = mobile ? false : collapsed;

  const asideClassName = mobile
    ? `fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-6 border-r border-border bg-white/95 p-4 shadow-2xl backdrop-blur transition-transform dark:bg-slate-900/95 lg:hidden ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`
    : `fixed left-0 top-0 hidden h-screen flex-col gap-6 border-r border-border bg-white/80 backdrop-blur transition-all dark:bg-slate-900/80 lg:flex ${
        isCollapsed ? "w-20 p-4" : "w-72 p-6"
      }`;

  return (
    <aside className={asideClassName} aria-hidden={mobile && !isOpen}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {houseIconUrl ? (
            <div
              role="img"
              aria-label={`Icône de ${houseName}`}
              className="h-12 w-12 shrink-0 rounded-2xl border bg-cover bg-center"
              style={{ backgroundImage: `url(${houseIconUrl})` }}
            />
          ) : (
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
              H
            </div>
          )}
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Maison
              </p>
              <h2 className="truncate text-lg font-semibold">{houseName}</h2>
            </div>
          ) : null}
        </div>
        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
            title={isCollapsed ? "Déplier" : "Replier"}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      {!isCollapsed ? (
        <div className="rounded-xl border bg-white/90 p-3 dark:bg-slate-900/70">
          <p className="text-sm font-medium">{userName || "Utilisateur"}</p>
          <p className="text-xs text-muted-foreground">{userEmail || "—"}</p>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pr-1">
        <div className="space-y-2">
          {!isCollapsed ? (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Navigation
            </p>
          ) : null}
          <nav className="flex flex-col gap-2">
            {primaryNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              const showBadge =
                item.href === "/app/notifications" && unreadNotifications > 0;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                  onClick={mobile ? onClose : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed ? (
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      {showBadge ? (
                        <span className="rounded-full bg-rose-500 px-2 py-0.5 text-xs font-semibold text-white">
                          {unreadNotifications}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2">
          {!isCollapsed ? (
            <p className="text-xs uppercase tracking-widest text-muted-foreground">
              Configuration
            </p>
          ) : null}
          <nav className="flex flex-col gap-2">
            {secondaryNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                  title={isCollapsed ? item.label : undefined}
                  onClick={mobile ? onClose : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!isCollapsed ? (
                    <span className="truncate">{item.label}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <div className="pt-2">
        {!isCollapsed ? (
          <SignOutButton className="w-full justify-start" variant="outline" />
        ) : (
          <SignOutButton
            className="w-full justify-center"
            variant="outline"
            collapsed
          />
        )}
      </div>
    </aside>
  );
}
