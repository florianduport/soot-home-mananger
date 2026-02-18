import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { SignInForm } from "@/components/auth/sign-in-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return <SignInForm callbackUrl="/app" />;
  }

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
