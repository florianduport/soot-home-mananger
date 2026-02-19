"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { createVendor, deleteVendor, updateVendor } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCloseDetailsOnOutside } from "@/components/ui/use-close-details-on-outside";

export type VendorItem = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  notes: string | null;
  rating: number | null;
  tags: string[];
  taskCount: number;
  documentCount: number;
};

type VendorDraft = {
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  rating: string;
  tags: string;
  notes: string;
};

const triggerClassName =
  "inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-sidebar-primary bg-sidebar-primary text-sidebar-primary-foreground shadow-sm transition-colors hover:bg-sidebar-primary/90";
const menuItemClassName =
  "flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-sidebar-primary-foreground hover:bg-sidebar-primary-foreground/10";

function buildDraft(vendor: VendorItem): VendorDraft {
  return {
    name: vendor.name,
    company: vendor.company ?? "",
    email: vendor.email ?? "",
    phone: vendor.phone ?? "",
    website: vendor.website ?? "",
    address: vendor.address ?? "",
    rating: vendor.rating ? String(vendor.rating) : "",
    tags: vendor.tags.join(", "),
    notes: vendor.notes ?? "",
  };
}

function VendorRow({
  vendor,
  isEditing,
  draft,
  onStartEdit,
  onCancelEdit,
  onChange,
}: {
  vendor: VendorItem;
  isEditing: boolean;
  draft: VendorDraft | null;
  onStartEdit: (vendor: VendorItem) => void;
  onCancelEdit: () => void;
  onChange: (patch: Partial<VendorDraft>) => void;
}) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  useCloseDetailsOnOutside(menuRef);

  if (isEditing && draft) {
    return (
      <div className="rounded-lg border p-4">
        <form action={updateVendor} className="space-y-3" onSubmit={onCancelEdit}>
          <input type="hidden" name="vendorId" value={vendor.id} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="name"
              value={draft.name}
              onChange={(event) => onChange({ name: event.target.value })}
              required
              placeholder="Nom"
            />
            <Input
              name="company"
              value={draft.company}
              onChange={(event) => onChange({ company: event.target.value })}
              placeholder="Entreprise"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="email"
              type="email"
              value={draft.email}
              onChange={(event) => onChange({ email: event.target.value })}
              placeholder="Email"
            />
            <Input
              name="phone"
              value={draft.phone}
              onChange={(event) => onChange({ phone: event.target.value })}
              placeholder="Téléphone"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="website"
              value={draft.website}
              onChange={(event) => onChange({ website: event.target.value })}
              placeholder="Site web"
            />
            <Input
              name="address"
              value={draft.address}
              onChange={(event) => onChange({ address: event.target.value })}
              placeholder="Adresse"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              name="rating"
              type="number"
              min={1}
              max={5}
              value={draft.rating}
              onChange={(event) => onChange({ rating: event.target.value })}
              placeholder="Note (1-5)"
            />
            <Input
              name="tags"
              value={draft.tags}
              onChange={(event) => onChange({ tags: event.target.value })}
              placeholder="Tags (ex: plomberie, urgence)"
            />
          </div>
          <Textarea
            name="notes"
            value={draft.notes}
            onChange={(event) => onChange({ notes: event.target.value })}
            placeholder="Notes"
            rows={3}
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onCancelEdit}>
              Annuler
            </Button>
            <Button type="submit" variant="outline" size="sm">
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/app/vendors/${vendor.id}`}
            className="block truncate text-lg font-semibold hover:underline"
          >
            {vendor.name}
          </Link>
          <p className="text-sm text-muted-foreground">
            {vendor.company ? vendor.company : "Entreprise non renseignée"}
          </p>
        </div>
        <details ref={menuRef} className="action-menu group relative shrink-0">
          <summary
            className={`${triggerClassName} list-none [&::-webkit-details-marker]:hidden`}
            title="Actions"
            aria-label={`Actions pour ${vendor.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </summary>
          <div className="action-menu-popover absolute right-0 z-[999] mt-2 w-48 rounded-xl border border-sidebar-primary bg-sidebar-primary p-2 text-sidebar-primary-foreground shadow-xl">
            <button
              type="button"
              className={menuItemClassName}
              onClick={() => {
                onStartEdit(vendor);
                menuRef.current?.removeAttribute("open");
              }}
            >
              <Pencil className="h-4 w-4" />
              Modifier
            </button>
            <form action={deleteVendor}>
              <input type="hidden" name="vendorId" value={vendor.id} />
              <button
                type="submit"
                className={`${menuItemClassName} text-rose-700 hover:bg-rose-50`}
              >
                <Trash2 className="h-4 w-4" />
                Supprimer
              </button>
            </form>
          </div>
        </details>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
        <div className="flex flex-wrap gap-3">
          <span>Tâches liées: {vendor.taskCount}</span>
          <span>Factures/Devis: {vendor.documentCount}</span>
          {vendor.rating ? <span>Note: {vendor.rating}/5</span> : null}
        </div>
        <div className="grid gap-1 sm:grid-cols-2">
          <span>Email: {vendor.email ?? "—"}</span>
          <span>Téléphone: {vendor.phone ?? "—"}</span>
          <span>Site web: {vendor.website ?? "—"}</span>
          <span>Adresse: {vendor.address ?? "—"}</span>
        </div>
        {vendor.tags.length ? (
          <div className="flex flex-wrap gap-2">
            {vendor.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        ) : (
          <span>Tags: —</span>
        )}
        {vendor.notes ? <p className="text-sm text-muted-foreground">{vendor.notes}</p> : null}
      </div>
    </div>
  );
}

export function VendorsManager({
  houseId,
  vendors,
}: {
  houseId: string;
  vendors: VendorItem[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<VendorDraft | null>(null);

  function startEdit(vendor: VendorItem) {
    setEditingId(vendor.id);
    setDraft(buildDraft(vendor));
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft(null);
  }

  function updateDraft(patch: Partial<VendorDraft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Nouveau prestataire</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createVendor} className="space-y-3">
            <input type="hidden" name="houseId" value={houseId} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="name" required placeholder="Nom" />
              <Input name="company" placeholder="Entreprise" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="email" type="email" placeholder="Email" />
              <Input name="phone" placeholder="Téléphone" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="website" placeholder="Site web" />
              <Input name="address" placeholder="Adresse" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="rating" type="number" min={1} max={5} placeholder="Note (1-5)" />
              <Input name="tags" placeholder="Tags (ex: plomberie, urgence)" />
            </div>
            <Textarea name="notes" placeholder="Notes" rows={3} />
            <div className="flex justify-end">
              <Button type="submit" variant="add" className="rounded-full">
                <Plus className="h-4 w-4" />
                Ajouter le prestataire
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {vendors.length ? (
          vendors.map((vendor) => (
            <VendorRow
              key={vendor.id}
              vendor={vendor}
              isEditing={editingId === vendor.id}
              draft={editingId === vendor.id ? draft : null}
              onStartEdit={startEdit}
              onCancelEdit={cancelEdit}
              onChange={updateDraft}
            />
          ))
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Aucun prestataire pour le moment. Ajoute ton premier contact ci-dessus.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
