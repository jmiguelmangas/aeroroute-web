export type OptimizationProfile = "minimum_fuel" | "minimum_time" | "balanced";

export interface OptimizationRequest {
  origin_icao: string;
  destination_icao: string;
  aircraft_type: "A320" | "B738";
  profile: OptimizationProfile;
}

export interface Candidate {
  path: string[];
  geometry: RoutePoint[];
  distance_m: number;
  time_s: number;
  fuel_kg: number;
  score: number;
}

export interface RoutePoint {
  latitude_deg: number;
  longitude_deg: number;
}

export interface OptimizationResult {
  run_id: string | null;
  status: string;
  algorithm_version: string;
  winner: Candidate | null;
  alternatives: Candidate[];
  solver_termination_reason: string;
}

export interface Explanation {
  provider: "template" | "mlx";
  text: string;
  warnings: string[];
}

const apiUrl =
  import.meta.env.VITE_AEROROUTE_API_URL ?? "http://localhost:8000";

export async function createOptimization(
  request: OptimizationRequest
): Promise<OptimizationResult> {
  const response = await fetch(`${apiUrl}/api/v1/optimizations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error("The simulation could not be completed.");
  }
  return (await response.json()) as OptimizationResult;
}

export async function getExplanation(runId: string): Promise<Explanation> {
  const response = await fetch(
    `${apiUrl}/api/v1/optimizations/${runId}/explanation`
  );
  if (!response.ok) {
    throw new Error("The explanation could not be loaded.");
  }
  return (await response.json()) as Explanation;
}
