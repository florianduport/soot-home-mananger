import { expect, test } from "@playwright/test";

test.describe("Public pages", () => {
  test("landing page exposes core entrypoints", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("Soot").first()).toBeVisible();
    await expect(page.getByRole("link", { name: /sign in/i }).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("landing page auto-translates to english with browser locale", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /^Sign in$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Start with Soot$/i })).toBeVisible();
  });

  test("login page renders magic-link form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("Soot").first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /send magic link|envoyer le (lien|link) magique/i,
      })
    ).toBeVisible();
  });
});
