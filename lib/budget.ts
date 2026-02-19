import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export const BUDGET_TABLES_UNAVAILABLE_MESSAGE =
  "Le module budget n'est pas encore disponible: lance `npm run db:push` puis recharge la page.";

const monthKeyRegex = /^\d{4}-\d{2}$/;

export function isBudgetTableUnavailableError(error: unknown) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error.code === "P2021" || error.code === "P2022")
  ) {
    return true;
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    const message = error.message.toLowerCase();
    return message.includes("budget");
  }

  if (error instanceof TypeError) {
    const message = error.message.toLowerCase();
    if (message.includes("budget")) {
      return true;
    }
    return (
      message.includes("cannot read properties of undefined") &&
      ["findmany", "findunique", "findfirst", "create", "update", "delete"].some(
        (operation) => message.includes(operation)
      )
    );
  }

  return false;
}

type BudgetRuntimeDelegates = {
  budgetEntry: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  budgetRecurringEntry: {
    findMany: (args: unknown) => Promise<unknown>;
  };
  budgetDocument: {
    create: (args: unknown) => Promise<unknown>;
  };
};

export function getBudgetRuntimeDelegates() {
  const runtimePrisma = prisma as unknown as {
    budgetEntry?: Partial<BudgetRuntimeDelegates["budgetEntry"]>;
    budgetRecurringEntry?: Partial<BudgetRuntimeDelegates["budgetRecurringEntry"]>;
    budgetDocument?: Partial<BudgetRuntimeDelegates["budgetDocument"]>;
  };

  if (
    !runtimePrisma.budgetEntry?.findMany ||
    !runtimePrisma.budgetRecurringEntry?.findMany ||
    !runtimePrisma.budgetDocument?.create
  ) {
    return null;
  }

  return runtimePrisma as unknown as BudgetRuntimeDelegates;
}

export async function withBudgetTablesGuard<T>(action: () => Promise<T>) {
  try {
    return await action();
  } catch (error) {
    if (isBudgetTableUnavailableError(error)) {
      throw new Error(BUDGET_TABLES_UNAVAILABLE_MESSAGE);
    }
    throw error;
  }
}

export function formatEuroFromCents(value: number, locale = "fr-FR") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "EUR",
  }).format(value / 100);
}

export function toMonthKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseMonthKey(raw: string | undefined | null) {
  if (!raw || !monthKeyRegex.test(raw)) return null;
  const [, month] = raw.split("-").map(Number);
  if (month < 1 || month > 12) return null;
  return raw;
}

export function startOfMonthFromKey(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

export function monthRangeFromKey(monthKey: string) {
  const start = startOfMonthFromKey(monthKey);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1, 0, 0, 0, 0);
  return { start, end };
}

export function shiftMonthKey(monthKey: string, delta: number) {
  const start = startOfMonthFromKey(monthKey);
  start.setMonth(start.getMonth() + delta);
  return toMonthKey(start);
}

export function occursInMonth(date: Date, monthKey: string) {
  return toMonthKey(date) === monthKey;
}
