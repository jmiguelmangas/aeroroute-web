import createClient from "openapi-fetch";

import type { components, paths } from "./generated/schema";

export type Airport = components["schemas"]["AirportResponse"];
export type Candidate = components["schemas"]["CandidateResponse"];
export type DataQualityFlag = components["schemas"]["DataQualityFlag"];
export type Explanation = components["schemas"]["ExplanationResponse"];
export type DestinationAlternate =
  components["schemas"]["DestinationAlternate"];
export type EnrouteDiversion = components["schemas"]["EnrouteDiversion"];
export type FuelPlan = components["schemas"]["FuelPlanResponse"];
export type FlightPlanRequest = components["schemas"]["FlightPlanRequest"];
export type FlightPlan = components["schemas"]["FlightPlanResponse"];
export type FlightPlanHistoryItem =
  components["schemas"]["FlightPlanHistoryItem"];
export type OptimizationHistoryItem =
  components["schemas"]["OptimizationHistoryItem"];
export type OptimizationRequest = components["schemas"]["OptimizationRequest"];
export type OptimizationResult = components["schemas"]["OptimizationResponse"];
export type OperationalReadiness =
  components["schemas"]["OperationalReadinessResponse"];
export type RoutePoint = components["schemas"]["RoutePoint"];
export type RouteSupport = components["schemas"]["RouteSupportResponse"];
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
    if (error || !data) {
      throw new Error(
        publicErrorMessage(error, "The simulation could not be completed.")
      );
    }
    return data;
  } catch (error) {
    throw normalizedError(error, "The simulation could not be completed.");
  }
}

export async function createFlightPlan(
  request: FlightPlanRequest
): Promise<FlightPlan> {
  try {
    const { data, error } = await api.POST("/api/v1/flight-plans", {
      body: request,
    });
    if (error || !data) {
      throw new Error(
        publicErrorMessage(error, "The flight plan could not be generated.")
      );
    }
    return data;
  } catch (error) {
    throw normalizedError(error, "The flight plan could not be generated.");
  }
}

export async function getFlightPlan(flightPlanId: string): Promise<FlightPlan> {
  const { data, error } = await api.GET(
    "/api/v1/flight-plans/{flight_plan_id}",
    { params: { path: { flight_plan_id: flightPlanId } } }
  );
  if (error || !data) throw new Error("The flight plan could not be loaded.");
  return data;
}

export async function listFlightPlans(): Promise<FlightPlanHistoryItem[]> {
  const { data, error } = await api.GET("/api/v1/flight-plans");
  if (error || !data) throw new Error("Flight-plan history unavailable.");
  return data;
}

export async function getFlightPlanPdf(flightPlanId: string): Promise<Blob> {
  const response = await globalThis.fetch(
    `${apiUrl}/api/v1/flight-plans/${flightPlanId}/pdf`
  );
  if (!response.ok) throw new Error("The OFP PDF could not be generated.");
  return response.blob();
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

export async function getRouteSupport(
  originIcao: string,
  destinationIcao: string
): Promise<RouteSupport> {
  const { data, error } = await api.GET("/api/v1/airports/route-support", {
    params: {
      query: { origin_icao: originIcao, destination_icao: destinationIcao },
    },
  });
  if (error || !data) throw new Error("Route support check unavailable.");
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

export async function getOperationalReadiness(): Promise<OperationalReadiness> {
  const { data, error } = await api.GET("/api/v1/operational-readiness");
  if (error || !data) throw new Error("Operational readiness unavailable.");
  return data;
}

function publicErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string" &&
    error.message.length <= 240
  ) {
    return error.message;
  }
  return fallback;
}

function normalizedError(error: unknown, fallback: string): Error {
  return error instanceof Error ? error : new Error(fallback);
}
