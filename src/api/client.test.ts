import { describe, expect, it, vi } from "vitest";

import { createFlightPlan, createOptimization } from "./client";

describe("createOptimization", () => {
  it("returns a typed API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            algorithm_version: "test",
            solver_termination_reason: "optimal",
            status: "optimal",
            winner: null,
            alternatives: [],
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    const result = await createOptimization({
      origin_icao: "LEMD",
      destination_icao: "KJFK",
      aircraft_type: "A320",
      profile: "balanced",
    });

    expect(result.status).toBe("optimal");
  });
});

describe("createFlightPlan", () => {
  it("preserves bounded public API problem messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: "aircraft_mass_outside_profile",
            message: "Reduce payload or extra fuel.",
          }),
          {
            status: 422,
            headers: { "Content-Type": "application/json" },
          }
        )
      )
    );

    await expect(
      createFlightPlan({
        origin_icao: "RJAA",
        destination_icao: "KSFO",
        aircraft_type: "B788",
        profile: "minimum_fuel",
        payload_mass_kg: 30_000,
      })
    ).rejects.toThrow("Reduce payload or extra fuel.");
  });
});
