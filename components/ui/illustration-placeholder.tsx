import { ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function IllustrationPlaceholder({
  className,
  showLabel = true,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-muted/40",
        className
      )}
      aria-label="Illustration en cours de génération"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.25),transparent_55%)]" />
      <div className="relative flex h-full w-full items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {showLabel ? (
          <span className="text-xs">Génération…</span>
        ) : (
          <ImageIcon className="h-4 w-4" />
        )}
      </div>
    </div>
  );
}
