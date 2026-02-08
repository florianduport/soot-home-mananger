"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function RegenerateImageButton({
  hasImage,
}: {
  hasImage: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="outline"
      size="sm"
      className="cursor-pointer"
      disabled={pending}
    >
      {pending
        ? "Génération..."
        : hasImage
          ? "Régénérer l’illustration"
          : "Générer l’illustration"}
    </Button>
  );
}
