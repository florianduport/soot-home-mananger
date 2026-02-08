import { createHouse } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CreateHouseForm() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-200 p-6 dark:from-slate-950 dark:to-slate-900">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader>
          <CardTitle>Créer ta maison</CardTitle>
          <CardDescription>
            Donne un nom à ta maison pour commencer à organiser les tâches.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createHouse} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Nom de la maison
              </label>
              <Input id="name" name="name" required placeholder="Maison Duport" />
            </div>
            <Button type="submit" className="w-full">
              Créer la maison
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
