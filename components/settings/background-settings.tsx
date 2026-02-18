"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  generateAppBackgroundGhibli,
  ghiblifyUploadedAppBackground,
  uploadAppBackground,
} from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/use-theme";

type ImageActionResult = {
  imageUrl: string;
};

export function BackgroundSettings() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { backgroundImageUrl, setBackgroundImage, clearBackgroundImage } = useTheme();

  const previewUrl = selectedPreviewUrl ?? backgroundImageUrl ?? null;
  const hasBackground = Boolean(backgroundImageUrl);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(selectedPreviewUrl);
      }
    };
  }, [selectedPreviewUrl]);

  function applySelectedFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Choisis un fichier image valide.");
      return;
    }

    setError(null);
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

  function handleUploadAndUse() {
    if (!selectedFile) {
      setError("Ajoute d'abord une photo à uploader.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const formData = new FormData();
        formData.set("backgroundFile", selectedFile);
        const result = (await uploadAppBackground(formData)) as ImageActionResult;
        setBackgroundImage(result.imageUrl);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Impossible de charger cette image de fond."
        );
      }
    });
  }

  function handleUploadAndGhiblify() {
    if (!selectedFile) {
      setError("Ajoute d'abord une photo à ghiblifier.");
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        const formData = new FormData();
        formData.set("backgroundFile", selectedFile);
        await uploadAppBackground(formData);
        const result = (await ghiblifyUploadedAppBackground()) as ImageActionResult;
        setBackgroundImage(result.imageUrl);
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : "Impossible de ghiblifier cette image."
        );
      }
    });
  }

  function handleGenerateGhibli() {
    startTransition(async () => {
      try {
        setError(null);
        const formData = new FormData();
        if (prompt.trim()) {
          formData.set("prompt", prompt);
        }
        const result = (await generateAppBackgroundGhibli(formData)) as ImageActionResult;
        setBackgroundImage(result.imageUrl);
      } catch (generationError) {
        setError(
          generationError instanceof Error
            ? generationError.message
            : "Impossible de générer un fond pour le moment."
        );
      }
    });
  }

  function handleGhiblifyLastUploaded() {
    startTransition(async () => {
      try {
        setError(null);
        const result = (await ghiblifyUploadedAppBackground()) as ImageActionResult;
        setBackgroundImage(result.imageUrl);
      } catch (generationError) {
        setError(
          generationError instanceof Error
            ? generationError.message
            : "Impossible de ghiblifier la photo uploadée."
        );
      }
    });
  }

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Fond de l&apos;application</p>
        <p className="text-xs text-muted-foreground">
          Upload de photo, génération Ghibli, ou ghiblification d&apos;une photo uploadée pour cette maison.
        </p>
      </div>

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
              aria-label="Aperçu du fond"
              className="h-16 w-28 rounded-lg border bg-cover bg-center"
              style={{ backgroundImage: `url(${previewUrl})` }}
            />
          ) : (
            <div className="flex h-16 w-28 items-center justify-center rounded-lg border bg-muted text-xs text-muted-foreground">
              Aucun fond
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            Glisse une image ici, ou clique pour sélectionner un fichier.
          </div>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        name="backgroundFile"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const pickedFile = event.target.files?.[0];
          if (pickedFile) {
            applySelectedFile(pickedFile);
          }
        }}
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
        >
          Choisir une photo
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleUploadAndUse}
          disabled={isPending || !selectedFile}
        >
          {isPending ? "Traitement..." : "Uploader et utiliser"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleUploadAndGhiblify}
          disabled={isPending || !selectedFile}
        >
          {isPending ? "Ghibli..." : "Uploader + Ghiblifier"}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="w-full sm:w-auto"
          onClick={handleGhiblifyLastUploaded}
          disabled={isPending}
        >
          {isPending ? "Ghibli..." : "Ghiblifier la photo uploadée"}
        </Button>
      </div>

      {selectedFile ? (
        <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
      ) : null}

      <div className="flex min-w-0 flex-col gap-2 md:flex-row md:items-center">
        <Input
          className="min-w-0 md:flex-1"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          maxLength={240}
          placeholder="Prompt optionnel (ex: forêt brumeuse, lumière dorée)"
          disabled={isPending}
        />
        <Button
          type="button"
          variant="outline"
          className="w-full md:w-auto"
          onClick={handleGenerateGhibli}
          disabled={isPending}
        >
          {isPending ? "Génération..." : "Générer (Ghibli)"}
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={isPending || !hasBackground}
          onClick={() => {
            clearBackgroundImage();
            setError(null);
          }}
        >
          Supprimer le fond
        </Button>
        <p className="text-xs text-muted-foreground">
          Le thème reprend automatiquement sa couleur de fond.
        </p>
      </div>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        PNG, JPG, WEBP ou GIF. Taille max: 10 Mo.
      </p>
    </div>
  );
}
