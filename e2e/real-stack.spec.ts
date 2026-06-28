import { expect, test } from "@playwright/test";

test("optimizes MAD-JFK through the live API and database", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "Aircraft" }).selectOption("B788");
  await page.getByRole("button", { name: "Search routes" }).click();

  await expect(page.getByRole("alert")).toHaveCount(0);
  const resultRows = page
    .getByRole("region", { name: "Route analysis" })
    .getByRole("row");
  await expect(resultRows.nth(1)).toContainText("Optimal");
  await expect(resultRows.nth(1)).not.toContainText("49,780", {
    timeout: 20_000,
  });
});
