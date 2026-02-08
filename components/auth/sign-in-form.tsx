"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SignInForm({
  callbackUrl = "/app",
  variant = "page",
}: {
  callbackUrl?: string;
  variant?: "page" | "card";
}) {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    await signIn("email", { email, redirect: false, callbackUrl });
    setSent(true);
    setIsLoading(false);
  };

  const content = (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader>
        <CardTitle>Homanager</CardTitle>
        <CardDescription>
          Connecte-toi avec un lien magique pour accéder à ta maison.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              placeholder="toi@exemple.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? "Envoi..." : "Envoyer le lien magique"}
          </Button>
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Si un serveur email n’est pas configuré, le lien apparaît dans les
              logs serveur.
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );

  if (variant === "card") {
    return content;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-6 dark:from-slate-950 dark:to-slate-900">
      {content}
    </main>
  );
}
