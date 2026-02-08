export const IMPORTANT_DATE_TYPE_VALUES = [
  "BIRTHDAY",
  "ANNIVERSARY",
  "EVENT",
  "OTHER",
] as const;

export type ImportantDateType = (typeof IMPORTANT_DATE_TYPE_VALUES)[number];

export type ImportantDateRecord = {
  id: string;
  title: string;
  description?: string | null;
  date: Date;
  type: ImportantDateType;
  isRecurringYearly: boolean;
};

export type ImportantDateOccurrence = {
  id: string;
  importantDateId: string;
  title: string;
  description?: string | null;
  type: ImportantDateType;
  occurrenceDate: Date;
  isRecurringYearly: boolean;
};

export const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function parseIsoDateAtNoon(value: string) {
  if (!ISO_DATE_REGEX.test(value)) {
    throw new Error("Format de date attendu: YYYY-MM-DD");
  }

  const parsed = new Date(`${value}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Date invalide");
  }

  return parsed;
}

function dateAtNoon(year: number, month: number, day: number) {
  return new Date(year, month, day, 12, 0, 0, 0);
}

function resolveRecurringDateForYear(sourceDate: Date, year: number) {
  const month = sourceDate.getMonth();
  const day = sourceDate.getDate();
  const candidate = dateAtNoon(year, month, day);

  if (candidate.getMonth() === month) {
    return candidate;
  }

  // Handles impossible dates (e.g. 29/02 on non-leap year) by clamping
  // to the last valid day of the month.
  return dateAtNoon(year, month + 1, 0);
}

export function getNextImportantDateOccurrence(
  sourceDate: Date,
  isRecurringYearly: boolean,
  referenceDate = new Date()
) {
  if (!isRecurringYearly) {
    return sourceDate;
  }

  const ref = new Date(referenceDate);
  ref.setHours(0, 0, 0, 0);

  const currentYearDate = resolveRecurringDateForYear(sourceDate, ref.getFullYear());
  if (currentYearDate.getTime() >= ref.getTime()) {
    return currentYearDate;
  }

  return resolveRecurringDateForYear(sourceDate, ref.getFullYear() + 1);
}

export function buildImportantDateOccurrences(
  importantDates: ImportantDateRecord[],
  range: { from: Date; to: Date }
) {
  const from = new Date(range.from);
  const to = new Date(range.to);

  const startTime = from.getTime();
  const endTime = to.getTime();
  const fromYear = from.getFullYear();
  const toYear = to.getFullYear();

  const occurrences: ImportantDateOccurrence[] = [];

  for (const item of importantDates) {
    if (!item.isRecurringYearly) {
      const time = item.date.getTime();
      if (time >= startTime && time <= endTime) {
        occurrences.push({
          id: `${item.id}-${item.date.toISOString()}`,
          importantDateId: item.id,
          title: item.title,
          description: item.description ?? null,
          type: item.type,
          occurrenceDate: item.date,
          isRecurringYearly: false,
        });
      }
      continue;
    }

    for (let year = fromYear - 1; year <= toYear + 1; year += 1) {
      const occurrenceDate = resolveRecurringDateForYear(item.date, year);
      const time = occurrenceDate.getTime();
      if (time < startTime || time > endTime) {
        continue;
      }

      occurrences.push({
        id: `${item.id}-${year}`,
        importantDateId: item.id,
        title: item.title,
        description: item.description ?? null,
        type: item.type,
        occurrenceDate,
        isRecurringYearly: true,
      });
    }
  }

  occurrences.sort((a, b) => {
    const delta = a.occurrenceDate.getTime() - b.occurrenceDate.getTime();
    if (delta !== 0) return delta;
    return a.title.localeCompare(b.title, "fr");
  });

  return occurrences;
}
