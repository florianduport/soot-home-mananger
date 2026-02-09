import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import {
  createAnimal,
  createCategory,
  createHouseInvite,
  createImportantDate,
  createPerson,
  createZone,
  deleteAnimal,
  deleteCategory,
  deleteImportantDate,
  deletePerson,
  deleteZone,
  removeHouseMember,
  revokeHouseInvite,
  updateAnimal,
  updateCategory,
  updateImportantDate,
  updatePerson,
  updateZone,
} from "@/app/actions";
import { getHouseData, requireSession } from "@/lib/house";
import { getNextImportantDateOccurrence } from "@/lib/important-dates";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { HouseIconUpload } from "@/components/houses/house-icon-upload";
import {
  buildConversationHref,
  groupConversationLinks,
} from "@/lib/agent/conversation-links";
import { prisma } from "@/lib/db";

const statusLabels: Record<string, string> = {
  PENDING: "En attente",
  ACCEPTED: "Acceptée",
  REVOKED: "Révoquée",
  EXPIRED: "Expirée",
};

const importantDateTypeLabels: Record<string, string> = {
  BIRTHDAY: "Anniversaire",
  ANNIVERSARY: "Commémoration",
  EVENT: "Événement",
  OTHER: "Autre",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
  }).format(value);
}

function dateInputValue(value: Date) {
  return value.toISOString().slice(0, 10);
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
  const zoneIds = zones.map((zone) => zone.id);
  const categoryIds = categories.map((category) => category.id);
  const animalIds = animals.map((animal) => animal.id);
  const personIds = people.map((person) => person.id);
  const [zoneLinks, categoryLinks, animalLinks, personLinks] = await Promise.all([
    zoneIds.length
      ? prisma.agentConversationLink.findMany({
          where: {
            entityType: "ZONE",
            entityId: { in: zoneIds },
          },
          include: {
            conversation: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    categoryIds.length
      ? prisma.agentConversationLink.findMany({
          where: {
            entityType: "CATEGORY",
            entityId: { in: categoryIds },
          },
          include: {
            conversation: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    animalIds.length
      ? prisma.agentConversationLink.findMany({
          where: {
            entityType: "ANIMAL",
            entityId: { in: animalIds },
          },
          include: {
            conversation: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
    personIds.length
      ? prisma.agentConversationLink.findMany({
          where: {
            entityType: "PERSON",
            entityId: { in: personIds },
          },
          include: {
            conversation: {
              select: {
                id: true,
                title: true,
                updatedAt: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);
  const zoneLinksById = groupConversationLinks(zoneLinks);
  const categoryLinksById = groupConversationLinks(categoryLinks);
  const animalLinksById = groupConversationLinks(animalLinks);
  const personLinksById = groupConversationLinks(personLinks);
  const sortedImportantDates = [...importantDates].sort((a, b) => {
    const aNext = getNextImportantDateOccurrence(a.date, a.isRecurringYearly);
    const bNext = getNextImportantDateOccurrence(b.date, b.isRecurringYearly);
    const delta = aNext.getTime() - bNext.getTime();
    if (delta !== 0) return delta;
    return a.title.localeCompare(b.title, "fr");
  });

  return (
    <>
      <header>
        <p className="text-sm text-muted-foreground">Réglages</p>
        <h1 className="text-2xl font-semibold">Organisation de la maison</h1>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Apparence</CardTitle>
          </CardHeader>
          <CardContent>
            <ThemeToggle />
          </CardContent>
        </Card>

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
                Le lien d&apos;invitation est affiché ci-dessous (ou dans les logs
                serveur si aucun email n&apos;est configuré).
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

        <Card>
          <CardHeader>
            <CardTitle>Zones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createZone} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="name" placeholder="Garage" className="w-full sm:flex-1" required />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Ajouter
              </Button>
            </form>
            <div className="space-y-2 text-sm">
              {zones.map((zone) => (
                <div key={zone.id} className="flex flex-wrap items-stretch gap-2 sm:items-center">
                  <div className="flex w-full flex-col gap-2 sm:flex-1">
                    <form
                      action={updateZone}
                      className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap"
                    >
                      <input type="hidden" name="zoneId" value={zone.id} />
                      <Input
                        name="name"
                        defaultValue={zone.name}
                        className="w-full sm:flex-1"
                        required
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        Modifier
                      </Button>
                    </form>
                    {zoneLinksById.get(zone.id)?.length ? (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {zoneLinksById.get(zone.id)?.map((link) => (
                          <Link
                            key={link.id}
                            href={buildConversationHref({
                              pathname: "/app/settings",
                              conversationId: link.conversation.id,
                            })}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {link.conversation.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <form action={deleteZone}>
                    <input type="hidden" name="zoneId" value={zone.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      Supprimer
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Catégories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createCategory} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="houseId" value={houseId} />
              <Input
                name="name"
                placeholder="Entretien"
                className="w-full sm:flex-1"
                required
              />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Ajouter
              </Button>
            </form>
            <div className="space-y-2 text-sm">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex flex-wrap items-stretch gap-2 sm:items-center"
                >
                  <div className="flex w-full flex-col gap-2 sm:flex-1">
                    <form
                      action={updateCategory}
                      className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap"
                    >
                      <input type="hidden" name="categoryId" value={category.id} />
                      <Input
                        name="name"
                        defaultValue={category.name}
                        className="w-full sm:flex-1"
                        required
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        Modifier
                      </Button>
                    </form>
                    {categoryLinksById.get(category.id)?.length ? (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {categoryLinksById.get(category.id)?.map((link) => (
                          <Link
                            key={link.id}
                            href={buildConversationHref({
                              pathname: "/app/settings",
                              conversationId: link.conversation.id,
                            })}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {link.conversation.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <form action={deleteCategory}>
                    <input type="hidden" name="categoryId" value={category.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      Supprimer
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Animaux</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createAnimal} className="grid gap-2">
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="name" placeholder="Nala" required />
              <Input name="species" placeholder="Chat" />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Ajouter
              </Button>
            </form>
            <div className="space-y-2 text-sm">
              {animals.map((animal) => (
                <div key={animal.id} className="flex flex-wrap items-stretch gap-2 sm:items-center">
                  <div className="flex w-full flex-col gap-2 sm:flex-1">
                    <form
                      action={updateAnimal}
                      className="grid w-full gap-2 sm:grid-cols-[1.2fr,1fr,auto]"
                    >
                      <input type="hidden" name="animalId" value={animal.id} />
                      <Input name="name" defaultValue={animal.name} required />
                      <Input name="species" defaultValue={animal.species ?? ""} />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        Modifier
                      </Button>
                    </form>
                    {animalLinksById.get(animal.id)?.length ? (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {animalLinksById.get(animal.id)?.map((link) => (
                          <Link
                            key={link.id}
                            href={buildConversationHref({
                              pathname: "/app/settings",
                              conversationId: link.conversation.id,
                            })}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {link.conversation.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <form action={deleteAnimal}>
                    <input type="hidden" name="animalId" value={animal.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      Supprimer
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Personnes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createPerson} className="grid gap-2">
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="name" placeholder="Enfant" required />
              <Input name="relation" placeholder="Fils" />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Ajouter
              </Button>
            </form>
            <div className="space-y-2 text-sm">
              {people.map((person) => (
                <div key={person.id} className="flex flex-wrap items-stretch gap-2 sm:items-center">
                  <div className="flex w-full flex-col gap-2 sm:flex-1">
                    <form
                      action={updatePerson}
                      className="grid w-full gap-2 sm:grid-cols-[1.2fr,1fr,auto]"
                    >
                      <input type="hidden" name="personId" value={person.id} />
                      <Input name="name" defaultValue={person.name} required />
                      <Input
                        name="relation"
                        defaultValue={person.relation ?? ""}
                      />
                      <Button
                        type="submit"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto"
                      >
                        Modifier
                      </Button>
                    </form>
                    {personLinksById.get(person.id)?.length ? (
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {personLinksById.get(person.id)?.map((link) => (
                          <Link
                            key={link.id}
                            href={buildConversationHref({
                              pathname: "/app/settings",
                              conversationId: link.conversation.id,
                            })}
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {link.conversation.title}
                          </Link>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <form action={deletePerson}>
                    <input type="hidden" name="personId" value={person.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      className="w-full sm:w-auto"
                    >
                      Supprimer
                    </Button>
                  </form>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dates importantes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form action={createImportantDate} className="grid gap-2">
              <input type="hidden" name="houseId" value={houseId} />
              <Input name="title" placeholder="Anniversaire de Léa" required />
              <select
                name="type"
                defaultValue="BIRTHDAY"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="BIRTHDAY">Anniversaire</option>
                <option value="ANNIVERSARY">Commémoration</option>
                <option value="EVENT">Événement</option>
                <option value="OTHER">Autre</option>
              </select>
              <Input name="date" type="date" required />
              <select
                name="isRecurringYearly"
                defaultValue="true"
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="true">Répéter chaque année</option>
                <option value="false">Date unique</option>
              </select>
              <Input name="description" placeholder="Optionnel: dîner en famille" />
              <Button type="submit" variant="outline" className="w-full sm:w-auto">
                Ajouter
              </Button>
            </form>

            <div className="space-y-2 text-sm">
              {sortedImportantDates.length ? (
                sortedImportantDates.map((importantDate) => {
                  const nextOccurrence = getNextImportantDateOccurrence(
                    importantDate.date,
                    importantDate.isRecurringYearly
                  );

                  return (
                    <div
                      key={importantDate.id}
                      className="flex flex-wrap items-stretch gap-2 sm:items-center"
                    >
                      <form
                        action={updateImportantDate}
                        className="grid w-full gap-2 sm:flex-1 sm:grid-cols-[1.2fr,1fr,1fr,1fr,auto]"
                      >
                        <input
                          type="hidden"
                          name="importantDateId"
                          value={importantDate.id}
                        />
                        <Input
                          name="title"
                          defaultValue={importantDate.title}
                          required
                        />
                        <select
                          name="type"
                          defaultValue={importantDate.type}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="BIRTHDAY">Anniversaire</option>
                          <option value="ANNIVERSARY">Commémoration</option>
                          <option value="EVENT">Événement</option>
                          <option value="OTHER">Autre</option>
                        </select>
                        <Input
                          name="date"
                          type="date"
                          defaultValue={dateInputValue(importantDate.date)}
                          required
                        />
                        <select
                          name="isRecurringYearly"
                          defaultValue={importantDate.isRecurringYearly ? "true" : "false"}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                        >
                          <option value="true">Annuel</option>
                          <option value="false">Unique</option>
                        </select>
                        <Button
                          type="submit"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          Modifier
                        </Button>
                        <Input
                          name="description"
                          defaultValue={importantDate.description ?? ""}
                          placeholder="Description (optionnel)"
                          className="sm:col-span-4"
                        />
                        <p className="sm:col-span-4 text-xs text-muted-foreground">
                          Type: {importantDateTypeLabels[importantDate.type] ?? "Autre"} ·
                          Prochaine occurrence: {formatDate(nextOccurrence)}
                        </p>
                      </form>
                      <form action={deleteImportantDate}>
                        <input
                          type="hidden"
                          name="importantDateId"
                          value={importantDate.id}
                        />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="sm"
                          className="w-full sm:w-auto"
                        >
                          Supprimer
                        </Button>
                      </form>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aucune date importante pour le moment.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
