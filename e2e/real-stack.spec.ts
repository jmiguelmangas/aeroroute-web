import { expect, test } from "@playwright/test";

test("optimizes MAD-JFK through the live API and database", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aeronave" }).selectOption("B788");
  await page.getByRole("button", { name: "Generar plan de vuelo" }).click();

  await expect(page.getByRole("alert")).toHaveCount(0);
  const resultRows = page.getByRole("row");
  await expect(resultRows.nth(1)).toContainText("Óptima");
  await expect(resultRows.nth(1)).not.toContainText("49,780", {
    timeout: 20_000,
  });
  await expect(
    page.getByRole("button", { name: "Ver plan de vuelo completo →" })
  ).toBeVisible();
});
