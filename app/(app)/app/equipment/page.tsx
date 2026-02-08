import { differenceInMonths, addMonths } from "date-fns";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getHouseData, requireSession } from "@/lib/house";
import {
  createEquipment,
  deleteEquipment,
  updateEquipment,
} from "@/app/actions";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

function dateInputValue(value: Date | null) {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function computeLifespanSummary(
  installedAt: Date | null,
  purchasedAt: Date | null,
  lifespanMonths: number | null
) {
  if (!lifespanMonths) return "Durée de vie non renseignée";
  const base = installedAt ?? purchasedAt;
  if (!base) return "Date de référence manquante";
  const end = addMonths(base, lifespanMonths);
  const remaining = differenceInMonths(end, new Date());
  if (remaining < 0) {
    return `Fin de vie atteinte (depuis ${Math.abs(remaining)} mois)`;
  }
  if (remaining === 0) {
    return "Fin de vie ce mois-ci";
  }
  return `${remaining} mois restants`;
}

export default async function EquipmentPage() {
  const session = await requireSession();
  const { houseId, equipments } = await getHouseData(session.user.id);

  return (
    <>
      <section>
        <input id="create-equipment" type="checkbox" className="peer sr-only" />
        <div className="flex items-start justify-between gap-3">
          <header>
            <p className="text-sm text-muted-foreground">Équipements</p>
            <h1 className="text-2xl font-semibold">Parc d&apos;équipements</h1>
          </header>
          <label
            htmlFor="create-equipment"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
            title="Créer un équipement"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Créer un équipement</span>
          </label>
        </div>
        <div className="mt-4 hidden peer-checked:block">
          <Card>
            <CardHeader>
              <CardTitle>Nouvel équipement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <form action={createEquipment} className="grid gap-3">
                <input type="hidden" name="houseId" value={houseId} />
                <Input name="name" placeholder="Chaudière" required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input name="location" placeholder="Local technique" />
                  <Input name="category" placeholder="Chauffage" />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">
                      Date d&apos;achat
                    </label>
                    <Input type="date" name="purchasedAt" />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm text-muted-foreground">
                      Date d&apos;installation
                    </label>
                    <Input type="date" name="installedAt" />
                  </div>
                </div>
                <Input
                  type="number"
                  name="lifespanMonths"
                  min={1}
                  placeholder="Durée de vie (mois)"
                />
                <Button
                  type="submit"
                  variant="add"
                  className="w-full rounded-full sm:w-auto"
                >
                  Ajouter
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Résumé</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Équipements</span>
              <span className="font-medium text-foreground">
                {equipments.length}
              </span>
            </div>
            <p>
              Renseigne les dates et la durée de vie pour anticiper les
              remplacements.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6">
        {equipments.length ? (
          equipments.map((equipment) => (
            <Card key={equipment.id}>
              <CardHeader className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <CardTitle>{equipment.name}</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {computeLifespanSummary(
                    equipment.installedAt,
                    equipment.purchasedAt,
                    equipment.lifespanMonths
                  )}
                </span>
              </CardHeader>
              <CardContent className="space-y-4">
                <form action={updateEquipment} className="grid gap-3">
                  <input type="hidden" name="equipmentId" value={equipment.id} />
                  <Input name="name" defaultValue={equipment.name} required />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      name="location"
                      defaultValue={equipment.location ?? ""}
                      placeholder="Emplacement"
                    />
                    <Input
                      name="category"
                      defaultValue={equipment.category ?? ""}
                      placeholder="Catégorie"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      type="date"
                      name="purchasedAt"
                      defaultValue={dateInputValue(equipment.purchasedAt)}
                    />
                    <Input
                      type="date"
                      name="installedAt"
                      defaultValue={dateInputValue(equipment.installedAt)}
                    />
                  </div>
                  <Input
                    type="number"
                    name="lifespanMonths"
                    min={1}
                    defaultValue={equipment.lifespanMonths ?? ""}
                    placeholder="Durée de vie (mois)"
                  />
                  <div className="text-xs text-muted-foreground">
                    Achat: {formatDate(equipment.purchasedAt)} · Installation:{" "}
                    {formatDate(equipment.installedAt)}
                  </div>
                  <Button type="submit" variant="outline" className="w-full sm:w-auto">
                    Mettre à jour
                  </Button>
                </form>
                <form action={deleteEquipment}>
                  <input type="hidden" name="equipmentId" value={equipment.id} />
                  <Button type="submit" variant="ghost" className="w-full sm:w-auto">
                    Supprimer
                  </Button>
                </form>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Aucun équipement enregistré pour le moment.
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
