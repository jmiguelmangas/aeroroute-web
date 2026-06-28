import createClient from "openapi-fetch";

import type { components, paths } from "./generated/schema";

export type Airport = components["schemas"]["AirportResponse"];
export type Candidate = components["schemas"]["CandidateResponse"];
export type DataQualityFlag = components["schemas"]["DataQualityFlag"];
export type Explanation = components["schemas"]["ExplanationResponse"];
export type OptimizationHistoryItem =
  components["schemas"]["OptimizationHistoryItem"];
export type OptimizationRequest = components["schemas"]["OptimizationRequest"];
export type OptimizationResult = components["schemas"]["OptimizationResponse"];
export type RoutePoint = components["schemas"]["RoutePoint"];
export type RunwayOptions = components["schemas"]["RunwayOptionsResponse"];
export type TerminalSelection = components["schemas"]["TerminalSelection"];
export type WaypointDetail = components["schemas"]["WaypointDetail"];
export type WindField = components["schemas"]["WindFieldResponse"];
export type OptimizationProfile = OptimizationRequest["profile"];

const apiUrl =
  import.meta.env.VITE_AEROROUTE_API_URL ?? "http://localhost:8000";

const api = createClient<paths>({
  baseUrl: apiUrl,
  fetch: (request) => globalThis.fetch(request),
});

export async function createOptimization(
  request: OptimizationRequest
): Promise<OptimizationResult> {
  try {
    const { data, error } = await api.POST("/api/v1/optimizations", {
      body: request,
    });
    if (error || !data) throw new Error();
    return data;
  } catch {
    throw new Error("The simulation could not be completed.");
  }
}

export async function searchAirports(query: string): Promise<Airport[]> {
  try {
    const { data, error } = await api.GET("/api/v1/airports", {
      params: { query: { query, limit: 8 } },
    });
    if (error || !data) throw new Error();
    return data.items;
  } catch {
    throw new Error("Airport catalogue unavailable.");
  }
}

export async function getRunwayOptions(
  airportIcao: string,
  procedureType: "SID" | "STAR",
  atUtc?: string
): Promise<RunwayOptions> {
  const { data, error } = await api.GET("/api/v1/airports/{icao}/runways", {
    params: {
      path: { icao: airportIcao },
      query: { procedure_type: procedureType, at_utc: atUtc },
    },
  });
  if (error || !data) throw new Error("Runway options unavailable.");
  return data;
}

export async function listOptimizations(): Promise<OptimizationHistoryItem[]> {
  try {
    const { data, error } = await api.GET("/api/v1/optimizations");
    if (error || !data) throw new Error();
    return data;
  } catch {
    throw new Error("Run history unavailable.");
  }
}

export async function getOptimization(
  runId: string
): Promise<OptimizationResult> {
  try {
    const { data, error } = await api.GET("/api/v1/optimizations/{run_id}", {
      params: { path: { run_id: runId } },
    });
    if (error || !data) throw new Error();
    return data;
  } catch {
    throw new Error("The stored run could not be loaded.");
  }
}

export async function getExplanation(runId: string): Promise<Explanation> {
  try {
    const { data, error } = await api.GET(
      "/api/v1/optimizations/{run_id}/explanation",
      { params: { path: { run_id: runId } } }
    );
    if (error || !data) throw new Error();
    return data;
  } catch {
    throw new Error("The explanation could not be loaded.");
  }
}

export async function getWindField(
  atUtc: string,
  origin: RoutePoint,
  destination: RoutePoint,
  flightLevel = 350
): Promise<WindField> {
  const { data, error } = await api.GET("/api/v1/weather/wind-field", {
    params: {
      query: {
        at_utc: atUtc,
        destination_latitude_deg: destination.latitude_deg,
        destination_longitude_deg: destination.longitude_deg,
        flight_level: flightLevel,
        origin_latitude_deg: origin.latitude_deg,
        origin_longitude_deg: origin.longitude_deg,
      },
    },
  });
  if (error || !data) throw new Error("Wind field unavailable.");
  return data;
}
