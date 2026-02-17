"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Plus, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import {
  createProject,
  deleteProject,
  regenerateProjectImage,
  updateProject,
  uploadProjectImage,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IllustrationPlaceholder } from "@/components/ui/illustration-placeholder";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  isImageGenerating: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
};

type ProjectManagerProps = {
  houseId: string;
  projects: ProjectItem[];
};

type ProjectDraft = {
  name: string;
  description: string;
  startsAt: string;
  endsAt: string;
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

function ProjectRow({
  project,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onChangeDraft,
}: {
  project: ProjectItem;
  isEditing: boolean;
  draft: ProjectDraft | null;
  onStartEdit: (project: ProjectItem) => void;
  onCancelEdit: () => void;
  onChangeDraft: (patch: Partial<ProjectDraft>) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  useCloseDetailsOnOutside(menuRef);
  const hasImage = Boolean(project.imageUrl);

  if (isEditing && draft) {
    return (
      <div className="rounded-lg border p-3">
        <form action={updateProject} className="space-y-3" onSubmit={onCancelEdit}>
          <input type="hidden" name="projectId" value={project.id} />
          <Input
            name="name"
            value={draft.name}
            onChange={(event) => onChangeDraft({ name: event.target.value })}
            required
          />
          <Textarea
            name="description"
            value={draft.description}
            onChange={(event) => onChangeDraft({ description: event.target.value })}
            rows={3}
            placeholder="Notes, objectifs, budget, etc."
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="date"
              name="startsAt"
              value={draft.startsAt}
              onChange={(event) => onChangeDraft({ startsAt: event.target.value })}
            />
            <Input
              type="date"
              name="endsAt"
              value={draft.endsAt}
              onChange={(event) => onChangeDraft({ endsAt: event.target.value })}
            />
          </div>
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
      <div className="flex min-w-0 items-start gap-3">
        {project.isImageGenerating ? (
          <IllustrationPlaceholder
            className="h-24 w-24 shrink-0 rounded-lg"
            showLabel={false}
          />
        ) : project.imageUrl ? (
          <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border bg-muted/30">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={project.imageUrl}
              alt={`Illustration ${project.name}`}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <Link
                href={`/app/projects/${project.id}`}
                className="block truncate font-medium underline-offset-4 hover:underline"
              >
                {project.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {formatDate(project.startsAt)} · {formatDate(project.endsAt)}
              </p>
              {project.description ? (
                <p className="line-clamp-3 text-sm text-muted-foreground">{project.description}</p>
              ) : null}
            </div>

            <details ref={menuRef} className="action-menu group relative shrink-0">
              <summary
                className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
                title="Actions"
                aria-label={`Actions pour ${project.name}`}
              >
                <MoreHorizontal className="h-4 w-4" />
              </summary>

              <div className="action-menu-popover absolute right-0 z-[999] mt-2 w-48 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
                <button
                  type="button"
                  className={menuItemClassName}
                  onClick={() => {
                    onStartEdit(project);
                    menuRef.current?.removeAttribute("open");
                  }}
                >
                  <Pencil className="h-4 w-4" />
                  Modifier
                </button>

                <form action={regenerateProjectImage}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <button
                    type="submit"
                    className={menuItemClassName}
                    disabled={project.isImageGenerating}
                  >
                    <RefreshCcw className="h-4 w-4" />
                    {project.isImageGenerating
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

                <form action={deleteProject}>
                  <input type="hidden" name="projectId" value={project.id} />
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
      </div>

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-sidebar-primary bg-sidebar-primary p-4 text-sidebar-primary-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Illustration du projet</h3>
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

            <form action={uploadProjectImage} className="mt-4 space-y-3">
              <input type="hidden" name="projectId" value={project.id} />
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

export function ProjectsManager({ houseId, projects }: ProjectManagerProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProjectDraft | null>(null);

  function startEdit(project: ProjectItem) {
    setEditingId(project.id);
    setDraft({
      name: project.name,
      description: project.description ?? "",
      startsAt: dateInputValue(project.startsAt),
      endsAt: dateInputValue(project.endsAt),
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Projets</CardTitle>
        <Button
          type="button"
          variant="add"
          size="icon"
          className="rounded-full"
          title={isAdding ? "Fermer l'ajout" : "Ajouter un projet"}
          aria-label={isAdding ? "Fermer l'ajout" : "Ajouter un projet"}
          onClick={() => setIsAdding((value) => !value)}
        >
          {isAdding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isAdding ? (
          <div className="rounded-lg border border-dashed p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-medium">Nouveau projet</p>
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

            <form action={createProject} className="space-y-3" onSubmit={() => setIsAdding(false)}>
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="name" placeholder="Rénovation cuisine" required />
              <Textarea
                name="description"
                placeholder="Notes, objectifs, budget, etc."
                rows={3}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Input type="date" name="startsAt" />
                <Input type="date" name="endsAt" />
              </div>
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

        {projects.length ? (
          <div className="space-y-2">
            {projects.map((project) => (
              <ProjectRow
                key={project.id}
                project={project}
                isEditing={editingId === project.id}
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
            Aucun projet pour le moment. Crée le premier pour organiser tes travaux.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
