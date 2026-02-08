"use client";

import { useEffect, useRef, useState } from "react";
import { removeHouseIcon, uploadHouseIcon } from "@/app/actions";
import { Button } from "@/components/ui/button";

type HouseIconUploadProps = {
  houseId: string;
  houseName: string;
  currentIconUrl?: string | null;
  canEdit: boolean;
};

export function HouseIconUpload({
  houseId,
  houseName,
  currentIconUrl,
  canEdit,
}: HouseIconUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const previewUrl = selectedPreviewUrl ?? currentIconUrl ?? null;

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    };
  }, [selectedPreviewUrl]);

  function applySelectedFile(file: File) {
    if (!file.type.startsWith("image/")) {
      return;
    }

    setSelectedFile(file);

    setSelectedPreviewUrl((previous) => {
      if (previous?.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }
      return URL.createObjectURL(file);
    });

    if (inputRef.current) {
      const dt = new DataTransfer();
      dt.items.add(file);
      inputRef.current.files = dt.files;
    }
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          if (!canEdit) return;
          event.preventDefault();
          setIsDragging(false);
          const droppedFile = event.dataTransfer.files?.[0];
          if (droppedFile) {
            applySelectedFile(droppedFile);
          }
        }}
        className={`rounded-xl border-2 border-dashed p-4 transition ${
          isDragging ? "border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800" : "border-border"
        } ${canEdit ? "cursor-pointer" : "cursor-not-allowed opacity-70"}`}
        onClick={() => {
          if (canEdit) {
            inputRef.current?.click();
          }
        }}
      >
        <div className="flex items-center gap-3">
          {previewUrl ? (
            <div
              role="img"
              aria-label={`Icône de ${houseName}`}
              className="h-12 w-12 rounded-2xl border bg-cover bg-center"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
              H
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            {canEdit
              ? "Glisse une image ici, ou clique pour sélectionner un fichier."
              : "Seul le propriétaire peut modifier l'icône."}
          </div>
        </div>
      </div>

      <form
        action={uploadHouseIcon}
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <input type="hidden" name="houseId" value={houseId} />
        <input
          ref={inputRef}
          type="file"
          name="iconFile"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
          disabled={!canEdit}
          onChange={(event) => {
            const pickedFile = event.target.files?.[0];
            if (pickedFile) {
              applySelectedFile(pickedFile);
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => inputRef.current?.click()}
          disabled={!canEdit}
        >
          Choisir un fichier
        </Button>
        <Button
          type="submit"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={!canEdit || !selectedFile}
        >
          Enregistrer l&apos;icône
        </Button>
        {selectedFile ? (
          <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
        ) : null}
      </form>

      {canEdit && currentIconUrl ? (
        <form action={removeHouseIcon}>
          <input type="hidden" name="houseId" value={houseId} />
          <Button type="submit" variant="ghost" size="sm">
            Retirer l&apos;icône
          </Button>
        </form>
      ) : null}

      <p className="text-xs text-muted-foreground">
        PNG, JPG, WEBP ou GIF. Taille max: 5 Mo.
      </p>
    </div>
  );
}
