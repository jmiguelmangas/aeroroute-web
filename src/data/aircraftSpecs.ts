export type AircraftCode = "A320" | "B738" | "B77W" | "B788" | "A359" | "A388";

export type AircraftSpec = {
  code: AircraftCode;
  name: string;
  category: "Corto/medio radio" | "Largo radio";
  mtowKg: number;
  cruiseMach: number;
  rangeNm: number;
  capacityPax: number;
};

// Reference-only public specs (not verified against a manufacturer datasheet),
// matching the aircraft types the search form's `aircraft` enum supports.
export const AIRCRAFT_SPECS: AircraftSpec[] = [
  {
    code: "A320",
    name: "A320",
    category: "Corto/medio radio",
    mtowKg: 78_000,
    cruiseMach: 0.78,
    rangeNm: 3_300,
    capacityPax: 180,
  },
  {
    code: "B738",
    name: "Boeing 737-800",
    category: "Corto/medio radio",
    mtowKg: 79_015,
    cruiseMach: 0.79,
    rangeNm: 2_935,
    capacityPax: 189,
  },
  {
    code: "B77W",
    name: "Boeing 777-300ER",
    category: "Largo radio",
    mtowKg: 351_534,
    cruiseMach: 0.84,
    rangeNm: 7_370,
    capacityPax: 396,
  },
  {
    code: "B788",
    name: "Boeing 787-8",
    category: "Largo radio",
    mtowKg: 227_930,
    cruiseMach: 0.85,
    rangeNm: 7_355,
    capacityPax: 242,
  },
  {
    code: "A359",
    name: "A350-900",
    category: "Largo radio",
    mtowKg: 280_000,
    cruiseMach: 0.85,
    rangeNm: 8_100,
    capacityPax: 300,
  },
  {
    code: "A388",
    name: "Airbus A380-800",
    category: "Largo radio",
    mtowKg: 575_000,
    cruiseMach: 0.85,
    rangeNm: 8_000,
    capacityPax: 525,
  },
];
