import { expect, test } from "@playwright/test";

test("landing page loads and language switch works", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("header").getByText("Soot", { exact: true })).toBeVisible();

  const languageSelect = page.locator("select").first();
  await languageSelect.selectOption("fr");
  await expect(page.getByRole("link", { name: "Connexion" })).toBeVisible();

  await languageSelect.selectOption("en");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
});
