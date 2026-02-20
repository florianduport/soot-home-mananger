import { expect, test } from "@playwright/test";
import { disconnectPrisma, seedSession } from "./helpers/auth";

test.afterAll(async () => {
  await disconnectPrisma();
});

test("notification preferences and task overrides are available", async ({ page }) => {
  await seedSession(page);

  await page.goto("/app/settings");
  await expect(page.getByText("Notifications")).toBeVisible();
  await expect(page.getByText("Quiet hours")).toBeVisible();
  await expect(page.getByText("Escalation")).toBeVisible();

  await page.goto("/app/tasks");
  await page.locator("#create-task").check({ force: true });
  await expect(page.getByText("Notification options")).toBeVisible();
});
