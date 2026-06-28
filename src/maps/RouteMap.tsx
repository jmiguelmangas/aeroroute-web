import { Layers3, X } from "lucide-react";
import maplibregl, {
  GeoJSONSource,
  LngLatBounds,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import {
  Candidate,
  RoutePoint,
  WaypointDetail,
  WindField,
} from "../api/client";
import {
  geodesicSegments,
  splitAtAntimeridian,
  unwrapLongitudes,
} from "./routeGeometry";

const EMPTY_COLLECTION = {
  type: "FeatureCollection" as const,
  features: [],
};

const BASEMAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    openstreetmap: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      maxzoom: 19,
      attribution:
        '<a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a>',
    },
  },
  layers: [
    {
      id: "openstreetmap",
      type: "raster",
      source: "openstreetmap",
      paint: {
        "raster-brightness-max": 0.72,
        "raster-brightness-min": 0.08,
        "raster-contrast": 0.18,
        "raster-saturation": -0.32,
      },
    },
  ],
};
const MAP_STYLE = import.meta.env.VITE_AEROROUTE_MAP_STYLE_URL || BASEMAP_STYLE;

export function RouteMap({
  alternatives = [],
  baseline,
  candidate,
  destinationLabel = "Destination",
  originLabel = "Origin",
  variant = "analysis",
  windField,
}: {
  alternatives?: Candidate[];
  baseline?: Candidate | null;
  candidate: Candidate | null;
  destinationLabel?: string;
  originLabel?: string;
  variant?: "analysis" | "overview";
  windField?: WindField | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const webglSupported = typeof WebGLRenderingContext !== "undefined";
  const [mapRevision, setMapRevision] = useState(0);
  const [basemapUnavailable, setBasemapUnavailable] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedWaypoint, setSelectedWaypoint] =
    useState<WaypointDetail | null>(null);
  const [layers, setLayers] = useState({
    alternatives: true,
    baseline: true,
    waypoints: variant === "analysis",
    winds: variant === "analysis",
    weather: true,
  });

  useEffect(() => {
    if (!containerRef.current || !webglSupported) return;
    const map = new maplibregl.Map({
      attributionControl: false,
      center: [-36, 43],
      container: containerRef.current,
      dragRotate: false,
      maxPitch: 0,
      pitchWithRotate: false,
      style: MAP_STYLE,
      zoom: 2.4,
    });
    mapRef.current = map;
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "top-left"
    );
    map.addControl(
      new maplibregl.AttributionControl({ compact: false }),
      "bottom-right"
    );
    map.on("load", () => {
      if (mapRef.current !== map) return;
      addRouteLayers(map);
      map.once("idle", () => {
        if (mapRef.current === map) {
          setMapRevision((revision) => revision + 1);
        }
      });
    });
    map.on("error", (event) => {
      if (String(event.error).includes("tile")) setBasemapUnavailable(true);
    });
    return () => {
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
    };
  }, [webglSupported]);

  useEffect(() => {
    const map = mapRef.current;
    if (
      !map ||
      mapRevision === 0 ||
      !map.isStyleLoaded() ||
      !map.getLayer("optimal-line")
    )
      return;
    map.setLayoutProperty(
      "baseline-line",
      "visibility",
      layers.baseline && baseline ? "visible" : "none"
    );
    map.setLayoutProperty(
      "alternative-lines",
      "visibility",
      layers.alternatives && alternatives.length ? "visible" : "none"
    );
    map.setLayoutProperty(
      "wind-node-halos",
      "visibility",
      layers.winds ? "visible" : "none"
    );
    map.setLayoutProperty(
      "wind-nodes",
      "visibility",
      layers.winds ? "visible" : "none"
    );
    map.setLayoutProperty(
      "navigation-line",
      "visibility",
      layers.waypoints && hasNavigationRoute(candidate) ? "visible" : "none"
    );
    map.setLayoutProperty(
      "wind-field-heat",
      "visibility",
      layers.weather && hasWindField(windField) ? "visible" : "none"
    );
    setSourceData(map, "baseline-route", routeCollection(baseline));
    setSourceData(map, "alternative-routes", routesCollection(alternatives));
    setSourceData(map, "optimal-route", routeCollection(candidate));
    setSourceData(map, "wind-node-data", windCollection(candidate));
    setSourceData(map, "navigation-route", navigationCollection(candidate));
    setSourceData(map, "wind-field-data", windFieldCollection(windField));
    fitRoute(map, candidate, variant);
  }, [
    alternatives,
    baseline,
    candidate,
    layers,
    mapRevision,
    variant,
    windField,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];
    if (!map || mapRevision === 0 || !candidate) return;

    const origin = candidate.geometry[0];
    const destination = candidate.geometry[candidate.geometry.length - 1];
    if (origin)
      markersRef.current.push(addAirportMarker(map, origin, originLabel));
    if (destination) {
      markersRef.current.push(
        addAirportMarker(map, destination, destinationLabel)
      );
    }
    if (layers.waypoints) {
      candidate.waypoints.slice(1, -1).forEach((waypoint, index) => {
        const element = document.createElement("button");
        element.type = "button";
        element.className = `waypoint-marker ${waypoint.kind}`;
        element.title = `${waypoint.display_name ?? `SYN-${index + 1}`} · FL${waypoint.flight_level}`;
        element.ariaLabel = `${waypoint.display_name ?? `SYN-${index + 1}`}, ${waypointKindLabel(waypoint.kind)}, flight level ${waypoint.flight_level}`;
        element.addEventListener("click", () => setSelectedWaypoint(waypoint));
        markersRef.current.push(
          new maplibregl.Marker({ element })
            .setLngLat([waypoint.longitude_deg, waypoint.latitude_deg])
            .addTo(map)
        );
      });
    }
    if (layers.winds) {
      candidate.waypoints.forEach((waypoint) => {
        if (
          waypoint.wind_component_kt === null ||
          waypoint.wind_component_kt === undefined
        )
          return;
        const component = waypoint.wind_component_kt;
        const element = document.createElement("div");
        element.className = `wind-marker ${
          component > 1 ? "tailwind" : component < -1 ? "headwind" : "calm"
        }`;
        element.role = "img";
        element.ariaLabel = `${Math.abs(component)} knots ${
          component > 1
            ? "tailwind"
            : component < -1
              ? "headwind"
              : "wind component"
        } at ${waypoint.display_name ?? waypoint.node_id}`;
        element.title = element.ariaLabel;
        element.textContent = `${component > 0 ? "+" : ""}${Math.round(component)}`;
        markersRef.current.push(
          new maplibregl.Marker({ element, offset: [0, -20] })
            .setLngLat([waypoint.longitude_deg, waypoint.latitude_deg])
            .addTo(map)
        );
      });
    }
    if (layers.weather && windField) {
      windField.samples.forEach((sample) => {
        const element = document.createElement("div");
        element.className = "wind-field-marker";
        element.role = "img";
        element.ariaLabel = `${Math.round(sample.speed_kt)} knot wind vector`;
        element.title = `${Math.round(sample.speed_kt)} kt at ${Math.round(sample.direction_deg)} degrees`;
        const arrow = document.createElement("span");
        arrow.style.transform = `rotate(${sample.direction_deg}deg)`;
        const speed = document.createElement("small");
        speed.textContent = `${Math.round(sample.speed_kt)}`;
        element.append(arrow, speed);
        markersRef.current.push(
          new maplibregl.Marker({ element })
            .setLngLat([sample.longitude_deg, sample.latitude_deg])
            .addTo(map)
        );
      });
    }
  }, [
    candidate,
    destinationLabel,
    layers.waypoints,
    layers.winds,
    layers.weather,
    mapRevision,
    originLabel,
    windField,
  ]);

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  return (
    <figure className={`route-map ${variant}`}>
      <div
        aria-label="Synthetic trajectory map"
        className="route-map__canvas"
        ref={containerRef}
        role="region"
      />
      {!webglSupported || basemapUnavailable ? (
        <div className="map-status" role="status">
          Live basemap unavailable
        </div>
      ) : null}

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
                  disabled={
                    (key === "winds" && !hasWindSamples(candidate)) ||
                    (key === "weather" && !hasWindField(windField))
                  }
                  onChange={() => toggleLayer(key as keyof typeof layers)}
                  type="checkbox"
                />
                <span>
                  {layerLabel(key)}
                  {key === "winds" && !hasWindSamples(candidate)
                    ? " (unavailable)"
                    : key === "weather" && !hasWindField(windField)
                      ? " (unavailable)"
                      : ""}
                </span>
              </label>
            ))}
        </div>
      ) : null}

      {selectedWaypoint ? (
        <aside
          className="waypoint-detail"
          aria-label="Navigation point details"
        >
          <button
            aria-label="Close synthetic node details"
            onClick={() => setSelectedWaypoint(null)}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
          <strong>{selectedWaypoint.display_name ?? "Synthetic node"}</strong>
          <span>{waypointKindLabel(selectedWaypoint.kind)}</span>
          <span>
            {selectedWaypoint.latitude_deg.toFixed(2)},{" "}
            {selectedWaypoint.longitude_deg.toFixed(2)}
          </span>
          <span>FL{selectedWaypoint.flight_level}</span>
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
          {selectedWaypoint.navigation_source === "airac.net" ? (
            <span>
              AIRAC {selectedWaypoint.airac_cycle ?? "current"}
              {selectedWaypoint.airac_region
                ? ` · ${selectedWaypoint.airac_region}`
                : ""}
              {selectedWaypoint.snap_distance_nm != null
                ? ` · ${selectedWaypoint.snap_distance_nm.toFixed(1)} NM adjustment`
                : ""}
            </span>
          ) : null}
          {selectedWaypoint.inbound_via ? (
            <span>
              Inbound via {selectedWaypoint.inbound_via}
              {selectedWaypoint.airway_validated
                ? " · AIRAC confirmed"
                : " · direct segment"}
            </span>
          ) : null}
        </aside>
      ) : null}

      <figcaption className="map-legend">
        <span className="legend-optimal">Optimal route</span>
        {layers.baseline && baseline ? (
          <span className="legend-baseline">Baseline</span>
        ) : null}
        {layers.alternatives && alternatives.length ? (
          <span>Alternatives</span>
        ) : null}
        {layers.winds && hasWindSamples(candidate) ? (
          <span className="legend-winds">Winds at nodes</span>
        ) : null}
        {layers.waypoints && hasNavigationRoute(candidate) ? (
          <span className="legend-navigation">AIRAC route</span>
        ) : null}
        {layers.weather && hasWindField(windField) ? (
          <span className="legend-wind-field">Wind field (kt)</span>
        ) : null}
      </figcaption>
    </figure>
  );
}

function addRouteLayers(map: maplibregl.Map) {
  map.addSource("baseline-route", { type: "geojson", data: EMPTY_COLLECTION });
  map.addSource("alternative-routes", {
    type: "geojson",
    data: EMPTY_COLLECTION,
  });
  map.addSource("optimal-route", { type: "geojson", data: EMPTY_COLLECTION });
  map.addSource("wind-node-data", { type: "geojson", data: EMPTY_COLLECTION });
  map.addSource("navigation-route", {
    type: "geojson",
    data: EMPTY_COLLECTION,
  });
  map.addSource("wind-field-data", {
    type: "geojson",
    data: EMPTY_COLLECTION,
  });
  map.addLayer({
    id: "wind-field-heat",
    type: "heatmap",
    source: "wind-field-data",
    maxzoom: 7,
    paint: {
      "heatmap-weight": [
        "interpolate",
        ["linear"],
        ["get", "speedKt"],
        0,
        0,
        120,
        1,
      ],
      "heatmap-intensity": 0.72,
      "heatmap-radius": 62,
      "heatmap-opacity": 0.46,
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(39, 87, 170, 0)",
        0.25,
        "rgba(72, 78, 190, 0.52)",
        0.5,
        "rgba(31, 169, 201, 0.62)",
        0.72,
        "rgba(91, 196, 95, 0.68)",
        1,
        "rgba(240, 174, 52, 0.78)",
      ],
    },
  });
  map.addLayer({
    id: "baseline-line",
    type: "line",
    source: "baseline-route",
    paint: {
      "line-color": "#b9d9f2",
      "line-dasharray": [1.5, 3],
      "line-opacity": 0.8,
      "line-width": 2,
    },
  });
  map.addLayer({
    id: "alternative-lines",
    type: "line",
    source: "alternative-routes",
    paint: {
      "line-color": "#f3f8ff",
      "line-dasharray": [4, 3],
      "line-opacity": 0.85,
      "line-width": 2.4,
    },
  });
  map.addLayer({
    id: "optimal-line-casing",
    type: "line",
    source: "optimal-route",
    paint: {
      "line-color": "#092016",
      "line-opacity": 0.78,
      "line-width": 7,
    },
  });
  map.addLayer({
    id: "optimal-line",
    type: "line",
    source: "optimal-route",
    paint: {
      "line-color": "#6ed43d",
      "line-width": 4,
    },
  });
  map.addLayer({
    id: "wind-node-halos",
    type: "circle",
    source: "wind-node-data",
    paint: {
      "circle-color": "rgba(2, 11, 21, 0.82)",
      "circle-radius": 14,
    },
  });
  map.addLayer({
    id: "navigation-line",
    type: "line",
    source: "navigation-route",
    paint: {
      "line-color": "#35b8e8",
      "line-dasharray": [1.5, 1.2],
      "line-opacity": 0.95,
      "line-width": 3,
    },
  });
  map.addLayer({
    id: "wind-nodes",
    type: "circle",
    source: "wind-node-data",
    paint: {
      "circle-color": [
        "interpolate",
        ["linear"],
        ["get", "windComponentKt"],
        -80,
        "#8156d8",
        0,
        "#39a7df",
        80,
        "#f2b84b",
      ],
      "circle-radius": 9,
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
    },
  });
}

function setSourceData(
  map: maplibregl.Map,
  sourceId: string,
  data: Parameters<GeoJSONSource["setData"]>[0]
) {
  const source = map.getSource(sourceId);
  if (source) (source as GeoJSONSource).setData(data);
}

function routesCollection(routes: Candidate[]) {
  return {
    type: "FeatureCollection" as const,
    features: routes.flatMap((route, routeIndex) =>
      candidateSegments(route)
        .flatMap((segment) => geodesicSegments(segment))
        .map((coordinates, segmentIndex) => ({
          type: "Feature" as const,
          id: `${routeIndex}-${segmentIndex}`,
          properties: { routeIndex },
          geometry: {
            type: "LineString" as const,
            coordinates,
          },
        }))
    ),
  };
}

function routeCollection(candidate?: Candidate | null) {
  return routesCollection(candidate ? [candidate] : []);
}

function windCollection(candidate?: Candidate | null) {
  return {
    type: "FeatureCollection" as const,
    features: (candidate?.waypoints ?? [])
      .filter(
        (waypoint) =>
          waypoint.wind_component_kt !== null &&
          waypoint.wind_component_kt !== undefined
      )
      .map((waypoint) => ({
        type: "Feature" as const,
        properties: { windComponentKt: waypoint.wind_component_kt },
        geometry: {
          type: "Point" as const,
          coordinates: [waypoint.longitude_deg, waypoint.latitude_deg],
        },
      })),
  };
}

function navigationCollection(candidate?: Candidate | null) {
  const points = (candidate?.waypoints ?? [])
    .filter((waypoint) => waypoint.kind !== "synthetic")
    .map((waypoint) => ({
      latitude_deg: waypoint.latitude_deg,
      longitude_deg: waypoint.longitude_deg,
    }));
  return {
    type: "FeatureCollection" as const,
    features: splitAtAntimeridian(points).flatMap((segment) =>
      geodesicSegments(segment).map((coordinates) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates },
      }))
    ),
  };
}

function windFieldCollection(windField?: WindField | null) {
  return {
    type: "FeatureCollection" as const,
    features: (windField?.samples ?? []).map((sample) => ({
      type: "Feature" as const,
      properties: { speedKt: sample.speed_kt },
      geometry: {
        type: "Point" as const,
        coordinates: [sample.longitude_deg, sample.latitude_deg],
      },
    })),
  };
}

function hasWindSamples(candidate?: Candidate | null) {
  return (candidate?.waypoints ?? []).some(
    (waypoint) => waypoint.wind_component_kt !== null
  );
}

function hasWindField(windField?: WindField | null) {
  return Boolean(windField?.samples.length);
}

function hasNavigationRoute(candidate?: Candidate | null) {
  return (candidate?.waypoints ?? []).some(
    (waypoint) => waypoint.kind === "navigation_fix"
  );
}

function candidateSegments(candidate: Candidate): RoutePoint[][] {
  const geojson = candidate.display_geojson;
  if (!geojson) return splitAtAntimeridian(candidate.geometry);
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

function addAirportMarker(
  map: maplibregl.Map,
  point: RoutePoint,
  label: string
) {
  const element = document.createElement("div");
  element.className = "airport-marker";
  element.ariaLabel = `${label} airport`;
  element.title = label;
  element.innerHTML = `<span aria-hidden="true"></span><strong>${label}</strong>`;
  return new maplibregl.Marker({ element })
    .setLngLat([point.longitude_deg, point.latitude_deg])
    .addTo(map);
}

function fitRoute(
  map: maplibregl.Map,
  candidate: Candidate | null,
  variant: "analysis" | "overview"
) {
  if (!candidate?.geometry.length) return;
  const bounds = new LngLatBounds();
  unwrapLongitudes(candidate.geometry).forEach((point) => bounds.extend(point));
  map.fitBounds(bounds, {
    duration: 0,
    maxZoom: 5,
    padding: variant === "overview" ? 52 : 64,
  });
}

function layerLabel(key: string) {
  if (key === "waypoints") return "Navigation points";
  if (key === "winds") return "Winds at nodes";
  if (key === "weather") return "Wind field";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function waypointKindLabel(kind: WaypointDetail["kind"]) {
  if (kind === "navigation_fix") return "AIRAC navigation fix";
  if (kind === "oceanic_coordinate") return "Oceanic coordinate";
  if (kind === "airport") return "Airport";
  return "Solver node";
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
