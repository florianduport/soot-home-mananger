import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { StatusToggle } from "@/components/tasks/status-toggle";
import { TaskAssigneeSelect } from "@/components/tasks/task-assignee-select";
import { TaskCompleteMessage } from "@/components/tasks/task-complete-message";

export type TaskListItem = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  zone?: string | null;
  category?: string | null;
  project?: string | null;
  equipment?: string | null;
  animal?: string | null;
  person?: string | null;
  recurring?: boolean;
  assignee?: string | null;
  assigneeId?: string | null;
  imageUrl?: string | null;
};

export type TaskMember = {
  id: string;
  name: string | null;
  email: string | null;
};

const statusLabels: Record<TaskListItem["status"], string> = {
  TODO: "À faire",
  IN_PROGRESS: "À faire",
  DONE: "Terminé",
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(date);
}

export function TaskList({
  tasks,
  members = [],
  showAssigneeControls = false,
}: {
  tasks: TaskListItem[];
  members?: TaskMember[];
  showAssigneeControls?: boolean;
}) {
  if (!tasks.length) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
        Aucune tâche pour le moment. Commence par créer ta première tâche.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`relative flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4 ${
            task.status === "DONE" ? "opacity-70" : ""
          }`}
        >
          <TaskCompleteMessage taskId={task.id} />
          <div className="flex min-w-0 items-start gap-3">
            <StatusToggle
              taskId={task.id}
              done={task.status === "DONE"}
              className="mt-1 shrink-0 self-center"
            />
            {task.imageUrl ? (
              <div className="flex h-full shrink-0 items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={task.imageUrl}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover"
                />
              </div>
            ) : null}
            <div className="min-w-0">
              <Link
                href={`/app/tasks/${task.id}`}
                className={`block break-words text-base font-semibold hover:underline ${
                  task.status === "DONE" ? "line-through" : ""
                }`}
              >
                {task.title}
              </Link>
              <p className="text-sm text-muted-foreground">
                Échéance: {formatDate(task.dueDate)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant={task.status === "DONE" ? "default" : "secondary"}>
                  {statusLabels[task.status]}
                </Badge>
                {task.recurring ? <Badge variant="outline">Récurrente</Badge> : null}
              </div>
            </div>
          </div>
          {(task.zone ||
            task.category ||
            task.project ||
            task.equipment ||
            task.animal ||
            task.person ||
            task.assignee) && (
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              {task.zone ? <span>Zone: {task.zone}</span> : null}
              {task.category ? <span>Catégorie: {task.category}</span> : null}
              {task.project ? <span>Projet: {task.project}</span> : null}
              {task.equipment ? <span>Équipement: {task.equipment}</span> : null}
              {task.animal ? <span>Animal: {task.animal}</span> : null}
              {task.person ? <span>Personne: {task.person}</span> : null}
              {task.assignee ? <span>Assignée à: {task.assignee}</span> : null}
            </div>
          )}
          {showAssigneeControls ? (
            <div className="flex gap-3">
              <TaskAssigneeSelect
                taskId={task.id}
                assigneeId={task.assigneeId}
                members={members}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
