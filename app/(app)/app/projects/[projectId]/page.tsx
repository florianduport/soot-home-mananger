import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updateProject } from "@/app/actions";
import { TaskList } from "@/components/dashboard/task-list";
import { ProjectDetailActionsMenu } from "@/components/projects/project-detail-actions-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { IllustrationPlaceholder } from "@/components/ui/illustration-placeholder";
import { requireSession } from "@/lib/house";
import { resolveProjectImageState } from "@/lib/project-images";
import { resolveTaskImageGeneratingSet } from "@/lib/task-images";
import { prisma } from "@/lib/db";
import { Hammer } from "lucide-react";

type ProjectParams = { projectId: string };
type ProjectSearchParams = { [key: string]: string | string[] | undefined };

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "full",
  }).format(value);
}

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

async function resolveParams(params: ProjectParams | Promise<ProjectParams>) {
  return typeof (params as Promise<ProjectParams>)?.then === "function"
    ? (params as Promise<ProjectParams>)
    : Promise.resolve(params as ProjectParams);
}

async function resolveSearchParams(
  searchParams: ProjectSearchParams | Promise<ProjectSearchParams>
) {
  return typeof (searchParams as Promise<ProjectSearchParams>)?.then === "function"
    ? (searchParams as Promise<ProjectSearchParams>)
    : Promise.resolve(searchParams as ProjectSearchParams);
}

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: ProjectParams | Promise<ProjectParams>;
  searchParams: ProjectSearchParams | Promise<ProjectSearchParams>;
}) {
  const resolvedParams = await resolveParams(params);
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const isEditMode = (resolvedSearchParams.edit ?? "").toString() === "1";
  const session = await requireSession();

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.projectId },
    include: {
      tasks: {
        where: { isTemplate: false },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
        include: {
          zone: true,
          category: true,
          equipment: true,
          animal: true,
          person: true,
          assignee: true,
          parent: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  const membership = await prisma.houseMember.findFirst({
    where: { houseId: project.houseId, userId: session.user.id },
  });

  if (!membership) {
    redirect("/app");
  }

  const [projectImageState, generatingTaskIds] = await Promise.all([
    resolveProjectImageState(project.id),
    resolveTaskImageGeneratingSet(project.tasks.map((task) => task.id)),
  ]);

  const hasProjectIllustration = projectImageState.isGenerating || Boolean(projectImageState.imageUrl);
  const completedTasks = project.tasks.filter((task) => task.status === "DONE").length;
  const linkedTasks = project.tasks.map((task) => ({
    id: task.id,
    title: task.title,
    status: task.status,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    imageUrl: task.imageUrl ?? null,
    isImageGenerating: generatingTaskIds.has(task.id),
    zone: task.zone?.name ?? null,
    category: task.category?.name ?? null,
    equipment: task.equipment?.name ?? null,
    animal: task.animal?.name ?? null,
    animalImageUrl: task.animal?.imageUrl ?? null,
    person: task.person?.name ?? null,
    personImageUrl: task.person?.imageUrl ?? null,
    recurring: Boolean(task.parentId),
    assignee: task.assignee?.name ?? task.assignee?.email ?? null,
    assigneeId: task.assigneeId ?? null,
    assigneeImageUrl: task.assignee?.image ?? null,
  }));

  return (
    <>
      <header className="page-header relative z-[120] flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Hammer className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            <Link href="/app/projects" className="hover:underline">
              Projets
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {project.tasks.length} tâche{project.tasks.length > 1 ? "s" : ""} liée
            {project.tasks.length > 1 ? "s" : ""}
          </Badge>
          <ProjectDetailActionsMenu
            projectId={project.id}
            isEditMode={isEditMode}
            hasImage={Boolean(projectImageState.imageUrl)}
            isImageGenerating={projectImageState.isGenerating}
          />
        </div>
      </header>

      <section className={`relative z-0 grid gap-6 ${isEditMode ? "lg:grid-cols-[1.2fr,1fr]" : ""}`}>
        <Card className={hasProjectIllustration ? "overflow-hidden pt-0" : undefined}>
          {projectImageState.isGenerating ? (
            <IllustrationPlaceholder className="aspect-square w-full rounded-none border-x-0 border-t-0 border-b" />
          ) : projectImageState.imageUrl ? (
            <div className="overflow-hidden border-b bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={projectImageState.imageUrl}
                alt={`Illustration ${project.name}`}
                className="aspect-square w-full object-cover"
              />
            </div>
          ) : null}
          <CardHeader className={hasProjectIllustration ? "pt-6" : undefined}>
            <CardTitle>Détails du projet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-muted-foreground">Date de début</p>
                <p className="font-medium">{formatDate(project.startsAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date de fin</p>
                <p className="font-medium">{formatDate(project.endsAt)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tâches terminées</p>
                <p className="font-medium">
                  {completedTasks} / {project.tasks.length}
                </p>
              </div>
            </div>
            <div>
              <p className="text-muted-foreground">Description</p>
              <p className="font-medium">
                {project.description?.trim() || "Aucune description pour le moment."}
              </p>
            </div>
          </CardContent>
        </Card>

        {isEditMode ? (
          <Card>
            <CardHeader>
              <CardTitle>Modifier le projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form action={updateProject} className="space-y-3">
                <input type="hidden" name="projectId" value={project.id} />
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Nom</label>
                  <Input name="name" defaultValue={project.name} required />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm text-muted-foreground">Description</label>
                  <Textarea
                    name="description"
                    defaultValue={project.description ?? ""}
                    rows={4}
                    placeholder="Notes, objectifs, budget, etc."
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Début</label>
                    <Input
                      type="date"
                      name="startsAt"
                      defaultValue={dateInputValue(project.startsAt)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">Fin</label>
                    <Input
                      type="date"
                      name="endsAt"
                      defaultValue={dateInputValue(project.endsAt)}
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
          <CardTitle>Tâches liées</CardTitle>
        </CardHeader>
        <CardContent>
          <TaskList tasks={linkedTasks} />
        </CardContent>
      </Card>
    </>
  );
}
