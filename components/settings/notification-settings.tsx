"use client";

import { useState, useTransition } from "react";
import { updateNotificationPreferences } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n/i18n-provider";
import { type AppLanguage } from "@/lib/i18n/language";

export type NotificationPreferencesData = {
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  escalationEnabled: boolean;
  escalationDelayHours: number;
  escalationTarget: "OWNER" | "CREATOR" | "OWNER_AND_CREATOR";
};

type NotificationSettingsProps = {
  houseId: string;
  preferences: NotificationPreferencesData;
};

const COPY: Record<
  AppLanguage,
  {
    title: string;
    description: string;
    quietHoursTitle: string;
    quietHoursHint: string;
    escalationTitle: string;
    escalationHint: string;
    escalationDelayLabel: string;
    escalationTargetLabel: string;
    escalationTargets: Record<NotificationPreferencesData["escalationTarget"], string>;
    save: string;
  }
> = {
  en: {
    title: "Notifications",
    description: "Quiet hours and escalation rules for task alerts.",
    quietHoursTitle: "Quiet hours",
    quietHoursHint: "Pause alerts between",
    escalationTitle: "Escalation",
    escalationHint: "Escalate unacknowledged assignments after",
    escalationDelayLabel: "Delay (hours)",
    escalationTargetLabel: "Recipients",
    escalationTargets: {
      OWNER: "Home owner",
      CREATOR: "Task creator",
      OWNER_AND_CREATOR: "Owner + creator",
    },
    save: "Save preferences",
  },
  fr: {
    title: "Notifications",
    description: "Heures silencieuses et regles d'escalade pour les taches.",
    quietHoursTitle: "Heures silencieuses",
    quietHoursHint: "Limiter les alertes entre",
    escalationTitle: "Escalade",
    escalationHint: "Escalader les assignments sans reponse apres",
    escalationDelayLabel: "Delai (heures)",
    escalationTargetLabel: "Destinataires",
    escalationTargets: {
      OWNER: "Proprietaire de la maison",
      CREATOR: "Createur de la tache",
      OWNER_AND_CREATOR: "Proprietaire + createur",
    },
    save: "Enregistrer les preferences",
  },
  es: {
    title: "Notificaciones",
    description: "Horas silenciosas y reglas de escalada para las tareas.",
    quietHoursTitle: "Horas silenciosas",
    quietHoursHint: "Limitar alertas entre",
    escalationTitle: "Escalada",
    escalationHint: "Escalar asignaciones sin respuesta despues de",
    escalationDelayLabel: "Demora (horas)",
    escalationTargetLabel: "Destinatarios",
    escalationTargets: {
      OWNER: "Propietario del hogar",
      CREATOR: "Creador de la tarea",
      OWNER_AND_CREATOR: "Propietario + creador",
    },
    save: "Guardar preferencias",
  },
};

export function NotificationSettings({ houseId, preferences }: NotificationSettingsProps) {
  const { language } = useI18n();
  const copy = COPY[language];
  const [quietHoursEnabled, setQuietHoursEnabled] = useState(
    preferences.quietHoursEnabled
  );
  const [escalationEnabled, setEscalationEnabled] = useState(
    preferences.escalationEnabled
  );
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{copy.description}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        <form
          action={(formData) => startTransition(() => updateNotificationPreferences(formData))}
          className="space-y-6"
        >
          <input type="hidden" name="houseId" value={houseId} />

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{copy.quietHoursTitle}</p>
                <p className="text-xs text-muted-foreground">{copy.quietHoursHint}</p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="quietHoursEnabled"
                  className="h-4 w-4"
                  defaultChecked={preferences.quietHoursEnabled}
                  onChange={(event) => setQuietHoursEnabled(event.target.checked)}
                />
                {copy.quietHoursTitle}
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                type="time"
                name="quietHoursStart"
                defaultValue={preferences.quietHoursStart}
                disabled={!quietHoursEnabled}
              />
              <Input
                type="time"
                name="quietHoursEnd"
                defaultValue={preferences.quietHoursEnd}
                disabled={!quietHoursEnabled}
              />
            </div>
          </div>

          <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">{copy.escalationTitle}</p>
                <p className="text-xs text-muted-foreground">{copy.escalationHint}</p>
              </div>
              <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="escalationEnabled"
                  className="h-4 w-4"
                  defaultChecked={preferences.escalationEnabled}
                  onChange={(event) => setEscalationEnabled(event.target.checked)}
                />
                {copy.escalationTitle}
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-xs text-muted-foreground" htmlFor="escalationDelayHours">
                  {copy.escalationDelayLabel}
                </label>
                <Input
                  id="escalationDelayHours"
                  type="number"
                  name="escalationDelayHours"
                  min={1}
                  max={168}
                  defaultValue={preferences.escalationDelayHours}
                  disabled={!escalationEnabled}
                />
              </div>
              <div className="grid gap-2">
                <label className="text-xs text-muted-foreground" htmlFor="escalationTarget">
                  {copy.escalationTargetLabel}
                </label>
                <select
                  id="escalationTarget"
                  name="escalationTarget"
                  defaultValue={preferences.escalationTarget}
                  disabled={!escalationEnabled}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  {Object.entries(copy.escalationTargets).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isPending}>
            {copy.save}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
