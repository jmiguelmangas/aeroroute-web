import { describe, expect, it, vi } from "vitest";

import { createOptimization } from "./client";

describe("createOptimization", () => {
  it("returns a typed API response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "optimal",
          winner: null,
          alternatives: [],
        }),
      })
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
