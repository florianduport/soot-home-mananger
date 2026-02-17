"use client";

import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  createImportantDate,
  deleteImportantDate,
  updateImportantDate,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";
import { getNextImportantDateOccurrence, type ImportantDateType } from "@/lib/important-dates";

type ImportantDateItem = {
  id: string;
  title: string;
  type: ImportantDateType;
  date: Date;
  isRecurringYearly: boolean;
  description: string | null;
};

type SettingsImportantDatesManagerProps = {
  houseId: string;
  items: ImportantDateItem[];
};

type ImportantDateDraft = {
  title: string;
  type: ImportantDateType;
  date: string;
  isRecurringYearly: "true" | "false";
  description: string;
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10";
const selectClassName =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm";
const typeLabels: Record<ImportantDateType, string> = {
  BIRTHDAY: "Anniversaire",
  ANNIVERSARY: "Commémoration",
  EVENT: "Événement",
  OTHER: "Autre",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(value);
}

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
}

function ImportantDateRow({
  item,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
}: {
  item: ImportantDateItem;
  isEditing: boolean;
  draft: ImportantDateDraft | null;
  onStartEdit: (item: ImportantDateItem) => void;
  onCancelEdit: () => void;
  onChangeDraft: (patch: Partial<ImportantDateDraft>) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  useCloseDetailsOnOutside(menuRef);

  if (isEditing && draft) {
    return (
      <div className="rounded-lg border p-3">
        <form action={updateImportantDate} className="space-y-3" onSubmit={onCancelEdit}>
          <input type="hidden" name="importantDateId" value={item.id} />
          <Input
            name="title"
            value={draft.title}
            onChange={(event) => onChangeDraft({ title: event.target.value })}
            required
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <select
              name="type"
              value={draft.type}
              className={selectClassName}
              onChange={(event) => onChangeDraft({ type: event.target.value as ImportantDateType })}
            >
              <option value="BIRTHDAY">Anniversaire</option>
              <option value="ANNIVERSARY">Commémoration</option>
              <option value="EVENT">Événement</option>
              <option value="OTHER">Autre</option>
            </select>
            <Input
              type="date"
              name="date"
              value={draft.date}
              onChange={(event) => onChangeDraft({ date: event.target.value })}
              required
            />
            <select
              name="isRecurringYearly"
              value={draft.isRecurringYearly}
              className={selectClassName}
              onChange={(event) =>
                onChangeDraft({
                  isRecurringYearly: event.target.value as "true" | "false",
                })
              }
            >
              <option value="true">Annuel</option>
              <option value="false">Unique</option>
            </select>
          </div>
          <Input
            name="description"
            value={draft.description}
            onChange={(event) => onChangeDraft({ description: event.target.value })}
            placeholder="Description (optionnel)"
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
              Annuler
            </Button>
            <Button type="submit" variant="outline" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    );
  }

  const nextOccurrence = getNextImportantDateOccurrence(item.date, item.isRecurringYearly);

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium">{item.title}</p>
          {item.description ? (
            <p className="line-clamp-2 text-sm text-muted-foreground">{item.description}</p>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Type: {typeLabels[item.type]} · Prochaine occurrence: {formatDate(nextOccurrence)}
          </p>
          <p className="text-xs text-muted-foreground">
            {item.isRecurringYearly ? "Répété chaque année" : "Date unique"}
          </p>
        </div>

        <details ref={menuRef} className="action-menu group relative shrink-0">
          <summary
            className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
            title="Actions"
            aria-label={`Actions pour ${item.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </summary>

          <div className="action-menu-popover absolute right-0 z-[999] mt-2 w-48 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
            <button
              type="button"
              className={menuItemClassName}
              onClick={() => {
                onStartEdit(item);
                menuRef.current?.removeAttribute("open");
              }}
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>

            <form action={deleteImportantDate}>
              <input type="hidden" name="importantDateId" value={item.id} />
              <button
                type="submit"
                className={`${menuItemClassName} text-rose-700 hover:bg-rose-50`}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}

export function SettingsImportantDatesManager({
  houseId,
  items,
}: SettingsImportantDatesManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ImportantDateDraft | null>(null);

  const sortedItems = [...items].sort((a, b) => {
    const aNext = getNextImportantDateOccurrence(a.date, a.isRecurringYearly);
    const bNext = getNextImportantDateOccurrence(b.date, b.isRecurringYearly);
    const delta = aNext.getTime() - bNext.getTime();
    if (delta !== 0) return delta;
    return a.title.localeCompare(b.title, "fr");
  });

  function startEdit(item: ImportantDateItem) {
    setEditingId(item.id);
    setDraft({
      title: item.title,
      type: item.type,
      date: dateInputValue(item.date),
      isRecurringYearly: item.isRecurringYearly ? "true" : "false",
      description: item.description ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Dates importantes</CardTitle>
        <Button
          type="button"
          variant="add"
          size="icon"
          className="rounded-full"
          title={isAdding ? "Fermer l'ajout" : "Ajouter une date importante"}
          aria-label={isAdding ? "Fermer l'ajout" : "Ajouter une date importante"}
          onClick={() => setIsAdding((value) => !value)}
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isAdding ? (
          <div className="rounded-lg border border-dashed p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Nouvelle date importante</p>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                title="Fermer"
                aria-label="Fermer"
                onClick={() => setIsAdding(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form
              action={createImportantDate}
              className="space-y-3"
              onSubmit={() => setIsAdding(false)}
            >
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="title" placeholder="Anniversaire de Léa" required />
              <div className="grid gap-3 sm:grid-cols-3">
                <select
                  name="type"
                  defaultValue="BIRTHDAY"
                  className={selectClassName}
                >
                  <option value="BIRTHDAY">Anniversaire</option>
                  <option value="ANNIVERSARY">Commémoration</option>
                  <option value="EVENT">Événement</option>
                  <option value="OTHER">Autre</option>
                </select>
                <Input name="date" type="date" required />
                <select
                  name="isRecurringYearly"
                  defaultValue="true"
                  className={selectClassName}
                >
                  <option value="true">Répéter chaque année</option>
                  <option value="false">Date unique</option>
                </select>
              </div>
              <Input name="description" placeholder="Description (optionnel)" />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsAdding(false)}>
                  Annuler
                </Button>
                <Button type="submit" variant="outline" size="sm">
                  Ajouter
                </Button>
              </div>
            </form>
          </div>
        ) : null}

        {sortedItems.length ? (
          <div className="space-y-2">
            {sortedItems.map((item) => (
              <ImportantDateRow
                key={item.id}
                item={item}
                isEditing={editingId === item.id}
                draft={draft}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onChangeDraft={(patch) =>
                  setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                }
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Aucune date importante enregistrée pour le moment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
