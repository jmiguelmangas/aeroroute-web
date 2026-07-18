import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import {
  Candidate,
  Explanation,
  getAssuranceReadiness,
  getDispatchReadiness,
  getExplanation,
  getOperationalDataSources,
  getOperationalReadiness,
  getOperatorApprovalReadiness,
  OptimizationResult,
  validateIcaoFpl,
  WindField,
} from "../api/client";

export const demoResult: OptimizationResult = {
  run_id: null,
  status: "demo",
  algorithm_version: "demo-reference",
  solver_termination_reason: "reference_fixture",
  request: {
    origin_icao: "LEMD",
    destination_icao: "KJFK",
    aircraft_type: "A320",
    profile: "minimum_fuel",
  },
  winner: withDisplayData({
    path: ["LEMD", "N42W025", "N45W050", "KJFK"],
    geometry: [
      { latitude_deg: 40.47, longitude_deg: -3.56 },
      { latitude_deg: 45.2, longitude_deg: -22.0 },
      { latitude_deg: 47.4, longitude_deg: -48.0 },
      { latitude_deg: 40.64, longitude_deg: -73.78 },
    ],
    distance_m: 5_860_000,
    time_s: 26_520,
    fuel_kg: 49_780,
    score: 0.91,
    fuel_breakdown: {
      modeled_trip_fuel_kg: 49_780,
      cruise_fuel_kg: 48_480,
      fixed_climb_descent_fuel_kg: 1_300,
      mass_assumption_fuel_kg: 3_000,
      reserves_optimized: false,
    },
    objective_breakdown: {
      fuel_delta: -0.021,
      time_delta: -0.011,
      route_extension: 0.007,
      fuel_weight: 0.8,
      time_weight: 0.15,
      extension_weight: 0.05,
      fuel_component: -0.0168,
      time_component: -0.00165,
      extension_component: 0.00035,
      total_score: -0.0181,
    },
  }),
  alternatives: [
    withDisplayData({
      path: ["LEMD", "N39W025", "N42W050", "KJFK"],
      geometry: [
        { latitude_deg: 40.47, longitude_deg: -3.56 },
        { latitude_deg: 41.6, longitude_deg: -23.0 },
        { latitude_deg: 43.1, longitude_deg: -49.0 },
        { latitude_deg: 40.64, longitude_deg: -73.78 },
      ],
      distance_m: 5_819_000,
      time_s: 26_820,
      fuel_kg: 50_860,
      score: 0.86,
    }),
    withDisplayData({
      path: ["LEMD", "N48W020", "N51W045", "KJFK"],
      geometry: [
        { latitude_deg: 40.47, longitude_deg: -3.56 },
        { latitude_deg: 49.1, longitude_deg: -20.0 },
        { latitude_deg: 52.5, longitude_deg: -45.0 },
        { latitude_deg: 40.64, longitude_deg: -73.78 },
      ],
      distance_m: 6_075_000,
      time_s: 27_300,
      fuel_kg: 52_340,
      score: 0.82,
    }),
  ],
  assumptions: [
    "Still-air deterministic performance model",
    "Representative initial mass of 65,000 kg",
    "Synthetic cruise corridor",
  ],
  data_quality: [
    {
      code: "WEATHER_FIXTURE",
      severity: "warning",
      message: "Weather uses a frozen reference snapshot.",
    },
    {
      code: "PERFORMANCE_CURATED",
      severity: "info",
      message: "Aircraft performance uses a curated reference model.",
    },
  ],
};

export const demoExplanation: Explanation = {
  provider: "template",
  text: "The selected synthetic route uses the strongest tailwind corridor while keeping the added distance modest. It saves 1,080 kg of estimated fuel versus Alternative 1 in this reference scenario.",
  warnings: [
    "Synthetic trajectory only; not suitable for operational flight planning.",
  ],
};

export function withDisplayData(
  candidate: Omit<Candidate, "display_geojson" | "waypoints">
): Candidate {
  return {
    ...candidate,
    display_geojson: {
      type: "LineString" as const,
      coordinates: candidate.geometry.map((point) => [
        point.longitude_deg,
        point.latitude_deg,
      ]),
    },
    waypoints: candidate.geometry.map((point, index) => ({
      node_id: candidate.path[index] ?? `P${index + 1}`,
      display_name: `SYN-${String(index + 1).padStart(2, "0")}`,
      kind: "synthetic" as const,
      latitude_deg: point.latitude_deg,
      longitude_deg: point.longitude_deg,
      flight_level:
        index === 0 || index === candidate.geometry.length - 1 ? 0 : 350,
      elapsed_time_s:
        (candidate.time_s * index) / (candidate.geometry.length - 1),
      cumulative_distance_m:
        (candidate.distance_m * index) / (candidate.geometry.length - 1),
      cumulative_fuel_kg:
        (candidate.fuel_kg * index) / (candidate.geometry.length - 1),
      estimated_mass_kg:
        65_000 - (candidate.fuel_kg * index) / (candidate.geometry.length - 1),
      wind_component_kt:
        index === 0 || index === candidate.geometry.length - 1 ? null : 38,
    })),
  };
}

/**
 * Lifted above the Search/Results view-swap so switching sidebar views
 * doesn't reset the just-generated (or demo) result back to nothing.
 */
export function useSearchResult() {
  const [result, setResult] = useState<OptimizationResult>(demoResult);
  const [endpointLabels, setEndpointLabels] = useState({
    destination: "JFK",
    origin: "MAD",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flightPlanId, setFlightPlanId] = useState<string | null>(null);
  const [windField, setWindField] = useState<WindField | null>(null);

  const explanationQuery = useQuery({
    queryKey: ["dashboard-explanation", result.run_id],
    queryFn: () => getExplanation(result.run_id as string),
    enabled: Boolean(result.run_id),
    retry: 1,
  });
  const explanation: Explanation | null = result.run_id
    ? (explanationQuery.data ?? null)
    : demoExplanation;

  const operationalReadiness = useQuery({
    queryKey: ["operational-readiness"],
    queryFn: getOperationalReadiness,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const operationalDataSources = useQuery({
    queryKey: ["operational-data-sources"],
    queryFn: getOperationalDataSources,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const dispatchReadiness = useQuery({
    queryKey: ["dispatch-readiness"],
    queryFn: getDispatchReadiness,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const assuranceReadiness = useQuery({
    queryKey: ["assurance-readiness"],
    queryFn: getAssuranceReadiness,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const operatorApprovalReadiness = useQuery({
    queryKey: ["operator-approval-readiness"],
    queryFn: getOperatorApprovalReadiness,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const icaoFplValidation = useQuery({
    queryKey: [
      "icao-fpl-validation",
      result.request?.origin_icao,
      result.request?.destination_icao,
      result.request?.aircraft_type,
    ],
    queryFn: () =>
      validateIcaoFpl({
        aircraft_identification: "ARO123",
        aircraft_type: result.request?.aircraft_type ?? "A320",
        cruising_level: "F350",
        cruising_speed: "N0480",
        departure_aerodrome: result.request?.origin_icao ?? "",
        departure_time_hhmm: "1200",
        destination_aerodrome: result.request?.destination_icao ?? "",
        equipment: "SDE2E3FGHIJ1J5M1RWXY/LB1",
        flight_rules: "I",
        flight_type: "S",
        other_information: "",
        route: `${result.request?.origin_icao ?? ""} DCT ${result.request?.destination_icao ?? ""}`,
        total_eet_hhmm: "0700",
      }),
    enabled: Boolean(
      result.request?.origin_icao && result.request?.destination_icao
    ),
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  return {
    result,
    setResult,
    endpointLabels,
    setEndpointLabels,
    error,
    setError,
    loading,
    setLoading,
    flightPlanId,
    setFlightPlanId,
    windField,
    setWindField,
    explanation,
    explanationQuery,
    operationalReadiness,
    operationalDataSources,
    dispatchReadiness,
    assuranceReadiness,
    operatorApprovalReadiness,
    icaoFplValidation,
  };
}

export type SearchResult = ReturnType<typeof useSearchResult>;
