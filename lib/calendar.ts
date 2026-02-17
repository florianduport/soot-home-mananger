import { addDays } from "date-fns";
import {
  buildImportantDateOccurrences,
  type ImportantDateRecord,
  type ImportantDateType,
} from "@/lib/important-dates";

export type CalendarTask = {
  id: string;
  title: string;
  dueDate: string;
  kind?: "task" | "reminder" | "important_date";
  parentId?: string;
  imageUrl?: string | null;
  isImageGenerating?: boolean;
  zoneId?: string | null;
  categoryId?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  equipmentId?: string | null;
  importantDateId?: string;
  importantDateType?: ImportantDateType;
  href?: string | null;
  description?: string | null;
};

type SourceTask = {
  id: string;
  title: string;
  dueDate: Date | null;
  reminderOffsetDays: number | null;
  imageUrl?: string | null;
  isImageGenerating?: boolean;
  zoneId?: string | null;
  categoryId?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  equipmentId?: string | null;
};

type BuildCalendarOptions = {
  anchorDate?: Date;
  recurringYearsBefore?: number;
  recurringYearsAfter?: number;
  importantDatesHref?: string;
};

export function buildCalendarTasks(
  tasks: SourceTask[],
  importantDates: ImportantDateRecord[] = [],
  options: BuildCalendarOptions = {}
): CalendarTask[] {
  const calendarTasks: CalendarTask[] = [];
  const anchorDate = options.anchorDate ?? new Date();
  const recurringYearsBefore = options.recurringYearsBefore ?? 2;
  const recurringYearsAfter = options.recurringYearsAfter ?? 4;

  tasks.forEach((task) => {
    if (task.dueDate) {
      calendarTasks.push({
        id: task.id,
        title: task.title,
        dueDate: task.dueDate.toISOString(),
        kind: "task",
        imageUrl: task.imageUrl ?? null,
        isImageGenerating: Boolean(task.isImageGenerating),
        zoneId: task.zoneId ?? null,
        categoryId: task.categoryId ?? null,
        assigneeId: task.assigneeId ?? null,
        projectId: task.projectId ?? null,
        equipmentId: task.equipmentId ?? null,
        href: `/app/tasks/${task.id}`,
      });
    }

    if (
      task.dueDate &&
      task.reminderOffsetDays &&
      task.reminderOffsetDays > 0
    ) {
      const reminderDate = addDays(task.dueDate, -task.reminderOffsetDays);
      calendarTasks.push({
        id: `${task.id}-reminder-${task.reminderOffsetDays}`,
        title: `Rappel : ${task.title}`,
        dueDate: reminderDate.toISOString(),
        kind: "reminder",
        parentId: task.id,
        imageUrl: task.imageUrl ?? null,
        isImageGenerating: Boolean(task.isImageGenerating),
        zoneId: task.zoneId ?? null,
        categoryId: task.categoryId ?? null,
        assigneeId: task.assigneeId ?? null,
        projectId: task.projectId ?? null,
        equipmentId: task.equipmentId ?? null,
        href: `/app/tasks/${task.id}`,
      });
    }
  });

  const from = new Date(anchorDate.getFullYear() - recurringYearsBefore, 0, 1, 0, 0, 0, 0);
  const to = new Date(anchorDate.getFullYear() + recurringYearsAfter, 11, 31, 23, 59, 59, 999);
  const occurrences = buildImportantDateOccurrences(importantDates, { from, to });

  occurrences.forEach((occurrence) => {
    calendarTasks.push({
      id: occurrence.id,
      title: occurrence.title,
      dueDate: occurrence.occurrenceDate.toISOString(),
      kind: "important_date",
      importantDateId: occurrence.importantDateId,
      importantDateType: occurrence.type,
      description: occurrence.description ?? null,
      href: options.importantDatesHref ?? "/app/settings",
    });
  });

  return calendarTasks;
}
