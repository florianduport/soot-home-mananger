import Link from "next/link";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getHouseData, requireSession } from "@/lib/house";
import { createProject, deleteProject, updateProject } from "@/app/actions";
import {
  buildConversationHref,
  groupConversationLinks,
} from "@/lib/agent/conversation-links";
import { prisma } from "@/lib/db";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function ProjectsPage() {
  const session = await requireSession();
  const { houseId, projects, tasks } = await getHouseData(session.user.id);
  const projectIds = projects.map((project) => project.id);
  const projectLinks = projectIds.length
    ? await prisma.agentConversationLink.findMany({
        where: {
          entityType: "PROJECT",
          entityId: { in: projectIds },
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
      })
    : [];
  const projectLinksById = groupConversationLinks(projectLinks);

  return (
    <>
      <section>
        <input id="create-project" type="checkbox" className="peer sr-only" />
        <div className="flex items-start justify-between gap-3">
          <header>
            <p className="text-sm text-muted-foreground">Projets</p>
            <h1 className="text-2xl font-semibold">Travaux et chantiers</h1>
          </header>
          <label
            htmlFor="create-project"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
            title="Créer un projet"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Créer un projet</span>
          </label>
        </div>
        <div className="mt-4 hidden peer-checked:block">
          <Card>
            <CardHeader>
              <CardTitle>Nouveau projet</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form action={createProject} className="grid gap-3">
                <input type="hidden" name="houseId" value={houseId} />
                <Input name="name" placeholder="Rénovation cuisine" required />
                <Textarea
                  name="description"
                  placeholder="Notes, objectifs, budget, etc."
                  rows={3}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">
                      Début prévu
                    </label>
                    <Input type="date" name="startsAt" />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">
                      Fin prévue
                    </label>
                    <Input type="date" name="endsAt" />
                  </div>
                </div>
                <Button
                  type="submit"
                  variant="add"
                  className="w-full rounded-full sm:w-auto"
                >
                  Créer le projet
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Aperçu rapide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Projets actifs</span>
              <span className="font-medium text-foreground">{projects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tâches liées</span>
              <span className="font-medium text-foreground">
                {tasks.filter((task) => task.projectId).length}
              </span>
            </div>
            <p>
              Associe les tâches à un projet depuis la fiche tâche pour garder une
              vision d&apos;ensemble.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6">
        {projects.length ? (
          projects.map((project) => {
            const projectTasks = tasks.filter(
              (task) => task.projectId === project.id
            );
            return (
              <Card key={project.id}>
                <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <CardTitle>{project.name}</CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {formatDate(project.startsAt)} · {formatDate(project.endsAt)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form action={updateProject} className="grid gap-3">
                    <input type="hidden" name="projectId" value={project.id} />
                    <Input name="name" defaultValue={project.name} required />
                    <Textarea
                      name="description"
                      defaultValue={project.description ?? ""}
                      rows={3}
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Input
                        type="date"
                        name="startsAt"
                        defaultValue={dateInputValue(project.startsAt)}
                      />
                      <Input
                        type="date"
                        name="endsAt"
                        defaultValue={dateInputValue(project.endsAt)}
                      />
                    </div>
                    <Button type="submit" variant="outline" className="w-full sm:w-auto">
                      Mettre à jour
                    </Button>
                  </form>
                  <form action={deleteProject}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <Button type="submit" variant="ghost" className="w-full sm:w-auto">
                      Supprimer
                    </Button>
                  </form>
                  {projectLinksById.get(project.id)?.length ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Conversations IA liées
                      </p>
                      <ul className="space-y-2 text-sm">
                        {projectLinksById.get(project.id)?.map((link) => (
                          <li
                            key={link.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2"
                          >
                            <Link
                              href={buildConversationHref({
                                pathname: "/app/projects",
                                conversationId: link.conversation.id,
                              })}
                              className="font-medium text-primary underline-offset-4 hover:underline"
                            >
                              {link.conversation.title}
                            </Link>
                            <span className="text-xs text-muted-foreground">
                              {formatDate(link.conversation.updatedAt)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Tâches liées
                    </p>
                    {projectTasks.length ? (
                      <ul className="space-y-1 text-sm">
                        {projectTasks.map((task) => (
                          <li key={task.id}>
                            <Link
                              href={`/app/tasks/${task.id}`}
                              className="underline-offset-4 hover:underline"
                            >
                              {task.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Aucune tâche associée pour le moment.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Aucun projet pour le moment. Crée le premier pour organiser tes
              travaux.
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
