"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  MoreHorizontal,
  RefreshCcw,
  Trash2,
  UserRound,
  Pencil,
  Upload,
  X,
} from "lucide-react";
import {
  deleteTask,
  regenerateTaskImage,
  updateTaskAssignee,
  uploadTaskImage,
} from "@/app/actions";
import { AvatarSelect } from "@/components/ui/avatar-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

type TaskDetailActionsMenuProps = {
  taskId: string;
  isEditMode: boolean;
  assigneeId?: string | null;
  hasImage?: boolean;
  isImageGenerating?: boolean;
  members: Array<{
    userId: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  }>;
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10";

export function TaskDetailActionsMenu({
  taskId,
  isEditMode,
  assigneeId,
  hasImage,
  isImageGenerating = false,
  members,
}: TaskDetailActionsMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  useCloseDetailsOnOutside(detailsRef);

  function toggleEditMode() {
    const nextParams = new URLSearchParams(searchParams?.toString() ?? "");
    if (isEditMode) {
      nextParams.delete("edit");
    } else {
      nextParams.set("edit", "1");
    }

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
    detailsRef.current?.removeAttribute("open");
  }

  function openAssignModal() {
    setAssignOpen(true);
    detailsRef.current?.removeAttribute("open");
  }

  function closeAssignModal() {
    setAssignOpen(false);
  }

  function openUploadModal() {
    setUploadOpen(true);
    detailsRef.current?.removeAttribute("open");
  }

  function closeUploadModal() {
    setUploadOpen(false);
  }

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "Supprimer cette tâche ? Cette action est irréversible."
    );
    if (!confirmed) {
      event.preventDefault();
      return;
    }
    detailsRef.current?.removeAttribute("open");
  }

  return (
    <>
      <details ref={detailsRef} className="action-menu group relative">
        <summary
          className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
          title="Actions de la tâche"
          aria-label="Actions de la tâche"
        >
          <MoreHorizontal className="h-4 w-4" />
        </summary>

        <div className="action-menu-popover absolute right-0 z-[999] mt-2 w-56 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
          <button type="button" className={menuItemClassName} onClick={toggleEditMode}>
            <Pencil className="h-4 w-4" />
            {isEditMode ? "Fermer l'édition" : "Modifier la tâche"}
          </button>

          <form action={regenerateTaskImage}>
            <input type="hidden" name="taskId" value={taskId} />
            <button
              type="submit"
              className={menuItemClassName}
            >
              <RefreshCcw className="h-4 w-4" />
              {isImageGenerating
                ? "Génération..."
                : hasImage
                  ? "Régénérer l’illustration"
                  : "Générer l’illustration"}
            </button>
          </form>

          <button type="button" className={menuItemClassName} onClick={openUploadModal}>
            <Upload className="h-4 w-4" />
            {hasImage ? "Changer l’image" : "Téléverser une image"}
          </button>

          <button type="button" className={menuItemClassName} onClick={openAssignModal}>
            <UserRound className="h-4 w-4" />
            Assigner
          </button>

          <form action={deleteTask} onSubmit={confirmDelete}>
            <input type="hidden" name="taskId" value={taskId} />
            <button
              type="submit"
              className={`${menuItemClassName} text-rose-700 hover:bg-rose-50`}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer la tâche
            </button>
          </form>
        </div>
      </details>

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-sidebar-primary bg-sidebar-primary p-4 text-sidebar-primary-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Assigner la tâche</h3>
              <button
                type="button"
                onClick={closeAssignModal}
                className={triggerClassName}
                title="Fermer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={updateTaskAssignee} className="mt-4 space-y-3">
              <input type="hidden" name="taskId" value={taskId} />
              <AvatarSelect
                name="assigneeId"
                defaultValue={assigneeId ?? ""}
                emptyLabel="Non assignée"
                options={members.map((member) => ({
                  value: member.userId,
                  label: member.name || member.email || "Membre",
                  imageUrl: member.image ?? null,
                }))}
              />
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeAssignModal}>
                  Annuler
                </Button>
                <Button type="submit" variant="add">
                  Valider
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-sidebar-primary bg-sidebar-primary p-4 text-sidebar-primary-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Illustration de la tâche</h3>
              <button
                type="button"
                onClick={closeUploadModal}
                className={triggerClassName}
                title="Fermer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form action={uploadTaskImage} className="mt-4 space-y-3">
              <input type="hidden" name="taskId" value={taskId} />
              <Input name="imageFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WEBP ou GIF. Taille max: 8 Mo.
              </p>
              <div className="flex items-center justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeUploadModal}>
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
    </>
  );
}
