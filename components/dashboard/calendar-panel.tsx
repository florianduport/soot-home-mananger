"use client";

import { useMemo, useRef, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CalendarView, type CalendarTask } from "@/components/dashboard/calendar-view";

type Option = { id: string; name: string | null; email?: string | null };

export function CalendarPanel({
  tasks,
  zones,
  categories,
  members,
  projects,
  equipments,
}: {
  tasks: CalendarTask[];
  zones: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  members: Option[];
  projects: { id: string; name: string }[];
  equipments: { id: string; name: string }[];
}) {
  const [view, setView] = useState<"month" | "week">("month");
  const [showReminders, setShowReminders] = useState(true);
  const [showImportantDates, setShowImportantDates] = useState(true);
  const [zoneId, setZoneId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [equipmentId, setEquipmentId] = useState("");
  const filtersRef = useRef<HTMLDetailsElement>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!showReminders && task.kind === "reminder") return false;
      if (!showImportantDates && task.kind === "important_date") return false;

      const isTaskLike = task.kind === "task" || task.kind === "reminder" || !task.kind;
      if (!isTaskLike) {
        return true;
      }

      if (zoneId && task.zoneId !== zoneId) return false;
      if (categoryId && task.categoryId !== categoryId) return false;
      if (assigneeId && task.assigneeId !== assigneeId) return false;
      if (projectId && task.projectId !== projectId) return false;
      if (equipmentId && task.equipmentId !== equipmentId) return false;
      return true;
    });
  }, [
    tasks,
    showReminders,
    showImportantDates,
    zoneId,
    categoryId,
    assigneeId,
    projectId,
    equipmentId,
  ]);

  return (
    <CalendarView
      tasks={filteredTasks}
      view={view}
      headerAction={
        <details ref={filtersRef} className="group relative">
          <summary
            className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
            title="Filtres calendrier"
            aria-label="Filtres calendrier"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </summary>

          <div className="absolute right-0 z-20 mt-2 w-[min(90vw,340px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`h-9 rounded-md border px-3 text-sm ${
                    view === "month"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground"
                  }`}
                  onClick={() => setView("month")}
                >
                  Mois
                </button>
                <button
                  type="button"
                  className={`h-9 rounded-md border px-3 text-sm ${
                    view === "week"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground"
                  }`}
                  onClick={() => setView("week")}
                >
                  Semaine
                </button>
              </div>

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showReminders}
                  onChange={(event) => setShowReminders(event.target.checked)}
                />
                Afficher les rappels
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={showImportantDates}
                  onChange={(event) => setShowImportantDates(event.target.checked)}
                />
                Afficher les dates importantes
              </label>

              <div className="grid gap-2">
                <select
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Zone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
                <select
                  value={categoryId}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Catégorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  value={assigneeId}
                  onChange={(event) => setAssigneeId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Assigné</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name || member.email || "Membre"}
                    </option>
                  ))}
                </select>
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Projet</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select
                  value={equipmentId}
                  onChange={(event) => setEquipmentId(event.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs"
                >
                  <option value="">Équipement</option>
                  {equipments.map((equipment) => (
                    <option key={equipment.id} value={equipment.id}>
                      {equipment.name}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                className="h-9 w-full rounded-md border border-slate-200 bg-white text-sm text-slate-800 hover:bg-slate-100"
                onClick={() => {
                  setView("month");
                  setShowReminders(true);
                  setShowImportantDates(true);
                  setZoneId("");
                  setCategoryId("");
                  setAssigneeId("");
                  setProjectId("");
                  setEquipmentId("");
                  filtersRef.current?.removeAttribute("open");
                }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          </div>
        </details>
      }
    />
  );
}
