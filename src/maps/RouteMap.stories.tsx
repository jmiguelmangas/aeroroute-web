import type { Meta, StoryObj } from "@storybook/react-vite";

import type { Candidate } from "../api/client";
import { RouteMap } from "./RouteMap";

const route: Candidate = {
  path: ["LEMD", "N45W038", "KJFK"],
  geometry: [
    { latitude_deg: 40.47, longitude_deg: -3.56 },
    { latitude_deg: 45, longitude_deg: -38 },
    { latitude_deg: 40.64, longitude_deg: -73.78 },
  ],
  display_geojson: {
    type: "LineString",
    coordinates: [
      [-3.56, 40.47],
      [-38, 45],
      [-73.78, 40.64],
    ],
  },
  waypoints: [
    waypoint("LEMD", 40.47, -3.56, 0, 0),
    waypoint("N45W038", 45, -38, 350, 9_000),
    waypoint("KJFK", 40.64, -73.78, 0, 18_000),
  ],
  distance_m: 5_000_000,
  time_s: 24_000,
  fuel_kg: 18_000,
  score: 0.91,
};

const meta = {
  title: "AeroRoute/Route Map",
  component: RouteMap,
  parameters: { layout: "fullscreen" },
  decorators: [
    (Story) => (
      <div style={{ height: 520, padding: 24 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    alternatives: [],
    baseline: null,
    candidate: route,
    variant: "analysis",
  },
} satisfies Meta<typeof RouteMap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const InteractiveLayers: Story = {};

function waypoint(
  nodeId: string,
  latitude: number,
  longitude: number,
  flightLevel: number,
  fuel: number
) {
  return {
    node_id: nodeId,
    latitude_deg: latitude,
    longitude_deg: longitude,
    flight_level: flightLevel,
    elapsed_time_s: (fuel / 18_000) * 24_000,
    cumulative_distance_m: (fuel / 18_000) * 5_000_000,
    cumulative_fuel_kg: fuel,
    estimated_mass_kg: 65_000 - fuel,
    wind_component_kt: flightLevel ? 38 : null,
  };
}
