import { updateUserProfile } from "@/app/actions";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { ProfileAvatarUpload } from "@/components/profile/profile-avatar-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { requireSession } from "@/lib/house";
import { UserRound } from "lucide-react";

function splitNameParts(fullName?: string | null) {
  const trimmed = fullName?.trim() || "";
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

export default async function ProfilePage() {
  const session = await requireSession();
  const { firstName, lastName } = splitNameParts(session.user.name);

  return (
    <>
      <header className="page-header">
        <UserRound className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Profil</p>
        <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Mon compte</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Informations personnelles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={updateUserProfile} className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  name="firstName"
                  defaultValue={firstName}
                  placeholder="Prénom"
                  required
                />
                <Input name="lastName" defaultValue={lastName} placeholder="Nom" />
              </div>
              <Input value={session.user.email || ""} disabled />
              <Button type="submit" variant="outline">
                Enregistrer
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Avatar</CardTitle>
          </CardHeader>
          <CardContent>
            <ProfileAvatarUpload
              userName={session.user.name}
              currentAvatarUrl={session.user.image}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session</CardTitle>
          </CardHeader>
          <CardContent>
            <SignOutButton variant="outline" />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
