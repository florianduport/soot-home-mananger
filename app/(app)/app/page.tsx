import Link from "next/link";
import { Home, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TaskList } from "@/components/dashboard/task-list";
import { Button } from "@/components/ui/button";
import { getHouseData, requireSession } from "@/lib/house";
import { resolveEquipmentImageUrl } from "@/lib/equipment-images";
import { resolveProjectImageUrl } from "@/lib/project-images";
import { resolveTaskImageGeneratingSet } from "@/lib/task-images";
import { SootMascot } from "@/components/mascot/soot-mascot";

export default async function OverviewPage() {
  const session = await requireSession();
  const { membership, tasks } = await getHouseData(session.user.id);
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

  const today = new Date();
  const startOfDay = new Date(today);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  const weekAhead = new Date(startOfDay);
  weekAhead.setDate(weekAhead.getDate() + 7);

  const focusOfDay = taskItems
    .filter((task) => {
      if (task.status === "DONE" || !task.dueDate) return false;
      const due = new Date(task.dueDate);
      return due >= startOfDay && due < endOfDay;
    })
    .slice(0, 3);

  const routineTasks = taskItems
    .filter((task) => task.recurring)
    .filter((task) => task.status !== "DONE")
    .slice(0, 5);

  const upcomingTasks = taskItems.filter((task) => {
    if (task.status === "DONE" || !task.dueDate) return false;
    const due = new Date(task.dueDate);
    return due >= startOfDay && due <= weekAhead;
  });

  return (
    <>
      <header className="page-header flex items-center justify-between gap-3">
        <div className="min-w-0">
          <Home className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Aujourd&apos;hui</p>
          <h1 className="text-2xl font-semibold sm:whitespace-nowrap">{membership.house.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Une maison calme, une action utile à la fois.
          </p>
        </div>
        <Button asChild size="icon" variant="add" className="rounded-full">
          <Link href="/app/tasks?create=1">
            <Plus className="h-4 w-4" />
            <span className="sr-only">Ajouter</span>
          </Link>
        </Button>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Focus du jour</CardTitle>
          <SootMascot mood={focusOfDay.length ? "working" : "sleepy"} className="h-10 w-10" />
        </CardHeader>
        <CardContent>
          <TaskList tasks={focusOfDay} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Routines</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList tasks={routineTasks} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>À venir (7 jours)</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList tasks={upcomingTasks.slice(0, 8)} />
        </CardContent>
      </Card>
    </>
  );
}
