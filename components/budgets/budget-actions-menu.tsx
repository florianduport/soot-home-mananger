"use client";

import { useRef, useState } from "react";
import { MoreHorizontal, Upload, X } from "lucide-react";
import {
  createBudgetEntry,
  createBudgetRecurringEntry,
  uploadBudgetDocumentAndCreateExpense,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BudgetFormType =
  | "income"
  | "expense"
  | "incomeRecurring"
  | "expenseRecurring"
  | "import";

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition-colors hover:bg-slate-100";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100";

function getModalTitle(type: BudgetFormType) {
  if (type === "income") return "Ajouter un revenu du mois";
  if (type === "expense") return "Ajouter une dépense du mois";
  if (type === "incomeRecurring") return "Ajouter un revenu récurrent";
  if (type === "expenseRecurring") return "Ajouter une dépense récurrente";
  return "Importer un justificatif";
}

export function BudgetActionsMenu({
  houseId,
  selectedMonth,
  defaultEntryDate,
}: {
  houseId: string;
  selectedMonth: string;
  defaultEntryDate: string;
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const [activeForm, setActiveForm] = useState<BudgetFormType | null>(null);

  function openForm(type: BudgetFormType) {
    setActiveForm(type);
    detailsRef.current?.removeAttribute("open");
  }

  function closeModal() {
    setActiveForm(null);
  }

  return (
    <>
      <details ref={detailsRef} className="group relative">
        <summary
          className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
          title="Actions budget"
          aria-label="Actions budget"
        >
          <MoreHorizontal className="h-4 w-4" />
        </summary>
        <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <button type="button" className={menuItemClassName} onClick={() => openForm("income")}>
            Ajouter un revenu
          </button>
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => openForm("expense")}
          >
            Ajouter une dépense
          </button>
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => openForm("incomeRecurring")}
          >
            Ajouter un revenu récurrent
          </button>
          <button
            type="button"
            className={menuItemClassName}
            onClick={() => openForm("expenseRecurring")}
          >
            Ajouter une dépense récurrente
          </button>
          <button type="button" className={menuItemClassName} onClick={() => openForm("import")}>
            Importer un justificatif
          </button>
        </div>
      </details>

      {activeForm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold">{getModalTitle(activeForm)}</h3>
              <button
                type="button"
                onClick={closeModal}
                className={triggerClassName}
                title="Fermer"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {activeForm === "income" ? (
              <form action={createBudgetEntry} className="mt-4 space-y-3">
                <input type="hidden" name="houseId" value={houseId} />
                <input type="hidden" name="type" value="INCOME" />
                <Input name="label" placeholder="Salaire, prime, remboursement..." required />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Montant (EUR)"
                    required
                  />
                  <Input
                    name="occurredOn"
                    type="date"
                    defaultValue={defaultEntryDate}
                    required
                  />
                </div>
                <Textarea name="notes" placeholder="Notes (optionnel)" />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="isForecast" value="true" />
                  Revenu anticipé
                </label>
                <div className="flex justify-end">
                  <Button type="submit" variant="add">
                    Ajouter le revenu
                  </Button>
                </div>
              </form>
            ) : null}

            {activeForm === "expense" ? (
              <form action={createBudgetEntry} className="mt-4 space-y-3">
                <input type="hidden" name="houseId" value={houseId} />
                <input type="hidden" name="type" value="EXPENSE" />
                <Input name="label" placeholder="Courses, énergie, assurance..." required />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Montant (EUR)"
                    required
                  />
                  <Input
                    name="occurredOn"
                    type="date"
                    defaultValue={defaultEntryDate}
                    required
                  />
                </div>
                <Textarea name="notes" placeholder="Notes (optionnel)" />
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input type="checkbox" name="isForecast" value="true" />
                  Dépense anticipée
                </label>
                <div className="flex justify-end">
                  <Button type="submit" variant="add">
                    Ajouter la dépense
                  </Button>
                </div>
              </form>
            ) : null}

            {activeForm === "incomeRecurring" ? (
              <form action={createBudgetRecurringEntry} className="mt-4 space-y-3">
                <input type="hidden" name="houseId" value={houseId} />
                <input type="hidden" name="type" value="INCOME" />
                <Input name="label" placeholder="Salaire mensuel, allocation..." required />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Montant (EUR)"
                    required
                  />
                  <Input
                    name="dayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Jour du mois (optionnel)"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="startMonth" type="month" defaultValue={selectedMonth} required />
                  <Input name="endMonth" type="month" />
                </div>
                <Textarea name="notes" placeholder="Notes (optionnel)" />
                <div className="flex justify-end">
                  <Button type="submit" variant="outline">
                    Ajouter une règle récurrente
                  </Button>
                </div>
              </form>
            ) : null}

            {activeForm === "expenseRecurring" ? (
              <form action={createBudgetRecurringEntry} className="mt-4 space-y-3">
                <input type="hidden" name="houseId" value={houseId} />
                <input type="hidden" name="type" value="EXPENSE" />
                <Input name="label" placeholder="Loyer, énergie, abonnement..." required />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Montant (EUR)"
                    required
                  />
                  <Input
                    name="dayOfMonth"
                    type="number"
                    min="1"
                    max="31"
                    placeholder="Jour du mois (optionnel)"
                  />
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="startMonth" type="month" defaultValue={selectedMonth} required />
                  <Input name="endMonth" type="month" />
                </div>
                <Textarea name="notes" placeholder="Notes (optionnel)" />
                <div className="flex justify-end">
                  <Button type="submit" variant="outline">
                    Ajouter une règle récurrente
                  </Button>
                </div>
              </form>
            ) : null}

            {activeForm === "import" ? (
              <form action={uploadBudgetDocumentAndCreateExpense} className="mt-4 space-y-3">
                <input type="hidden" name="houseId" value={houseId} />
                <Input
                  name="document"
                  type="file"
                  accept="application/pdf,image/*"
                  required
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input name="fallbackMonth" type="month" defaultValue={selectedMonth} required />
                  <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-muted-foreground">
                    <input type="checkbox" name="forceForecast" value="true" />
                    Forcer en dépense anticipée
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button type="submit" variant="add">
                    <Upload className="h-4 w-4" />
                    Analyser et créer la dépense
                  </Button>
                </div>
              </form>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
