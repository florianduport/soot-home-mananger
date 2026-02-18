import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SootMascot } from "@/components/mascot/soot-mascot";

export const dynamic = "force-dynamic";

export default async function ClientInactivePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.houseMember.findFirst({
    where: { userId: session.user.id },
    include: {
      house: {
        select: {
          name: true,
          clientStatus: true,
          isOnboardingCompleted: true,
          createdBy: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/setup/house");
  }

  if (membership.house.clientStatus === "ACTIVE") {
    if (!membership.house.isOnboardingCompleted) {
      redirect("/setup/house");
    }
    redirect("/app");
  }

  const ownerLabel =
    membership.house.createdBy.name ||
    membership.house.createdBy.email ||
    "le propriétaire principal";

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#f7ecd8] via-[#efe4cf] to-[#dfd0b5] p-6">
      <Card className="w-full max-w-xl border-[#cdb894] bg-[#fbf5e7]">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto">
            <SootMascot mood="sleepy" className="h-14 w-14" />
          </div>
          <CardTitle className="font-serif text-3xl">Client désactivé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-[#4c5b52]">
          <p>
            L&apos;accès à <strong>{membership.house.name}</strong> est temporairement désactivé.
          </p>
          <p>
            La réactivation se fait uniquement via administration interne. Contacte{" "}
            <strong>{ownerLabel}</strong> pour relancer l&apos;abonnement de la maison.
          </p>
          <div className="pt-2">
            <SignOutButton variant="outline" />
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
