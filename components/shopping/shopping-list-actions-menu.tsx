"use client";

import { Eraser, Euro, MoreHorizontal, Trash2 } from "lucide-react";
import { clearShoppingList, deleteShoppingList } from "@/app/actions";
import { ConvertShoppingListExpenseDialog } from "@/components/shopping/convert-shopping-list-expense-dialog";

type ShoppingListActionsMenuProps = {
  shoppingListId: string;
  shoppingListName: string;
  budgetConversionReady: boolean;
  alreadyConverted: boolean;
  defaultAmount?: string;
  defaultDate: string;
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100";

export function ShoppingListActionsMenu({
  shoppingListId,
  shoppingListName,
  budgetConversionReady,
  alreadyConverted,
  defaultAmount,
  defaultDate,
}: ShoppingListActionsMenuProps) {
  return (
    <details className="group relative">
      <summary
        className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
        title="Actions"
        aria-label={`Actions pour ${shoppingListName}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </summary>

      <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        {!alreadyConverted && budgetConversionReady ? (
          <ConvertShoppingListExpenseDialog
            shoppingListId={shoppingListId}
            shoppingListName={shoppingListName}
            defaultAmount={defaultAmount}
            defaultDate={defaultDate}
            renderTrigger={(openDialog) => (
              <button
                type="button"
                className={`${menuItemClassName} text-amber-700 hover:bg-amber-50`}
                onClick={(event) => {
                  event.preventDefault();
                  openDialog();
                }}
              >
                <Euro className="h-4 w-4" />
                Convertir en dépense
              </button>
            )}
          />
        ) : alreadyConverted ? (
          <p className="px-3 py-2 text-xs text-emerald-700">
            Déjà convertie en dépense
          </p>
        ) : (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            Conversion indisponible (module budget)
          </p>
        )}

        <form action={clearShoppingList}>
          <input type="hidden" name="shoppingListId" value={shoppingListId} />
          <button type="submit" className={menuItemClassName}>
            <Eraser className="h-4 w-4" />
            Vider la liste
          </button>
        </form>

        <form action={deleteShoppingList}>
          <input type="hidden" name="shoppingListId" value={shoppingListId} />
          <button
            type="submit"
            className={`${menuItemClassName} text-rose-700 hover:bg-rose-50`}
          >
            <Trash2 className="h-4 w-4" />
            Supprimer la liste
          </button>
        </form>
      </div>
    </details>
  );
}
