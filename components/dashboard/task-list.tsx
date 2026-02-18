import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { StatusToggle } from "@/components/tasks/status-toggle";
import { TaskAssigneeSelect } from "@/components/tasks/task-assignee-select";
import { TaskCompleteMessage } from "@/components/tasks/task-complete-message";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { IllustrationPlaceholder } from "@/components/ui/illustration-placeholder";
import { SootMascot } from "@/components/mascot/soot-mascot";

export type TaskListItem = {
  id: string;
  title: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
  dueDate: string | null;
  zone?: string | null;
  category?: string | null;
  project?: string | null;
  projectImageUrl?: string | null;
  equipment?: string | null;
  equipmentImageUrl?: string | null;
  animal?: string | null;
  animalImageUrl?: string | null;
  person?: string | null;
  personImageUrl?: string | null;
  recurring?: boolean;
  assignee?: string | null;
  assigneeId?: string | null;
  assigneeImageUrl?: string | null;
  imageUrl?: string | null;
  isImageGenerating?: boolean;
};

export type TaskMember = {
  id: string;
  name: string | null;
  email: string | null;
  image?: string | null;
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
        <div className="mb-3 flex items-center gap-3">
          <SootMascot mood="sleepy" className="h-8 w-8" />
          <p>Aucune tâche pour le moment. Commence par créer ta première tâche.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={`relative flex min-w-0 items-stretch gap-3 rounded-xl border bg-card p-3 sm:p-4 ${
            task.status === "DONE" ? "opacity-70" : ""
          }`}
        >
          <TaskCompleteMessage taskId={task.id} />
          <StatusToggle
            taskId={task.id}
            done={task.status === "DONE"}
            className="shrink-0 self-center"
          />
          {task.isImageGenerating ? (
            <IllustrationPlaceholder
              className="h-full w-24 shrink-0 self-stretch rounded-xl"
              showLabel={false}
            />
          ) : task.imageUrl ? (
            <div className="w-24 shrink-0 self-stretch overflow-hidden rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={task.imageUrl} alt="" className="h-full w-full object-cover" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1 space-y-3">
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
                {task.project ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Projet:</span>
                    <EntityAvatar
                      name={task.project}
                      imageUrl={task.projectImageUrl}
                      size="xs"
                    />
                    <span>{task.project}</span>
                  </span>
                ) : null}
                {task.equipment ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Équipement:</span>
                    <EntityAvatar
                      name={task.equipment}
                      imageUrl={task.equipmentImageUrl}
                      size="xs"
                    />
                    <span>{task.equipment}</span>
                  </span>
                ) : null}
                {task.animal ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Animal:</span>
                    <EntityAvatar
                      name={task.animal}
                      imageUrl={task.animalImageUrl}
                      size="xs"
                    />
                    <span>{task.animal}</span>
                  </span>
                ) : null}
                {task.person ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Personne:</span>
                    <EntityAvatar
                      name={task.person}
                      imageUrl={task.personImageUrl}
                      size="xs"
                    />
                    <span>{task.person}</span>
                  </span>
                ) : null}
                {task.assignee ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span>Assignée à:</span>
                    <EntityAvatar
                      name={task.assignee}
                      imageUrl={task.assigneeImageUrl}
                      size="xs"
                    />
                    <span>{task.assignee}</span>
                  </span>
                ) : null}
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
        </div>
      ))}
    </div>
  );
}
