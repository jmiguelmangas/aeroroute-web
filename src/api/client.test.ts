import { describe, expect, it, vi } from "vitest";

import { createOptimization } from "./client";

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
