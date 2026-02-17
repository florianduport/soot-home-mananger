"use client";

import { addMonths, differenceInMonths } from "date-fns";
import { MoreHorizontal, Pencil, Plus, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import {
  createEquipment,
  deleteEquipment,
  regenerateEquipmentImage,
  updateEquipment,
  uploadEquipmentImage,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { IllustrationPlaceholder } from "@/components/ui/illustration-placeholder";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

type EquipmentItem = {
  id: string;
  name: string;
  location: string | null;
  category: string | null;
  purchasedAt: Date | null;
  installedAt: Date | null;
  lifespanMonths: number | null;
  imageUrl: string | null;
  isImageGenerating: boolean;
};

type EquipmentManagerProps = {
  houseId: string;
  equipments: EquipmentItem[];
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function computeLifespanSummary(
  installedAt: Date | null,
  purchasedAt: Date | null,
  lifespanMonths: number | null
) {
  if (!lifespanMonths) return "Durée de vie non renseignée";
  const base = installedAt ?? purchasedAt;
  if (!base) return "Date de référence manquante";
  const end = addMonths(base, lifespanMonths);
  const remaining = differenceInMonths(end, new Date());
  if (remaining < 0) {
    return `Fin de vie atteinte (depuis ${Math.abs(remaining)} mois)`;
  }
  if (remaining === 0) {
    return "Fin de vie ce mois-ci";
  }
  return `${remaining} mois restants`;
}

type EquipmentDraft = {
  id: string;
  name: string;
  location: string;
  category: string;
  purchasedAt: string;
  installedAt: string;
  lifespanMonths: string;
};

function EquipmentRow({
  equipment,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onChange,
}: {
  equipment: EquipmentItem;
  isEditing: boolean;
  draft: EquipmentDraft | null;
  onStartEdit: (equipment: EquipmentItem) => void;
  onCancelEdit: () => void;
  onChange: (patch: Partial<EquipmentDraft>) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  useCloseDetailsOnOutside(menuRef);
  const hasImage = Boolean(equipment.imageUrl);

  if (isEditing && draft) {
    return (
      <div className="rounded-lg border p-3">
        <form action={updateEquipment} className="space-y-3" onSubmit={onCancelEdit}>
          <input type="hidden" name="equipmentId" value={equipment.id} />
          <Input
            name="name"
            value={draft.name}
            onChange={(event) => onChange({ name: event.target.value })}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="location"
              value={draft.location}
              onChange={(event) => onChange({ location: event.target.value })}
              placeholder="Emplacement"
            />
            <Input
              name="category"
              value={draft.category}
              onChange={(event) => onChange({ category: event.target.value })}
              placeholder="Catégorie"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              name="purchasedAt"
              value={draft.purchasedAt}
              onChange={(event) => onChange({ purchasedAt: event.target.value })}
            />
            <Input
              type="date"
              name="installedAt"
              value={draft.installedAt}
              onChange={(event) => onChange({ installedAt: event.target.value })}
            />
          </div>
          <Input
            type="number"
            name="lifespanMonths"
            min={1}
            value={draft.lifespanMonths}
            onChange={(event) => onChange({ lifespanMonths: event.target.value })}
            placeholder="Durée de vie (mois)"
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

  return (
    <div className="rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-start gap-3">
          {equipment.isImageGenerating ? (
            <IllustrationPlaceholder
              className="h-20 w-28 shrink-0 rounded-lg sm:h-24 sm:w-36"
              showLabel={false}
            />
          ) : equipment.imageUrl ? (
            <div className="shrink-0 overflow-hidden rounded-lg border bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={equipment.imageUrl}
                alt={`Illustration ${equipment.name}`}
                className="h-20 w-28 object-cover sm:h-24 sm:w-36"
              />
            </div>
          ) : null}

          <div className="min-w-0 space-y-1">
            <p className="truncate font-medium">{equipment.name}</p>
            <p className="text-sm text-muted-foreground">
              {equipment.location || "Emplacement non renseigné"} ·{" "}
              {equipment.category || "Catégorie non renseignée"}
            </p>
            <p className="text-xs text-muted-foreground">
              Achat: {formatDate(equipment.purchasedAt)} · Installation:{" "}
              {formatDate(equipment.installedAt)}
            </p>
            <p className="text-xs text-muted-foreground">
              {computeLifespanSummary(
                equipment.installedAt,
                equipment.purchasedAt,
                equipment.lifespanMonths
              )}
            </p>
          </div>
        </div>

        <details ref={menuRef} className="action-menu group relative shrink-0">
          <summary
            className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
            title="Actions"
            aria-label={`Actions pour ${equipment.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </summary>
          <div className="action-menu-popover absolute right-0 z-[999] mt-2 w-48 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
            <button
              type="button"
              className={menuItemClassName}
              onClick={() => {
                onStartEdit(equipment);
                menuRef.current?.removeAttribute("open");
              }}
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>

            <form action={regenerateEquipmentImage}>
              <input type="hidden" name="equipmentId" value={equipment.id} />
              <button
                type="submit"
                className={menuItemClassName}
              >
                <RefreshCcw className="h-4 w-4" />
                {equipment.isImageGenerating
                  ? "Génération..."
                  : hasImage
                    ? "Régénérer l’illustration"
                    : "Générer l’illustration"}
              </button>
            </form>

            <button
              type="button"
              className={menuItemClassName}
              onClick={() => {
                setUploadOpen(true);
                menuRef.current?.removeAttribute("open");
              }}
            >
              <Upload className="h-4 w-4" />
              {hasImage ? "Changer l’image" : "Téléverser une image"}
            </button>

            <form action={deleteEquipment}>
              <input type="hidden" name="equipmentId" value={equipment.id} />
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

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-sidebar-primary bg-sidebar-primary p-4 text-sidebar-primary-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Illustration de l&apos;équipement</h3>
              <button
                type="button"
                onClick={() => setUploadOpen(false)}
                className={triggerClassName}
                title="Fermer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={uploadEquipmentImage} className="mt-4 space-y-3">
              <input type="hidden" name="equipmentId" value={equipment.id} />
              <Input
                name="imageFile"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                required
              />
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WEBP ou GIF. Taille max: 8 Mo.
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setUploadOpen(false)}>
                  Annuler
                </Button>
                <Button type="submit" variant="add">
                  Enregistrer
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EquipmentManager({ houseId, equipments }: EquipmentManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<EquipmentDraft | null>(null);

  function startEdit(equipment: EquipmentItem) {
    setEditingId(equipment.id);
    setDraft({
      id: equipment.id,
      name: equipment.name,
      location: equipment.location ?? "",
      category: equipment.category ?? "",
      purchasedAt: dateInputValue(equipment.purchasedAt),
      installedAt: dateInputValue(equipment.installedAt),
      lifespanMonths: equipment.lifespanMonths?.toString() ?? "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Parc d&apos;équipements</CardTitle>
        <Button
          type="button"
          variant="add"
          size="icon"
          className="rounded-full"
          title={isAdding ? "Fermer l'ajout" : "Ajouter un équipement"}
          aria-label={isAdding ? "Fermer l'ajout" : "Ajouter un équipement"}
          onClick={() => setIsAdding((value) => !value)}
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isAdding ? (
          <div className="rounded-lg border border-dashed p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Nouvel équipement</p>
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
              action={createEquipment}
              className="space-y-3"
              onSubmit={() => setIsAdding(false)}
            >
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="name" placeholder="Chaudière" required />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input name="location" placeholder="Local technique" />
                <Input name="category" placeholder="Chauffage" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="date" name="purchasedAt" />
                <Input type="date" name="installedAt" />
              </div>
              <Input
                type="number"
                name="lifespanMonths"
                min={1}
                placeholder="Durée de vie (mois)"
              />
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

        {equipments.length ? (
          <div className="space-y-2">
            {equipments.map((equipment) => (
              <EquipmentRow
                key={equipment.id}
                equipment={equipment}
                isEditing={editingId === equipment.id}
                draft={draft}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onChange={(patch) =>
                  setDraft((prev) => (prev ? { ...prev, ...patch } : prev))
                }
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Aucun équipement enregistré pour le moment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
