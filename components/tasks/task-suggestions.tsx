import {
  applyTaskSuggestion,
  deleteTaskSuggestion,
  generateSuggestedTasks,
  updateTaskSuggestion,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Suggestion = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  reminderOffsetDays: number | null;
  recurrenceUnit: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | null;
  recurrenceInterval: number | null;
  zoneId: string | null;
  categoryId: string | null;
  projectId: string | null;
  equipmentId: string | null;
};

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export function TaskSuggestions({
  houseId,
  suggestions,
  zones,
  categories,
  projects,
  equipments,
}: {
  houseId: string;
  suggestions: Suggestion[];
  zones: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  equipments: { id: string; name: string }[];
}) {
  return (
    <div className="space-y-4">
      <form action={generateSuggestedTasks} className="grid gap-4">
        <input type="hidden" name="houseId" value={houseId} />
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="focus">
            Focus ou contexte
          </label>
          <Textarea
            id="focus"
            name="focus"
            placeholder="Ex: préparer l'hiver, entretien du jardin, rendez-vous animaux"
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="horizonDays">
            Horizon (jours)
          </label>
          <Input
            id="horizonDays"
            name="horizonDays"
            type="number"
            min={7}
            defaultValue={30}
          />
        </div>
        <Button type="submit" className="w-full sm:w-auto">
          Générer des suggestions
        </Button>
      </form>

      {suggestions.length ? (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-xl border p-4 space-y-3">
              <form action={updateTaskSuggestion} className="grid gap-3">
                <input type="hidden" name="suggestionId" value={suggestion.id} />
                <Input name="title" defaultValue={suggestion.title} required />
                <Textarea
                  name="description"
                  defaultValue={suggestion.description ?? ""}
                  rows={2}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    type="date"
                    name="dueDate"
                    defaultValue={dateInputValue(suggestion.dueDate)}
                  />
                  <Input
                    type="number"
                    name="reminderOffsetDays"
                    min={0}
                    defaultValue={suggestion.reminderOffsetDays ?? ""}
                    placeholder="Rappel (jours avant)"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    name="recurrenceUnit"
                    defaultValue={suggestion.recurrenceUnit ?? ""}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="">Récurrence</option>
                    <option value="DAILY">Quotidienne</option>
                    <option value="WEEKLY">Hebdomadaire</option>
                    <option value="MONTHLY">Mensuelle</option>
                    <option value="YEARLY">Annuelle</option>
                  </select>
                  <Input
                    type="number"
                    name="recurrenceInterval"
                    min={1}
                    defaultValue={suggestion.recurrenceInterval ?? ""}
                    placeholder="Intervalle"
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    name="zoneId"
                    defaultValue={suggestion.zoneId ?? ""}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="">Zone</option>
                    {zones.map((zone) => (
                      <option key={zone.id} value={zone.id}>
                        {zone.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="categoryId"
                    defaultValue={suggestion.categoryId ?? ""}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="">Catégorie</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="projectId"
                    defaultValue={suggestion.projectId ?? ""}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="">Projet</option>
                    {projects.map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="equipmentId"
                    defaultValue={suggestion.equipmentId ?? ""}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    <option value="">Équipement</option>
                    {equipments.map((equipment) => (
                      <option key={equipment.id} value={equipment.id}>
                        {equipment.name}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="submit" variant="outline" className="w-full sm:w-auto">
                  Mettre à jour la suggestion
                </Button>
              </form>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                <form action={applyTaskSuggestion}>
                  <input type="hidden" name="suggestionId" value={suggestion.id} />
                  <Button type="submit" className="w-full sm:w-auto">
                    Ajouter à mes tâches
                  </Button>
                </form>
                <form action={deleteTaskSuggestion}>
                  <input type="hidden" name="suggestionId" value={suggestion.id} />
                  <Button type="submit" variant="ghost" className="w-full sm:w-auto">
                    Supprimer
                  </Button>
                </form>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucune suggestion pour le moment.
        </p>
      )}
    </div>
  );
}
