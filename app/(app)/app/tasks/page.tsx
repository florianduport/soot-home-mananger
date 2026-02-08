import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/dashboard/task-list";
import { Button } from "@/components/ui/button";
import { getHouseData, requireSession } from "@/lib/house";
import { Plus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

type TaskSearchParams = { [key: string]: string | string[] | undefined };

function resolveSearchParams(
  searchParams: TaskSearchParams | Promise<TaskSearchParams>
) {
  return typeof (searchParams as Promise<TaskSearchParams>)?.then === "function"
    ? (searchParams as Promise<TaskSearchParams>)
    : Promise.resolve(searchParams as TaskSearchParams);
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: TaskSearchParams | Promise<TaskSearchParams>;
}) {
  const session = await requireSession();
  const {
    houseId,
    zones,
    categories,
    animals,
    people,
    equipments,
    projects,
    members,
    tasks,
  } = await getHouseData(session.user.id);

  const resolvedSearchParams = await resolveSearchParams(searchParams);

  const queryValue = (resolvedSearchParams.q ?? "").toString();
  const query = queryValue.toLowerCase();
  const statusFilter = (resolvedSearchParams.status ?? "").toString();
  const zoneFilter = (resolvedSearchParams.zone ?? "").toString();
  const categoryFilter = (resolvedSearchParams.category ?? "").toString();
  const assigneeFilter = (resolvedSearchParams.assignee ?? "").toString();
  const timeframeFilter = (resolvedSearchParams.timeframe ?? "").toString() || "all";

  const now = new Date();
  const startDefaultWindow = new Date(now);
  startDefaultWindow.setMonth(startDefaultWindow.getMonth() - 1);
  const endDefaultWindow = new Date(now);
  endDefaultWindow.setMonth(endDefaultWindow.getMonth() + 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const nextMonthEnd = new Date(now.getFullYear(), now.getMonth() + 2, 1);
  const nextThreeMonthsEnd = new Date(now);
  nextThreeMonthsEnd.setMonth(nextThreeMonthsEnd.getMonth() + 3);
  const nextSixMonthsEnd = new Date(now);
  nextSixMonthsEnd.setMonth(nextSixMonthsEnd.getMonth() + 6);

  const taskItems = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    imageUrl: task.imageUrl ?? null,
    zone: task.zone?.name ?? null,
    category: task.category?.name ?? null,
    project: task.project?.name ?? null,
    equipment: task.equipment?.name ?? null,
    animal: task.animal?.name ?? null,
    person: task.person?.name ?? null,
    recurring: Boolean(task.parentId),
    assignee: task.assignee?.name ?? task.assignee?.email ?? null,
    assigneeId: task.assigneeId ?? null,
  }));

  const filtered = taskItems.filter((task) => {
    if (timeframeFilter !== "all") {
      if (!task.dueDate) return false;
      const due = new Date(task.dueDate);
      if (timeframeFilter === "window_1m") {
        if (due < startDefaultWindow || due > endDefaultWindow) return false;
      } else if (timeframeFilter === "next_month") {
        if (due < nextMonthStart || due >= nextMonthEnd) return false;
      } else if (timeframeFilter === "next_3m") {
        if (due < now || due >= nextThreeMonthsEnd) return false;
      } else if (timeframeFilter === "next_6m") {
        if (due < now || due >= nextSixMonthsEnd) return false;
      }
    }

    if (statusFilter && task.status !== statusFilter) return false;
    if (zoneFilter && task.zone !== zoneFilter) return false;
    if (categoryFilter && task.category !== categoryFilter) return false;
    if (assigneeFilter && task.assigneeId !== assigneeFilter) return false;
    if (query) {
      const haystack = `${task.title} ${task.zone ?? ""} ${task.category ?? ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  return (
    <>
      <section>
        <input id="create-task" type="checkbox" className="peer sr-only" />
        <div className="flex items-start justify-between gap-3">
          <header>
            <p className="text-sm text-muted-foreground">Tâches</p>
            <h1 className="text-2xl font-semibold">Toutes les tâches</h1>
          </header>
          <label
            htmlFor="create-task"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
            title="Créer une tâche"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Créer une tâche</span>
          </label>
        </div>
        <div className="mt-4 hidden peer-checked:block">
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle tâche</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskForm
                houseId={houseId}
                zones={zones}
                categories={categories}
                projects={projects}
                equipments={equipments}
                animals={animals}
                people={people}
                members={members.map((member) => member.user)}
              />
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Liste complète</CardTitle>
          <details className="group relative">
            <summary
              className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100 [&::-webkit-details-marker]:hidden"
              title="Filtres tâches"
              aria-label="Filtres tâches"
            >
              <SlidersHorizontal className="h-4 w-4" />
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-[min(90vw,340px)] rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
              <form method="get" className="grid gap-2">
                <input
                  name="q"
                  placeholder="Rechercher..."
                  defaultValue={queryValue}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
                <select
                  name="timeframe"
                  defaultValue={timeframeFilter}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">Statut</option>
                  <option value="TODO">À faire</option>
                  <option value="IN_PROGRESS">En cours</option>
                  <option value="DONE">Terminé</option>
                </select>
                <select
                  name="zone"
                  defaultValue={zoneFilter}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">Zone</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.name}>
                      {zone.name}
                    </option>
                  ))}
                </select>
                <select
                  name="category"
                  defaultValue={categoryFilter}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">Catégorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.name}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select
                  name="assignee"
                  defaultValue={assigneeFilter}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">Assigné</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.userId}>
                      {member.user.name || member.user.email || "Membre"}
                    </option>
                  ))}
                </select>
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
        </CardHeader>
        <CardContent>
          <TaskList tasks={filtered} members={members.map((member) => member.user)} />
        </CardContent>
      </Card>
    </>
  );
}
