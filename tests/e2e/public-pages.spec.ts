import { expect, test } from "@playwright/test";

test.describe("Public pages", () => {
  test("landing page exposes core entrypoints", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("main")).toBeVisible();
    await expect(page.locator("header").getByText("Soot", { exact: true })).toBeVisible();
    await expect(page.locator('a[href="/login"]').first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  test("landing page auto-translates to english with browser locale", async ({ page, context }) => {
    await context.clearCookies();
    await page.addInitScript(() => {
      localStorage.removeItem("soot-language");
      document.cookie = "soot-language=; Max-Age=0; Path=/";
    });

    await page.goto("/");

    await expect(page.locator("html")).toHaveAttribute("lang", "en");
    await expect(page.getByRole("link", { name: /^Sign in$/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /^Start with Soot$/i })).toBeVisible();
  });

  test("login page renders magic-link form", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("Soot").first()).toBeVisible();
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(
      page.getByRole("button", {
        name: /send magic link|envoyer le (lien|link) magique|enviar el (enlace|link) magico/i,
      })
    ).toBeVisible();
  });

  test("house settings redirects unauthenticated users", async ({ page }) => {
    await page.goto("/app/house");

    await expect(page).toHaveURL(/\/login/i);
  });
});
