import { greatCircle } from "@turf/great-circle";

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

export function geodesicSegments(points: RoutePoint[]): number[][][] {
  if (points.length < 2) {
    return points.length
      ? [[[points[0].longitude_deg, points[0].latitude_deg]]]
      : [];
  }
  return points.slice(1).flatMap((destination, index) => {
    const origin = points[index];
    const feature = greatCircle(
      [origin.longitude_deg, origin.latitude_deg],
      [destination.longitude_deg, destination.latitude_deg],
      { npoints: 24, offset: 10 }
    );
    return feature.geometry.type === "MultiLineString"
      ? feature.geometry.coordinates
      : [feature.geometry.coordinates];
  });
}

export function unwrapLongitudes(points: RoutePoint[]): [number, number][] {
  let previous: number | undefined;
  return points.map((point) => {
    let longitude = point.longitude_deg;
    if (previous !== undefined) {
      while (longitude - previous > 180) longitude -= 360;
      while (longitude - previous < -180) longitude += 360;
    }
    previous = longitude;
    return [longitude, point.latitude_deg];
  });
}
