import Link from "next/link";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/house";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions";

export default async function NotificationsPage() {
  const session = await requireSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const unreadCount = notifications.filter((notification) => !notification.readAt)
    .length;

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Centre de notifications</p>
          <h1 className="text-2xl font-semibold">Notifications</h1>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="outline" size="sm">
                Tout marquer comme lu
              </Button>
            </form>
          ) : null}
        </div>
      </header>

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Aucune notification pour le moment.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((notification) => {
            const createdAt = format(notification.createdAt, "dd/MM/yyyy HH:mm");
            return (
              <Card key={notification.id}>
                <CardHeader className="space-y-2 pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base font-semibold">
                      {notification.title}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      {notification.readAt ? null : (
                        <Badge variant="secondary">Non lu</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {createdAt}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {notification.body ? (
                    <p className="text-sm text-muted-foreground">
                      {notification.body}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-3">
                    {notification.linkUrl ? (
                      <Button asChild size="sm" variant="secondary">
                        <Link href={notification.linkUrl}>Ouvrir</Link>
                      </Button>
                    ) : null}
                    {notification.readAt ? null : (
                      <form action={markNotificationRead}>
                        <input
                          type="hidden"
                          name="notificationId"
                          value={notification.id}
                        />
                        <Button type="submit" size="sm" variant="ghost">
                          Marquer comme lu
                        </Button>
                      </form>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}
