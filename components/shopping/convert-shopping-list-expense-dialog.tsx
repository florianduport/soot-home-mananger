"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { Euro, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { convertShoppingListToBudgetExpense } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ReactNode } from "react";

type ConvertShoppingListExpenseDialogProps = {
  shoppingListId: string;
  shoppingListName: string;
  defaultAmount?: string;
  defaultDate: string;
  renderTrigger?: (openDialog: () => void) => ReactNode;
};

const goldButtonClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-amber-500 bg-amber-500 text-white shadow-sm transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50";

export function ConvertShoppingListExpenseDialog({
  shoppingListId,
  shoppingListName,
  defaultAmount,
  defaultDate,
  renderTrigger,
}: ConvertShoppingListExpenseDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function closeDialog() {
    if (isPending) return;
    setOpen(false);
    setError(null);
  }

  function validateFormData(formData: FormData) {
    const amountRaw = formData.get("amount")?.toString().trim() ?? "";
    const amount = Number(amountRaw.replace(",", "."));
    if (!amountRaw || !Number.isFinite(amount) || amount <= 0) {
      return "Le montant réel doit être supérieur à 0.";
    }

    const dateRaw = formData.get("occurredOn")?.toString().trim() ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      return "La date de dépense est invalide.";
    }

    return null;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const validationError = validateFormData(formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await convertShoppingListToBudgetExpense(formData);
        setOpen(false);
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Impossible de convertir cette liste en dépense."
        );
      }
    });
  }

  return (
    <>
      {renderTrigger ? (
        renderTrigger(() => setOpen(true))
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={goldButtonClassName}
          title="Convertir la liste en dépense"
          aria-label={`Convertir ${shoppingListName} en dépense`}
        >
          <Euro className="h-4 w-4" />
        </button>
      )}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Conversion budget
                </p>
                <h3 className="text-lg font-semibold">Convertir la liste</h3>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100"
                title="Fermer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">{shoppingListName}</p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input type="hidden" name="shoppingListId" value={shoppingListId} />
              <Input
                name="notes"
                placeholder="Note (optionnel)"
                disabled={isPending}
              />
              <Input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={defaultAmount}
                placeholder="Montant total réel"
                required
                disabled={isPending}
              />
              <Input
                name="occurredOn"
                type="date"
                defaultValue={defaultDate}
                required
                disabled={isPending}
              />

              {error ? (
                <p className="text-sm text-red-600" role="alert">
                  {error}
                </p>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={closeDialog}
                  disabled={isPending}
                >
                  Annuler
                </Button>
                <Button type="submit" variant="add" disabled={isPending}>
                  {isPending ? "Conversion..." : "Valider"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
