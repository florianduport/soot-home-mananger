"use client";

import { signOut } from "next-auth/react";
import { type VariantProps } from "class-variance-authority";
import { LogOut } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

type ButtonVariant = VariantProps<typeof buttonVariants>["variant"];

export function SignOutButton({
  className,
  variant = "outline",
  collapsed = false,
}: {
  className?: string;
  variant?: ButtonVariant;
  collapsed?: boolean;
}) {
  return (
    <Button
      variant={variant}
      className={className}
      onClick={() => signOut({ callbackUrl: "/" })}
      title={collapsed ? "Se déconnecter" : undefined}
    >
      {collapsed ? <LogOut className="h-4 w-4" /> : "Se déconnecter"}
    </Button>
  );
}
