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
  terminal_selection: {
    departure_runway: "32L",
    departure_runway_suggested: false,
    sid_identifier: "VAST2N",
    arrival_runway: "22L",
    arrival_runway_suggested: false,
    star_identifier: "CAMR4",
    airac_cycle: "2606",
    rationale: [],
  },
};

const flightPlanResponse = {
  flight_plan_id: "plan-1",
  optimization_run_id: "run-1",
  status: "completed",
  created_at: "2026-06-29T14:00:00Z",
  coded_route: "LEMD VAST2N DCT CAMR4 KJFK",
  request: {
    ...optimizationResponse.request,
    callsign: "ARX101",
    payload_mass_kg: 8_000,
  },
  optimization: optimizationResponse,
  operationally_approved: false,
  disclaimer: "Educational pre-operational flight-plan simulation only.",
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/operational-readiness", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        active_mode: "simulator",
        requested_mode: "simulator",
        operational_use_enabled: false,
        status: "simulator_only",
        approval_required: true,
        regulator_path_identified: false,
        operator_profile_present: false,
        licensed_operational_data_present: false,
        safety_case_present: false,
        requirements_traceability_present: false,
        manual_procedure_acceptance_present: false,
        disclaimer:
          "AeroRoute MLX is currently limited to simulator mode. It is not ICAO-fileable, dispatch-authorized, or suitable for operational or safety-critical decisions.",
        gaps: [
          {
            code: "operator_profile_missing",
            title: "Launch operator not configured",
            severity: "blocking",
            detail: "A named operator is required.",
          },
        ],
      }),
    });
  });
  await page.route("**/api/v1/airports/route-support?**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        origin_icao: "LEMD",
        destination_icao: "KJFK",
        supported: true,
        status: "supported",
        airac_cycle: "2606",
        navigation_manifest: {
          source: "airac.net",
          loading: "on_demand",
        },
        airports: [],
        problems: [],
      }),
    });
  });
  await page.route("**/api/v1/airports/*/runways?**", async (route) => {
    const url = new URL(route.request().url());
    const airport = url.pathname.split("/").at(-2);
    const departure = airport === "LEMD";
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        airport_icao: airport,
        procedure_type: departure ? "SID" : "STAR",
        items: [
          {
            identifier: departure ? "32L" : "22L",
            bearing_deg: departure ? 322 : 220,
            length_ft: 12000,
            width_ft: 197,
            surface: "asphalt",
            compatible_procedures: 4,
            suggested: true,
          },
        ],
        suggested_runway: departure ? "32L" : "22L",
        airac_cycle: "2606",
        recommendation_basis: ["Fixture recommendation"],
      }),
    });
  });
  // Default explanation fixture so the dashboard's automatic post-optimization
  // explanation fetch (real backend call, not fabricated text) has somewhere
  // to land in every test. Individual tests override this when they need to
  // assert on specific explanation content.
  await page.route("**/api/v1/optimizations/*/explanation", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "template",
        text: "Deterministic route facts.",
        warnings: [],
      }),
    });
  });
});

test("searches routes and shows the results screen", async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route("**/api/v1/flight-plans", async (route) => {
    submitted = route.request().postDataJSON();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(flightPlanResponse),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Opciones avanzadas/ }).click();
  await page
    .getByRole("combobox", { name: "Pista salida" })
    .selectOption("32L");
  await page
    .getByRole("combobox", { name: "Pista llegada" })
    .selectOption("22L");
  await page.getByRole("button", { name: "Generar plan de vuelo" }).click();

  expect(submitted).toMatchObject({
    departure_runway: "32L",
    arrival_runway: "22L",
  });

  // Submitting navigates to the Resultados screen.
  await expect(
    page.getByRole("heading", { name: "Comparación de rutas" })
  ).toBeVisible();
  await expect(page.getByRole("cell", { name: "18,000" })).toBeVisible();
  await expect(page.getByLabel("Synthetic trajectory map")).toBeVisible();

  await page.getByRole("button", { name: "Open fullscreen map" }).click();
  await expect(
    page.getByRole("figure", { name: "Fullscreen interactive route map" })
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Open fullscreen map" })
  ).toBeVisible();
  await page.getByRole("button", { name: "Map layers" }).click();
  await expect(page.getByLabel("Navigation points")).toBeChecked();
  await page
    .getByRole("button", {
      name: "SYN-1, Solver node, flight level 350",
    })
    .click();
  await expect(page.getByText("9,000 kg fuel")).toBeVisible();

  await page.getByRole("tab", { name: "Perfil vertical" }).click();
  await expect(page.getByLabel("Perfil vertical sintético")).toBeVisible();

  // Technical detail (nav fixes / summary) lives behind the collapsed
  // "Detalles técnicos" accordion.
  await page.getByRole("button", { name: "Detalles técnicos" }).click();
  await page.getByRole("tab", { name: "Fijos de navegación" }).click();
  await expect(
    page.getByRole("columnheader", { name: "Nivel de vuelo" })
  ).toBeVisible();

  await page.getByRole("tab", { name: "Resumen" }).click();
  await expect(page.getByText("RWY 32L · VAST2N")).toBeVisible();
  await expect(page.getByText("RWY 22L · CAMR4")).toBeVisible();

  // The explanation panel fetches automatically for a real result: it must
  // show the backend explanation and a profile-derived claim, not fabricated
  // demo text.
  await expect(page.getByText("Deterministic route facts.")).toBeVisible();
  await expect(
    page.getByText(
      "La ruta seleccionada es la candidata de mínimo combustible entre las alternativas evaluadas."
    )
  ).toBeVisible();
});

test("keeps the reference result visible when the API is degraded", async ({
  page,
}) => {
  await page.route("**/api/v1/flight-plans", async (route) => {
    await route.fulfill({ status: 503, body: "weather provider unavailable" });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Generar plan de vuelo" }).click();

  await expect(
    page.getByRole("alert").getByText("The flight plan could not be generated.")
  ).toBeVisible();

  await page.getByRole("button", { name: "Resultados" }).click();
  await expect(page.getByRole("cell", { name: "49,780" })).toBeVisible();
});

test("loads an MLX explanation through the existing explanation endpoint", async ({
  page,
}) => {
  await page.route("**/api/v1/flight-plans", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(flightPlanResponse),
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
  await page.getByRole("button", { name: "Generar plan de vuelo" }).click();
  await page.getByRole("button", { name: "Regenerar explicación" }).click();

  await expect(page.getByText("Generada localmente con MLX")).toBeVisible();
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
  const origin = page.getByRole("combobox", { name: "Origen" });
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
    .getByRole("button", { name: "LEMD KJFK A320 minimum fuel optimal" })
    .click();

  await expect(
    page.getByRole("heading", { name: "LEMD → KJFK" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ruta almacenada" })
  ).toBeVisible();
  await expect(page.getByText("Deterministic route facts.")).toBeVisible();
});

test("reloads an immutable pre-operational OFP", async ({ page }) => {
  await page.route("**/api/v1/flight-plans/plan-1", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(flightPlanResponse),
    });
  });

  await page.goto("/flight-plans/plan-1");

  await expect(
    page.getByRole("heading", { name: "ARX101 · LEMD → KJFK" })
  ).toBeVisible();
  await expect(page.getByText(flightPlanResponse.coded_route)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exportar JSON" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exportar PDF" })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Registro de navegación" })
  ).toBeVisible();
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
