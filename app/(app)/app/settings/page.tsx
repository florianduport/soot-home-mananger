import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/lib/house";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { BackgroundSettings } from "@/components/settings/background-settings";
import { LanguageSettings } from "@/components/settings/language-settings";
import { Settings } from "lucide-react";

export default async function SettingsPage() {
  await requireSession();

  return (
    <>
      <header className="page-header">
        <Settings className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Réglages</p>
        <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Réglages techniques</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Apparence</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ThemeSettings />
            <BackgroundSettings />
            <LanguageSettings />
          </CardContent>
        </Card>
      </section>
    </>
  );
}
