import { PrismaClient } from "@prisma/client";
import { randomBytes } from "crypto";
import type { Page } from "@playwright/test";

const prisma = new PrismaClient();

export async function seedSession(page: Page) {
  const unique = Date.now();
  const user = await prisma.user.create({
    data: {
      email: `playwright-${unique}@example.com`,
      name: "Playwright User",
    },
  });

  const house = await prisma.house.create({
    data: {
      name: "Maison Playwright",
      createdById: user.id,
    },
  });

  await prisma.houseMember.create({
    data: {
      houseId: house.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24);

  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires,
    },
  });

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
    },
  ]);

  return { user, house };
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
