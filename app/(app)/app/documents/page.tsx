import Link from "next/link";
import { FileText, Upload } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { uploadVaultDocument } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { prisma } from "@/lib/db";
import { requireHouse, requireSession } from "@/lib/house";

const documentTypeOptions = [
  "RECEIPT",
  "WARRANTY",
  "INVOICE",
  "QUOTE",
  "OTHER",
] as const;

type DocumentType = (typeof documentTypeOptions)[number];

type DocumentSearchParams = { [key: string]: string | string[] | undefined };

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

function formatDateLabel(value: Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

const documentTypeLabels: Record<DocumentType, string> = {
  RECEIPT: "Reçu",
  WARRANTY: "Garantie",
  INVOICE: "Facture",
  QUOTE: "Devis",
  OTHER: "Document",
};

async function resolveSearchParams(
  searchParams: DocumentSearchParams | Promise<DocumentSearchParams>
) {
  return typeof (searchParams as Promise<DocumentSearchParams>)?.then === "function"
    ? (searchParams as Promise<DocumentSearchParams>)
    : Promise.resolve(searchParams as DocumentSearchParams);
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: DocumentSearchParams | Promise<DocumentSearchParams>;
}) {
  const session = await requireSession();
  const membership = await requireHouse(session.user.id);
  const houseId = membership.houseId;
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const searchQuery = (resolvedSearchParams.q ?? "").toString().trim();
  const selectedTypeRaw = (resolvedSearchParams.type ?? "").toString().trim().toUpperCase();
  const selectedType = documentTypeOptions.includes(selectedTypeRaw as DocumentType)
    ? (selectedTypeRaw as DocumentType)
    : null;

  const documentWhere: Prisma.BudgetDocumentWhereInput = {
    houseId,
  };

  if (selectedType) {
    documentWhere.documentType = selectedType;
  }

  if (searchQuery) {
    documentWhere.OR = [
      { name: { contains: searchQuery, mode: "insensitive" } },
      { supplier: { contains: searchQuery, mode: "insensitive" } },
      { notes: { contains: searchQuery, mode: "insensitive" } },
      { vendor: { name: { contains: searchQuery, mode: "insensitive" } } },
      { vendor: { company: { contains: searchQuery, mode: "insensitive" } } },
      { task: { title: { contains: searchQuery, mode: "insensitive" } } },
      { equipment: { name: { contains: searchQuery, mode: "insensitive" } } },
    ];
  }

  const [documents, vendors, tasks, equipments] = await prisma.$transaction([
    prisma.budgetDocument.findMany({
      where: documentWhere,
      orderBy: [{ createdAt: "desc" }],
      take: 80,
      include: {
        vendor: { select: { id: true, name: true, company: true } },
        task: { select: { id: true, title: true } },
        equipment: { select: { id: true, name: true } },
        uploadedBy: { select: { name: true, email: true } },
      },
    }),
    prisma.vendor.findMany({
      where: { houseId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, company: true },
    }),
    prisma.task.findMany({
      where: { houseId, isTemplate: false },
      orderBy: [{ status: "asc" }, { dueDate: "desc" }, { createdAt: "desc" }],
      take: 60,
      select: { id: true, title: true },
    }),
    prisma.equipment.findMany({
      where: { houseId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <>
      <section>
        <header className="page-header">
          <FileText
            className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Documents</p>
          <h1 className="text-2xl font-semibold sm:whitespace-nowrap">
            Garanties & reçus
          </h1>
        </header>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Ajouter un document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={uploadVaultDocument} className="space-y-4">
              <input type="hidden" name="houseId" value={houseId} />
              <Input
                name="document"
                type="file"
                accept="application/pdf,image/*"
                required
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="documentType" className="text-sm text-muted-foreground">
                    Type
                  </label>
                  <select
                    id="documentType"
                    name="documentType"
                    defaultValue="RECEIPT"
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  >
                    {documentTypeOptions.map((option) => (
                      <option key={option} value={option}>
                        {documentTypeLabels[option]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label htmlFor="issuedOn" className="text-sm text-muted-foreground">
                    Date d&apos;émission (optionnel)
                  </label>
                  <Input id="issuedOn" name="issuedOn" type="date" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="warrantyEndsOn" className="text-sm text-muted-foreground">
                    Fin de garantie (optionnel)
                  </label>
                  <Input id="warrantyEndsOn" name="warrantyEndsOn" type="date" />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="supplier" className="text-sm text-muted-foreground">
                    Fournisseur (optionnel)
                  </label>
                  <Input id="supplier" name="supplier" placeholder="Marque, boutique, artisan" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-2">
                  <label htmlFor="vendorId" className="text-sm text-muted-foreground">
                    Prestataire (optionnel)
                  </label>
                  <select
                    id="vendorId"
                    name="vendorId"
                    defaultValue=""
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
                  <label htmlFor="equipmentId" className="text-sm text-muted-foreground">
                    Équipement (optionnel)
                  </label>
                  <select
                    id="equipmentId"
                    name="equipmentId"
                    defaultValue=""
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
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
              <div className="grid gap-2">
                <label htmlFor="taskId" className="text-sm text-muted-foreground">
                  Tâche liée (optionnel)
                </label>
                <select
                  id="taskId"
                  name="taskId"
                  defaultValue=""
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">—</option>
                  {tasks.map((task) => (
                    <option key={task.id} value={task.id}>
                      {task.title}
                    </option>
                  ))}
                </select>
              </div>
              <Textarea name="notes" rows={3} placeholder="Notes (optionnel)" />
              <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                <span>PDF ou images jusqu&apos;à 20 Mo.</span>
                <Button type="submit" variant="add">
                  <Upload className="h-4 w-4" />
                  Ajouter au coffre
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recherche rapide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <form className="space-y-3" method="get">
              <Input
                name="q"
                defaultValue={searchQuery}
                placeholder="Nom, fournisseur, tâche, équipement..."
              />
              <div className="grid gap-2">
                <label htmlFor="type" className="text-sm text-muted-foreground">
                  Filtrer par type
                </label>
                <select
                  id="type"
                  name="type"
                  defaultValue={selectedType ?? ""}
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                >
                  <option value="">Tous les types</option>
                  {documentTypeOptions.map((option) => (
                    <option key={option} value={option}>
                      {documentTypeLabels[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center justify-end gap-2">
                <Button type="submit" variant="outline">
                  Rechercher
                </Button>
                <Button type="reset" variant="ghost" asChild>
                  <Link href="/app/documents">Réinitialiser</Link>
                </Button>
              </div>
            </form>
            <p>
              {documents.length} document{documents.length > 1 ? "s" : ""} affiché
              {documents.length > 1 ? "s" : ""}.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4">
        {documents.length ? (
          documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="space-y-2 p-4 text-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">
                      {documentTypeLabels[doc.documentType as DocumentType] ?? "Document"} · {doc.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Ajouté le {formatDateLabel(doc.createdAt) ?? "—"}
                      {doc.uploadedBy?.name || doc.uploadedBy?.email
                        ? ` · par ${doc.uploadedBy?.name ?? doc.uploadedBy?.email}`
                        : ""}
                    </p>
                  </div>
                  {doc.path ? (
                    <Link href={doc.path} className="text-xs text-muted-foreground hover:underline">
                      Voir le fichier
                    </Link>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {doc.vendor?.name ? (
                    <span>
                      Prestataire: {doc.vendor.name}
                      {doc.vendor.company ? ` · ${doc.vendor.company}` : ""}
                    </span>
                  ) : null}
                  {doc.supplier ? <span>Fournisseur: {doc.supplier}</span> : null}
                  {doc.issuedOn ? <span>Émis le {formatDate(doc.issuedOn)}</span> : null}
                  {doc.warrantyEndsOn ? (
                    <span>Garantie jusqu&apos;au {formatDate(doc.warrantyEndsOn)}</span>
                  ) : null}
                  {doc.equipment?.name ? <span>Équipement: {doc.equipment.name}</span> : null}
                  {doc.task?.title ? (
                    <span>
                      Tâche: <Link href={`/app/tasks/${doc.task.id}`} className="hover:underline">
                        {doc.task.title}
                      </Link>
                    </span>
                  ) : null}
                </div>
                {doc.notes ? <p className="text-sm text-muted-foreground">{doc.notes}</p> : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Aucun document enregistré pour le moment.
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
