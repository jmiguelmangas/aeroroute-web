import { expect, test } from "@playwright/test";

test("simulates a trajectory and shows its synthetic result", async ({
  page,
}) => {
  await page.route("**/api/v1/optimizations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ contentType: "application/json", body: "[]" });
      return;
    }
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        run_id: "run-1",
        status: "optimal",
        algorithm_version: "0.1.0",
        winner: {
          path: ["0:0:10000", "1:0:10000"],
          geometry: [
            { latitude_deg: 40.47, longitude_deg: -3.56 },
            { latitude_deg: 40.64, longitude_deg: -73.77 },
          ],
          distance_m: 5_000_000,
          time_s: 24_000,
          fuel_kg: 18_000,
          score: 0,
        },
        alternatives: [],
        solver_termination_reason: "optimal",
      }),
    });
  });
  await page.route("**/api/v1/optimizations/run-1/explanation", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "mlx",
        text: "Selected candidate: minimum_fuel. Fuel: 18000 kg. Time: 400 minutes.",
        warnings: [],
      }),
    })
  );

  await page.goto("/");
  await expect(
    page.getByText("Educational synthetic trajectory-efficiency simulator")
  ).toBeVisible();
  await page.getByRole("button", { name: "Simulate trajectory" }).click();

  await expect(
    page.getByRole("heading", { name: "Selected synthetic trajectory" })
  ).toBeVisible();
  await expect(page.getByText("18000 kg")).toBeVisible();
  await expect(page.getByLabel("Synthetic trajectory map")).toBeVisible();
  await page.getByRole("button", { name: "Explain this result" }).click();
  await expect(
    page.getByRole("heading", { name: "Explanation (mlx)" })
  ).toBeVisible();
  await expect(
    page.getByText("Selected candidate: minimum_fuel.")
  ).toBeVisible();
});
