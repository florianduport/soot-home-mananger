import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureRecurringTasks } from "@/lib/recurrence";

type ShoppingListWithItems = Prisma.ShoppingListGetPayload<{
  include: { items: true };
}>;

type ShoppingListRuntimeDelegate = {
  findMany: (args: {
    where: { houseId: string };
    orderBy: { createdAt: "asc" };
    include: { items: { orderBy: { createdAt: "asc" } } };
  }) => Promise<ShoppingListWithItems[]>;
};

type ImportantDateRecord = Prisma.ImportantDateGetPayload<Record<string, never>>;

type ImportantDateRuntimeDelegate = {
  findMany: (args: {
    where: { houseId: string };
    orderBy: Array<{ date: "asc" } | { title: "asc" }>;
  }) => Promise<ImportantDateRecord[]>;
};

function getShoppingListDelegate() {
  const runtimePrisma = prisma as unknown as {
    shoppingList?: ShoppingListRuntimeDelegate;
  };
  return runtimePrisma.shoppingList;
}

function getImportantDateDelegate() {
  const runtimePrisma = prisma as unknown as {
    importantDate?: ImportantDateRuntimeDelegate;
  };
  return runtimePrisma.importantDate;
}

function isShoppingTableUnavailableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  );
}

function isImportantDateUnavailableError(error: unknown) {
  return (
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2021" || error.code === "P2022")) ||
    (error instanceof TypeError &&
      error.message.toLowerCase().includes("importantdate"))
  );
}

function isAvatarColumnUnavailableError(error: unknown, entity: "animal" | "person") {
  const entityToken = entity.toLowerCase();

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code !== "P2021" && error.code !== "P2022") {
      return false;
    }

    const meta = error.meta as { column?: unknown } | undefined;
    const column = typeof meta?.column === "string" ? meta.column.toLowerCase() : "";
    const message = error.message.toLowerCase();

    return (
      column.includes("imageurl") ||
      (message.includes("imageurl") && message.includes(entityToken))
    );
  }

  return false;
}

async function loadAnimalsWithAvatarFallback(houseId: string) {
  try {
    return await prisma.animal.findMany({
      where: { houseId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        houseId: true,
        name: true,
        species: true,
        imageUrl: true,
        birthDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (!isAvatarColumnUnavailableError(error, "animal")) {
      throw error;
    }

    const fallback = await prisma.animal.findMany({
      where: { houseId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        houseId: true,
        name: true,
        species: true,
        birthDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return fallback.map((animal) => ({ ...animal, imageUrl: null as string | null }));
  }
}

async function loadPeopleWithAvatarFallback(houseId: string) {
  try {
    return await prisma.person.findMany({
      where: { houseId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        houseId: true,
        name: true,
        relation: true,
        imageUrl: true,
        birthDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (error) {
    if (!isAvatarColumnUnavailableError(error, "person")) {
      throw error;
    }

    const fallback = await prisma.person.findMany({
      where: { houseId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        houseId: true,
        name: true,
        relation: true,
        birthDate: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return fallback.map((person) => ({ ...person, imageUrl: null as string | null }));
  }
}

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }
  return session;
}

export async function requireHouse(
  userId: string,
  options?: {
    allowInactive?: boolean;
    allowIncompleteOnboarding?: boolean;
  }
) {
  const membership = await prisma.houseMember.findFirst({
    where: { userId },
    include: { house: true },
    orderBy: { createdAt: "asc" },
  });

  if (!membership) {
    redirect("/setup/house");
  }

  if (!options?.allowInactive && membership.house.clientStatus === "INACTIVE") {
    redirect("/client-inactif");
  }

  if (
    !options?.allowIncompleteOnboarding &&
    !membership.house.isOnboardingCompleted
  ) {
    redirect("/setup/house");
  }

  return membership;
}

export async function requirePrincipalOwner(userId: string, houseId: string) {
  const house = await prisma.house.findUnique({
    where: { id: houseId },
    select: {
      id: true,
      createdById: true,
      clientStatus: true,
    },
  });

  if (!house) {
    redirect("/setup/house");
  }

  if (house.clientStatus === "INACTIVE") {
    redirect("/client-inactif");
  }

  if (house.createdById !== userId) {
    redirect("/app");
  }

  const membership = await prisma.houseMember.findFirst({
    where: {
      userId,
      houseId,
    },
    include: { house: true },
  });

  if (!membership) {
    redirect("/setup/house");
  }

  return membership;
}

export async function getHouseData(userId: string) {
  const membership = await requireHouse(userId);
  const houseId = membership.houseId;

  await ensureRecurringTasks(houseId);

  let shoppingListsReady = true;
  let shoppingLists: ShoppingListWithItems[] = [];
  const shoppingListDelegate = getShoppingListDelegate();
  let importantDates: ImportantDateRecord[] = [];
  const importantDateDelegate = getImportantDateDelegate();

  if (shoppingListDelegate?.findMany) {
    try {
      shoppingLists = await shoppingListDelegate.findMany({
        where: { houseId },
        orderBy: { createdAt: "asc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
          },
        },
      });
    } catch (error) {
      if (isShoppingTableUnavailableError(error)) {
        shoppingListsReady = false;
      } else {
        throw error;
      }
    }
  } else {
    shoppingListsReady = false;
  }

  if (importantDateDelegate?.findMany) {
    try {
      importantDates = await importantDateDelegate.findMany({
        where: { houseId },
        orderBy: [{ date: "asc" }, { title: "asc" }],
      });
    } catch (error) {
      if (!isImportantDateUnavailableError(error)) {
        throw error;
      }
    }
  }

  const [zones, categories, animals, people, equipments, projects, members, invites, tasks, suggestions] =
    await Promise.all([
    prisma.zone.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
    loadAnimalsWithAvatarFallback(houseId),
    loadPeopleWithAvatarFallback(houseId),
    prisma.equipment.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
    prisma.project.findMany({ where: { houseId }, orderBy: { createdAt: "desc" } }),
    prisma.houseMember.findMany({
      where: { houseId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.houseInvite.findMany({
      where: { houseId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.task.findMany({
      where: { houseId, isTemplate: false },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      include: {
        zone: true,
        category: true,
        equipment: true,
        project: true,
        animal: true,
        person: true,
        parent: true,
        assignee: true,
      },
    }),
    prisma.taskSuggestion.findMany({
      where: { houseId },
      orderBy: { createdAt: "desc" },
      include: {
        zone: true,
        category: true,
        project: true,
        equipment: true,
      },
    }),
  ]);

  return {
    membership,
    houseId,
    zones,
    categories,
    animals,
    people,
    equipments,
    projects,
    shoppingLists,
    shoppingListsReady,
    members,
    invites,
    tasks,
    suggestions,
    importantDates,
  };
}
