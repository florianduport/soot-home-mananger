import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

test("notification settings can be updated", async ({ page }) => {
  const userId = randomUUID();
  const houseId = randomUUID();
  const memberId = randomUUID();
  const sessionToken = randomUUID();
  const email = `playwright-${randomUUID()}@soot.local`;
  const now = new Date();
  const expires = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    await prisma.user.create({
      data: {
        id: userId,
        email,
        name: "Playwright User",
      },
    });

    await prisma.house.create({
      data: {
        id: houseId,
        name: "Maison Test",
        createdById: userId,
      },
    });

    await prisma.houseMember.create({
      data: {
        id: memberId,
        houseId,
        userId,
        role: "OWNER",
      },
    });

    await prisma.session.create({
      data: {
        id: randomUUID(),
        sessionToken,
        userId,
        expires,
      },
    });

    await page.context().addCookies([
      {
        name: "next-auth.session-token",
        value: sessionToken,
        url: "http://localhost:3210",
      },
    ]);

    await page.goto("/app/settings");

    const quietHoursToggle = page.getByLabel(/activer les heures silencieuses/i);
    const escalationToggle = page.getByLabel(/activer l'escalade/i);
    const quietHoursStart = page.getByLabel(/Début des heures silencieuses/i);
    const quietHoursEnd = page.getByLabel(/Fin des heures silencieuses/i);
    const escalationDelay = page.getByLabel(/Délai avant escalade/i);

    await quietHoursToggle.check();
    await escalationToggle.check();
    await quietHoursStart.fill("23:15");
    await quietHoursEnd.fill("06:45");
    await escalationDelay.fill("12");

    await page.getByRole("button", { name: /enregistrer les préférences/i }).click();

    await page.reload();

    await expect(quietHoursToggle).toBeChecked();
    await expect(escalationToggle).toBeChecked();
    await expect(quietHoursStart).toHaveValue("23:15");
    await expect(quietHoursEnd).toHaveValue("06:45");
    await expect(escalationDelay).toHaveValue("12");
  } finally {
    await prisma.notificationPreference.deleteMany({
      where: { userId, houseId },
    });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.houseMember.deleteMany({ where: { houseId } });
    await prisma.house.deleteMany({ where: { id: houseId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
});
