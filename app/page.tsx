import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { SootLanding } from "@/components/landing/soot-landing";

export const dynamic = "force-dynamic";

export default async function LandingPage() {
  const session = await getServerSession(authOptions);

  if (session?.user?.id) {
    const membership = await prisma.houseMember.findFirst({
      where: { userId: session.user.id },
      include: {
        house: {
          select: {
            clientStatus: true,
            isOnboardingCompleted: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    if (!membership) {
      redirect("/setup/house");
    }

    if (membership.house.clientStatus === "INACTIVE") {
      redirect("/client-inactif");
    }

    if (!membership.house.isOnboardingCompleted) {
      redirect("/setup/house");
    }

    redirect("/app");
  }

  return <SootLanding />;
}
