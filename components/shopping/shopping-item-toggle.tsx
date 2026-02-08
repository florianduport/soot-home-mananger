"use client";

import { useRef } from "react";
import { toggleShoppingListItem } from "@/app/actions";

export function ShoppingItemToggle({
  itemId,
  completed,
}: {
  itemId: string;
  completed: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={toggleShoppingListItem} className="flex items-center">
      <input type="hidden" name="itemId" value={itemId} />
      <input
        id={`shopping-item-${itemId}`}
        type="checkbox"
        name="completed"
        value="true"
        defaultChecked={completed}
        className="h-4 w-4 cursor-pointer accent-foreground"
        title={completed ? "Décoche pour marquer à faire" : "Coche pour marquer comme fait"}
        onChange={() => {
          formRef.current?.requestSubmit();
        }}
      />
    </form>
  );
}
