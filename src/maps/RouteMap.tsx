import { Layers3, X } from "lucide-react";
import maplibregl, {
  GeoJSONSource,
  LngLatBounds,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import { Candidate, RoutePoint, WaypointDetail } from "../api/client";
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
}: {
  alternatives?: Candidate[];
  baseline?: Candidate | null;
  candidate: Candidate | null;
  destinationLabel?: string;
  originLabel?: string;
  variant?: "analysis" | "overview";
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
    setSourceData(map, "baseline-route", routeCollection(baseline));
    setSourceData(map, "alternative-routes", routesCollection(alternatives));
    setSourceData(map, "optimal-route", routeCollection(candidate));
    fitRoute(map, candidate, variant);
  }, [alternatives, baseline, candidate, layers, mapRevision, variant]);

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
        element.className = "waypoint-marker";
        element.title = `FL${waypoint.flight_level}`;
        element.ariaLabel = `${waypoint.display_name ?? `SYN-${index + 1}`}, synthetic node, flight level ${waypoint.flight_level}`;
        element.addEventListener("click", () => setSelectedWaypoint(waypoint));
        markersRef.current.push(
          new maplibregl.Marker({ element })
            .setLngLat([waypoint.longitude_deg, waypoint.latitude_deg])
            .addTo(map)
        );
      });
    }
  }, [candidate, destinationLabel, layers.waypoints, mapRevision, originLabel]);

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
                  onChange={() => toggleLayer(key as keyof typeof layers)}
                  type="checkbox"
                />
                <span>{layerLabel(key)}</span>
              </label>
            ))}
        </div>
      ) : null}

      {selectedWaypoint ? (
        <aside className="waypoint-detail" aria-label="Synthetic node details">
          <button
            aria-label="Close synthetic node details"
            onClick={() => setSelectedWaypoint(null)}
            title="Close"
            type="button"
          >
            <X aria-hidden="true" size={16} />
          </button>
          <strong>{selectedWaypoint.display_name ?? "Synthetic node"}</strong>
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
}

function setSourceData(
  map: maplibregl.Map,
  sourceId: string,
  data: ReturnType<typeof routesCollection>
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
  if (key === "waypoints") return "Synthetic nodes";
  return key.charAt(0).toUpperCase() + key.slice(1);
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
}
