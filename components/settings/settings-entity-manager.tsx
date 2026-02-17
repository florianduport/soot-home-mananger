"use client";

import { useRef, useState } from "react";
import {
  ImageMinus,
  ImagePlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import {
  applyAnimalAvatarGhibliStyle,
  applyPersonAvatarGhibliStyle,
  createAnimal,
  createCategory,
  createPerson,
  createZone,
  deleteAnimal,
  deleteCategory,
  deletePerson,
  deleteZone,
  removeAnimalAvatar,
  removePersonAvatar,
  restoreAnimalAvatar,
  restorePersonAvatar,
  uploadAnimalAvatar,
  uploadPersonAvatar,
  updateAnimal,
  updateCategory,
  updatePerson,
  updateZone,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

type EntityType = "zone" | "category" | "animal" | "person";

type SettingsEntity = {
  id: string;
  name: string;
  secondary?: string | null;
  imageUrl?: string | null;
};

type SettingsEntityManagerProps = {
  type: EntityType;
  title: string;
  houseId: string;
  items: SettingsEntity[];
  primaryPlaceholder: string;
  secondaryPlaceholder?: string;
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10";

const CONFIG = {
  zone: {
    idField: "zoneId",
    secondaryField: null,
    createAction: createZone,
    updateAction: updateZone,
    deleteAction: deleteZone,
  },
  category: {
    idField: "categoryId",
    secondaryField: null,
    createAction: createCategory,
    updateAction: updateCategory,
    deleteAction: deleteCategory,
  },
  animal: {
    idField: "animalId",
    secondaryField: "species",
    createAction: createAnimal,
    updateAction: updateAnimal,
    deleteAction: deleteAnimal,
    uploadAvatarAction: uploadAnimalAvatar,
    applyGhibliAction: applyAnimalAvatarGhibliStyle,
    restoreAvatarAction: restoreAnimalAvatar,
    removeAvatarAction: removeAnimalAvatar,
    avatarPrefix: "/animal-avatars/",
  },
  person: {
    idField: "personId",
    secondaryField: "relation",
    createAction: createPerson,
    updateAction: updatePerson,
    deleteAction: deletePerson,
    uploadAvatarAction: uploadPersonAvatar,
    applyGhibliAction: applyPersonAvatarGhibliStyle,
    restoreAvatarAction: restorePersonAvatar,
    removeAvatarAction: removePersonAvatar,
    avatarPrefix: "/person-avatars/",
  },
} as const;

function EntityRow({
  config,
  item,
  isEditing,
  editingName,
  editingSecondary,
  secondaryPlaceholder,
  onStartEdit,
  onCancelEdit,
  onChangeEditingName,
  onChangeEditingSecondary,
}: {
  config: (typeof CONFIG)[EntityType];
  item: SettingsEntity;
  isEditing: boolean;
  editingName: string;
  editingSecondary: string;
  secondaryPlaceholder?: string;
  onStartEdit: (item: SettingsEntity) => void;
  onCancelEdit: () => void;
  onChangeEditingName: (value: string) => void;
  onChangeEditingSecondary: (value: string) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  useCloseDetailsOnOutside(menuRef);
  const avatarPrefix = "avatarPrefix" in config ? config.avatarPrefix : null;
  const hasAvatarActions = Boolean(
    "uploadAvatarAction" in config &&
      "removeAvatarAction" in config &&
      "applyGhibliAction" in config &&
      "restoreAvatarAction" in config &&
      avatarPrefix
  );
  const currentImageUrl = item.imageUrl ?? null;
  const hasAvatar = Boolean(currentImageUrl);
  const isGhibliAvatar = Boolean(currentImageUrl?.includes("-ghibli.png"));
  const canApplyGhibli = Boolean(
    currentImageUrl &&
      avatarPrefix &&
      !isGhibliAvatar &&
      currentImageUrl.startsWith(avatarPrefix)
  );
  const avatarFallback = item.name.trim().slice(0, 1).toUpperCase() || "?";

  if (isEditing) {
    return (
      <div className="rounded-lg border p-3">
        <form
          action={config.updateAction}
          className="space-y-3"
          onSubmit={() => onCancelEdit()}
        >
          <input type="hidden" name={config.idField} value={item.id} />
          <Input
            name="name"
            value={editingName}
            onChange={(event) => onChangeEditingName(event.target.value)}
            required
          />
          {config.secondaryField ? (
            <Input
              name={config.secondaryField}
              value={editingSecondary}
              onChange={(event) => onChangeEditingSecondary(event.target.value)}
              placeholder={secondaryPlaceholder}
            />
          ) : null}
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
        <div className="flex min-w-0 items-start gap-3">
          {hasAvatarActions ? (
            hasAvatar ? (
              <div
                role="img"
                aria-label={`Avatar de ${item.name}`}
                className="mt-0.5 h-10 w-10 shrink-0 rounded-full border bg-cover bg-center"
                style={{ backgroundImage: `url(${currentImageUrl})` }}
              />
            ) : (
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-xs font-semibold text-sidebar-primary-foreground">
                {avatarFallback}
              </div>
            )
          ) : null}

          <div className="min-w-0">
            <p className="truncate font-medium">{item.name}</p>
            {config.secondaryField ? (
              <p className="truncate text-sm text-muted-foreground">{item.secondary || "—"}</p>
            ) : null}
          </div>
        </div>

        <details ref={menuRef} className="action-menu group relative shrink-0">
          <summary
            className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
            title="Actions"
            aria-label={`Actions pour ${item.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </summary>

          <div className="action-menu-popover absolute right-0 z-[999] mt-2 w-48 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
            {hasAvatarActions && "uploadAvatarAction" in config ? (
              <form action={config.uploadAvatarAction}>
                <input type="hidden" name={config.idField} value={item.id} />
                <input
                  ref={avatarInputRef}
                  type="file"
                  name="avatarFile"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={() => {
                    if (avatarInputRef.current?.files?.length) {
                      avatarInputRef.current.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  type="button"
                  className={menuItemClassName}
                  onClick={() => avatarInputRef.current?.click()}
                >
                  <ImagePlus className="h-4 w-4" />
                  Importer un avatar
                </button>
              </form>
            ) : null}

            {hasAvatarActions && hasAvatar && canApplyGhibli && "applyGhibliAction" in config ? (
              <form action={config.applyGhibliAction}>
                <input type="hidden" name={config.idField} value={item.id} />
                <button type="submit" className={menuItemClassName}>
                  <Sparkles className="h-4 w-4" />
                  Style Ghibli
                </button>
              </form>
            ) : null}

            {hasAvatarActions &&
            hasAvatar &&
            isGhibliAvatar &&
            "restoreAvatarAction" in config ? (
              <form action={config.restoreAvatarAction}>
                <input type="hidden" name={config.idField} value={item.id} />
                <button type="submit" className={menuItemClassName}>
                  <Undo2 className="h-4 w-4" />
                  Restaurer
                </button>
              </form>
            ) : null}

            {hasAvatarActions && hasAvatar && "removeAvatarAction" in config ? (
              <form action={config.removeAvatarAction}>
                <input type="hidden" name={config.idField} value={item.id} />
                <button type="submit" className={menuItemClassName}>
                  <ImageMinus className="h-4 w-4" />
                  Retirer l&apos;avatar
                </button>
              </form>
            ) : null}

            {hasAvatarActions ? <div className="my-1 border-t border-slate-200" /> : null}

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

            <form action={config.deleteAction}>
              <input type="hidden" name={config.idField} value={item.id} />
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

export function SettingsEntityManager({
  type,
  title,
  houseId,
  items,
  primaryPlaceholder,
  secondaryPlaceholder,
}: SettingsEntityManagerProps) {
  const config = CONFIG[type];

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSecondary, setEditingSecondary] = useState("");

  function startEdit(item: SettingsEntity) {
    setEditingId(item.id);
    setEditingName(item.name);
    setEditingSecondary(item.secondary ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditingName("");
    setEditingSecondary("");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <Button
          type="button"
          variant="add"
          size="icon"
          className="rounded-full"
          title={isAdding ? "Fermer l'ajout" : `Ajouter ${title.toLowerCase()}`}
          aria-label={isAdding ? "Fermer l'ajout" : `Ajouter ${title.toLowerCase()}`}
          onClick={() => setIsAdding((value) => !value)}
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isAdding ? (
          <div className="rounded-lg border border-dashed p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Nouvelle entrée</p>
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
              action={config.createAction}
              className="space-y-3"
              onSubmit={() => setIsAdding(false)}
            >
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="name" placeholder={primaryPlaceholder} required />
              {config.secondaryField ? (
                <Input name={config.secondaryField} placeholder={secondaryPlaceholder} />
              ) : null}
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

        {items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <EntityRow
                key={item.id}
                config={config}
                item={item}
                isEditing={editingId === item.id}
                editingName={editingName}
                editingSecondary={editingSecondary}
                secondaryPlaceholder={secondaryPlaceholder}
                onStartEdit={startEdit}
                onCancelEdit={cancelEdit}
                onChangeEditingName={setEditingName}
                onChangeEditingSecondary={setEditingSecondary}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Aucune entrée pour le moment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
