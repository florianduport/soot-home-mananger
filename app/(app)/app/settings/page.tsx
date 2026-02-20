import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  createHouseInvite,
  removeHouseMember,
  revokeHouseInvite,
} from "@/app/actions";
import { getHouseData, requireSession } from "@/lib/house";
import { ThemeSettings } from "@/components/settings/theme-settings";
import { BackgroundSettings } from "@/components/settings/background-settings";
import { LanguageSettings } from "@/components/settings/language-settings";
import { HouseIconUpload } from "@/components/houses/house-icon-upload";
import { SettingsEntityManager } from "@/components/settings/settings-entity-manager";
import { SettingsImportantDatesManager } from "@/components/settings/settings-important-dates-manager";
import { NotificationSettings } from "@/components/settings/notification-settings";
import { Settings } from "lucide-react";
import { getNotificationPreferences } from "@/lib/notifications";

const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REVOKED: "Révoquée",
  EXPIRED: "Expirée",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(value);
}

export default async function SettingsPage() {
  const session = await requireSession();
  const {
    membership,
    houseId,
    zones,
    categories,
    animals,
    people,
    members,
    invites,
    importantDates,
  } =
    await getHouseData(session.user.id);
  const houseIconUrl = membership.house.iconUrl;
  const canEditHouse = membership.role === "OWNER";
  const notificationPreferences = await getNotificationPreferences(session.user.id, houseId);

  return (
    <>
      <header className="page-header">
        <Settings className="float-left mr-3 mt-3 h-7 w-7 text-muted-foreground" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">Réglages</p>
        <h1 className="text-2xl font-semibold sm:whitespace-nowrap">Organisation de la maison</h1>
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

        <NotificationSettings
          houseId={houseId}
          preferences={notificationPreferences}
        />

        <Card>
          <CardHeader>
            <CardTitle>Icône de la maison</CardTitle>
          </CardHeader>
          <CardContent>
            <HouseIconUpload
              houseId={houseId}
              houseName={membership.house.name}
              currentIconUrl={houseIconUrl}
              canEdit={canEditHouse}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Membres</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {members.map((member) => {
                const isSelf = member.userId === session.user.id;
                const isOwner = member.role === "OWNER";
                return (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center justify-between gap-2"
                  >
                    <span>
                      {member.user.name || member.user.email || "Membre"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {isOwner ? "Propriétaire" : "Membre"}
                      </span>
                      {!isOwner && !isSelf ? (
                        <form action={removeHouseMember}>
                          <input type="hidden" name="memberId" value={member.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Retirer
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invitations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createHouseInvite} className="grid gap-2">
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="email" type="email" placeholder="email@exemple.fr" required />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Envoyer l&apos;invitation
              </Button>
              <p className="text-xs text-muted-foreground">
                Le lien d&apos;invitation est affiché ci-dessous.
              </p>
            </form>

            <div className="space-y-3 text-sm">
              {invites.length ? (
                invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="rounded-lg border border-dashed p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{invite.email}</p>
                        <p className="text-xs text-muted-foreground">
                          Statut: {statusLabels[invite.status] || invite.status}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDate(invite.createdAt)}</span>
                        {invite.status === "PENDING" ? (
                          <form action={revokeHouseInvite}>
                            <input type="hidden" name="inviteId" value={invite.id} />
                            <Button
                              type="submit"
                              variant="ghost"
                              size="sm"
                              className="w-full sm:w-auto"
                            >
                              Révoquer
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    </div>
                    <Link
                      href={`/invite/${invite.token}`}
                      className="mt-2 inline-block text-xs text-primary underline"
                    >
                      Lien d&apos;invitation
                    </Link>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune invitation pour le moment.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <SettingsEntityManager
          type="zone"
          title="Zones"
          houseId={houseId}
          items={zones.map((zone) => ({ id: zone.id, name: zone.name }))}
          primaryPlaceholder="Garage"
        />

        <SettingsEntityManager
          type="category"
          title="Catégories"
          houseId={houseId}
          items={categories.map((category) => ({ id: category.id, name: category.name }))}
          primaryPlaceholder="Entretien"
        />

        <SettingsEntityManager
          type="animal"
          title="Animaux"
          houseId={houseId}
          items={animals.map((animal) => ({
            id: animal.id,
            name: animal.name,
            secondary: animal.species,
            imageUrl: animal.imageUrl,
          }))}
          primaryPlaceholder="Nala"
          secondaryPlaceholder="Chat"
        />

        <SettingsEntityManager
          type="person"
          title="Personnes"
          houseId={houseId}
          items={people.map((person) => ({
            id: person.id,
            name: person.name,
            secondary: person.relation,
            imageUrl: person.imageUrl,
          }))}
          primaryPlaceholder="Enfant"
          secondaryPlaceholder="Fils"
        />

        <SettingsImportantDatesManager
          houseId={houseId}
          items={importantDates.map((importantDate) => ({
            id: importantDate.id,
            title: importantDate.title,
            type: importantDate.type,
            date: importantDate.date,
            isRecurringYearly: importantDate.isRecurringYearly,
            description: importantDate.description,
          }))}
        />
      </section>
    </>
  );
}
