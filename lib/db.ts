import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function hasExpectedDelegates(client: PrismaClient) {
  const runtimeClient = client as unknown as {
    shoppingList?: unknown;
    importantDate?: unknown;
    budgetEntry?: unknown;
    budgetRecurringEntry?: unknown;
    budgetDocument?: unknown;
  };

  return (
    runtimeClient.shoppingList &&
    runtimeClient.importantDate &&
    runtimeClient.budgetEntry &&
    runtimeClient.budgetRecurringEntry &&
    runtimeClient.budgetDocument
  );
}

const existing = global.prisma;
const shouldRecreate = existing ? !hasExpectedDelegates(existing) : false;

if (shouldRecreate) {
  void existing?.$disconnect().catch(() => {
    // ignore disconnect error in dev hot-reload scenarios
  });
}

export const prisma =
  shouldRecreate || !existing ? new PrismaClient() : existing;

if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}
