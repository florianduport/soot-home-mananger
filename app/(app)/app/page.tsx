import Link from "next/link";
import { Home, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { TaskList } from "@/components/dashboard/task-list";
import { Button } from "@/components/ui/button";
import { getHouseData, requireSession } from "@/lib/house";
import { resolveEquipmentImageUrl } from "@/lib/equipment-images";
import { buildCalendarTasks } from "@/lib/calendar";
import { resolveProjectImageUrl } from "@/lib/project-images";
import { resolveTaskImageGeneratingSet } from "@/lib/task-images";

export default async function OverviewPage() {
  const session = await requireSession();
  const { membership, tasks, importantDates } = await getHouseData(session.user.id);
  const generatingTaskIds = await resolveTaskImageGeneratingSet(tasks.map((task) => task.id));
  const uniqueProjectIds = Array.from(
    new Set(tasks.map((task) => task.projectId).filter((projectId): projectId is string => Boolean(projectId)))
  );
  const uniqueEquipmentIds = Array.from(
    new Set(
      tasks
        .map((task) => task.equipmentId)
        .filter((equipmentId): equipmentId is string => Boolean(equipmentId))
    )
  );
  const projectImageEntries = await Promise.all(
    uniqueProjectIds.map(async (projectId) => [projectId, await resolveProjectImageUrl(projectId)] as const)
  );
  const equipmentImageEntries = await Promise.all(
    uniqueEquipmentIds.map(
      async (equipmentId) => [equipmentId, await resolveEquipmentImageUrl(equipmentId)] as const
    )
  );
  const projectImageMap = new Map<string, string | null>(projectImageEntries);
  const equipmentImageMap = new Map<string, string | null>(equipmentImageEntries);

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
    updatedAt: task.updatedAt,
  }));

  const calendarTasks = buildCalendarTasks(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      reminderOffsetDays: task.reminderOffsetDays,
      imageUrl: task.imageUrl ?? null,
      isImageGenerating: generatingTaskIds.has(task.id),
      zoneId: task.zoneId,
      categoryId: task.categoryId,
      assigneeId: task.assigneeId,
      projectId: task.projectId,
      equipmentId: task.equipmentId,
    })),
    importantDates.map((importantDate) => ({
      id: importantDate.id,
      title: importantDate.title,
      description: importantDate.description,
      date: importantDate.date,
      type: importantDate.type,
      isRecurringYearly: importantDate.isRecurringYearly,
    }))
  );

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const doneThisWeek = taskItems.filter(
    (task) => task.status === "DONE" && task.updatedAt >= weekAgo
  );
  const weekAhead = new Date();
  weekAhead.setDate(weekAhead.getDate() + 7);
  const upcomingTasks = taskItems.filter((task) => {
    if (task.status === "DONE") return false;
    if (!task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due >= weekAgo && due <= weekAhead;
  });

  return (
    <>
      <header className="page-header">
        <Home className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Vue globale</p>
        <h1 className="text-2xl font-semibold sm:whitespace-nowrap">{membership.house.name}</h1>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Tâches à venir</CardTitle>
          <Button asChild size="icon" variant="add" className="rounded-full">
            <Link href="/app/tasks">
              <Plus className="h-4 w-4" />
              <span className="sr-only">Ajouter une tâche</span>
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <TaskList tasks={upcomingTasks.slice(0, 8)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Tâches faites cette semaine</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList tasks={doneThisWeek.slice(0, 8)} />
        </CardContent>
      </Card>

      <CalendarView tasks={calendarTasks} />
    </>
  );
}
