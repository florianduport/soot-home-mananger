"use client";

import { useEffect, useRef, useState } from "react";
import {
  cartoonifyUserAvatar,
  removeUserAvatar,
  restoreUserAvatar,
  uploadUserAvatar,
} from "@/app/actions";
import { Button } from "@/components/ui/button";

type ProfileAvatarUploadProps = {
  userName?: string | null;
  currentAvatarUrl?: string | null;
};

export function ProfileAvatarUpload({
  userName,
  currentAvatarUrl,
}: ProfileAvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const previewUrl = selectedPreviewUrl ?? currentAvatarUrl ?? null;
  const hasLocalUploadedAvatar = Boolean(currentAvatarUrl?.startsWith("/user-avatars/"));
  const isCartoonifiedAvatar = Boolean(currentAvatarUrl?.includes("-cartoonified.png"));
  const canCartoonify = hasLocalUploadedAvatar && !isCartoonifiedAvatar;
  const fallbackInitial = (userName?.trim().slice(0, 1).toUpperCase() || "U");

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
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          const droppedFile = event.dataTransfer.files?.[0];
          if (droppedFile) {
            applySelectedFile(droppedFile);
          }
        }}
        className={`rounded-xl border-2 border-dashed p-4 transition ${
          isDragging
            ? "border-slate-900 bg-slate-50 dark:border-slate-200 dark:bg-slate-800"
            : "border-border"
        } cursor-pointer`}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex items-center gap-3">
          {previewUrl ? (
            <div
              role="img"
              aria-label={`Avatar de ${userName || "l'utilisateur"}`}
              className="h-14 w-14 rounded-full border bg-cover bg-center"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-lg font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
              {fallbackInitial}
            </div>
          )}
          <div className="text-sm text-muted-foreground">
            Glisse une image ici, ou clique pour sélectionner un fichier.
          </div>
        </div>
      </div>

      <form
        action={uploadUserAvatar}
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <input
          ref={inputRef}
          type="file"
          name="avatarFile"
          accept="image/png,image/jpeg,image/webp,image/gif"
          className="hidden"
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
        >
          Choisir un fichier
        </Button>
        <Button
          type="submit"
          variant="outline"
          className="w-full sm:w-auto"
          disabled={!selectedFile}
        >
          Enregistrer l&apos;avatar
        </Button>
        {selectedFile ? (
          <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
        ) : null}
      </form>

      {currentAvatarUrl ? (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {canCartoonify ? (
            <form action={cartoonifyUserAvatar}>
              <Button type="submit" variant="outline" size="sm">
                Style Ghibli
              </Button>
            </form>
          ) : null}

          {isCartoonifiedAvatar ? (
            <form action={restoreUserAvatar}>
              <Button type="submit" variant="outline" size="sm">
                Restaurer
              </Button>
            </form>
          ) : null}

          <form action={removeUserAvatar}>
            <Button type="submit" variant="ghost" size="sm">
              Retirer l&apos;avatar
            </Button>
          </form>
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        PNG, JPG, WEBP ou GIF. Taille max: 5 Mo.
      </p>
    </div>
  );
}
