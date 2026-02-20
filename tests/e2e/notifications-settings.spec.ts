import { expect, test } from "@playwright/test";
import { disconnectPrisma, seedSession } from "./helpers/auth";

test.afterAll(async () => {
  await disconnectPrisma();
});

test("notification preferences and task overrides are available", async ({ page }) => {
  await seedSession(page);

  await page.goto("/app/settings");
  await expect(page.locator('input[name="quietHoursEnabled"]')).toBeVisible();
  await expect(page.locator('input[name="quietHoursStart"]')).toBeVisible();
  await expect(page.locator('input[name="quietHoursEnd"]')).toBeVisible();
  await expect(page.locator('input[name="escalationEnabled"]')).toBeVisible();
  await expect(page.locator('input[name="escalationDelayHours"]')).toBeVisible();
  await expect(page.locator('select[name="escalationTarget"]')).toBeVisible();

  await page.goto("/app/tasks");
  await page.locator("#create-task").check({ force: true });
  await expect(page.locator('input[name="ignoreQuietHours"]')).toBeVisible();
  await expect(page.locator('select[name="escalationOverride"]')).toBeVisible();
});
