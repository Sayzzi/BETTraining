import { expect, test } from "@playwright/test";

test("the science page is readable without an account and cites its sources", async ({ page }) => {
  await page.goto("/connexion");
  await page.getByRole("link", { name: "Ce que dit la science sur le BET" }).click();

  await expect(page).toHaveURL(/\/la-science$/);
  await expect(page.getByRole("heading", { level: 1, name: "Ce que dit la science" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Ce qui n'est pas prouvé" })).toBeVisible();

  const doi = page.getByRole("link", { name: "doi:10.3390/jfmk10040391" });
  await expect(doi).toHaveAttribute("href", "https://doi.org/10.3390/jfmk10040391");
});
