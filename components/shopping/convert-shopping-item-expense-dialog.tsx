"use client";

import { useState, useTransition } from "react";
import type { FormEvent } from "react";
import { ReceiptText, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { convertShoppingItemToBudgetExpense } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const iconButtonClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50";

type ConvertShoppingItemExpenseDialogProps = {
  itemId: string;
  itemName: string;
  defaultAmount?: string;
  defaultDate: string;
};

export function ConvertShoppingItemExpenseDialog({
  itemId,
  itemName,
  defaultAmount,
  defaultDate,
}: ConvertShoppingItemExpenseDialogProps) {
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
    const form = event.currentTarget;
    const formData = new FormData(form);
    const validationError = validateFormData(formData);

    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);

    startTransition(async () => {
      try {
        await convertShoppingItemToBudgetExpense(formData);
        setOpen(false);
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Impossible de convertir cet article en dépense."
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={iconButtonClassName}
        title="Convertir en dépense réelle"
        aria-label={`Convertir "${itemName}" en dépense réelle`}
      >
        <ReceiptText className="h-4 w-4" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Conversion budget
                </p>
                <h3 className="text-lg font-semibold">Convertir en dépense</h3>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                className={iconButtonClassName}
                title="Fermer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-sm text-muted-foreground">{itemName}</p>

            <form onSubmit={handleSubmit} className="mt-4 space-y-3">
              <input type="hidden" name="itemId" value={itemId} />
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
                placeholder="Montant réel"
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
