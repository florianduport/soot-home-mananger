import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/auth";
import { prisma } from "@/lib/db";
import { ensureRecurringTasks } from "@/lib/recurrence";
import { ensureTaskReminders } from "@/lib/notifications";

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

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/");
  }
  return session;
}

export async function requireHouse(userId: string) {
  const membership = await prisma.houseMember.findFirst({
    where: { userId },
    include: { house: true },
  });

  if (!membership) {
    redirect("/");
  }

  return membership;
}

export async function getHouseData(userId: string) {
  const membership = await requireHouse(userId);
  const houseId = membership.houseId;

  await ensureRecurringTasks(houseId);
  await ensureTaskReminders(houseId);

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
    await prisma.$transaction([
    prisma.zone.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
    prisma.category.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
    prisma.animal.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
    prisma.person.findMany({ where: { houseId }, orderBy: { name: "asc" } }),
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
