import { describe, expect, it } from "vitest";

import {
  geodesicSegments,
  splitAtAntimeridian,
  unwrapLongitudes,
} from "./routeGeometry";

describe("splitAtAntimeridian", () => {
  it("breaks a route instead of drawing across the entire map", () => {
    const segments = splitAtAntimeridian([
      { latitude_deg: 35, longitude_deg: 179 },
      { latitude_deg: 36, longitude_deg: -179 },
    ]);

    expect(segments).toHaveLength(2);
    expect(segments[0]).toHaveLength(1);
    expect(segments[1]).toHaveLength(1);
  });
});

describe("geodesicSegments", () => {
  it("densifies a transatlantic leg into a curved display line", () => {
    const segments = geodesicSegments([
      { latitude_deg: 40.47, longitude_deg: -3.56 },
      { latitude_deg: 40.64, longitude_deg: -73.78 },
    ]);

    expect(segments).toHaveLength(1);
    expect(segments[0].length).toBeGreaterThan(20);
    expect(
      Math.max(...segments[0].map((coordinate) => coordinate[1]))
    ).toBeGreaterThan(45);
  });

  it("splits a great-circle leg at the antimeridian", () => {
    const segments = geodesicSegments([
      { latitude_deg: 35, longitude_deg: 179 },
      { latitude_deg: 36, longitude_deg: -179 },
    ]);

    expect(segments.length).toBeGreaterThan(1);
  });
});

describe("unwrapLongitudes", () => {
  it("keeps camera bounds narrow around the antimeridian", () => {
    expect(
      unwrapLongitudes([
        { latitude_deg: 35, longitude_deg: 179 },
        { latitude_deg: 36, longitude_deg: -179 },
      ])
    ).toEqual([
      [179, 35],
      [181, 36],
    ]);
  });
});
