import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInDays,
  differenceInMonths,
  differenceInWeeks,
  differenceInYears,
  format,
  setHours,
  startOfDay,
} from "date-fns";
import { prisma } from "@/lib/db";
import type { RecurrenceUnit } from "@prisma/client";

const HORIZON_DAYS = 90;

function addInterval(date: Date, unit: RecurrenceUnit, interval: number) {
  switch (unit) {
    case "DAILY":
      return addDays(date, interval);
    case "WEEKLY":
      return addWeeks(date, interval);
    case "MONTHLY":
      return addMonths(date, interval);
    case "YEARLY":
      return addYears(date, interval);
    default:
      return addDays(date, interval);
  }
}

function dateKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function normalizeDueDate(date: Date) {
  return setHours(startOfDay(date), 12);
}

export async function ensureRecurringTasks(houseId: string) {
  const templates = await prisma.task.findMany({
    where: {
      houseId,
      isTemplate: true,
      recurrenceUnit: { not: null },
      dueDate: { not: null },
    },
    select: {
      id: true,
      title: true,
      description: true,
      dueDate: true,
      recurrenceUnit: true,
      recurrenceInterval: true,
      reminderOffsetDays: true,
      createdById: true,
      assigneeId: true,
      zoneId: true,
      categoryId: true,
      projectId: true,
      equipmentId: true,
      animalId: true,
      personId: true,
      allowDuringQuietHours: true,
      escalationDelayHours: true,
      escalationDisabled: true,
    },
  });

  if (!templates.length) return;

  const today = startOfDay(new Date());
  const horizon = addDays(today, HORIZON_DAYS);

  for (const template of templates) {
    const existing = await prisma.task.findMany({
      where: {
        parentId: template.id,
        dueDate: { not: null },
      },
      select: { dueDate: true },
    });

    const existingKeys = new Set(
      existing
        .map((item) => item.dueDate)
        .filter((date): date is Date => Boolean(date))
        .map((date) => dateKey(date))
    );

    let cursor = normalizeDueDate(template.dueDate!);
    const interval = template.recurrenceInterval ?? 1;
    const unit = template.recurrenceUnit!;

    if (cursor < today) {
      let jumps = 0;
      if (unit === "DAILY") {
        jumps = Math.floor(differenceInDays(today, cursor) / interval);
      } else if (unit === "WEEKLY") {
        jumps = Math.floor(differenceInWeeks(today, cursor) / interval);
      } else if (unit === "MONTHLY") {
        jumps = Math.floor(differenceInMonths(today, cursor) / interval);
      } else if (unit === "YEARLY") {
        jumps = Math.floor(differenceInYears(today, cursor) / interval);
      }
      if (jumps > 0) {
        cursor = addInterval(cursor, unit, jumps * interval);
      }
      while (cursor < today) {
        cursor = addInterval(cursor, unit, interval);
      }
    }

    while (cursor <= horizon) {
      const key = dateKey(cursor);
      if (!existingKeys.has(key)) {
        await prisma.task.create({
          data: {
            houseId,
            title: template.title,
            description: template.description,
            status: "TODO",
            dueDate: cursor,
            reminderOffsetDays: template.reminderOffsetDays,
            createdById: template.createdById,
            assigneeId: template.assigneeId ?? null,
            zoneId: template.zoneId,
            categoryId: template.categoryId,
            projectId: template.projectId,
            equipmentId: template.equipmentId,
            animalId: template.animalId,
            personId: template.personId,
            assignedAt: template.assigneeId ? new Date() : null,
            allowDuringQuietHours: template.allowDuringQuietHours,
            escalationDelayHours: template.escalationDelayHours,
            escalationDisabled: template.escalationDisabled,
            parentId: template.id,
          },
        });
      }
      cursor = addInterval(cursor, unit, interval);
    }
  }
}
