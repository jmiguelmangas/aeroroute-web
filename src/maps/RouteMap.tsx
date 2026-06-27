import { Layers3, X } from "lucide-react";
import { useState } from "react";

import { Candidate, RoutePoint, WaypointDetail } from "../api/client";
import { splitAtAntimeridian } from "./routeGeometry";

export function RouteMap({
  alternatives = [],
  baseline,
  candidate,
  variant = "analysis",
}: {
  alternatives?: Candidate[];
  baseline?: Candidate | null;
  candidate: Candidate | null;
  variant?: "analysis" | "overview";
}) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] =
    useState<WaypointDetail | null>(null);
  const [layers, setLayers] = useState({
    alternatives: true,
    baseline: true,
    weather: variant === "analysis",
    waypoints: variant === "analysis",
  });
  const routes = [
    ...(layers.baseline && baseline
      ? [{ className: "route-line baseline", candidate: baseline }]
      : []),
    ...(layers.alternatives
      ? alternatives.map((route, index) => ({
          className: `route-line alternative alt-${index + 1}`,
          candidate: route,
        }))
      : []),
    ...(candidate ? [{ className: "route-line optimal", candidate }] : []),
  ];
  const waypoints = candidate?.waypoints ?? [];

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  return (
    <figure className={`route-map ${variant}`}>
      <svg
        aria-label="Synthetic trajectory map"
        role="img"
        viewBox="0 0 800 400"
        width="100%"
      >
        <defs>
          <linearGradient id="ocean" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="#12395a" />
            <stop offset="48%" stopColor="#09243e" />
            <stop offset="100%" stopColor="#04182c" />
          </linearGradient>
          <radialGradient id="weatherGlow" cx="48%" cy="45%" r="45%">
            <stop offset="0%" stopColor="#7d4dff" stopOpacity="0.55" />
            <stop offset="58%" stopColor="#0eb5ff" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0eb5ff" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect fill="url(#ocean)" height="400" width="800" />
        <path
          className="land"
          d="M0 44 C86 58 122 92 154 142 C184 191 150 260 210 326 L0 400 Z"
        />
        <path
          className="land europe"
          d="M540 0 L800 0 L800 400 L676 400 C710 300 667 236 699 171 C626 150 602 95 540 72 Z"
        />
        <path
          className="land africa"
          d="M632 214 C708 220 760 292 733 400 L583 400 C559 326 581 253 632 214 Z"
        />
        {layers.weather ? (
          <>
            <rect className="wind-field" height="400" width="800" />
            <ellipse
              cx="390"
              cy="190"
              fill="url(#weatherGlow)"
              rx="260"
              ry="130"
            />
            {Array.from({ length: 64 }, (_, index) => (
              <path
                className="wind-streak"
                d="M0 0 l22 -5"
                key={index}
                style={{
                  transform: `translate(${40 + (index % 16) * 48}px, ${
                    55 + Math.floor(index / 16) * 70
                  }px) rotate(${-18 + (index % 5) * 7}deg)`,
                }}
              />
            ))}
          </>
        ) : null}
        {routes.map((route) =>
          candidateSegments(route.candidate).map((segment, index) => (
            <polyline
              className={route.className}
              fill="none"
              key={`${route.className}-${index}`}
              points={segment.map(projectPoint).join(" ")}
            />
          ))
        )}
        <MapPoint
          label="JFK"
          point={{ latitude_deg: 40.64, longitude_deg: -73.78 }}
        />
        <MapPoint
          label="MAD"
          point={{ latitude_deg: 40.47, longitude_deg: -3.56 }}
        />
      </svg>

      {layers.waypoints
        ? waypoints.slice(1, -1).map((waypoint, index) => {
            const position = projectPercent(waypoint);
            return (
              <button
                aria-label={`Waypoint ${index + 1}, flight level ${waypoint.flight_level}`}
                className="waypoint-marker"
                key={waypoint.node_id}
                onClick={() => setSelectedWaypoint(waypoint)}
                style={{ left: position.left, top: position.top }}
                title={`FL${waypoint.flight_level}`}
                type="button"
              />
            );
          })
        : null}

      <button
        aria-expanded={layersOpen}
        aria-label="Map layers"
        className="map-layers-button"
        onClick={() => setLayersOpen((open) => !open)}
        title="Map layers"
        type="button"
      >
        <Layers3 aria-hidden="true" size={18} />
      </button>
      {layersOpen ? (
        <div className="map-layers" aria-label="Map layers">
          <strong>Layers</strong>
          {Object.entries(layers)
            .filter(
              ([key]) =>
                (key !== "baseline" || Boolean(baseline)) &&
                (key !== "alternatives" || alternatives.length > 0)
            )
            .map(([key, checked]) => (
              <label key={key}>
                <input
                  checked={checked}
                  onChange={() => toggleLayer(key as keyof typeof layers)}
                  type="checkbox"
                />
                <span>{layerLabel(key)}</span>
              </label>
            ))}
        </div>
      ) : null}

      {selectedWaypoint ? (
        <aside className="waypoint-detail" aria-label="Waypoint details">
          <button
            aria-label="Close waypoint details"
            onClick={() => setSelectedWaypoint(null)}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
          <strong>FL{selectedWaypoint.flight_level}</strong>
          <span>{formatDuration(selectedWaypoint.elapsed_time_s)} elapsed</span>
          <span>
            {Math.round(selectedWaypoint.cumulative_fuel_kg).toLocaleString()}{" "}
            kg fuel
          </span>
          <span>
            {Math.round(selectedWaypoint.estimated_mass_kg).toLocaleString()} kg
            mass
          </span>
          <span>
            {selectedWaypoint.wind_component_kt === null
              ? "Wind unavailable"
              : `${selectedWaypoint.wind_component_kt} kt wind component`}
          </span>
        </aside>
      ) : null}

      <figcaption className="map-legend">
        <span className="legend-optimal">Optimal route</span>
        {layers.baseline && baseline ? (
          <span className="legend-baseline">Baseline</span>
        ) : null}
        {layers.alternatives ? <span>Alternatives</span> : null}
      </figcaption>
    </figure>
  );
}

function candidateSegments(candidate: Candidate): RoutePoint[][] {
  const geojson = candidate.display_geojson;
  if (!geojson) {
    return splitAtAntimeridian(candidate.geometry);
  }
  if (geojson.type === "MultiLineString") {
    return (geojson.coordinates as number[][][]).map((segment) =>
      segment.map(([longitude_deg, latitude_deg]) => ({
        latitude_deg,
        longitude_deg,
      }))
    );
  }
  if (geojson.type === "LineString") {
    return [
      (geojson.coordinates as number[][]).map(
        ([longitude_deg, latitude_deg]) => ({
          latitude_deg,
          longitude_deg,
        })
      ),
    ];
  }
  return splitAtAntimeridian(candidate.geometry);
}

function MapPoint({ label, point }: { label: string; point: RoutePoint }) {
  const [x, y] = projectPoint(point).split(",");
  return (
    <g className="map-point">
      <circle cx={x} cy={y} r="6" />
      <text x={Number(x) + 10} y={Number(y) - 8}>
        {label}
      </text>
    </g>
  );
}

function projectPoint(point: RoutePoint) {
  return `${((point.longitude_deg + 100) / 110) * 800},${
    ((68 - point.latitude_deg) / 42) * 400
  }`;
}

function projectPercent(point: RoutePoint) {
  return {
    left: `${((point.longitude_deg + 100) / 110) * 100}%`,
    top: `${((68 - point.latitude_deg) / 42) * 100}%`,
  };
}

function layerLabel(key: string) {
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
