import { describe, expect, it } from "vitest";

import { splitAtAntimeridian } from "./routeGeometry";

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
