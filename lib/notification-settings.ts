export const DEFAULT_NOTIFICATION_SETTINGS = {
  quietHoursEnabled: false,
  quietHoursStartMinutes: 22 * 60,
  quietHoursEndMinutes: 7 * 60,
  scheduleEnabled: false,
  scheduleDays: ["MON", "TUE", "WED", "THU", "FRI"] as const,
  scheduleStartMinutes: 8 * 60,
  scheduleEndMinutes: 18 * 60,
  escalationEnabled: true,
  escalationDelayHours: 24,
};

export type WeekdayValue = "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";

export type NotificationSettingsData = {
  quietHoursEnabled: boolean;
  quietHoursStartMinutes: number;
  quietHoursEndMinutes: number;
  scheduleEnabled: boolean;
  scheduleDays: WeekdayValue[];
  scheduleStartMinutes: number;
  scheduleEndMinutes: number;
  escalationEnabled: boolean;
  escalationDelayHours: number;
};

export const WEEKDAY_OPTIONS: Array<{ value: WeekdayValue; label: string }> = [
  { value: "MON", label: "Lundi" },
  { value: "TUE", label: "Mardi" },
  { value: "WED", label: "Mercredi" },
  { value: "THU", label: "Jeudi" },
  { value: "FRI", label: "Vendredi" },
  { value: "SAT", label: "Samedi" },
  { value: "SUN", label: "Dimanche" },
];

export function formatMinutesToTime(minutes: number) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.min(1439, minutes)) : 0;
  const hours = Math.floor(safeMinutes / 60)
    .toString()
    .padStart(2, "0");
  const mins = (safeMinutes % 60).toString().padStart(2, "0");
  return `${hours}:${mins}`;
}

export function parseTimeToMinutes(rawValue?: string | null) {
  if (!rawValue) return null;
  if (!/^\d{2}:\d{2}$/.test(rawValue)) return null;
  const [hours, minutes] = rawValue.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}
