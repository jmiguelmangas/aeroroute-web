import { RoutePoint } from "../api/client";

export function splitAtAntimeridian(points: RoutePoint[]): RoutePoint[][] {
  if (points.length === 0) {
    return [];
  }
  const segments: RoutePoint[][] = [[points[0]]];
  for (const point of points.slice(1)) {
    const current = segments.at(-1)!;
    const previous = current.at(-1)!;
    if (Math.abs(point.longitude_deg - previous.longitude_deg) > 180) {
      segments.push([point]);
    } else {
      current.push(point);
    }
  }
  return segments;
}
