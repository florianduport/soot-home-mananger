import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/house";
import { Handshake } from "lucide-react";

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(value);
}

const documentTypeLabels: Record<string, string> = {
  INVOICE: "Facture",
  QUOTE: "Devis",
  RECEIPT: "Reçu",
  OTHER: "Document",
};

type VendorParams = { vendorId: string };

type VendorSearchParams = { [key: string]: string | string[] | undefined };

async function resolveParams(params: VendorParams | Promise<VendorParams>) {
  return typeof (params as Promise<VendorParams>)?.then === "function"
    ? (params as Promise<VendorParams>)
    : Promise.resolve(params as VendorParams);
}

async function resolveSearchParams(
  searchParams: VendorSearchParams | Promise<VendorSearchParams>
) {
  return typeof (searchParams as Promise<VendorSearchParams>)?.then === "function"
    ? (searchParams as Promise<VendorSearchParams>)
    : Promise.resolve(searchParams as VendorSearchParams);
}

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: VendorParams | Promise<VendorParams>;
  searchParams: VendorSearchParams | Promise<VendorSearchParams>;
}) {
  const resolvedParams = await resolveParams(params);
  await resolveSearchParams(searchParams);
  const session = await requireSession();

  const vendor = await prisma.vendor.findUnique({
    where: { id: resolvedParams.vendorId },
    include: {
      tasks: {
        where: { isTemplate: false },
        orderBy: [{ status: "asc" }, { dueDate: "desc" }],
        take: 12,
        select: {
          id: true,
          title: true,
          status: true,
          dueDate: true,
          project: { select: { name: true } },
          equipment: { select: { name: true } },
        },
      },
      documents: {
        orderBy: { issuedOn: "desc" },
        take: 12,
        select: {
          id: true,
          name: true,
          documentType: true,
          issuedOn: true,
          path: true,
        },
      },
    },
  });

  if (!vendor) {
    notFound();
  }

  const membership = await prisma.houseMember.findFirst({
    where: { houseId: vendor.houseId, userId: session.user.id },
  });

  if (!membership) {
    redirect("/app");
  }

  return (
    <>
      <section>
        <header className="page-header">
          <Handshake
            className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            <Link href="/app/vendors" className="hover:underline">
              Prestataires
            </Link>
          </p>
          <h1 className="text-2xl font-semibold">{vendor.name}</h1>
          <p className="text-sm text-muted-foreground">
            {vendor.company ?? "Entreprise non renseignée"}
          </p>
        </header>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Profil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="grid gap-2 sm:grid-cols-2">
              <span>Email: {vendor.email ?? "—"}</span>
              <span>Téléphone: {vendor.phone ?? "—"}</span>
              <span>Site web: {vendor.website ?? "—"}</span>
              <span>Adresse: {vendor.address ?? "—"}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {vendor.tags.length ? (
                vendor.tags.map((tag) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))
              ) : (
                <span>Tags: —</span>
              )}
              {vendor.rating ? <span>Note: {vendor.rating}/5</span> : null}
            </div>
            {vendor.notes ? <p>{vendor.notes}</p> : <p>Notes: —</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Historique des interventions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {vendor.tasks.length ? (
              vendor.tasks.map((task) => (
                <div key={task.id} className="rounded-lg border p-3">
                  <Link
                    href={`/app/tasks/${task.id}`}
                    className="font-medium hover:underline"
                  >
                    {task.title}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>Statut: {task.status === "DONE" ? "Terminée" : "À faire"}</span>
                    <span>Échéance: {formatDate(task.dueDate)}</span>
                    {task.project?.name ? <span>Projet: {task.project.name}</span> : null}
                    {task.equipment?.name ? <span>Équipement: {task.equipment.name}</span> : null}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucune tâche liée pour le moment.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Factures et devis</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {vendor.documents.length ? (
              vendor.documents.map((doc) => (
                <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div>
                    <p className="font-medium">
                      {documentTypeLabels[doc.documentType] ?? "Document"} · {doc.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Émis le {formatDate(doc.issuedOn)}
                    </p>
                  </div>
                  {doc.path ? (
                    <Link href={doc.path} className="text-xs text-muted-foreground hover:underline">
                      Voir le fichier
                    </Link>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">Aucun document lié pour le moment.</p>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
}
