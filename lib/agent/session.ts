import { getServerSession } from "next-auth";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";

export class AgentApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function requireAgentUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new AgentApiError("Non authentifié", 401);
  }
  return session.user.id;
}

export async function requirePrimaryMembership(userId: string) {
  const membership = await prisma.houseMember.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      houseId: true,
      role: true,
      house: {
        select: {
          clientStatus: true,
          isOnboardingCompleted: true,
        },
      },
    },
  });

  if (!membership) {
    throw new AgentApiError("Aucune maison associée à cet utilisateur", 403);
  }

  if (membership.house.clientStatus === "INACTIVE") {
    throw new AgentApiError("Client désactivé", 403);
  }

  if (!membership.house.isOnboardingCompleted) {
    throw new AgentApiError("Onboarding maison incomplet", 403);
  }

  return membership;
}
