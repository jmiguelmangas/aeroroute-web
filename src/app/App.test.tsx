// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { MemoryRouter } from "react-router-dom";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { OptimizationRequest, OptimizationResult } from "../api/client";
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
};

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());

describe("AeroRoute search", () => {
  it("submits the selected widebody and renders the API result", async () => {
    let submitted: OptimizationRequest | undefined;
    server.use(
      http.post(
        "http://localhost:8000/api/v1/optimizations",
        async ({ request }) => {
          submitted = (await request.json()) as OptimizationRequest;
          return HttpResponse.json(result);
        }
      )
    );
    const user = userEvent.setup();
    renderApp();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Aircraft" }),
      "B77W"
    );
    await user.click(screen.getByRole("button", { name: "Search routes" }));

    expect(await screen.findByRole("cell", { name: "69,239" })).toBeVisible();
    expect(submitted).toMatchObject({
      origin_icao: "LEMD",
      destination_icao: "KJFK",
      aircraft_type: "B77W",
      profile: "minimum_fuel",
    });
  });

  it("keeps the reference result visible when the API is unavailable", async () => {
    server.use(
      http.post(
        "http://localhost:8000/api/v1/optimizations",
        () => new HttpResponse(null, { status: 503 })
      )
    );
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Search routes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The simulation could not be completed."
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
