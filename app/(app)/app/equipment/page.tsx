import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EquipmentManager } from "@/components/equipment/equipment-manager";
import { getHouseData, requireSession } from "@/lib/house";
import { resolveEquipmentImageState } from "@/lib/equipment-images";
import { Package } from "lucide-react";

export default async function EquipmentPage() {
  const session = await requireSession();
  const { houseId, equipments } = await getHouseData(session.user.id);
  const equipmentsWithImages = await Promise.all(
    equipments.map(async (equipment) => {
      const imageState = await resolveEquipmentImageState(equipment.id);
      return {
        id: equipment.id,
        name: equipment.name,
        location: equipment.location,
        category: equipment.category,
        purchasedAt: equipment.purchasedAt,
        installedAt: equipment.installedAt,
        lifespanMonths: equipment.lifespanMonths,
        imageUrl: imageState.imageUrl,
        isImageGenerating: imageState.isGenerating,
      };
    })
  );

  return (
    <>
      <section>
        <header className="page-header">
          <Package className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Équipements</p>
          <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Parc d&apos;équipements</h1>
        </header>
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
        <EquipmentManager houseId={houseId} equipments={equipmentsWithImages} />
      </section>
    </>
  );
}
