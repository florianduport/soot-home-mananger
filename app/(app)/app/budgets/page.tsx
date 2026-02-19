import Link from "next/link";
import { ArrowLeft, ArrowRight, Landmark } from "lucide-react";
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

function formatExpenseEuroFromCents(amountCents: number) {
  return `-${formatEuroFromCents(Math.abs(amountCents))}`;
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

function formatPercent(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(value);
}

function buildMonthlyItems(
  monthKey: string,
  entries: Array<{
    id: string;
    type: "INCOME" | "EXPENSE";
    source: "MANUAL" | "RECURRING" | "SHOPPING_LIST" | "DOCUMENT";
    label: string;
    amountCents: number;
    occurredOn: Date;
    isForecast: boolean;
    notes: string | null;
    document: { path: string } | null;
  }>,
  recurringEntries: Array<{
    id: string;
    type: "INCOME" | "EXPENSE";
    label: string;
    amountCents: number;
    dayOfMonth: number | null;
    notes: string | null;
    startMonth: Date;
    endMonth: Date | null;
  }>,
  isForecast: boolean
): BudgetListItem[] {
  const { start: monthStart, end: monthEnd } = monthRangeFromKey(monthKey);
  const monthEndInclusive = new Date(monthEnd.getTime() - 1);
  const activeRecurringEntries = recurringEntries.filter((entry) => {
    if (entry.startMonth > monthEndInclusive) return false;
    if (!entry.endMonth) return true;
    return entry.endMonth >= monthStart;
  });

  return [
    ...entries.map((entry) => ({
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
    ...activeRecurringEntries.map((entry) => ({
      id: `recurring-${entry.id}-${monthKey}`,
      persisted: false,
      type: entry.type,
      source: "RECURRING" as const,
      label: entry.label,
      amountCents: entry.amountCents,
      occurredOn: recurringOccurrenceDate(monthKey, entry.dayOfMonth),
      isForecast,
      notes: entry.notes,
      documentPath: null,
    })),
  ];
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
  const defaultEntryDate = dateInputLabel(start);
  const insightsMonths = 6;
  const trendMonths = Array.from({ length: insightsMonths }, (_, index) =>
    shiftMonthKey(selectedMonth, -(insightsMonths - 1 - index))
  );
  const { start: trendStart } = monthRangeFromKey(trendMonths[0]);
  const { end: trendEnd } = monthRangeFromKey(selectedMonth);
  const trendEndInclusive = new Date(trendEnd.getTime() - 1);

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
              gte: trendStart,
              lt: trendEnd,
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
              lte: trendEndInclusive,
            },
            OR: [
              { endMonth: null },
              {
                endMonth: {
                  gte: trendStart,
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
        <header className="page-header">
          <Landmark className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Budgets</p>
          <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Gestion mensuelle</h1>
        </header>
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            {budgetUnavailableMessage}
          </CardContent>
        </Card>
      </>
    );
  }

  const selectedMonthEntries = budgetEntries.filter(
    (entry) => entry.occurredOn >= start && entry.occurredOn < end
  );
  const monthlyItems = buildMonthlyItems(
    selectedMonth,
    selectedMonthEntries,
    recurringEntries,
    selectedMonth > nowMonth
  ).sort((a, b) => {
    if (a.occurredOn.getTime() === b.occurredOn.getTime()) {
      return a.label.localeCompare(b.label, "fr");
    }
    return a.occurredOn.getTime() - b.occurredOn.getTime();
  });

  const nonZeroMonthlyItems = monthlyItems.filter((item) => item.amountCents > 0);
  const incomes = nonZeroMonthlyItems.filter((item) => item.type === "INCOME");
  const expenses = nonZeroMonthlyItems.filter((item) => item.type === "EXPENSE");
  const totalIncomeCents = incomes.reduce((sum, item) => sum + item.amountCents, 0);
  const totalExpenseCents = expenses.reduce((sum, item) => sum + item.amountCents, 0);
  const totalForecastExpenseCents = expenses
    .filter((item) => item.isForecast)
    .reduce((sum, item) => sum + item.amountCents, 0);
  const balanceCents = totalIncomeCents - totalExpenseCents;
  const halfBalanceCents = balanceCents / 2;
  const expenseAmountColorClass = (amountCents: number) => {
    if (amountCents < halfBalanceCents) return "text-emerald-600";
    if (amountCents <= balanceCents) return "text-amber-500";
    return "text-rose-600";
  };
  const trendData = trendMonths.map((monthKey) => {
    const { start: monthStart, end: monthEnd } = monthRangeFromKey(monthKey);
    const entries = budgetEntries.filter(
      (entry) => entry.occurredOn >= monthStart && entry.occurredOn < monthEnd
    );
    const items = buildMonthlyItems(
      monthKey,
      entries,
      recurringEntries,
      monthKey > nowMonth
    );
    const itemsWithAmounts = items.filter((item) => item.amountCents > 0);
    const income = itemsWithAmounts
      .filter((item) => item.type === "INCOME")
      .reduce((sum, item) => sum + item.amountCents, 0);
    const expense = itemsWithAmounts
      .filter((item) => item.type === "EXPENSE")
      .reduce((sum, item) => sum + item.amountCents, 0);
    return {
      monthKey,
      income,
      expense,
      balance: income - expense,
      label: monthLabel(monthKey),
    };
  });
  const maxExpenseCents = Math.max(
    1,
    ...trendData.map((item) => item.expense)
  );
  const selectedTrend = trendData[trendData.length - 1];
  const previousTrend = trendData[trendData.length - 2];
  const expenseDelta = previousTrend
    ? selectedTrend.expense - previousTrend.expense
    : 0;
  const incomeDelta = previousTrend
    ? selectedTrend.income - previousTrend.income
    : 0;
  const expenseDeltaPercent = previousTrend?.expense
    ? expenseDelta / previousTrend.expense
    : null;
  const incomeDeltaPercent = previousTrend?.income
    ? incomeDelta / previousTrend.income
    : null;
  const rollingAverageSource = trendData
    .slice(Math.max(0, trendData.length - 3))
    .map((item) => item.expense);
  const rollingAverageExpense =
    rollingAverageSource.reduce((sum, item) => sum + item, 0) /
    Math.max(1, rollingAverageSource.length);
  const overspendAlerts = [
    totalExpenseCents > totalIncomeCents
      ? `Dépenses supérieures aux revenus de ${formatEuroFromCents(
          totalExpenseCents - totalIncomeCents
        )}`
      : null,
    expenseDeltaPercent && expenseDeltaPercent > 0.2
      ? `Dépenses en hausse de ${formatPercent(expenseDeltaPercent)} vs mois précédent`
      : null,
    rollingAverageExpense > 0 &&
    totalExpenseCents > rollingAverageExpense * 1.15
      ? `Dépenses supérieures de ${formatPercent(
          totalExpenseCents / rollingAverageExpense - 1
        )} à la moyenne des 3 derniers mois`
      : null,
  ].filter(Boolean);

  return (
    <>
      <section className="flex flex-col gap-4">
        <header className="page-header flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Landmark
              className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">Budgets</p>
            <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Gestion mensuelle</h1>
          </div>
          <BudgetActionsMenu
            houseId={houseId}
            selectedMonth={selectedMonth}
            defaultEntryDate={defaultEntryDate}
          />
        </header>
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
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end justify-between gap-2">
              {trendData.map((item) => {
                const height = Math.max(
                  12,
                  Math.round((item.expense / maxExpenseCents) * 72)
                );
                const isSelected = item.monthKey === selectedMonth;
                return (
                  <div key={item.monthKey} className="flex w-full flex-col items-center">
                    <div
                      className={`w-full rounded-full ${
                        isSelected ? "bg-rose-500/80" : "bg-muted"
                      }`}
                      style={{ height }}
                      title={`${item.label}: ${formatExpenseEuroFromCents(
                        item.expense
                      )}`}
                    />
                    <span className="mt-2 text-[11px] text-muted-foreground">
                      {item.label.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-muted-foreground">
              Tendances des 6 derniers mois (dépenses).
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Variations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Dépenses</p>
                <p className="text-xs text-muted-foreground">
                  {previousTrend ? "Vs mois précédent" : "Pas de mois précédent"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {formatExpenseEuroFromCents(totalExpenseCents)}
                </p>
                <p
                  className={`text-xs ${
                    expenseDelta >= 0 ? "text-rose-600" : "text-emerald-600"
                  }`}
                >
                  {previousTrend
                    ? `${expenseDelta >= 0 ? "+" : "-"}${formatEuroFromCents(
                        Math.abs(expenseDelta)
                      )} (${formatPercent(Math.abs(expenseDeltaPercent ?? 0))})`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Revenus</p>
                <p className="text-xs text-muted-foreground">
                  {previousTrend ? "Vs mois précédent" : "Pas de mois précédent"}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-emerald-600">
                  {formatEuroFromCents(totalIncomeCents)}
                </p>
                <p
                  className={`text-xs ${
                    incomeDelta >= 0 ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {previousTrend
                    ? `${incomeDelta >= 0 ? "+" : ""}${formatEuroFromCents(
                        incomeDelta
                      )} (${formatPercent(Math.abs(incomeDeltaPercent ?? 0))})`
                    : "—"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <div>
                <p className="font-medium">Solde</p>
                <p className="text-xs text-muted-foreground">Du mois sélectionné</p>
              </div>
              <p
                className={`font-semibold ${
                  balanceCents >= 0 ? "text-emerald-600" : "text-rose-600"
                }`}
              >
                {formatEuroFromCents(balanceCents)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alertes</CardTitle>
          </CardHeader>
          <CardContent>
            {overspendAlerts.length ? (
              <ul className="space-y-3 text-sm">
                {overspendAlerts.map((alert) => (
                  <li key={alert} className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="font-medium text-rose-700">{alert}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                Aucune alerte de dépassement détectée.
              </p>
            )}
          </CardContent>
        </Card>
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
              {formatExpenseEuroFromCents(totalExpenseCents)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dépenses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-semibold ${expenseAmountColorClass(totalExpenseCents)}`}>
              {formatExpenseEuroFromCents(totalExpenseCents)}
            </p>
            <p
              className={`mt-2 text-xs ${expenseAmountColorClass(totalForecastExpenseCents)}`}
            >
              Anticipées: {formatExpenseEuroFromCents(totalForecastExpenseCents)}
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
                        <p
                          className={`font-semibold ${expenseAmountColorClass(item.amountCents)}`}
                        >
                          {formatExpenseEuroFromCents(item.amountCents)}
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
