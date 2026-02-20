"use client";

import { updateNotificationPreferences } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type NotificationPreferences = {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  escalationEnabled: boolean;
  escalationDelayHours: number;
};

export function NotificationSettings({
  houseId,
  preferences,
}: {
  houseId: string;
  preferences: NotificationPreferences;
}) {
  return (
    <form
      action={updateNotificationPreferences}
      className="space-y-4 rounded-lg border bg-card p-4"
    >
      <input type="hidden" name="houseId" value={houseId} />
      <div className="space-y-1">
        <p className="text-sm font-medium">Notifications avancées</p>
        <p className="text-xs text-muted-foreground">
          Configure les heures de silence et l&apos;escalade des tâches non prises
          en charge.
        </p>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="quietHoursEnabled"
            defaultChecked={preferences.quietHoursEnabled}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-foreground"
          />
          Activer les heures silencieuses pour les emails de notification.
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="quietHoursStart">
              Début des heures silencieuses
            </label>
            <Input
              id="quietHoursStart"
              name="quietHoursStart"
              type="time"
              defaultValue={preferences.quietHoursStart}
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm text-muted-foreground" htmlFor="quietHoursEnd">
              Fin des heures silencieuses
            </label>
            <Input
              id="quietHoursEnd"
              name="quietHoursEnd"
              type="time"
              defaultValue={preferences.quietHoursEnd}
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            name="escalationEnabled"
            defaultChecked={preferences.escalationEnabled}
            className="mt-0.5 h-4 w-4 cursor-pointer accent-foreground"
          />
          Activer l&apos;escalade vers les propriétaires de la maison.
        </label>
        <div className="grid gap-2">
          <label className="text-sm text-muted-foreground" htmlFor="escalationDelayHours">
            Délai avant escalade (heures)
          </label>
          <Input
            id="escalationDelayHours"
            name="escalationDelayHours"
            type="number"
            min={1}
            max={168}
            defaultValue={preferences.escalationDelayHours}
          />
        </div>
      </div>

      <Button type="submit" variant="outline" className="w-full sm:w-auto">
        Enregistrer les préférences
      </Button>
    </form>
  );
}
