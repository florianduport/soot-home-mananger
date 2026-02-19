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
import { AvatarSelect } from "@/components/ui/avatar-select";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { IllustrationPlaceholder } from "@/components/ui/illustration-placeholder";
import { requireSession } from "@/lib/house";
import { prisma } from "@/lib/db";
import { resolveEquipmentImageUrl } from "@/lib/equipment-images";
import { resolveProjectImageUrl } from "@/lib/project-images";
import { isTaskImageGenerating } from "@/lib/task-images";
import { CheckSquare2, SendHorizontal } from "lucide-react";

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
      vendor: true,
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
    redirect("/app");
  }
  const taskImageGenerating = await isTaskImageGenerating(task.id);
  const hasTaskIllustration = taskImageGenerating || Boolean(task.imageUrl);

  const [members, zones, categories, projects, equipments, animals, people, vendors] =
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
      prisma.vendor.findMany({ where: { houseId: task.houseId }, orderBy: { name: "asc" } }),
    ]);
  const projectsWithImages = await Promise.all(
    projects.map(async (project) => ({
      ...project,
      imageUrl: await resolveProjectImageUrl(project.id),
    }))
  );
  const equipmentsWithImages = await Promise.all(
    equipments.map(async (equipment) => ({
      ...equipment,
      imageUrl: await resolveEquipmentImageUrl(equipment.id),
    }))
  );
  const projectImageMap = new Map(
    projectsWithImages.map((project) => [project.id, project.imageUrl] as const)
  );
  const equipmentImageMap = new Map(
    equipmentsWithImages.map((equipment) => [equipment.id, equipment.imageUrl] as const)
  );

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
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const relationItems = [
    task.assignee?.name || task.assignee?.email
      ? {
          label: "Assignée à",
          value: task.assignee?.name || task.assignee?.email || "",
          imageUrl: task.assignee?.image ?? null,
        }
      : null,
    task.animal?.name
      ? {
          label: "Animal",
          value: task.animal.name,
          imageUrl: task.animal.imageUrl ?? null,
        }
      : null,
    task.person?.name
      ? {
          label: "Personne",
          value: task.person.name,
          imageUrl: task.person.imageUrl ?? null,
        }
      : null,
    task.project?.name
      ? {
          label: "Projet",
          value: task.project.name,
          imageUrl: task.projectId ? projectImageMap.get(task.projectId) ?? null : null,
        }
      : null,
    task.equipment?.name
      ? {
          label: "Équipement",
          value: task.equipment.name,
          imageUrl: task.equipmentId
            ? equipmentImageMap.get(task.equipmentId) ?? null
            : null,
        }
      : null,
    task.vendor?.name
      ? {
          label: "Prestataire",
          value: task.vendor.name,
          imageUrl: null,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string; imageUrl: string | null }>;

  return (
    <>
      <header className="page-header relative z-[120] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <CheckSquare2
            className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
            aria-hidden="true"
          />
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
            isImageGenerating={taskImageGenerating}
            members={members.map((member) => ({
              userId: member.userId,
              name: member.user.name,
              email: member.user.email,
              image: member.user.image,
            }))}
          />
        </div>
      </header>

      <section className={`relative grid gap-6 ${isEditMode ? "lg:grid-cols-[1.2fr,1fr]" : ""}`}>
        <Card className={hasTaskIllustration ? "overflow-hidden pt-0" : undefined}>
          {taskImageGenerating ? (
            <IllustrationPlaceholder className="aspect-square w-full rounded-none border-x-0 border-t-0 border-b" />
          ) : task.imageUrl ? (
            <div className="overflow-hidden border-b bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={task.imageUrl}
                alt={`Illustration ${task.title}`}
                className="aspect-square w-full object-cover"
              />
            </div>
          ) : null}
          <CardHeader className={hasTaskIllustration ? "pt-6" : undefined}>
            <CardTitle>Détails de la tâche</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2">
              <span className="font-medium text-muted-foreground">
                Marquer comme terminée
              </span>
              <StatusToggle taskId={task.id} done={task.status === "DONE"} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {detailItems.map((item) => (
                <div key={item.label}>
                  <p className="text-muted-foreground">{item.label}</p>
                  <p className="font-medium">{item.value}</p>
                </div>
              ))}
              {relationItems.map((item) => (
                <div key={item.label}>
                  <p className="text-muted-foreground">{item.label}</p>
                  <div className="mt-0.5 inline-flex items-center gap-2 font-medium">
                    <EntityAvatar
                      name={item.value}
                      imageUrl={item.imageUrl}
                      size="xs"
                    />
                    <span>{item.value}</span>
                  </div>
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
                    <AvatarSelect
                      name="assigneeId"
                      defaultValue={task.assigneeId ?? task.assignee?.id ?? ""}
                      emptyLabel="Non assignée"
                      options={members.map((member) => ({
                        value: member.userId,
                        label: member.user.name || member.user.email || "Membre",
                        imageUrl: member.user.image ?? null,
                      }))}
                    />
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
                    <AvatarSelect
                      name="projectId"
                      defaultValue={task.projectId ?? task.project?.id ?? ""}
                      emptyLabel="—"
                      options={projectsWithImages.map((project) => ({
                        value: project.id,
                        label: project.name,
                        imageUrl: project.imageUrl ?? null,
                      }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Équipement</label>
                    <AvatarSelect
                      name="equipmentId"
                      defaultValue={task.equipmentId ?? task.equipment?.id ?? ""}
                      emptyLabel="—"
                      options={equipmentsWithImages.map((equipment) => ({
                        value: equipment.id,
                        label: equipment.name,
                        imageUrl: equipment.imageUrl ?? null,
                      }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Prestataire</label>
                    <select
                      name="vendorId"
                      defaultValue={task.vendorId ?? task.vendor?.id ?? ""}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                    >
                      <option value="">—</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                          {vendor.company ? ` · ${vendor.company}` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Animal</label>
                    <AvatarSelect
                      name="animalId"
                      defaultValue={task.animalId ?? task.animal?.id ?? ""}
                      emptyLabel="—"
                      options={animals.map((animal) => ({
                        value: animal.id,
                        label: animal.name,
                        imageUrl: animal.imageUrl ?? null,
                      }))}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Personne</label>
                    <AvatarSelect
                      name="personId"
                      defaultValue={task.personId ?? task.person?.id ?? ""}
                      emptyLabel="—"
                      options={people.map((person) => ({
                        value: person.id,
                        label: person.name,
                        imageUrl: person.imageUrl ?? null,
                      }))}
                    />
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
