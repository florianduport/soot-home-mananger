"use client";

import { useRef, useState } from "react";
import type { FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MoreHorizontal, Pencil, RefreshCcw, Trash2, Upload, X } from "lucide-react";
import {
  deleteProject,
  regenerateProjectImage,
  uploadProjectImage,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

type ProjectDetailActionsMenuProps = {
  projectId: string;
  isEditMode: boolean;
  hasImage: boolean;
  isImageGenerating: boolean;
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10";

export function ProjectDetailActionsMenu({
  projectId,
  isEditMode,
  hasImage,
  isImageGenerating,
}: ProjectDetailActionsMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailsRef = useRef<HTMLDetailsElement>(null);
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

  function openUploadModal() {
    setUploadOpen(true);
    detailsRef.current?.removeAttribute("open");
  }

  function closeUploadModal() {
    setUploadOpen(false);
  }

  function confirmDelete(event: FormEvent<HTMLFormElement>) {
    const confirmed = window.confirm(
      "Supprimer ce projet ? Les tâches liées resteront disponibles sans projet associé."
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
          title="Actions du projet"
          aria-label="Actions du projet"
        >
          <MoreHorizontal className="h-4 w-4" />
        </summary>

        <div className="action-menu-popover absolute right-0 z-[999] mt-2 w-56 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
          <button type="button" className={menuItemClassName} onClick={toggleEditMode}>
            <Pencil className="h-4 w-4" />
            {isEditMode ? "Fermer l'édition" : "Modifier le projet"}
          </button>

          <form action={regenerateProjectImage}>
            <input type="hidden" name="projectId" value={projectId} />
            <button
              type="submit"
              className={menuItemClassName}
              disabled={isImageGenerating}
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

          <form action={deleteProject} onSubmit={confirmDelete}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="redirectToProjects" value="1" />
            <button
              type="submit"
              className={`${menuItemClassName} text-rose-700 hover:bg-rose-50`}
            >
              <Trash2 className="h-4 w-4" />
              Supprimer le projet
            </button>
          </form>
        </div>
      </details>

      {uploadOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-sidebar-primary bg-sidebar-primary p-4 text-sidebar-primary-foreground shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">Illustration du projet</h3>
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

            <form action={uploadProjectImage} className="mt-4 space-y-3">
              <input type="hidden" name="projectId" value={projectId} />
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
