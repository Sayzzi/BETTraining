import { expect, test } from "@playwright/test";

test("a new user signs up, reaches the home page, then signs out", async ({ page }) => {
  const email = `e2e-${crypto.randomUUID()}@example.com`;

  await page.goto("/");
  await expect(page).toHaveURL(/\/connexion$/);

  await page.getByRole("link", { name: "Créer un compte" }).click();
  await expect(page.getByRole("heading", { name: "Créer un compte" })).toBeVisible();

  await page.getByLabel("Prénom").fill("Jakub");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("endurance-123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Bonjour, Jakub." })).toBeVisible();

  await page.getByRole("button", { name: "Se déconnecter" }).click();
  await expect(page).toHaveURL(/\/connexion$/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("endurance-123");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour, Jakub." })).toBeVisible();
});

test("signing in with a wrong password shows an error", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByLabel("E-mail").fill(`nobody-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Mot de passe").fill("wrong-password");
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(
    page.getByRole("alert").filter({ hasText: "E-mail ou mot de passe incorrect." }),
  ).toBeVisible();
});
