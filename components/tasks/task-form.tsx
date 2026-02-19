"use client";

import { createTask } from "@/app/actions";
import { AvatarSelect } from "@/components/ui/avatar-select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useMemo, useRef } from "react";

export type TaskFormData = {
  houseId: string;
  currentUserId: string;
  zones: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  projects: { id: string; name: string; imageUrl?: string | null }[];
  equipments: { id: string; name: string; imageUrl?: string | null }[];
  vendors: { id: string; name: string; company?: string | null }[];
  animals: { id: string; name: string; imageUrl?: string | null }[];
  people: { id: string; name: string; imageUrl?: string | null }[];
  members: {
    id: string;
    name: string | null;
    email: string | null;
    image?: string | null;
  }[];
};

export function TaskForm({
  houseId,
  currentUserId,
  zones,
  categories,
  projects,
  equipments,
  vendors,
  animals,
  people,
  members,
}: TaskFormData) {
  const formRef = useRef<HTMLFormElement>(null);
  const defaultDueDate = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }, []);
  const defaultAssigneeId = members.some((member) => member.id === currentUserId)
    ? currentUserId
    : "";

  async function submitCreateTask(formData: FormData) {
    await createTask(formData);
    formRef.current?.reset();

    const createTaskToggle = document.getElementById("create-task");
    if (createTaskToggle instanceof HTMLInputElement) {
      createTaskToggle.checked = false;
    }
  }

  return (
    <form ref={formRef} action={submitCreateTask} className="grid gap-4">
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
          <Input
            id="dueDate"
            name="dueDate"
            type="date"
            required
            defaultValue={defaultDueDate}
          />
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
          <AvatarSelect
            id="projectId"
            name="projectId"
            defaultValue=""
            emptyLabel="—"
            options={projects.map((project) => ({
              value: project.id,
              label: project.name,
              imageUrl: project.imageUrl ?? null,
            }))}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="equipmentId">
            Équipement
          </label>
          <AvatarSelect
            id="equipmentId"
            name="equipmentId"
            defaultValue=""
            emptyLabel="—"
            options={equipments.map((equipment) => ({
              value: equipment.id,
              label: equipment.name,
              imageUrl: equipment.imageUrl ?? null,
            }))}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="vendorId">
            Prestataire
          </label>
          <select
            id="vendorId"
            name="vendorId"
            className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
            defaultValue=""
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
          <label className="text-sm font-medium" htmlFor="assigneeId">
            Assigner à
          </label>
          <AvatarSelect
            id="assigneeId"
            name="assigneeId"
            defaultValue={defaultAssigneeId}
            emptyLabel="—"
            options={members.map((member) => ({
              value: member.id,
              label: member.name || member.email || "Membre",
              imageUrl: member.image ?? null,
            }))}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="animalId">
            Animal
          </label>
          <AvatarSelect
            id="animalId"
            name="animalId"
            defaultValue=""
            emptyLabel="—"
            options={animals.map((animal) => ({
              value: animal.id,
              label: animal.name,
              imageUrl: animal.imageUrl ?? null,
            }))}
          />
        </div>
        <div className="grid gap-2">
          <label className="text-sm font-medium" htmlFor="personId">
            Personne
          </label>
          <AvatarSelect
            id="personId"
            name="personId"
            defaultValue=""
            emptyLabel="—"
            options={people.map((person) => ({
              value: person.id,
              label: person.name,
              imageUrl: person.imageUrl ?? null,
            }))}
          />
        </div>
      </div>
      <Button type="submit" variant="add" className="rounded-full">
        Créer la tâche
      </Button>
    </form>
  );
}
