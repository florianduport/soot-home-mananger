import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getHouseData, requireSession } from "@/lib/house";
import { resolveProjectImageState } from "@/lib/project-images";
import { ProjectsManager } from "@/components/projects/projects-manager";
import { Hammer } from "lucide-react";

export default async function ProjectsPage() {
  const session = await requireSession();
  const { houseId, projects, tasks } = await getHouseData(session.user.id);
  const projectsWithImages = await Promise.all(
    projects.map(async (project) => {
      const imageState = await resolveProjectImageState(project.id);
      return {
        id: project.id,
        name: project.name,
        description: project.description,
        imageUrl: imageState.imageUrl,
        isImageGenerating: imageState.isGenerating,
        startsAt: project.startsAt,
        endsAt: project.endsAt,
      };
    })
  );

  return (
    <>
      <section>
        <header className="page-header">
          <Hammer className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Projets</p>
          <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Travaux et chantiers</h1>
        </header>
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
        <ProjectsManager
          houseId={houseId}
          projects={projectsWithImages}
        />
      </section>
    </>
  );
}
