import { CalendarPanel } from "@/components/dashboard/calendar-panel";
import { getHouseData, requireSession } from "@/lib/house";
import { buildCalendarTasks } from "@/lib/calendar";
import { resolveTaskImageGeneratingSet } from "@/lib/task-images";
import { CalendarDays } from "lucide-react";

export default async function CalendarPage() {
  const session = await requireSession();
  const { tasks, zones, categories, members, projects, equipments, importantDates } =
    await getHouseData(session.user.id);
  const generatingTaskIds = await resolveTaskImageGeneratingSet(tasks.map((task) => task.id));

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

  return (
    <>
      <header className="page-header">
        <CalendarDays
          className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Calendrier</p>
        <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Toutes les échéances</h1>
      </header>

      <CalendarPanel
        tasks={calendarTasks}
        zones={zones}
        categories={categories}
        members={members.map((member) => member.user)}
        projects={projects}
        equipments={equipments}
      />
    </>
  );
}
