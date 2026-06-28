import { describe, expect, it } from "vitest";

import type { Candidate } from "../api/client";
import {
  averageCruiseLevel,
  formatWindComponent,
  weatherEvidence,
  windStatistics,
} from "./routeMetrics";

const candidate = {
  waypoints: [
    waypoint(0, null),
    waypoint(340, -20),
    waypoint(360, 50),
    waypoint(0, null),
  ],
} as Candidate;

describe("route weather metrics", () => {
  it("uses only available node wind samples", () => {
    expect(windStatistics(candidate)).toEqual({
      averageKt: 15,
      maximumKt: 50,
      minimumKt: -20,
      sampleCount: 2,
    });
  });

  it("reports direction instead of calling every component a tailwind", () => {
    expect(formatWindComponent(15)).toBe("+15 kt tailwind");
    expect(formatWindComponent(-20)).toBe("20 kt headwind");
    expect(formatWindComponent(null)).toBe("Unavailable");
  });

  it("derives cruise level and weather evidence", () => {
    expect(averageCruiseLevel(candidate)).toBe(350);
    expect(
      weatherEvidence([
        {
          code: "WEATHER_STALE",
          severity: "warning",
          message: "Cruise winds use stale Open-Meteo pressure-level data.",
        },
      ])
    ).toEqual({
      source: "Cruise winds use stale Open-Meteo pressure-level data.",
      state: "Stale forecast",
    });
  });
});

function waypoint(flightLevel: number, windComponent: number | null) {
  return {
    flight_level: flightLevel,
    wind_component_kt: windComponent,
  };
}
