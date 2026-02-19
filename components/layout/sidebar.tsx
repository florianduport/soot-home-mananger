"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  CalendarDays,
  CheckSquare2,
  Hammer,
  Home,
  Landmark,
  LogOut,
  Moon,
  MoreHorizontal,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  ShoppingCart,
  Store,
  Settings,
  Sun,
  UserRound,
  X,
} from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

const primaryNav = [
  { href: "/app", label: "Aujourd’hui", icon: Home },
  { href: "/app/tasks", label: "Tâches", icon: CheckSquare2 },
  { href: "/app/calendar", label: "Calendrier", icon: CalendarDays },
  { href: "/app/budgets", label: "Budgets", icon: Landmark },
  { href: "/app/shopping-lists", label: "Listes d'achats", icon: ShoppingCart },
  { href: "/app/projects", label: "Projets", icon: Hammer },
  { href: "/app/equipment", label: "Équipements", icon: Package },
  { href: "/app/marketplace", label: "Marketplace", icon: Store },
];

const secondaryNav = [{ href: "/app/settings", label: "Réglages", icon: Settings }];
const userMenuTriggerClassName =
  "inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90";
const userMenuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10";
const appearanceModeButtonClassName =
  "inline-flex h-8 items-center justify-center gap-1 rounded-md border px-2 text-xs font-medium transition-colors";

export function Sidebar({
  houseName,
  houseIconUrl,
  userName,
  userEmail,
  userImage,
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
  userImage?: string | null;
  collapsed?: boolean;
  onToggle?: () => void;
  mobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const { setTheme, theme, ghibliMode, setGhibliMode } = useTheme();
  const isCollapsed = mobile ? false : collapsed;
  const userMenuRef = useRef<HTMLDetailsElement>(null);
  useCloseDetailsOnOutside(userMenuRef);
  const displayUserName = userName?.trim() || "Utilisateur";
  const displayUserEmail = userEmail?.trim() || "—";
  const fallbackInitialSource =
    displayUserName === "Utilisateur" ? displayUserEmail : displayUserName;
  const avatarFallback = fallbackInitialSource.slice(0, 1).toUpperCase() || "U";

  function closeUserMenu() {
    userMenuRef.current?.removeAttribute("open");
  }

  function openProfile() {
    closeUserMenu();
    if (mobile) {
      onClose?.();
    }
  }

  async function handleSignOut() {
    closeUserMenu();
    await signOut({ callbackUrl: "/login" });
  }

  function setAppearanceMode(mode: "light" | "dark") {
    setTheme("ghibli");
    setGhibliMode(mode);
  }

  const asideClassName = mobile
    ? `fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-6 border-r border-sidebar-border bg-sidebar/95 p-4 text-sidebar-foreground shadow-2xl backdrop-blur transition-transform lg:hidden ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`
    : `fixed left-0 top-0 hidden h-screen flex-col gap-6 border-r border-sidebar-border bg-sidebar/86 text-sidebar-foreground backdrop-blur transition-all lg:flex ${
        isCollapsed ? "w-20 p-4" : "w-72 p-6"
      }`;

  const userMenuContent = (
    <>
      <Link href="/app/profile" className={userMenuItemClassName} onClick={openProfile}>
        <UserRound className="h-4 w-4" />
        Profil
      </Link>

      <div className="my-1 border-t border-sidebar-primary-foreground/20" />

      <div className="space-y-1 px-1 pb-1 pt-0.5">
        <p className="px-2 text-[11px] uppercase tracking-wider text-sidebar-foreground/65">
          Mode Ghibli
        </p>
        <div className="grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => setAppearanceMode("light")}
            className={`${appearanceModeButtonClassName} ${
              theme === "ghibli" && ghibliMode === "light"
                ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                : "border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            Clair
          </button>
          <button
            type="button"
            onClick={() => setAppearanceMode("dark")}
            className={`${appearanceModeButtonClassName} ${
              theme === "ghibli" && ghibliMode === "dark"
                ? "border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground"
                : "border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Moon className="h-3.5 w-3.5" />
            Sombre
          </button>
        </div>
      </div>

      <div className="my-1 border-t border-sidebar-primary-foreground/20" />

      <button type="button" className={userMenuItemClassName} onClick={handleSignOut}>
        <LogOut className="h-4 w-4" />
        Se déconnecter
      </button>
    </>
  );

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
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sidebar-primary text-lg font-semibold text-sidebar-primary-foreground">
              {houseName.slice(0, 1).toUpperCase() || "S"}
            </div>
          )}
          {!isCollapsed ? (
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-[color:var(--accent-amber)]">
                Maison
              </p>
              <h2 className="truncate text-lg font-semibold text-sidebar-foreground">
                {houseName}
              </h2>
            </div>
          ) : null}
        </div>
        {mobile ? (
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground hover:bg-sidebar-accent"
            title="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-sidebar-border bg-sidebar-accent/35 text-sidebar-foreground hover:bg-sidebar-accent"
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

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        <div className="space-y-2">
          <nav className="flex flex-col gap-2">
            {primaryNav.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow"
                      : "text-sidebar-foreground/90 hover:bg-sidebar-accent"
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

        <div className="space-y-2">
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
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow"
                      : "text-sidebar-foreground/90 hover:bg-sidebar-accent"
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
          <div className="rounded-xl border border-sidebar-border bg-sidebar-accent/35 p-3">
            <div className="flex items-start gap-3">
              {userImage ? (
                <div
                  role="img"
                  aria-label={`Avatar de ${displayUserName}`}
                  className="h-10 w-10 shrink-0 rounded-full border bg-cover bg-center"
                  style={{ backgroundImage: `url(${userImage})` }}
                />
              ) : (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sm font-semibold text-sidebar-primary-foreground">
                  {avatarFallback}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">
                  {displayUserName}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/80">{displayUserEmail}</p>
              </div>

              <details ref={userMenuRef} className="action-menu relative shrink-0">
                <summary
                  className={`${userMenuTriggerClassName} list-none [&::-webkit-details-marker]:hidden`}
                  title="Actions utilisateur"
                  aria-label="Actions utilisateur"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </summary>

                <div className="action-menu-popover absolute bottom-full right-0 z-[999] mb-2 w-56 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
                  {userMenuContent}
                </div>
              </details>
            </div>
          </div>
        ) : (
          <details ref={userMenuRef} className="action-menu relative">
            <summary
              className={`${userMenuTriggerClassName} list-none [&::-webkit-details-marker]:hidden`}
              title="Actions utilisateur"
              aria-label="Actions utilisateur"
            >
              <MoreHorizontal className="h-4 w-4" />
            </summary>

            <div className="action-menu-popover absolute bottom-full right-0 z-[999] mb-2 w-56 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
              {userMenuContent}
            </div>
          </details>
        )}
      </div>
    </aside>
  );
}
