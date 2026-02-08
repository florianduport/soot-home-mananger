import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { SignInForm } from "@/components/auth/sign-in-form";
import { CreateHouseForm } from "@/components/houses/create-house-form";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return <SignInForm />;
  }

  const membership = await prisma.houseMember.findFirst({
    where: { userId: session.user.id },
  });

  if (membership) {
    redirect("/app");
  }

  return <CreateHouseForm />;
}
