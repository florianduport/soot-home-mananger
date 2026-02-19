import { Handshake } from "lucide-react";
import { VendorsManager } from "@/components/vendors/vendors-manager";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireHouse, requireSession } from "@/lib/house";

export default async function VendorsPage() {
  const session = await requireSession();
  const membership = await requireHouse(session.user.id);
  const houseId = membership.houseId;

  const [vendors, tasks, documents] = await prisma.$transaction([
    prisma.vendor.findMany({
      where: { houseId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { houseId, vendorId: { not: null }, isTemplate: false },
      select: { id: true, vendorId: true },
    }),
    prisma.budgetDocument.findMany({
      where: { houseId, vendorId: { not: null } },
      select: { id: true, vendorId: true },
    }),
  ]);

  const taskCounts = new Map<string, number>();
  for (const task of tasks) {
    if (!task.vendorId) continue;
    taskCounts.set(task.vendorId, (taskCounts.get(task.vendorId) ?? 0) + 1);
  }

  const documentCounts = new Map<string, number>();
  for (const document of documents) {
    if (!document.vendorId) continue;
    documentCounts.set(
      document.vendorId,
      (documentCounts.get(document.vendorId) ?? 0) + 1
    );
  }

  const vendorItems = vendors.map((vendor) => ({
    id: vendor.id,
    name: vendor.name,
    company: vendor.company,
    email: vendor.email,
    phone: vendor.phone,
    website: vendor.website,
    address: vendor.address,
    notes: vendor.notes,
    rating: vendor.rating,
    tags: vendor.tags ?? [],
    taskCount: taskCounts.get(vendor.id) ?? 0,
    documentCount: documentCounts.get(vendor.id) ?? 0,
  }));

  const totalTasks = Array.from(taskCounts.values()).reduce((sum, value) => sum + value, 0);
  const totalDocuments = Array.from(documentCounts.values()).reduce(
    (sum, value) => sum + value,
    0
  );

  return (
    <>
      <section>
        <header className="page-header">
          <Handshake
            className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Prestataires</p>
          <h1 className="text-2xl font-semibold sm:whitespace-nowrap">
            Réseau d&apos;artisans et d&apos;entreprises
          </h1>
        </header>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Vue d&apos;ensemble</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="flex items-center justify-between">
              <span>Prestataires enregistrés</span>
              <span className="font-medium text-foreground">{vendors.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Tâches liées</span>
              <span className="font-medium text-foreground">{totalTasks}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Factures ou devis liés</span>
              <span className="font-medium text-foreground">{totalDocuments}</span>
            </div>
            <p>
              Associe un prestataire aux tâches et aux justificatifs pour retrouver
              rapidement l&apos;historique de ses interventions.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6">
        <VendorsManager houseId={houseId} vendors={vendorItems} />
      </section>
    </>
  );
}
