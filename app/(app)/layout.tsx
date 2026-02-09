import { ConfettiOverlay } from "@/components/tasks/confetti-overlay";
import { requireHouse, requireSession } from "@/lib/house";
import { getUnreadNotificationCount } from "@/lib/notifications";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const membership = await requireHouse(session.user.id);
  const unreadNotifications = await getUnreadNotificationCount(session.user.id);

  return (
    <AppShell
      houseName={membership.house.name}
      houseIconUrl={membership.house.iconUrl}
      userName={session.user.name}
      userEmail={session.user.email}
      unreadNotifications={unreadNotifications}
    >
      <ConfettiOverlay />
      {children}
    </AppShell>
  );
}
