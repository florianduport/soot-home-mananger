import { expect, test } from "@playwright/test";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { createTestSession } from "./helpers/auth";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3210";

test("documents vault upload links to task and equipment", async ({ page }) => {
  const { sessionToken, equipmentId, taskId } = await createTestSession();

  await page.context().addCookies([
    {
      name: "next-auth.session-token",
      value: sessionToken,
      url: BASE_URL,
    },
  ]);

  const filePath = path.join(tmpdir(), `soot-doc-${Date.now()}.png`);
  const buffer = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=",
    "base64"
  );
  await writeFile(filePath, buffer);

  await page.goto("/app/documents");

  await page.setInputFiles('input[name="document"]', filePath);
  await page.selectOption('select[name="documentType"]', "WARRANTY");
  await page.fill('input[name="issuedOn"]', "2026-02-01");
  await page.fill('input[name="warrantyEndsOn"]', "2027-02-01");
  await page.fill('input[name="supplier"]', "Atelier Test");
  await page.selectOption('select[name="equipmentId"]', equipmentId);
  await page.selectOption('select[name="taskId"]', taskId);
  await page.fill('textarea[name="notes"]', "Garantie pour la chaudière.");
  await page.getByRole("button", { name: /Ajouter au coffre|Add to vault/i }).click();

  await expect(page.getByText(/Garantie ·|Warranty ·/i))
    .toBeVisible();
  await expect(page.getByText(/Garantie jusqu'au|Warranty until/i))
    .toBeVisible();
  await expect(page.getByText(/Équipement: Chaudière|Equipment: Chaudière/i))
    .toBeVisible();
  await expect(page.getByText(/Tâche: Réparer la porte|Task: Réparer la porte/i))
    .toBeVisible();
});
