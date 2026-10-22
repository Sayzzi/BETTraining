import { expect, test } from "@playwright/test";

const ADVANCE_BUTTONS = ["Continuer", "Commencer le test", "Commencer l'exercice"];

test("a new user is guided to the assessment, completes it and sees the results", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "One full protocol run is enough.");
  test.setTimeout(300_000);

  await page.goto("/inscription");
  await page.getByLabel("Prénom").fill("Jakub");
  await page.getByLabel("E-mail").fill(`bilan-${crypto.randomUUID()}@example.com`);
  await page.getByLabel("Mot de passe").fill("endurance-123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();

  await expect(page.getByRole("heading", { name: "Commence par ton bilan" })).toBeVisible();
  await page.getByRole("link", { name: "Passer mon bilan" }).click();
  await page.getByRole("button", { name: "Commencer le bilan" }).click();

  // Click through every briefing and test; Space answers the vigilance tests, other tests just time out.
  const deadline = Date.now() + 280_000;
  while (!page.url().includes("/bilan/resultats/") && Date.now() < deadline) {
    for (const name of ADVANCE_BUTTONS) {
      const button = page.getByRole("button", { name, exact: true });
      if (await button.isVisible().catch(() => false)) await button.click();
    }
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
  }

  await expect(page.getByRole("heading", { name: "Résultats du bilan" })).toBeVisible();
  await expect(page.getByText("Résistance à la fatigue", { exact: true })).toBeVisible();
  await expect(page.getByRole("row")).toHaveCount(5);

  await page.getByRole("link", { name: "Retour à l'accueil" }).click();
  await expect(page.getByText(/Ton dernier bilan date du/)).toBeVisible();
});
