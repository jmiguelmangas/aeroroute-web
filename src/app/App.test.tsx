// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type { FlightPlanRequest, OptimizationResult } from "../api/client";
import { App } from "./App";

const result: OptimizationResult = {
  run_id: "run-widebody",
  request: {
    origin_icao: "LEMD",
    destination_icao: "KJFK",
    departure_time_utc: "2026-06-27T18:00:00Z",
    aircraft_type: "B77W",
    profile: "minimum_fuel",
  },
  status: "optimal",
  algorithm_version: "0.2.0",
  solver_termination_reason: "optimal",
  winner: {
    path: ["LEMD", "SYN-02", "KJFK"],
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
    waypoints: [],
    distance_m: 5_786_000,
    time_s: 28_680,
    fuel_kg: 69_239,
    score: 0,
  },
  alternatives: [],
  assumptions: ["Aircraft-specific mass assumptions"],
  data_quality: [],
  fuel_plan: {
    policy_identifier: "easa_simplified_v1",
    taxi_fuel_kg: 800,
    trip_fuel_kg: 69_239,
    contingency_fuel_kg: 3_462,
    alternate_fuel_kg: 4_500,
    final_reserve_fuel_kg: 2_790,
    extra_fuel_kg: 1_000,
    block_fuel_kg: 81_791,
    takeoff_fuel_kg: 80_991,
    estimated_landing_fuel_kg: 11_752,
    estimated_alternate_arrival_fuel_kg: 7_252,
    ramp_mass_kg: 291_791,
    takeoff_mass_kg: 290_991,
    estimated_landing_mass_kg: 221_752,
    operationally_approved: false,
    mass_iterations: 3,
    mass_converged: true,
    assumptions: ["Educational fuel arithmetic."],
  },
  destination_alternate: {
    icao_code: "KBOS",
    name: "Boston Logan",
    distance_from_destination_nm: 162.4,
    estimated_flight_time_minutes: 24,
    estimated_fuel_kg: 4_500,
    longest_published_runway_ft: 10_083,
    runway_compatible: true,
    selection: "suggested",
    navigation_source: "airac.net",
    airac_cycle: "2606",
    operationally_approved: false,
    rationale: [],
  },
  enroute_diversions: [
    {
      icao_code: "CYQX",
      name: "Gander",
      distance_to_route_nm: 88.2,
      nearest_route_fraction: 0.72,
      longest_published_runway_ft: 10_200,
      runway_compatible: true,
      navigation_source: "airac.net",
      airac_cycle: "2606",
      operationally_approved: false,
      rationale: [],
    },
  ],
};

const server = setupServer();

function flightPlanResponse(optimization: OptimizationResult) {
  return {
    flight_plan_id: "plan-1",
    optimization_run_id: optimization.run_id ?? "run-1",
    status: "completed",
    created_at: "2026-06-29T14:00:00Z",
    coded_route: "LEMD BARD3N DCT PAWLN1 KJFK",
    request: {
      ...optimization.request,
      origin_icao: "LEMD",
      destination_icao: "KJFK",
      aircraft_type: "B77W",
      profile: "minimum_fuel",
      callsign: "ARX101",
      payload_mass_kg: 8_000,
    },
    optimization,
    operationally_approved: false,
    disclaimer: "Educational pre-operational flight-plan simulation only.",
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
beforeEach(() => {
  server.use(
    http.get("http://localhost:8000/api/v1/airports/route-support", () =>
      HttpResponse.json({
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
      })
    ),
    http.get("http://localhost:8000/api/v1/operational-readiness", () =>
      HttpResponse.json({
        active_mode: "simulator",
        requested_mode: "simulator",
        operational_use_enabled: false,
        status: "simulator_only",
        evidence_contract_version: "1.0.0",
        evidence_baseline: "operational-readiness-evidence-2026-07-08",
        hazard_log_baseline: "operational-hazard-log-2026-07-08",
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
      })
    ),
    http.get("http://localhost:8000/api/v1/operational-data-sources", () =>
      HttpResponse.json({
        active_mode: "simulator",
        requested_mode: "simulator",
        operational_use_enabled: false,
        data_contract_version: "1.0.0",
        data_baseline: "operational-data-sources-2026-07-09",
        status: "simulator_only",
        sources: [],
        blocking_domains: ["notam", "airspace_restrictions"],
      })
    )
  );
});
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("AeroRoute search", () => {
  it("loads AIRAC runway choices and submits explicit selections", async () => {
    let submitted: FlightPlanRequest | undefined;
    server.use(
      http.get(
        "http://localhost:8000/api/v1/airports/:icao/runways",
        ({ params, request }) => {
          const type = new URL(request.url).searchParams.get("procedure_type");
          const departure = params.icao === "LEMD";
          return HttpResponse.json({
            airport_icao: params.icao,
            procedure_type: type,
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
            surface_wind_speed_kt: 18,
            surface_wind_direction_deg: 320,
            surface_wind_source: "open-meteo",
          });
        }
      ),
      http.post(
        "http://localhost:8000/api/v1/flight-plans",
        async ({ request }) => {
          submitted = (await request.json()) as FlightPlanRequest;
          return HttpResponse.json(
            flightPlanResponse({
              ...result,
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
            })
          );
        }
      )
    );
    const user = userEvent.setup();
    renderApp();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: "Departure runway" }),
      "32L"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Arrival runway" }),
      "22L"
    );
    await user.click(screen.getByRole("button", { name: "Generate OFP" }));

    await waitFor(() =>
      expect(submitted).toMatchObject({
        departure_runway: "32L",
        arrival_runway: "22L",
      })
    );
    expect(screen.getByText("RWY 32L · VAST2N")).toBeVisible();
    expect(screen.getByText("RWY 22L · CAMR4")).toBeVisible();
    expect(screen.getByText(/18 kt from 320°/)).toBeVisible();
  });

  it("submits the selected widebody and renders the API result", async () => {
    let submitted: FlightPlanRequest | undefined;
    server.use(
      http.post(
        "http://localhost:8000/api/v1/flight-plans",
        async ({ request }) => {
          submitted = (await request.json()) as FlightPlanRequest;
          return HttpResponse.json(flightPlanResponse(result));
        }
      )
    );
    const user = userEvent.setup();
    renderApp();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Aircraft" }),
      "B77W"
    );
    await user.click(screen.getByRole("button", { name: "Generate OFP" }));

    expect(await screen.findByRole("cell", { name: "69,239" })).toBeVisible();
    expect(submitted).toMatchObject({
      origin_icao: "LEMD",
      destination_icao: "KJFK",
      aircraft_type: "B77W",
      profile: "minimum_fuel",
      callsign: "ARX101",
      payload_mass_kg: 8_000,
    });

    await user.click(screen.getByRole("tab", { name: "Fuel plan" }));
    expect(screen.getByText("81,791 kg")).toBeVisible();
    expect(screen.getByText("Not operational")).toBeVisible();

    await user.click(screen.getByRole("tab", { name: "Alternates" }));
    expect(screen.getByText(/KBOS · Boston Logan/)).toBeVisible();
    expect(screen.getByRole("cell", { name: "CYQX" })).toBeVisible();
  });

  it("shows operational readiness blockers from the API", async () => {
    renderApp();

    expect(await screen.findByText("Simulator mode only")).toBeVisible();
    expect(screen.getByText("Launch operator not configured")).toBeVisible();
    expect(
      screen.getByText(/operational-readiness-evidence-2026-07-08/)
    ).toBeVisible();
    expect(
      screen.getByText(/operational-data-sources-2026-07-09/)
    ).toBeVisible();
    expect(screen.getByText(/notam, airspace_restrictions/)).toBeVisible();
    expect(screen.getByText(/not ICAO-fileable/)).toBeVisible();
  });

  it("keeps the reference result visible when the API is unavailable", async () => {
    server.use(
      http.post(
        "http://localhost:8000/api/v1/flight-plans",
        () => new HttpResponse(null, { status: 503 })
      )
    );
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Generate OFP" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The flight plan could not be generated."
    );
    await waitFor(() =>
      expect(screen.getByRole("cell", { name: "49,780" })).toBeVisible()
    );
  });
});

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  );
}
