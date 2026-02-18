/**
 * Supprime les doublons HouseMember pour que chaque userId n'apparaisse qu'une fois.
 * À lancer une fois si `prisma db push` échoue avec :
 * "A unique constraint covering the column `userId` on the table `HouseMember` will be added.
 *  If there are existing duplicate values, this will fail."
 *
 * Usage: node scripts/fix-house-member-duplicates.mjs
 * Ou avec DATABASE_URL: DATABASE_URL="postgresql://..." node scripts/fix-house-member-duplicates.mjs
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const members = await prisma.houseMember.findMany({
    orderBy: [{ userId: "asc" }, { createdAt: "asc" }],
    select: { id: true, userId: true, createdAt: true },
  });

  const byUser = new Map();
  for (const m of members) {
    if (!byUser.has(m.userId)) byUser.set(m.userId, []);
    byUser.get(m.userId).push(m);
  }

  const toDelete = [];
  for (const [, list] of byUser) {
    if (list.length <= 1) continue;
    // Garder le premier (plus ancien), supprimer les autres
    for (let i = 1; i < list.length; i++) {
      toDelete.push(list[i].id);
    }
  }

  if (toDelete.length === 0) {
    console.log("Aucun doublon HouseMember.userId trouvé. Tu peux lancer prisma db push.");
    return;
  }

  console.log(`${toDelete.length} entrée(s) en doublon à supprimer.`);
  const result = await prisma.houseMember.deleteMany({
    where: { id: { in: toDelete } },
  });
  console.log(`${result.count} entrée(s) supprimée(s). Tu peux relancer prisma db push.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
