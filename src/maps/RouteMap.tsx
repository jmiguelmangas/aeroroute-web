import { RoutePoint } from "../api/client";
import { splitAtAntimeridian } from "./routeGeometry";

export function RouteMap({ points }: { points: RoutePoint[] }) {
  return (
    <svg
      aria-label="Synthetic trajectory map"
      role="img"
      viewBox="0 0 800 400"
      width="100%"
    >
      <rect fill="#eef6ff" height="400" width="800" />
      {splitAtAntimeridian(points).map((segment, index) => (
        <polyline
          fill="none"
          key={index}
          points={segment
            .map(
              (point) =>
                `${((point.longitude_deg + 180) / 360) * 800},${
                  ((90 - point.latitude_deg) / 180) * 400
                }`
            )
            .join(" ")}
          stroke="#1267b3"
          strokeWidth="3"
        />
      ))}
    </svg>
  );
}
