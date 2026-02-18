import {
  addShoppingListItem,
  createShoppingList,
  deleteShoppingListItem,
} from "@/app/actions";
import { Plus, ShoppingCart, Trash2 } from "lucide-react";
import {
  formatEuroFromCents,
  getBudgetRuntimeDelegates,
  isBudgetTableUnavailableError,
  withBudgetTablesGuard,
} from "@/lib/budget";
import { PendingEstimatesRefresher } from "@/components/shopping/pending-estimates-refresher";
import { ShoppingListActionsMenu } from "@/components/shopping/shopping-list-actions-menu";
import { ShoppingItemToggle } from "@/components/shopping/shopping-item-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getHouseData, requireSession } from "@/lib/house";

type ShoppingSearchParams = { [key: string]: string | string[] | undefined };

function resolveSearchParams(
  searchParams: ShoppingSearchParams | Promise<ShoppingSearchParams>
) {
  return typeof (searchParams as Promise<ShoppingSearchParams>)?.then === "function"
    ? (searchParams as Promise<ShoppingSearchParams>)
    : Promise.resolve(searchParams as ShoppingSearchParams);
}

function buildProgressLabel(
  total: number,
  completed: number
) {
  if (!total) {
    return "Aucun article";
  }
  return `${completed}/${total} fait${completed > 1 ? "s" : ""}`;
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function amountInputFromCents(value?: number | null) {
  if (value == null) return "";
  return (value / 100).toFixed(2);
}

export default async function ShoppingListsPage({
  searchParams,
}: {
  searchParams: ShoppingSearchParams | Promise<ShoppingSearchParams>;
}) {
  const resolvedSearchParams = await resolveSearchParams(searchParams);
  const createOpen = (resolvedSearchParams.create ?? "").toString() === "1";
  const session = await requireSession();
  const { houseId, shoppingLists, shoppingListsReady } = await getHouseData(
    session.user.id
  );
  const todayInput = toDateInputValue(new Date());
  const hasPendingEstimates = shoppingLists.some((shoppingList) =>
    shoppingList.items.some((item) => item.estimatedCostCents == null)
  );
  const allShoppingListIds = shoppingLists.map((shoppingList) => shoppingList.id);
  let budgetConversionReady = true;
  const convertedExpensesByShoppingListId = new Map<
    string,
    { amountCents: number; occurredOn: Date }
  >();

  if (allShoppingListIds.length > 0) {
    try {
      const budgetDelegates = getBudgetRuntimeDelegates();
      if (!budgetDelegates) {
        throw new Error(
          "Le module budget n'est pas encore disponible: lance `npm run db:push` puis redémarre le serveur."
        );
      }

      const convertedEntries = await withBudgetTablesGuard(() =>
        budgetDelegates.budgetEntry.findMany({
          where: {
            houseId,
            shoppingListId: {
              in: allShoppingListIds,
            },
          },
          select: {
            shoppingListId: true,
            amountCents: true,
            occurredOn: true,
          },
        }) as Promise<
          Array<{
            shoppingListId: string | null;
            amountCents: number;
            occurredOn: Date;
          }>
        >
      );

      for (const entry of convertedEntries) {
        if (!entry.shoppingListId) continue;
        convertedExpensesByShoppingListId.set(entry.shoppingListId, {
          amountCents: entry.amountCents,
          occurredOn: entry.occurredOn,
        });
      }
    } catch (error) {
      if (
        isBudgetTableUnavailableError(error) ||
        (error instanceof Error &&
          error.message.toLowerCase().includes("module budget"))
      ) {
        budgetConversionReady = false;
      } else {
        throw error;
      }
    }
  }

  if (!shoppingListsReady) {
    return (
      <>
        <header className="page-header">
          <ShoppingCart
            className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">Listes d&apos;achats</p>
          <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Courses et achats</h1>
        </header>
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            Les listes d&apos;achats ne sont pas encore disponibles sur cette
            instance. Lance <code>npm run db:push</code>, puis redémarre le
            serveur.
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PendingEstimatesRefresher enabled={hasPendingEstimates} />
      <section>
        <input
          id="create-shopping-list"
          type="checkbox"
          className="peer sr-only"
          defaultChecked={createOpen}
        />
        <header className="page-header flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <ShoppingCart
              className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="text-sm text-muted-foreground">Listes d&apos;achats</p>
            <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Courses et achats</h1>
          </div>
          <label
            htmlFor="create-shopping-list"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90"
            title="Créer une liste"
          >
            <Plus className="h-4 w-4" />
            <span className="sr-only">Créer une liste</span>
          </label>
        </header>
        <div className="mt-4 hidden peer-checked:block">
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle liste</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                action={createShoppingList}
                className="flex flex-col gap-2 sm:flex-row sm:flex-wrap"
              >
                <input type="hidden" name="houseId" value={houseId} />
                <Input
                  name="name"
                  placeholder="Ex: Courses de la semaine"
                  className="w-full sm:flex-1"
                  required
                />
                <Button
                  type="submit"
                  variant="add"
                  className="w-full rounded-full sm:w-auto"
                >
                  Créer la liste
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4">
        {shoppingLists.length ? (
          shoppingLists.map((shoppingList) => {
            const converted = convertedExpensesByShoppingListId.get(shoppingList.id);
            const completedCount = shoppingList.items.filter(
              (item) => item.completed
            ).length;
            const hasPendingCost = shoppingList.items.some(
              (item) => !item.completed && item.estimatedCostCents == null
            );
            const remainingEstimatedCostCents = shoppingList.items.reduce(
              (total, item) =>
                item.completed ? total : total + (item.estimatedCostCents ?? 0),
              0
            );

            return (
              <Card key={shoppingList.id}>
                <CardHeader>
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle>{shoppingList.name}</CardTitle>
                      <ShoppingListActionsMenu
                        shoppingListId={shoppingList.id}
                        shoppingListName={shoppingList.name}
                        budgetConversionReady={budgetConversionReady}
                        alreadyConverted={Boolean(converted)}
                        defaultAmount={amountInputFromCents(remainingEstimatedCostCents)}
                        defaultDate={todayInput}
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="outline">
                        {buildProgressLabel(shoppingList.items.length, completedCount)}
                      </Badge>
                      <Badge variant="secondary">
                        Coût estimé restant:{" "}
                        {hasPendingCost
                          ? "calcul..."
                          : formatEuroFromCents(remainingEstimatedCostCents)}
                      </Badge>
                      {converted ? (
                        <Badge variant="default">
                          Dépense réelle: {formatEuroFromCents(converted.amountCents)}
                        </Badge>
                      ) : null}
                    </div>
                    {converted ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Convertie le{" "}
                        {new Intl.DateTimeFormat("fr-FR", {
                          dateStyle: "medium",
                        }).format(converted.occurredOn)}
                      </p>
                    ) : null}
                    {!budgetConversionReady ? (
                      <p className="mt-2 text-xs text-muted-foreground">
                        Conversion en dépense indisponible tant que le module budget
                        n&apos;est pas activé (<code>npm run db:push</code>).
                      </p>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {shoppingList.items.length ? (
                    <div className="space-y-3">
                      {shoppingList.items.map((item) => (
                        <div
                          key={item.id}
                          className={`relative flex flex-col gap-3 rounded-xl border bg-card p-3 sm:p-4 ${
                            item.completed ? "opacity-70" : ""
                          }`}
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-3">
                              <ShoppingItemToggle
                                itemId={item.id}
                                completed={item.completed}
                              />
                              <p
                                className={`min-w-0 break-words text-base font-semibold ${
                                  item.completed ? "line-through text-muted-foreground" : ""
                                }`}
                              >
                                {item.name}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                              <Badge variant={item.completed ? "default" : "secondary"}>
                                {item.completed ? "Fait" : "À acheter"}
                              </Badge>
                              <Badge variant="outline">
                                {item.estimatedCostCents == null
                                  ? "Calcul..."
                                  : formatEuroFromCents(item.estimatedCostCents)}
                              </Badge>
                              {item.completed ? (
                                <form action={deleteShoppingListItem}>
                                  <input type="hidden" name="itemId" value={item.id} />
                                  <Button
                                    type="submit"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                    title="Supprimer l'article"
                                    aria-label={`Supprimer ${item.name}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </form>
                              ) : (
                                <span aria-hidden="true" className="inline-block h-8 w-8" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
                      Cette liste est vide pour le moment.
                    </div>
                  )}

                  <form
                    action={addShoppingListItem}
                    className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap"
                  >
                    <input
                      type="hidden"
                      name="shoppingListId"
                      value={shoppingList.id}
                    />
                    <Input
                      name="name"
                      placeholder="Ajouter un article"
                      className="w-full sm:flex-1"
                      required
                    />
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Ajouter
                    </Button>
                  </form>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <Card>
            <CardContent className="py-8 text-sm text-muted-foreground">
              Aucune liste pour le moment. Crée une première liste d&apos;achats.
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}
