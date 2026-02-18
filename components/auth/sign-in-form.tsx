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
    <Card className="w-full max-w-md border-[#cfbf9f] bg-[#fff8eb] shadow-[0_16px_36px_rgba(48,38,24,0.14)]">
      <CardHeader>
        <CardTitle className="font-serif text-2xl text-[#1b2a21]">Soot</CardTitle>
        <CardDescription className="text-sm text-[#3d5649]">
          Connecte-toi avec un lien magique pour accéder à ton foyer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-semibold text-[#25362d]">
              Email
            </label>
            <Input
              id="email"
              type="email"
              required
              className="border-[#c8b89c] bg-[#fffdf7] text-[#1f2f26] placeholder:text-[#60796b] focus-visible:border-[#486a54]"
              placeholder="toi@exemple.fr"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-[#1f3224] text-[#f7eeda] hover:bg-[#18281c]"
            disabled={isLoading}
          >
            {isLoading ? "Envoi..." : "Envoyer le lien magique"}
          </Button>
          {sent ? (
            <p className="text-sm text-[#3b5648]">
              Lien magique envoyé. Vérifie ta boîte email.
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
    <main className="soot-auth-screen flex min-h-screen w-full items-center justify-center overflow-x-clip bg-[radial-gradient(circle_at_18%_8%,#fdf6e6_0,transparent_44%),radial-gradient(circle_at_87%_2%,#d7e6cf_0,transparent_35%),linear-gradient(160deg,#f6efde,#efe1ca)] p-4 sm:p-6">
      {content}
    </main>
  );
}
