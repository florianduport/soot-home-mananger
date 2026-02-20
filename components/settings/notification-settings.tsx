"use client";

import { useMemo, useTransition } from "react";
import { updateNotificationSettings } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  WEEKDAY_OPTIONS,
  formatMinutesToTime,
  type NotificationSettingsData,
} from "@/lib/notification-settings";

type NotificationSettingsProps = {
  settings: Partial<NotificationSettingsData> | null;
};

export function NotificationSettings({ settings }: NotificationSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const resolved = useMemo(() => {
    const scheduleDays =
      settings?.scheduleDays && settings.scheduleDays.length > 0
        ? settings.scheduleDays
        : [...DEFAULT_NOTIFICATION_SETTINGS.scheduleDays];

    return {
      ...DEFAULT_NOTIFICATION_SETTINGS,
      ...settings,
      scheduleDays,
    };
  }, [settings]);

  async function submitSettings(formData: FormData) {
    startTransition(async () => {
      await updateNotificationSettings(formData);
    });
  }

  return (
    <form action={submitSettings} className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Notifications avancées</p>
        <p className="text-xs text-muted-foreground">
          Définis quand les notifications sont envoyées par email et comment gérer les escalades.
        </p>
      </div>

      <fieldset className="space-y-3" disabled={isPending}>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="quietHoursEnabled"
              defaultChecked={resolved.quietHoursEnabled}
              className="h-4 w-4 accent-foreground"
            />
            Activer les heures calmes
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Début</label>
              <Input
                type="time"
                name="quietHoursStart"
                defaultValue={formatMinutesToTime(resolved.quietHoursStartMinutes)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Fin</label>
              <Input
                type="time"
                name="quietHoursEnd"
                defaultValue={formatMinutesToTime(resolved.quietHoursEndMinutes)}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Pendant cette plage, les emails sont suspendus (les notifications restent visibles dans l&apos;app).
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="scheduleEnabled"
              defaultChecked={resolved.scheduleEnabled}
              className="h-4 w-4 accent-foreground"
            />
            Activer un planning d&apos;envoi
          </label>
          <div className="flex flex-wrap gap-3 text-sm">
            {WEEKDAY_OPTIONS.map((day) => (
              <label key={day.value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="scheduleDays"
                  value={day.value}
                  defaultChecked={resolved.scheduleDays.includes(day.value)}
                  className="h-4 w-4 accent-foreground"
                />
                {day.label}
              </label>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Début</label>
              <Input
                type="time"
                name="scheduleStart"
                defaultValue={formatMinutesToTime(resolved.scheduleStartMinutes)}
              />
            </div>
            <div className="grid gap-1">
              <label className="text-xs text-muted-foreground">Fin</label>
              <Input
                type="time"
                name="scheduleEnd"
                defaultValue={formatMinutesToTime(resolved.scheduleEndMinutes)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="escalationEnabled"
              defaultChecked={resolved.escalationEnabled}
              className="h-4 w-4 accent-foreground"
            />
            Activer l&apos;escalade sur les tâches non confirmées
          </label>
          <div className="grid gap-1">
            <label className="text-xs text-muted-foreground">Délai avant escalade (heures)</label>
            <Input
              type="number"
              name="escalationDelayHours"
              min={1}
              max={168}
              defaultValue={resolved.escalationDelayHours}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            L&apos;escalade avertit le créateur et le propriétaire de la maison si la tâche reste non lue.
          </p>
        </div>
      </fieldset>

      <Button type="submit" variant="outline" className="w-full sm:w-auto" disabled={isPending}>
        {isPending ? "Enregistrement..." : "Enregistrer"}
      </Button>
    </form>
  );
}
