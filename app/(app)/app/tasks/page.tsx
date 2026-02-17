import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskForm } from "@/components/tasks/task-form";
import { TaskList } from "@/components/dashboard/task-list";
import { TasksFiltersMenu } from "@/components/tasks/tasks-filters-menu";
import { getHouseData, requireSession } from "@/lib/house";
import { resolveEquipmentImageUrl } from "@/lib/equipment-images";
import { resolveProjectImageUrl } from "@/lib/project-images";
import { resolveTaskImageGeneratingSet } from "@/lib/task-images";
import { CheckSquare2, Plus } from "lucide-react";

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
  const generatingTaskIds = await resolveTaskImageGeneratingSet(tasks.map((task) => task.id));
  const projectImageEntries = await Promise.all(
    projects.map(async (project) => [project.id, await resolveProjectImageUrl(project.id)] as const)
  );
  const equipmentImageEntries = await Promise.all(
    equipments.map(
      async (equipment) => [equipment.id, await resolveEquipmentImageUrl(equipment.id)] as const
    )
  );
  const projectImageMap = new Map<string, string | null>(projectImageEntries);
  const equipmentImageMap = new Map<string, string | null>(equipmentImageEntries);

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
    isImageGenerating: generatingTaskIds.has(task.id),
    zone: task.zone?.name ?? null,
    category: task.category?.name ?? null,
    project: task.project?.name ?? null,
    projectImageUrl: task.projectId ? projectImageMap.get(task.projectId) ?? null : null,
    equipment: task.equipment?.name ?? null,
    equipmentImageUrl: task.equipmentId ? equipmentImageMap.get(task.equipmentId) ?? null : null,
    animal: task.animal?.name ?? null,
    animalImageUrl: task.animal?.imageUrl ?? null,
    person: task.person?.name ?? null,
    personImageUrl: task.person?.imageUrl ?? null,
    recurring: Boolean(task.parentId),
    assignee: task.assignee?.name ?? task.assignee?.email ?? null,
    assigneeId: task.assigneeId ?? null,
    assigneeImageUrl: task.assignee?.image ?? null,
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
        <header className="page-header flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CheckSquare2
              className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">Tâches</p>
            <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Toutes les tâches</h1>
          </div>
          <label
            htmlFor="create-task"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90"
            title="Créer une tâche"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Créer une tâche</span>
          </label>
        </header>
        <div className="mt-4 hidden peer-checked:block">
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle tâche</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskForm
                houseId={houseId}
                currentUserId={session.user.id}
                zones={zones}
                categories={categories}
                projects={projects.map((project) => ({
                  ...project,
                  imageUrl: projectImageMap.get(project.id) ?? null,
                }))}
                equipments={equipments.map((equipment) => ({
                  ...equipment,
                  imageUrl: equipmentImageMap.get(equipment.id) ?? null,
                }))}
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
          <TasksFiltersMenu
            queryValue={queryValue}
            timeframeFilter={timeframeFilter}
            statusFilter={statusFilter}
            zoneFilter={zoneFilter}
            categoryFilter={categoryFilter}
            assigneeFilter={assigneeFilter}
            zones={zones.map((zone) => ({ id: zone.id, label: zone.name }))}
            categories={categories.map((category) => ({
              id: category.id,
              label: category.name,
            }))}
            assignees={members.map((member) => ({
              id: member.userId,
              label: member.user.name || member.user.email || "Membre",
              imageUrl: member.user.image,
            }))}
          />
        </CardHeader>
        <CardContent>
          <TaskList tasks={filtered} members={members.map((member) => member.user)} />
        </CardContent>
      </Card>
    </>
  );
}
