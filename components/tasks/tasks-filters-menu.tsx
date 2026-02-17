"use client";

import { useRef } from "react";
import Link from "next/link";
import { SlidersHorizontal } from "lucide-react";
import { AvatarSelect } from "@/components/ui/avatar-select";
import { Button } from "@/components/ui/button";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

type Option = {
  id: string;
  label: string;
  imageUrl?: string | null;
};

export function TasksFiltersMenu({
  queryValue,
  timeframeFilter,
  statusFilter,
  zoneFilter,
  categoryFilter,
  assigneeFilter,
  zones,
  categories,
  assignees,
}: {
  queryValue: string;
  timeframeFilter: string;
  statusFilter: string;
  zoneFilter: string;
  categoryFilter: string;
  assigneeFilter: string;
  zones: Option[];
  categories: Option[];
  assignees: Option[];
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useCloseDetailsOnOutside(detailsRef);

  return (
    <details ref={detailsRef} className="group relative">
      <summary
        className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90 [&::-webkit-details-marker]:hidden"
        title="Filtres tâches"
        aria-label="Filtres tâches"
      >
        <SlidersHorizontal className="h-4 w-4" />
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-[min(90vw,340px)] rounded-xl border border-sidebar-primary bg-sidebar-primary p-3 text-sidebar-primary-foreground shadow-xl">
        <form method="get" className="grid gap-2">
          <input
            name="q"
            placeholder="Rechercher..."
            defaultValue={queryValue}
            className="h-9 w-full rounded-md border border-sidebar-primary-foreground/25 bg-sidebar-primary-foreground/10 px-3 text-sm text-sidebar-primary-foreground placeholder:text-sidebar-primary-foreground/70"
          />
          <select
            name="timeframe"
            defaultValue={timeframeFilter}
            className="h-9 w-full rounded-md border border-sidebar-primary-foreground/25 bg-sidebar-primary-foreground/10 px-3 text-sm text-sidebar-primary-foreground shadow-xs focus-visible:border-sidebar-primary-foreground/50 focus-visible:ring-sidebar-primary-foreground/20 focus-visible:ring-[3px]"
          >
            <option value="all">Période: toutes les tâches</option>
            <option value="window_1m">Période: ± 1 mois</option>
            <option value="next_month">Période: mois prochain</option>
            <option value="next_3m">Période: 3 mois</option>
            <option value="next_6m">Période: 6 mois</option>
          </select>
          <select
            name="status"
            defaultValue={statusFilter}
            className="h-9 w-full rounded-md border border-sidebar-primary-foreground/25 bg-sidebar-primary-foreground/10 px-3 text-sm text-sidebar-primary-foreground shadow-xs focus-visible:border-sidebar-primary-foreground/50 focus-visible:ring-sidebar-primary-foreground/20 focus-visible:ring-[3px]"
          >
            <option value="">Statut</option>
            <option value="TODO">À faire</option>
            <option value="IN_PROGRESS">En cours</option>
            <option value="DONE">Terminé</option>
          </select>
          <select
            name="zone"
            defaultValue={zoneFilter}
            className="h-9 w-full rounded-md border border-sidebar-primary-foreground/25 bg-sidebar-primary-foreground/10 px-3 text-sm text-sidebar-primary-foreground shadow-xs focus-visible:border-sidebar-primary-foreground/50 focus-visible:ring-sidebar-primary-foreground/20 focus-visible:ring-[3px]"
          >
            <option value="">Zone</option>
            {zones.map((zone) => (
              <option key={zone.id} value={zone.label}>
                {zone.label}
              </option>
            ))}
          </select>
          <select
            name="category"
            defaultValue={categoryFilter}
            className="h-9 w-full rounded-md border border-sidebar-primary-foreground/25 bg-sidebar-primary-foreground/10 px-3 text-sm text-sidebar-primary-foreground shadow-xs focus-visible:border-sidebar-primary-foreground/50 focus-visible:ring-sidebar-primary-foreground/20 focus-visible:ring-[3px]"
          >
            <option value="">Catégorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.label}>
                {category.label}
              </option>
            ))}
          </select>
          <AvatarSelect
            name="assignee"
            defaultValue={assigneeFilter}
            emptyLabel="Assigné"
            triggerClassName="border-sidebar-primary-foreground/25 bg-sidebar-primary-foreground/10 text-sidebar-primary-foreground focus-visible:border-sidebar-primary-foreground/50 focus-visible:ring-sidebar-primary-foreground/20"
            contentClassName="bg-sidebar-primary text-sidebar-primary-foreground"
            options={assignees.map((assignee) => ({
              value: assignee.id,
              label: assignee.label,
              imageUrl: assignee.imageUrl ?? null,
            }))}
          />
          <div className="mt-1 flex items-center justify-end gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/app/tasks">Réinitialiser</Link>
            </Button>
            <Button type="submit" variant="outline" size="sm">
              Appliquer
            </Button>
          </div>
        </form>
      </div>
    </details>
  );
}
