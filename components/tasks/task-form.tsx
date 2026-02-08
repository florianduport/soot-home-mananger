import { createTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type TaskFormData = {
  houseId: string;
  zones: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  projects: { id: string; name: string }[];
  equipments: { id: string; name: string }[];
  animals: { id: string; name: string }[];
  people: { id: string; name: string }[];
  members: { id: string; name: string | null; email: string | null }[];
};

export function TaskForm({
  houseId,
  zones,
  categories,
  projects,
  equipments,
  animals,
  people,
  members,
}: TaskFormData) {
  return (
    <form action={createTask} className="grid gap-4">
      <input type="hidden" name="houseId" value={houseId} />
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="title">
          Titre
        </label>
        <Input id="title" name="title" required placeholder="Nettoyer la terrasse" />
      </div>
      <div className="grid gap-2">
        <label className="text-sm font-medium" htmlFor="description">
          Description
        </label>
        <Textarea id="description" name="description" placeholder="Détails utiles" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="dueDate">
            Échéance
          </label>
          <Input id="dueDate" name="dueDate" type="date" />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="reminderOffsetDays">
            Rappel (jours avant)
          </label>
          <Input id="reminderOffsetDays" name="reminderOffsetDays" type="number" min={0} />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="recurrenceUnit">
            Récurrence
          </label>
          <select
            id="recurrenceUnit"
            name="recurrenceUnit"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
          >
            <option value="">Aucune</option>
            <option value="DAILY">Quotidienne</option>
            <option value="WEEKLY">Hebdomadaire</option>
            <option value="MONTHLY">Mensuelle</option>
            <option value="YEARLY">Annuelle</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="recurrenceInterval">
            Intervalle
          </label>
          <Input
            id="recurrenceInterval"
            name="recurrenceInterval"
            type="number"
            min={1}
            placeholder="1"
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="zoneId">
            Zone
          </label>
          <select
            id="zoneId"
            name="zoneId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
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
          <label className="text-sm font-medium" htmlFor="categoryId">
            Catégorie
          </label>
          <select
            id="categoryId"
            name="categoryId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
          >
            <option value="">—</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="projectId">
            Projet
          </label>
          <select
            id="projectId"
            name="projectId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
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
          <label className="text-sm font-medium" htmlFor="equipmentId">
            Équipement
          </label>
          <select
            id="equipmentId"
            name="equipmentId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
          >
            <option value="">—</option>
            {equipments.map((equipment) => (
              <option key={equipment.id} value={equipment.id}>
                {equipment.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="assigneeId">
            Assigner à
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
          >
            <option value="">—</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name || member.email || "Membre"}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="animalId">
            Animal
          </label>
          <select
            id="animalId"
            name="animalId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
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
          <label className="text-sm font-medium" htmlFor="personId">
            Personne
          </label>
          <select
            id="personId"
            name="personId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
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
      <Button type="submit" variant="add" className="rounded-full">
        Créer la tâche
      </Button>
    </form>
  );
}
