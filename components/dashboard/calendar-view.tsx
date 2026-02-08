"use client";

import { type ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export type CalendarTask = {
  id: string;
  title: string;
  dueDate: string;
  kind?: "task" | "reminder" | "important_date";
  parentId?: string;
  imageUrl?: string | null;
  zoneId?: string | null;
  categoryId?: string | null;
  assigneeId?: string | null;
  projectId?: string | null;
  equipmentId?: string | null;
  href?: string | null;
};

const weekdayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

function toKey(date: Date) {
  return format(date, "yyyy-MM-dd");
}

export function CalendarView({
  tasks,
  view = "month",
  headerAction,
}: {
  tasks: CalendarTask[];
  view?: "month" | "week";
  headerAction?: ReactNode;
}) {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());

  const tasksByDate = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    tasks.forEach((task) => {
      const date = new Date(task.dueDate);
      if (Number.isNaN(date.getTime())) return;
      const key = toKey(date);
      if (!map.has(key)) map.set(key, []);
      map.get(key)?.push(task);
    });
    map.forEach((value) => {
      const kindOrder: Record<string, number> = {
        important_date: 0,
        reminder: 1,
        task: 2,
      };
      value.sort((a, b) => {
        if (a.kind === b.kind) return 0;
        return (kindOrder[a.kind ?? "task"] ?? 9) - (kindOrder[b.kind ?? "task"] ?? 9);
      });
    });
    return map;
  }, [tasks]);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
  const gridStart = view === "week" ? weekStart : startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = view === "week" ? weekEnd : endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return (
    <div className="rounded-2xl border bg-card text-foreground shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">
              Calendrier
            </p>
            <h3 className="text-base font-semibold sm:text-lg">
              Calendrier global
            </h3>
          </div>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
        <div className="mt-3 flex w-full flex-wrap items-center gap-2 sm:flex-nowrap">
          <button
            type="button"
            className="rounded-full border border-border px-3 py-1 text-xs uppercase tracking-widest text-muted-foreground hover:bg-muted"
            onClick={() => {
              const now = new Date();
              setCurrentDate(now);
            }}
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-border text-muted-foreground hover:bg-muted"
            onClick={() => {
              setCurrentDate(
                view === "week"
                  ? addDays(currentDate, -7)
                  : addMonths(currentDate, -1)
              );
            }}
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center text-sm font-medium text-foreground sm:min-w-[160px] sm:flex-none">
            {view === "week"
              ? `${format(weekStart, "d MMM")} - ${format(weekEnd, "d MMM yyyy")}`
              : format(monthStart, "MMMM yyyy")}
          </div>
          <button
            type="button"
            className="h-9 w-9 rounded-full border border-border text-muted-foreground hover:bg-muted"
            onClick={() => {
              setCurrentDate(
                view === "week"
                  ? addDays(currentDate, 7)
                  : addMonths(currentDate, 1)
              );
            }}
          >
            ›
          </button>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-border text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {weekdayLabels.map((label) => (
              <div key={label} className="px-3 py-2 text-center">
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-px bg-border/60">
            {days.map((day) => {
              const key = toKey(day);
              const dayTasks = tasksByDate.get(key) ?? [];
              const isCurrentMonth =
                view === "week" ? true : isSameMonth(day, monthStart);
              const isTodayDate = isToday(day);
              const visibleTasks = dayTasks.slice(0, 3);
              const extraCount = dayTasks.length - visibleTasks.length;

              return (
                <div
                  key={key}
                  className={`min-h-[108px] bg-card p-2 sm:min-h-[120px] ${
                    isCurrentMonth ? "opacity-100" : "opacity-40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold ${
                        isTodayDate
                          ? "flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background"
                          : "text-muted-foreground"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {dayTasks.length ? (
                      <span className="text-[10px] text-slate-400">
                        {dayTasks.length} éléments
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-2 space-y-1">
                    {visibleTasks.map((task) => {
                      const href =
                        task.href ??
                        (task.kind === "important_date"
                          ? "/app/settings"
                          : `/app/tasks/${task.parentId ?? task.id}`);
                      const className = `block truncate rounded-md border px-2 py-1 text-[10px] font-medium transition hover:opacity-80 sm:text-[11px] ${
                        task.kind === "important_date"
                          ? "border-amber-200 bg-amber-50 text-amber-900"
                          : task.kind === "reminder"
                            ? "border-dashed border-muted-foreground/40 text-muted-foreground"
                            : "border-border bg-muted text-foreground"
                      }`;

                      const content = (
                        <span className="flex items-center gap-2">
                          {task.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={task.imageUrl}
                              alt=""
                              className="h-6 w-6 rounded-md object-cover"
                            />
                          ) : null}
                          <span className="truncate">{task.title}</span>
                        </span>
                      );

                      if (!href) {
                        return (
                          <div key={task.id} className={className}>
                            {content}
                          </div>
                        );
                      }

                      return (
                        <Link
                          key={task.id}
                          href={href}
                          className={className}
                        >
                          {content}
                        </Link>
                      );
                    })}
                    {extraCount > 0 ? (
                      <div className="text-[10px] text-slate-400">
                        +{extraCount} autres
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
