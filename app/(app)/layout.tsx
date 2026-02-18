import { ConfettiOverlay } from "@/components/tasks/confetti-overlay";
import { requireHouse, requireSession } from "@/lib/house";
import { AppShell } from "@/components/layout/app-shell";
import { ThemeProvider } from "@/components/theme/theme-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const membership = await requireHouse(session.user.id);

  return (
    <ThemeProvider storageScope={`house:${membership.houseId}`}>
      <AppShell
        houseName={membership.house.name}
        houseIconUrl={membership.house.iconUrl}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
      >
        <ConfettiOverlay />
        {children}
      </AppShell>
    </ThemeProvider>
  );
}
