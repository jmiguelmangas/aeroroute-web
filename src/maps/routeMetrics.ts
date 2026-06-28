import type { Candidate, DataQualityFlag } from "../api/client";

export type WindStatistics = {
  averageKt: number;
  maximumKt: number;
  minimumKt: number;
  sampleCount: number;
};

export function windStatistics(candidate: Candidate): WindStatistics | null {
  const samples = candidate.waypoints
    .map((waypoint) => waypoint.wind_component_kt)
    .filter((value): value is number => value !== null && value !== undefined);
  if (!samples.length) return null;
  return {
    averageKt: samples.reduce((sum, value) => sum + value, 0) / samples.length,
    maximumKt: Math.max(...samples),
    minimumKt: Math.min(...samples),
    sampleCount: samples.length,
  };
}

export function averageCruiseLevel(candidate: Candidate): number | null {
  const levels = candidate.waypoints
    .map((waypoint) => waypoint.flight_level)
    .filter((level) => level > 0);
  if (!levels.length) return null;
  return Math.round(
    levels.reduce((sum, level) => sum + level, 0) / levels.length
  );
}

export function formatWindComponent(value: number | null): string {
  if (value === null) return "Unavailable";
  const rounded = Math.round(value);
  if (rounded > 0) return `+${rounded} kt tailwind`;
  if (rounded < 0) return `${Math.abs(rounded)} kt headwind`;
  return "0 kt neutral";
}

export function weatherEvidence(flags: DataQualityFlag[]): {
  source: string;
  state: string;
} {
  const flag = flags.find((item) => item.code.startsWith("WEATHER_"));
  if (!flag) return { source: "Unavailable", state: "Unknown" };
  const states: Record<string, string> = {
    WEATHER_FALLBACK: "Still-air fallback",
    WEATHER_FORECAST: "Forecast",
    WEATHER_STALE: "Stale forecast",
    WEATHER_STILL_AIR: "Still air",
  };
  return {
    source: flag.message,
    state: states[flag.code] ?? flag.code,
  };
}
