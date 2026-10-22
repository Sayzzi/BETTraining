import { expect, test, type Page } from "@playwright/test";
import postgres from "postgres";

const ADVANCE_BUTTONS = ["Continuer", "Commencer le test", "Commencer l'exercice"];

async function signUp(page: Page) {
  const email = `seance-${crypto.randomUUID()}@example.com`;
  await page.goto("/inscription");
  await page.getByLabel("Prénom").fill("Jakub");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Mot de passe").fill("endurance-123");
  await page.getByRole("button", { name: "Créer mon compte" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour, Jakub." })).toBeVisible();
  return email;
}

/** Records a completed assessment directly: the assessment flow has its own end-to-end test. */
async function giveCompletedAssessment(email: string) {
  const sql = postgres(process.env.TEST_DATABASE_URL!, { max: 1 });
  try {
    const [{ id }] = await sql`select id from "user" where email = ${email}`;
    const [session] = await sql`
      insert into training_session (user_id, kind, status, device, input_mode)
      values (${id}, 'assessment', 'completed', 'desktop', 'keyboard') returning id`;
    await sql`
      insert into assessment (user_id, session_id, protocol_version, status, results, completed_at)
      values (${id}, ${session.id}, 1, 'completed',
        ${sql.json({ protocolVersion: 1, domains: [], fatigueResistance: 0.9 })}, now())`;
  } finally {
    await sql.end();
  }
}

async function rate(page: Page, legend: string, value: number) {
  await page.getByRole("group", { name: legend }).getByText(String(value), { exact: true }).click();
}

test("the BET session sends users without an assessment to the assessment first", async ({ page }) => {
  await signUp(page);
  await page.goto("/seance");
  await expect(page).toHaveURL(/\/bilan$/);
});

test("an assessed user runs a BET session and sees its summary", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "One full session run is enough.");
  test.setTimeout(240_000);

  const email = await signUp(page);
  await giveCompletedAssessment(email);
  await page.reload();
  await page.getByRole("link", { name: "Lancer ma séance BET" }).click();

  await expect(page.getByRole("radio", { name: "Après le sport" })).toBeChecked();
  await rate(page, "Ta fatigue mentale en ce moment", 3);
  await page.getByRole("button", { name: "Commencer la séance" }).click();

  // Briefings and tests in turn; Space answers the vigilance checks, other exercises time out.
  const ratings = page.getByRole("heading", { name: "Comment s'est passée la séance ?" });
  const deadline = Date.now() + 200_000;
  while (!(await ratings.isVisible().catch(() => false)) && Date.now() < deadline) {
    for (const name of ADVANCE_BUTTONS) {
      const button = page.getByRole("button", { name, exact: true });
      if (await button.isVisible().catch(() => false)) await button.click();
    }
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
  }

  await rate(page, "Ta fatigue mentale maintenant", 6);
  await rate(page, "L'effort que la séance t'a demandé", 7);
  await rate(page, "Ta motivation pendant la séance", 8);
  await page.getByRole("button", { name: "Voir le résumé" }).click();

  await expect(page.getByRole("heading", { name: "Résumé de la séance" })).toBeVisible();
  await expect(page.getByText("Écart entre les deux mesures de fatigue")).toBeVisible();
  // 7 effort x 30 minutes.
  await expect(page.getByRole("definition").filter({ hasText: "210" })).toBeVisible();
  await expect(page.getByRole("definition").filter({ hasText: "3 → 6" })).toBeVisible();
});

test("preferences change the week's plan shown on the home page", async ({ page }) => {
  const email = await signUp(page);
  await giveCompletedAssessment(email);
  await page.goto("/preferences");
  await page.getByRole("group", { name: "Séances BET par semaine" }).getByText("3", { exact: true }).click();
  await page.getByRole("group", { name: "Objectif hebdomadaire" }).getByText("5", { exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(page.getByText("Préférences enregistrées.")).toBeVisible();

  await page.goto("/");
  await expect(page.getByText(/sur 3, 0 séance légère, objectif 5 séances/)).toBeVisible();
});

test("a light session at rest runs short targeted exercises and ends on its summary", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "One full session run is enough.");
  test.setTimeout(120_000);

  const email = await signUp(page);
  await giveCompletedAssessment(email);
  await page.goto("/seance/legere");
  await expect(page.getByRole("heading", { name: "Séance légère" })).toBeVisible();
  await page.getByRole("radio", { name: "Au repos" }).check({ force: true });
  await expect(page.getByText(/la séance devient de l'entraînement cognitif/)).toBeVisible();
  await rate(page, "Ta fatigue mentale en ce moment", 2);
  await page.getByRole("button", { name: "Commencer la séance" }).click();

  const ratings = page.getByRole("heading", { name: "Comment s'est passée la séance ?" });
  const deadline = Date.now() + 90_000;
  while (!(await ratings.isVisible().catch(() => false)) && Date.now() < deadline) {
    for (const name of ADVANCE_BUTTONS) {
      const button = page.getByRole("button", { name, exact: true });
      if (await button.isVisible().catch(() => false)) await button.click();
    }
    await page.keyboard.press("Space");
    await page.waitForTimeout(150);
  }
  await rate(page, "Ta fatigue mentale maintenant", 3);
  await rate(page, "L'effort que la séance t'a demandé", 4);
  await rate(page, "Ta motivation pendant la séance", 7);
  await page.getByRole("button", { name: "Voir le résumé" }).click();

  await expect(page.getByRole("heading", { name: "Résumé de la séance légère" })).toBeVisible();
  // 4 effort x 10 minutes.
  await expect(page.getByRole("definition").filter({ hasText: "40" }).first()).toBeVisible();
});

