import { randomBytes } from "crypto";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL =
    "postgresql://postgres:postgres@127.0.0.1:5432/soot?schema=public";
}

const prisma = new PrismaClient();

export async function createTestSession() {
  const seed = randomBytes(4).toString("hex");
  const email = `playwright+${seed}@soot.local`;

  const user = await prisma.user.create({
    data: {
      email,
      name: "Playwright User",
    },
  });

  const house = await prisma.house.create({
    data: {
      name: "Maison Playwright",
      createdById: user.id,
      isOnboardingCompleted: true,
      clientStatus: "ACTIVE",
    },
  });

  await prisma.houseMember.create({
    data: {
      houseId: house.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  const equipment = await prisma.equipment.create({
    data: {
      houseId: house.id,
      name: "Chaudière",
    },
  });

  const task = await prisma.task.create({
    data: {
      houseId: house.id,
      title: "Réparer la porte",
      createdById: user.id,
    },
  });

  const sessionToken = randomBytes(16).toString("hex");
  await prisma.session.create({
    data: {
      sessionToken,
      userId: user.id,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  return {
    sessionToken,
    houseId: house.id,
    equipmentId: equipment.id,
    taskId: task.id,
  };
}
