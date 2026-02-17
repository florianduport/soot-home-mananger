import { cn } from "@/lib/utils";

const AVATAR_SIZE_CLASSES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-6 w-6 text-xs",
  md: "h-8 w-8 text-sm",
} as const;

type EntityAvatarSize = keyof typeof AVATAR_SIZE_CLASSES;

function resolveFallback(name?: string | null) {
  const trimmed = name?.trim() ?? "";
  return trimmed.slice(0, 1).toUpperCase() || "?";
}

export function EntityAvatar({
  name,
  imageUrl,
  size = "sm",
  className,
}: {
  name?: string | null;
  imageUrl?: string | null;
  size?: EntityAvatarSize;
  className?: string;
}) {
  const fallback = resolveFallback(name);
  const sizeClassName = AVATAR_SIZE_CLASSES[size];

  if (imageUrl) {
    return (
      <span
        role="img"
        aria-label={name ? `Avatar de ${name}` : "Avatar"}
        className={cn(
          "shrink-0 rounded-full border bg-cover bg-center",
          sizeClassName,
          className
        )}
        style={{ backgroundImage: `url(${imageUrl})` }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground",
        sizeClassName,
        className
      )}
    >
      {fallback}
    </span>
  );
}
