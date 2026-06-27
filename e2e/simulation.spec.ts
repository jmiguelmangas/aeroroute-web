import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const optimizationResponse = {
  run_id: "run-1",
  request: {
    origin_icao: "LEMD",
    destination_icao: "KJFK",
    departure_time_utc: "2025-05-20T12:00:00Z",
    aircraft_type: "A320",
    profile: "minimum_fuel",
  },
  status: "optimal",
  algorithm_version: "0.1.0",
  winner: {
    path: ["0:0:10000", "1:0:10668", "2:0:10000"],
    geometry: [
      { latitude_deg: 40.47, longitude_deg: -3.56 },
      { latitude_deg: 45, longitude_deg: -38 },
      { latitude_deg: 40.64, longitude_deg: -73.77 },
    ],
    display_geojson: {
      type: "LineString",
      coordinates: [
        [-3.56, 40.47],
        [-38, 45],
        [-73.77, 40.64],
      ],
    },
    waypoints: [
      {
        node_id: "0:0:10000",
        latitude_deg: 40.47,
        longitude_deg: -3.56,
        flight_level: 328,
        elapsed_time_s: 0,
        cumulative_distance_m: 0,
        cumulative_fuel_kg: 0,
        estimated_mass_kg: 65000,
        wind_component_kt: null,
      },
      {
        node_id: "1:0:10668",
        latitude_deg: 45,
        longitude_deg: -38,
        flight_level: 350,
        elapsed_time_s: 12000,
        cumulative_distance_m: 2500000,
        cumulative_fuel_kg: 9000,
        estimated_mass_kg: 56000,
        wind_component_kt: 38,
      },
      {
        node_id: "2:0:10000",
        latitude_deg: 40.64,
        longitude_deg: -73.77,
        flight_level: 328,
        elapsed_time_s: 24000,
        cumulative_distance_m: 5000000,
        cumulative_fuel_kg: 18000,
        estimated_mass_kg: 47000,
        wind_component_kt: null,
      },
    ],
    distance_m: 5_000_000,
    time_s: 24_000,
    fuel_kg: 18_000,
    score: 0,
  },
  alternatives: [
    {
      path: ["0:1:10000", "1:1:10000"],
      geometry: [
        { latitude_deg: 40.47, longitude_deg: -3.56 },
        { latitude_deg: 42, longitude_deg: -40 },
        { latitude_deg: 40.64, longitude_deg: -73.77 },
      ],
      display_geojson: {
        type: "LineString",
        coordinates: [
          [-3.56, 40.47],
          [-40, 42],
          [-73.77, 40.64],
        ],
      },
      waypoints: [],
      distance_m: 5_100_000,
      time_s: 24_600,
      fuel_kg: 18_900,
      score: 2,
    },
  ],
  baseline: {
    path: ["0:0:10000", "1:0:10000"],
    geometry: [
      { latitude_deg: 40.47, longitude_deg: -3.56 },
      { latitude_deg: 40.64, longitude_deg: -73.77 },
    ],
    display_geojson: {
      type: "LineString",
      coordinates: [
        [-3.56, 40.47],
        [-73.77, 40.64],
      ],
    },
    waypoints: [],
    distance_m: 4_980_000,
    time_s: 23_800,
    fuel_kg: 18_200,
    score: 0,
  },
  assumptions: ["Still-air deterministic performance model"],
  data_quality: [
    {
      code: "WEATHER_STILL_AIR",
      severity: "warning",
      message: "Live weather is not included in this result.",
    },
  ],
  solver_termination_reason: "optimal",
};

test("searches routes and shows the dashboard result", async ({ page }) => {
  await page.route("**/api/v1/optimizations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(optimizationResponse),
    });
  });

  await page.goto("/");
  await expect(
    page.getByText("AeroRoute MLX is an educational trajectory-efficiency")
  ).toBeVisible();
  await page.getByRole("button", { name: "Search routes" }).click();

  await expect(
    page.getByRole("heading", { name: "2. Compare alternatives" })
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "18,000" })).toBeVisible();
  await expect(
    page
      .getByRole("region", { name: "Route analysis" })
      .getByLabel("Synthetic trajectory map")
  ).toBeVisible();

  const analysis = page.getByRole("region", { name: "Route analysis" });
  await analysis.getByRole("button", { name: "Map layers" }).click();
  await expect(analysis.getByLabel("Waypoints")).toBeChecked();
  await analysis
    .getByRole("button", { name: "Waypoint 1, flight level 350" })
    .click();
  await expect(analysis.getByText("9,000 kg fuel")).toBeVisible();

  await page.getByRole("tab", { name: "Vertical profile" }).click();
  await expect(page.getByLabel("Synthetic vertical profile")).toBeVisible();

  await page.getByRole("tab", { name: "Waypoints" }).click();
  await expect(
    page.getByRole("columnheader", { name: "Flight level" })
  ).toBeVisible();
});

test("keeps the reference dashboard visible when the API is degraded", async ({
  page,
}) => {
  await page.route("**/api/v1/optimizations", async (route) => {
    await route.fulfill({ status: 503, body: "weather provider unavailable" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Search routes" }).click();

  await expect(
    page.getByRole("alert").getByText("The simulation could not be completed.")
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "49,780" })).toBeVisible();
});

test("loads an MLX explanation through the existing explanation endpoint", async ({
  page,
}) => {
  await page.route("**/api/v1/optimizations", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(optimizationResponse),
    });
  });
  await page.route(
    "**/api/v1/optimizations/run-1/explanation",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          provider: "mlx",
          text: "MLX explanation constrained to deterministic facts.",
          warnings: [],
        }),
      });
    }
  );

  await page.goto("/");
  await page.getByRole("button", { name: "Search routes" }).click();
  await page.getByRole("button", { name: "Regenerate explanation" }).click();

  await expect(page.getByText("Generated locally with MLX")).toBeVisible();
  await expect(
    page.getByText("MLX explanation constrained to deterministic facts.")
  ).toBeVisible();
});

test("selects an airport from the catalogue autocomplete", async ({ page }) => {
  await page.route("**/api/v1/airports?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            icao_code: "LEMD",
            iata_code: "MAD",
            name: "Adolfo Suárez Madrid-Barajas",
            municipality: "Madrid",
            iso_country: "ES",
            latitude_deg: 40.47,
            longitude_deg: -3.56,
          },
        ],
        limit: 8,
        offset: 0,
      }),
    });
  });

  await page.goto("/");
  const origin = page.getByRole("combobox", { name: "Origin" });
  await origin.fill("MAD");
  await page
    .getByRole("button", {
      name: "MAD · LEMD Adolfo Suárez Madrid-Barajas, Madrid",
    })
    .click();

  await expect(origin).toHaveValue("MAD · LEMD — Adolfo Suárez Madrid-Barajas");
});

test("shows persisted run history and its explanation", async ({ page }) => {
  await page.route("**/api/v1/optimizations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify([
          {
            run_id: "run-1",
            status: "optimal",
            origin_icao: "LEMD",
            destination_icao: "KJFK",
            aircraft_type: "A320",
            profile: "minimum_fuel",
          },
        ]),
      });
      return;
    }
    await route.fallback();
  });
  await page.route("**/api/v1/optimizations/run-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(optimizationResponse),
    });
  });
  await page.route(
    "**/api/v1/optimizations/run-1/explanation",
    async (route) => {
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          provider: "template",
          text: "Deterministic route facts.",
          warnings: [],
        }),
      });
    }
  );

  await page.goto("/runs");
  await page
    .getByRole("link", { name: "LEMD KJFK A320 minimum fuel optimal" })
    .click();

  await expect(
    page.getByRole("heading", { name: "LEMD → KJFK" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Stored route" })
  ).toBeVisible();
  await expect(page.getByText("Deterministic route facts.")).toBeVisible();
});

test("has no serious accessibility violations in the reference dashboard", async ({
  page,
}) => {
  await page.goto("/");
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const seriousViolations = results.violations.filter((violation) =>
    ["serious", "critical"].includes(violation.impact ?? "")
  );

  expect(seriousViolations).toEqual([]);
});
