import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { acceptHouseInvite } from "@/app/actions";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REVOKED: "Révoquée",
  EXPIRED: "Expirée",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(value);
}

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.houseInvite.findUnique({
    where: { token },
    include: { house: true, createdBy: true },
  });

  if (!invite) {
    notFound();
  }

  if (invite.status === "PENDING" && invite.expiresAt < new Date()) {
    await prisma.houseInvite.update({
      where: { id: invite.id },
      data: { status: "EXPIRED" },
    });
    invite.status = "EXPIRED";
  }

  const session = await getServerSession(authOptions);
  const sessionEmail = session?.user?.email ?? null;
  const emailMatches =
    !sessionEmail || sessionEmail.toLowerCase() === invite.email.toLowerCase();

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 p-6 dark:from-slate-950 dark:to-slate-900">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Invitation à rejoindre {invite.house.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p>
              Invitation envoyée à <strong>{invite.email}</strong> par{" "}
              <strong>
                {invite.createdBy.name || invite.createdBy.email || "Un membre"}
              </strong>
              .
            </p>
            <p className="text-muted-foreground">
              Statut: {statusLabels[invite.status] || invite.status} · Expire le{" "}
              {formatDate(invite.expiresAt)}
            </p>
          </CardContent>
        </Card>

        {invite.status !== "PENDING" ? (
          <Card>
            <CardContent className="space-y-4 pt-6 text-sm">
              <p>
                Cette invitation n&apos;est plus active. Si besoin, demande une
                nouvelle invitation.
              </p>
              <Button asChild variant="outline">
                <Link href="/login">Retour</Link>
              </Button>
            </CardContent>
          </Card>
        ) : !session?.user?.id ? (
          <>
            <Card>
              <CardContent className="space-y-4 pt-6 text-sm">
                <p>Connecte-toi pour accepter l&apos;invitation.</p>
              </CardContent>
            </Card>
            <SignInForm callbackUrl={`/invite/${invite.token}`} variant="card" />
          </>
        ) : !emailMatches ? (
          <Card>
            <CardContent className="space-y-4 pt-6 text-sm">
              <p>
                Tu es connecté avec <strong>{sessionEmail}</strong>. Cette
                invitation est destinée à <strong>{invite.email}</strong>.
              </p>
              <p className="text-muted-foreground">
                Déconnecte-toi puis reconnecte-toi avec la bonne adresse.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <SignOutButton />
                <Button asChild variant="outline" className="w-full sm:w-auto">
                  <Link href="/login">Retour</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-4 pt-6 text-sm">
              <p>
                Tout est prêt. Confirme pour rejoindre{" "}
                <strong>{invite.house.name}</strong>.
              </p>
              <form action={acceptHouseInvite}>
                <input type="hidden" name="token" value={invite.token} />
                <Button type="submit">Rejoindre la maison</Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
