import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addTaskComment, updateTask } from "@/app/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TaskDetailActionsMenu } from "@/components/tasks/task-detail-actions-menu";
import { StatusToggle } from "@/components/tasks/status-toggle";
import { buildConversationHref } from "@/lib/agent/conversation-links";
import { requireSession } from "@/lib/house";
import { prisma } from "@/lib/db";
import { SendHorizontal } from "lucide-react";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

const statusLabels: Record<"TODO" | "IN_PROGRESS" | "DONE", string> = {
  TODO: "À faire",
  IN_PROGRESS: "En cours",
  DONE: "Terminé",
};

const recurrenceLabels: Record<"DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY", string> = {
  DAILY: "jour",
  WEEKLY: "semaine",
  MONTHLY: "mois",
  YEARLY: "an",
};

function formatRecurrence(
  unit: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null | undefined,
  interval: number | null | undefined
) {
  if (!unit) return "Tâche unique";
  const value = interval && interval > 1 ? interval : 1;
  const base = recurrenceLabels[unit] ?? "jour";
  const plural = value > 1 ? "s" : "";
  return `Tous les ${value} ${base}${plural}`;
}

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

type TaskParams = { taskId: string };
type TaskSearchParams = { [key: string]: string | string[] | undefined };

async function resolveParams(params: TaskParams | Promise<TaskParams>) {
  return typeof (params as Promise<TaskParams>)?.then === "function"
    ? (params as Promise<TaskParams>)
    : Promise.resolve(params as TaskParams);
}

async function resolveSearchParams(
  searchParams: TaskSearchParams | Promise<TaskSearchParams>
) {
  return typeof (searchParams as Promise<TaskSearchParams>)?.then === "function"
    ? (searchParams as Promise<TaskSearchParams>)
    : Promise.resolve(searchParams as TaskSearchParams);
}

export default async function TaskDetailPage({
  params,
  searchParams,
}: {
  params: TaskParams | Promise<TaskParams>;
  searchParams: TaskSearchParams | Promise<TaskSearchParams>;
}) {
  const resolvedParams = await resolveParams(params);
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const isEditMode = (resolvedSearchParams.edit ?? "").toString() === "1";
  const session = await requireSession();
  const task = await prisma.task.findUnique({
    where: { id: resolvedParams.taskId },
    include: {
      zone: true,
      category: true,
      project: true,
      equipment: true,
      animal: true,
      person: true,
      parent: true,
      assignee: true,
      comments: {
        include: { author: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!task) {
    notFound();
  }

  const membership = await prisma.houseMember.findFirst({
    where: { houseId: task.houseId, userId: session.user.id },
  });

  if (!membership) {
    redirect("/");
  }

  const conversationLinks = await prisma.agentConversationLink.findMany({
    where: {
      entityType: "TASK",
      entityId: task.id,
    },
    include: {
      conversation: {
        select: {
          id: true,
          title: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const [members, zones, categories, projects, equipments, animals, people] =
    await prisma.$transaction([
      prisma.houseMember.findMany({
        where: { houseId: task.houseId },
        include: { user: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.zone.findMany({ where: { houseId: task.houseId } }),
      prisma.category.findMany({ where: { houseId: task.houseId } }),
      prisma.project.findMany({ where: { houseId: task.houseId } }),
      prisma.equipment.findMany({ where: { houseId: task.houseId } }),
      prisma.animal.findMany({ where: { houseId: task.houseId } }),
      prisma.person.findMany({ where: { houseId: task.houseId } }),
    ]);

  const recurrenceSource = task.parent ?? (task.isTemplate ? task : null);
  const detailItems = [
    task.description
      ? {
          label: "Description",
          value: task.description,
        }
      : null,
    task.dueDate
      ? {
          label: "Échéance",
          value: formatDate(task.dueDate),
        }
      : null,
    task.assignee?.name || task.assignee?.email
      ? {
          label: "Assignée à",
          value: task.assignee?.name || task.assignee?.email || "",
        }
      : null,
    task.zone?.name
      ? {
          label: "Zone",
          value: task.zone.name,
        }
      : null,
    task.category?.name
      ? {
          label: "Catégorie",
          value: task.category.name,
        }
      : null,
    task.animal?.name
      ? {
          label: "Animal",
          value: task.animal.name,
        }
      : null,
    task.person?.name
      ? {
          label: "Personne",
          value: task.person.name,
        }
      : null,
    task.project?.name
      ? {
          label: "Projet",
          value: task.project.name,
        }
      : null,
    task.equipment?.name
      ? {
          label: "Équipement",
          value: task.equipment.name,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/app/tasks" className="hover:underline">
              Tâches
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{task.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={task.status === "DONE" ? "default" : "secondary"}>
            {statusLabels[task.status]}
          </Badge>
          <TaskDetailActionsMenu
            taskId={task.id}
            isEditMode={isEditMode}
            assigneeId={task.assigneeId ?? task.assignee?.id ?? null}
            hasImage={Boolean(task.imageUrl)}
            members={members.map((member) => ({
              userId: member.userId,
              name: member.user.name,
              email: member.user.email,
            }))}
          />
        </div>
      </header>

      <section className={`grid gap-6 ${isEditMode ? "lg:grid-cols-[1.2fr,1fr]" : ""}`}>
        <Card>
          <CardHeader>
            <CardTitle>Détails de la tâche</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="font-medium text-muted-foreground">
                Marquer comme terminée
              </span>
              <StatusToggle taskId={task.id} done={task.status === "DONE"} />
            </div>
            {task.imageUrl ? (
              <div className="overflow-hidden rounded-xl border bg-muted/30">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={task.imageUrl}
                  alt={`Illustration ${task.title}`}
                  className="h-56 w-full object-cover"
                />
              </div>
            ) : null}
            <div className="grid gap-2 sm:grid-cols-2">
              {detailItems.map((item) => (
                <div key={item.label}>
                  <p className="text-muted-foreground">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              ))}
              <div>
                <p className="text-muted-foreground">Récurrence</p>
                <p className="font-medium">
                  {formatRecurrence(
                    recurrenceSource?.recurrenceUnit,
                    recurrenceSource?.recurrenceInterval
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {isEditMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Modifier la tâche</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={updateTask} className="space-y-3">
                <input type="hidden" name="taskId" value={task.id} />
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Titre</label>
                  <Input name="title" defaultValue={task.title} required />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Description</label>
                  <Textarea
                    name="description"
                    defaultValue={task.description ?? ""}
                    rows={3}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Échéance</label>
                    <Input
                      type="date"
                      name="dueDate"
                      defaultValue={dateInputValue(task.dueDate)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">
                      Rappel (jours avant)
                    </label>
                    <Input
                      type="number"
                      name="reminderOffsetDays"
                      min={0}
                      defaultValue={task.reminderOffsetDays ?? ""}
                    />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Récurrence</label>
                    <select
                      name="recurrenceUnit"
                      defaultValue={recurrenceSource?.recurrenceUnit ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">Aucune</option>
                      <option value="DAILY">Quotidienne</option>
                      <option value="WEEKLY">Hebdomadaire</option>
                      <option value="MONTHLY">Mensuelle</option>
                      <option value="YEARLY">Annuelle</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">
                      Intervalle
                    </label>
                    <Input
                      type="number"
                      name="recurrenceInterval"
                      min={1}
                      defaultValue={recurrenceSource?.recurrenceInterval ?? ""}
                      placeholder="1"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Statut</label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        name="status"
                        value="DONE"
                        defaultChecked={task.status === "DONE"}
                        className="h-4 w-4 cursor-pointer accent-foreground"
                      />
                      Terminée
                    </label>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Assigner</label>
                    <select
                      name="assigneeId"
                      defaultValue={task.assigneeId ?? task.assignee?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">Non assignée</option>
                      {members.map((member) => (
                        <option key={member.id} value={member.userId}>
                          {member.user.name || member.user.email || "Membre"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Zone</label>
                    <select
                      name="zoneId"
                      defaultValue={task.zoneId ?? task.zone?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">—</option>
                      {zones.map((zone) => (
                        <option key={zone.id} value={zone.id}>
                          {zone.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Catégorie</label>
                    <select
                      name="categoryId"
                      defaultValue={task.categoryId ?? task.category?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">—</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Projet</label>
                    <select
                      name="projectId"
                      defaultValue={task.projectId ?? task.project?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">—</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Équipement</label>
                    <select
                      name="equipmentId"
                      defaultValue={task.equipmentId ?? task.equipment?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">—</option>
                      {equipments.map((equipment) => (
                        <option key={equipment.id} value={equipment.id}>
                          {equipment.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Animal</label>
                    <select
                      name="animalId"
                      defaultValue={task.animalId ?? task.animal?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">—</option>
                      {animals.map((animal) => (
                        <option key={animal.id} value={animal.id}>
                          {animal.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Personne</label>
                    <select
                      name="personId"
                      defaultValue={task.personId ?? task.person?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">—</option>
                      {people.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Enregistrer les modifications
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : null}
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Commentaires</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {conversationLinks.length ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Conversations IA liées</p>
              <ul className="space-y-2 text-sm">
                {conversationLinks.map((link) => (
                  <li
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                  >
                    <Link
                      href={buildConversationHref({
                        pathname: `/app/tasks/${task.id}`,
                        searchParams: resolvedSearchParams,
                        conversationId: link.conversation.id,
                      })}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {link.conversation.title}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(link.conversation.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="space-y-4">
            {task.comments.length ? (
              task.comments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border bg-muted/40 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>
                      {comment.author.name || comment.author.email || "Membre"}
                    </span>
                    <span>{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <p className="mt-2 text-sm">{comment.content}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucun commentaire pour le moment.
              </p>
            )}
          </div>

          <form action={addTaskComment} className="space-y-3">
            <input type="hidden" name="taskId" value={task.id} />
            <Textarea
              name="content"
              placeholder="Ajouter une note ou un commentaire..."
              required
              minLength={2}
              rows={4}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="icon"
                variant="add"
                title="Ajouter le commentaire"
                aria-label="Ajouter le commentaire"
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </>
  );
}
