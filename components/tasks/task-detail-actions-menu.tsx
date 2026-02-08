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
  X,
} from "lucide-react";
import { deleteTask, regenerateTaskImage, updateTaskAssignee } from "@/app/actions";
import { Button } from "@/components/ui/button";

type TaskDetailActionsMenuProps = {
  taskId: string;
  isEditMode: boolean;
  assigneeId?: string | null;
  hasImage?: boolean;
  members: Array<{
    userId: string;
    name: string | null;
    email: string | null;
  }>;
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100";

export function TaskDetailActionsMenu({
  taskId,
  isEditMode,
  assigneeId,
  hasImage,
  members,
}: TaskDetailActionsMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [assignOpen, setAssignOpen] = useState(false);

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
      <details ref={detailsRef} className="group relative">
        <summary
          className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
          title="Actions de la tâche"
          aria-label="Actions de la tâche"
        >
          <MoreHorizontal className="h-4 w-4" />
        </summary>

        <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <button type="button" className={menuItemClassName} onClick={toggleEditMode}>
            <Pencil className="h-4 w-4" />
            {isEditMode ? "Fermer l'édition" : "Modifier la tâche"}
          </button>

          <form action={regenerateTaskImage}>
            <input type="hidden" name="taskId" value={taskId} />
            <button type="submit" className={menuItemClassName}>
              <RefreshCcw className="h-4 w-4" />
              {hasImage ? "Régénérer l’illustration" : "Générer l’illustration"}
            </button>
          </form>

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
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
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
              <select
                name="assigneeId"
                defaultValue={assigneeId ?? ""}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
              >
                <option value="">Non assignée</option>
                {members.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name || member.email || "Membre"}
                  </option>
                ))}
              </select>
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
    </>
  );
}
