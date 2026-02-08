import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarView } from "@/components/dashboard/calendar-view";
import { TaskList } from "@/components/dashboard/task-list";
import { Button } from "@/components/ui/button";
import { getHouseData, requireSession } from "@/lib/house";
import { buildCalendarTasks } from "@/lib/calendar";

export default async function OverviewPage() {
  const session = await requireSession();
  const { membership, tasks, importantDates } = await getHouseData(session.user.id);

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
    updatedAt: task.updatedAt,
  }));

  const calendarTasks = buildCalendarTasks(
    tasks.map((task) => ({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      reminderOffsetDays: task.reminderOffsetDays,
      imageUrl: task.imageUrl ?? null,
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
      <header>
        <p className="text-sm text-muted-foreground">Vue globale</p>
        <h1 className="text-2xl font-semibold">{membership.house.name}</h1>
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
