import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { CreateHouseForm } from "@/components/houses/create-house-form";

export const dynamic = "force-dynamic";

export default async function SetupHousePage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login");
  }

  const membership = await prisma.houseMember.findFirst({
    where: { userId: session.user.id },
    include: {
      house: {
        select: {
          id: true,
          name: true,
          clientStatus: true,
          isOnboardingCompleted: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (membership?.house.clientStatus === "INACTIVE") {
    redirect("/client-inactif");
  }

  if (membership?.house.isOnboardingCompleted) {
    redirect("/app");
  }

  return (
    <CreateHouseForm
      userDisplayName={session.user.name}
      existingHouseId={membership?.house.id}
      existingHouseName={membership?.house.name}
    />
  );
}
