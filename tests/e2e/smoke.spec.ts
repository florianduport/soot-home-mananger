import { expect, test } from "@playwright/test";

test("landing page language switch supports fr/en/es", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("main")).toBeVisible();
  await expect(page.locator("header").getByText("Soot", { exact: true })).toBeVisible();

  const languageSelect = page.getByTestId("language-switcher-select");
  await expect(languageSelect).toBeVisible();

  await languageSelect.selectOption("fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("link", { name: "Connexion" })).toBeVisible();

  await languageSelect.selectOption("en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();

  await languageSelect.selectOption("es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.getByRole("link", { name: "Iniciar sesion" })).toBeVisible();
});
