"use client";

import { useI18n } from "@/components/i18n/i18n-provider";
import { type AppLanguage } from "@/lib/i18n/language";

export type TaskNotificationFieldValues = {
  ignoreQuietHours?: boolean;
  escalationOverride?: EscalationOverride;
  escalationDelayHours?: number | null;
};

type EscalationOverride = "DEFAULT" | "ENABLED" | "DISABLED";

type TaskNotificationFieldsProps = {
  values?: TaskNotificationFieldValues;
};

const COPY: Record<
  AppLanguage,
  {
    title: string;
    ignoreQuietHours: string;
    escalationLabel: string;
    escalationOptions: Record<EscalationOverride, string>;
    escalationDelay: string;
    escalationHint: string;
  }
> = {
  en: {
    title: "Notification options",
    ignoreQuietHours: "Ignore quiet hours for this task",
    escalationLabel: "Escalation",
    escalationOptions: {
      DEFAULT: "Use member preferences",
      ENABLED: "Force escalation",
      DISABLED: "Disable escalation",
    },
    escalationDelay: "Escalation delay (hours)",
    escalationHint: "Leave empty to use the default delay.",
  },
  fr: {
    title: "Options de notification",
    ignoreQuietHours: "Ignorer les heures silencieuses pour cette tache",
    escalationLabel: "Escalade",
    escalationOptions: {
      DEFAULT: "Utiliser les preferences du membre",
      ENABLED: "Forcer l'escalade",
      DISABLED: "Desactiver l'escalade",
    },
    escalationDelay: "Delai d'escalade (heures)",
    escalationHint: "Laisser vide pour garder le delai par defaut.",
  },
  es: {
    title: "Opciones de notificacion",
    ignoreQuietHours: "Ignorar horas silenciosas para esta tarea",
    escalationLabel: "Escalada",
    escalationOptions: {
      DEFAULT: "Usar preferencias del miembro",
      ENABLED: "Forzar escalada",
      DISABLED: "Desactivar escalada",
    },
    escalationDelay: "Demora de escalada (horas)",
    escalationHint: "Deja en blanco para usar la demora predeterminada.",
  },
};

export function TaskNotificationFields({ values }: TaskNotificationFieldsProps) {
  const { language } = useI18n();
  const copy = COPY[language];
  const escalationOverride = values?.escalationOverride ?? "DEFAULT";

  return (
    <div className="space-y-3 rounded-lg border bg-muted/20 p-4">
      <p className="text-sm font-medium">{copy.title}</p>
      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          name="ignoreQuietHours"
          className="h-4 w-4"
          defaultChecked={values?.ignoreQuietHours ?? false}
        />
        {copy.ignoreQuietHours}
      </label>
      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="escalationOverride">
          {copy.escalationLabel}
        </label>
        <select
          id="escalationOverride"
          name="escalationOverride"
          defaultValue={escalationOverride}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        >
          {Object.entries(copy.escalationOptions).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-2">
        <label className="text-xs text-muted-foreground" htmlFor="escalationDelayHours">
          {copy.escalationDelay}
        </label>
        <input
          id="escalationDelayHours"
          name="escalationDelayHours"
          type="number"
          min={1}
          max={168}
          defaultValue={values?.escalationDelayHours ?? ""}
          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
        />
        <p className="text-xs text-muted-foreground">{copy.escalationHint}</p>
      </div>
    </div>
  );
}
