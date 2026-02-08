import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import {
  deleteBudgetEntry,
} from "@/app/actions";
import {
  formatEuroFromCents,
  getBudgetRuntimeDelegates,
  isBudgetTableUnavailableError,
  monthRangeFromKey,
  parseMonthKey,
  shiftMonthKey,
  toMonthKey,
  withBudgetTablesGuard,
} from "@/lib/budget";
import { requireHouse, requireSession } from "@/lib/house";
import { Badge } from "@/components/ui/badge";
import { BudgetActionsMenu } from "@/components/budgets/budget-actions-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BudgetSearchParams = { [key: string]: string | string[] | undefined };

type BudgetListItem = {
  id: string;
  persisted: boolean;
  type: "INCOME" | "EXPENSE";
  source: "MANUAL" | "RECURRING" | "SHOPPING_LIST" | "DOCUMENT";
  label: string;
  amountCents: number;
  occurredOn: Date;
  isForecast: boolean;
  notes: string | null;
  documentPath: string | null;
};

function resolveSearchParams(
  searchParams: BudgetSearchParams | Promise<BudgetSearchParams>
) {
  return typeof (searchParams as Promise<BudgetSearchParams>)?.then === "function"
    ? (searchParams as Promise<BudgetSearchParams>)
    : Promise.resolve(searchParams as BudgetSearchParams);
}

function monthLabel(monthKey: string) {
  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, 1));
}

function dateInputLabel(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

function sourceLabel(source: BudgetListItem["source"]) {
  if (source === "RECURRING") return "Récurrent";
  if (source === "SHOPPING_LIST") return "Liste d'achat";
  if (source === "DOCUMENT") return "Document";
  return "Manuel";
}

function recurringOccurrenceDate(
  monthKey: string,
  dayOfMonth: number | null
) {
  const [year, month] = monthKey.split("-").map(Number);
  const maxDay = new Date(year, month, 0).getDate();
  const day = Math.max(1, Math.min(dayOfMonth || 1, maxDay));
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: BudgetSearchParams | Promise<BudgetSearchParams>;
}) {
  const session = await requireSession();
  const membership = await requireHouse(session.user.id);
  const houseId = membership.houseId;
  const resolvedSearchParams = await resolveSearchParams(searchParams);

  const selectedMonth =
    parseMonthKey((resolvedSearchParams.month ?? "").toString()) ||
    toMonthKey(new Date());
  const { start, end } = monthRangeFromKey(selectedMonth);
  const previousMonth = shiftMonthKey(selectedMonth, -1);
  const nextMonth = shiftMonthKey(selectedMonth, 1);
  const monthEndInclusive = new Date(end.getTime() - 1);
  const nowMonth = toMonthKey(new Date());
  const recurringIsForecast = selectedMonth > nowMonth;
  const defaultEntryDate = dateInputLabel(start);

  let budgetEntries: Array<{
    id: string;
    type: "INCOME" | "EXPENSE";
    source: "MANUAL" | "RECURRING" | "SHOPPING_LIST" | "DOCUMENT";
    label: string;
    amountCents: number;
    occurredOn: Date;
    isForecast: boolean;
    notes: string | null;
    document: { path: string } | null;
  }> = [];
  let recurringEntries: Array<{
    id: string;
    type: "INCOME" | "EXPENSE";
    label: string;
    amountCents: number;
    dayOfMonth: number | null;
    notes: string | null;
    startMonth: Date;
    endMonth: Date | null;
  }> = [];
  let budgetUnavailableMessage = "";

  try {
    const budgetDelegates = getBudgetRuntimeDelegates();
    if (!budgetDelegates) {
      throw new Error(
        "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
      );
    }

    [budgetEntries, recurringEntries] = await Promise.all([
      withBudgetTablesGuard(() =>
        budgetDelegates.budgetEntry.findMany({
          where: {
            houseId,
            occurredOn: {
              gte: start,
              lt: end,
            },
          },
          orderBy: [{ occurredOn: "asc" }, { createdAt: "asc" }],
          include: {
            document: {
              select: { path: true },
            },
          },
        }) as Promise<typeof budgetEntries>
      ),
      withBudgetTablesGuard(() =>
        budgetDelegates.budgetRecurringEntry.findMany({
          where: {
            houseId,
            startMonth: {
              lte: monthEndInclusive,
            },
            OR: [
              { endMonth: null },
              {
                endMonth: {
                  gte: start,
                },
              },
            ],
          },
          orderBy: [{ type: "asc" }, { label: "asc" }],
        }) as Promise<typeof recurringEntries>
      ),
    ]);
  } catch (error) {
    if (isBudgetTableUnavailableError(error)) {
      budgetUnavailableMessage =
        "Le module budget n'est pas encore disponible: lance `npm run db:push` puis recharge la page.";
    } else if (
      error instanceof Error &&
      error.message.toLowerCase().includes("module budget")
    ) {
      budgetUnavailableMessage = error.message;
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw error;
    }
  }

  if (budgetUnavailableMessage) {
    return (
      <>
        <header>
          <p className="text-sm text-muted-foreground">Budgets</p>
          <h1 className="text-2xl font-semibold">Gestion mensuelle</h1>
        </header>
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {budgetUnavailableMessage}
          </CardContent>
        </Card>
      </>
    );
  }

  const monthlyItems: BudgetListItem[] = [
    ...budgetEntries.map((entry) => ({
      id: entry.id,
      persisted: true,
      type: entry.type,
      source: entry.source,
      label: entry.label,
      amountCents: entry.amountCents,
      occurredOn: entry.occurredOn,
      isForecast: entry.isForecast,
      notes: entry.notes,
      documentPath: entry.document?.path ?? null,
    })),
    ...recurringEntries.map((entry) => ({
      id: `recurring-${entry.id}-${selectedMonth}`,
      persisted: false,
      type: entry.type,
      source: "RECURRING" as const,
      label: entry.label,
      amountCents: entry.amountCents,
      occurredOn: recurringOccurrenceDate(selectedMonth, entry.dayOfMonth),
      isForecast: recurringIsForecast,
      notes: entry.notes,
      documentPath: null,
    })),
  ].sort((a, b) => {
    if (a.occurredOn.getTime() === b.occurredOn.getTime()) {
      return a.label.localeCompare(b.label, "fr");
    }
    return a.occurredOn.getTime() - b.occurredOn.getTime();
  });

  const incomes = monthlyItems.filter((item) => item.type === "INCOME");
  const expenses = monthlyItems.filter((item) => item.type === "EXPENSE");
  const totalIncomeCents = incomes.reduce((sum, item) => sum + item.amountCents, 0);
  const totalExpenseCents = expenses.reduce((sum, item) => sum + item.amountCents, 0);
  const totalForecastExpenseCents = expenses
    .filter((item) => item.isForecast)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const balanceCents = totalIncomeCents - totalExpenseCents;

  return (
    <>
      <section className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <header>
            <p className="text-sm text-muted-foreground">Budgets</p>
            <h1 className="text-2xl font-semibold">Gestion mensuelle</h1>
          </header>
          <BudgetActionsMenu
            houseId={houseId}
            selectedMonth={selectedMonth}
            defaultEntryDate={defaultEntryDate}
          />
        </div>
        <div className="flex w-full items-center justify-center gap-2">
          <div className="flex min-w-0 w-full items-center gap-2 sm:max-w-[260px]">
            <Button asChild variant="outline" size="icon" className="rounded-full">
              <Link href={`/app/budgets?month=${previousMonth}`} aria-label="Mois précédent">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div className="min-w-0 flex-1 text-center text-sm font-medium text-foreground">
              {monthLabel(selectedMonth)}
            </div>
            <Button asChild variant="outline" size="icon" className="rounded-full">
              <Link href={`/app/budgets?month=${nextMonth}`} aria-label="Mois suivant">
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Solde</CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={`text-2xl font-semibold ${
                balanceCents >= 0 ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              {formatEuroFromCents(balanceCents)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Revenus {formatEuroFromCents(totalIncomeCents)} • Dépenses{" "}
              {formatEuroFromCents(totalExpenseCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-rose-600">
              {formatEuroFromCents(totalExpenseCents)}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Anticipées: {formatEuroFromCents(totalForecastExpenseCents)}
            </p>

            {expenses.length ? (
              <ul className="mt-4 space-y-3 border-t pt-4">
                {expenses.map((item) => (
                  <li key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.occurredOn)} • {sourceLabel(item.source)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.isForecast ? (
                            <Badge variant="outline">Anticipée</Badge>
                          ) : null}
                          {!item.persisted ? (
                            <Badge variant="outline">Calculée via récurrence</Badge>
                          ) : null}
                        </div>
                        {item.documentPath ? (
                          <Link
                            href={item.documentPath}
                            target="_blank"
                            className="inline-flex text-xs text-primary underline"
                          >
                            Ouvrir le justificatif
                          </Link>
                        ) : null}
                        {item.notes ? (
                          <p className="text-xs text-muted-foreground">{item.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-semibold text-rose-600">
                          {formatEuroFromCents(item.amountCents)}
                        </p>
                        {item.persisted ? (
                          <form action={deleteBudgetEntry}>
                            <input type="hidden" name="entryId" value={item.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Supprimer
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                Aucune dépense pour ce mois.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenus</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-emerald-600">
              {formatEuroFromCents(totalIncomeCents)}
            </p>

            {incomes.length ? (
              <ul className="mt-4 space-y-3 border-t pt-4">
                {incomes.map((item) => (
                  <li key={item.id} className="rounded-lg border p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <p className="font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(item.occurredOn)} • {sourceLabel(item.source)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.isForecast ? (
                            <Badge variant="outline">Anticipé</Badge>
                          ) : null}
                          {!item.persisted ? (
                            <Badge variant="outline">Calculé via récurrence</Badge>
                          ) : null}
                        </div>
                        {item.notes ? (
                          <p className="text-xs text-muted-foreground">{item.notes}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <p className="font-semibold text-emerald-600">
                          {formatEuroFromCents(item.amountCents)}
                        </p>
                        {item.persisted ? (
                          <form action={deleteBudgetEntry}>
                            <input type="hidden" name="entryId" value={item.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Supprimer
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">
                Aucun revenu pour ce mois.
              </p>
            )}
          </CardContent>
        </Card>
      </section>

    </>
  );
}
