import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { BrainCircuit, Fuel, LockKeyhole, Search, Wind } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { Link, Route, Routes } from "react-router-dom";
import { z } from "zod";

import {
  Candidate,
  createFlightPlan,
  DataQualityFlag,
  DestinationAlternate,
  EnrouteDiversion,
  Explanation,
  FuelPlan,
  getExplanation,
  getRunwayOptions,
  getWindField,
  OptimizationProfile,
  OptimizationResult,
  RunwayOptions,
  TerminalSelection,
  WaypointDetail,
  WindField,
} from "../api/client";
import {
  Alert,
  AirportCombobox,
  Brand,
  Button,
  Capability,
  Field,
  Metric,
  Panel,
  StatusBadge,
  Tabs,
} from "../components";
import { RouteMap } from "../maps/RouteMap";
import {
  averageCruiseLevel,
  formatWindComponent,
  weatherEvidence,
  windStatistics,
} from "../maps/routeMetrics";
import {
  AboutPage,
  FlightPlanDetailPage,
  FlightPlanHistoryPage,
  HistoryPage,
  RunDetailPage,
} from "../routes/pages";

const profiles: Record<OptimizationProfile, string> = {
  minimum_fuel: "Minimum fuel",
  minimum_time: "Minimum time",
  balanced: "Balanced",
};

const searchSchema = z.object({
  origin: z.string().min(3, "Select an origin airport."),
  destination: z.string().min(3, "Select a destination airport."),
  aircraft: z.enum(["A320", "B738", "B77W", "B788", "A359", "A388"]),
  profile: z.enum(["minimum_fuel", "minimum_time", "balanced"]),
  departureTime: z.string().min(1, "Departure time is required."),
  departureRunway: z.string(),
  arrivalRunway: z.string(),
  destinationAlternate: z.string(),
  extraFuelKg: z.number().min(0).max(100_000),
  callsign: z.string().max(12),
  payloadMassKg: z.number().min(0).max(100_000),
});

type SearchForm = z.infer<typeof searchSchema>;

const demoResult: OptimizationResult = {
  run_id: null,
  status: "demo",
  algorithm_version: "demo-reference",
  solver_termination_reason: "reference_fixture",
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

const demoExplanation: Explanation = {
  provider: "template",
  text: "The selected synthetic route uses the strongest tailwind corridor while keeping the added distance modest. It saves 1,080 kg of estimated fuel versus Alternative 1 in this reference scenario.",
  warnings: [
    "Synthetic trajectory only; not suitable for operational flight planning.",
  ],
};

export function App() {
  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/runs" element={<HistoryPage />} />
      <Route path="/runs/:runId" element={<RunDetailPage />} />
      <Route
        path="/flight-plans/:flightPlanId"
        element={<FlightPlanDetailPage />}
      />
      <Route path="/flight-plans" element={<FlightPlanHistoryPage />} />
      <Route path="/about" element={<AboutPage />} />
    </Routes>
  );
}

function DashboardPage() {
  const {
    control,
    formState: { errors },
    handleSubmit,
    register,
    setValue,
  } = useForm<SearchForm>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      origin: "MAD · LEMD — Madrid Barajas",
      destination: "JFK · KJFK — New York JFK",
      aircraft: "A320",
      profile: "minimum_fuel",
      departureTime: defaultDepartureTime(),
      departureRunway: "",
      arrivalRunway: "",
      destinationAlternate: "",
      extraFuelKg: 0,
      callsign: "ARX101",
      payloadMassKg: 8_000,
    },
  });
  const origin = useWatch({ control, name: "origin" });
  const destination = useWatch({ control, name: "destination" });
  const destinationAlternate = useWatch({
    control,
    name: "destinationAlternate",
  });
  const departureTime = useWatch({ control, name: "departureTime" });
  const runwayForecastTime = departureTime
    ? new Date(departureTime).toISOString()
    : undefined;
  const originIcao = airportCode(origin);
  const destinationIcao = airportCode(destination);
  const departureRunways = useQuery({
    queryKey: ["runways", originIcao, "SID", runwayForecastTime],
    queryFn: () => getRunwayOptions(originIcao, "SID", runwayForecastTime),
    enabled: originIcao.length === 4,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const arrivalRunways = useQuery({
    queryKey: ["runways", destinationIcao, "STAR", runwayForecastTime],
    queryFn: () =>
      getRunwayOptions(destinationIcao, "STAR", runwayForecastTime),
    enabled: destinationIcao.length === 4,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
  const [result, setResult] = useState<OptimizationResult>(demoResult);
  const [endpointLabels, setEndpointLabels] = useState({
    destination: "JFK",
    origin: "MAD",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flightPlanId, setFlightPlanId] = useState<string | null>(null);
  const [explanation, setExplanation] = useState<Explanation>(demoExplanation);
  const [windField, setWindField] = useState<WindField | null>(null);
  const [routeView, setRouteView] = useState<
    "map" | "profile" | "winds" | "details"
  >("map");
  const [explanationView, setExplanationView] = useState<
    "explanation" | "factors" | "tradeoffs"
  >("explanation");
  const [technicalView, setTechnicalView] = useState<
    | "summary"
    | "fuel"
    | "alternates"
    | "costs"
    | "waypoints"
    | "profile"
    | "quality"
  >("summary");

  const winner = result.winner ?? demoResult.winner;
  const candidates = useMemo(
    () => [winner, ...result.alternatives].filter(Boolean) as Candidate[],
    [result.alternatives, winner]
  );

  useEffect(() => {
    const atUtc = new Date(defaultDepartureTime()).toISOString();
    const candidate = demoResult.winner;
    const originPoint = candidate?.geometry[0];
    const destinationPoint = candidate?.geometry.at(-1);
    if (!originPoint || !destinationPoint) return;
    void getWindField(atUtc, originPoint, destinationPoint)
      .then(setWindField)
      .catch(() => setWindField(null));
  }, []);

  useEffect(() => {
    setValue("departureRunway", "");
  }, [originIcao, setValue]);

  useEffect(() => {
    setValue("arrivalRunway", "");
  }, [destinationIcao, setValue]);

  async function submit(values: SearchForm) {
    setLoading(true);
    setError(null);
    try {
      const departureUtc = new Date(values.departureTime).toISOString();
      const flightPlan = await createFlightPlan({
        origin_icao: airportCode(values.origin),
        destination_icao: airportCode(values.destination),
        departure_time_utc: departureUtc,
        aircraft_type: values.aircraft,
        profile: values.profile,
        departure_runway:
          values.departureRunway ||
          departureRunways.data?.suggested_runway ||
          undefined,
        arrival_runway:
          values.arrivalRunway ||
          arrivalRunways.data?.suggested_runway ||
          undefined,
        destination_alternate_icao: values.destinationAlternate
          ? airportCode(values.destinationAlternate)
          : undefined,
        extra_fuel_kg: values.extraFuelKg,
        callsign: values.callsign || undefined,
        payload_mass_kg: values.payloadMassKg,
      });
      const apiResult = flightPlan.optimization;
      setResult(apiResult);
      setFlightPlanId(flightPlan.flight_plan_id);
      const windCandidate = apiResult.winner;
      const originPoint = windCandidate?.geometry[0];
      const destinationPoint = windCandidate?.geometry.at(-1);
      setWindField(
        originPoint && destinationPoint
          ? await getWindField(
              departureUtc,
              originPoint,
              destinationPoint,
              averageCruiseLevel(windCandidate) ?? 350
            ).catch(() => null)
          : null
      );
      setEndpointLabels({
        destination: airportDisplayCode(values.destination),
        origin: airportDisplayCode(values.origin),
      });
      setExplanation(demoExplanation);
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The simulation could not be completed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadExplanation() {
    if (result.run_id) {
      setExplanation(await getExplanation(result.run_id));
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-panel" aria-label="AeroRoute overview">
        <div className="brand-block">
          <Brand />
          <p className="hero-title">
            Smarter routes. <span>Better decisions.</span>
          </p>
          <p className="hero-copy">
            AeroRoute MLX compares synthetic aircraft trajectories with
            deterministic optimization, weather-aware scoring, and local
            explanation support.
          </p>
          <div className="capability-grid" aria-label="Core capabilities">
            <Capability
              icon={Fuel}
              title="Optimize"
              body="Fuel, time, emissions or cost"
            />
            <Capability
              icon={Wind}
              title="Weather"
              body="Cruise-level winds and timing"
            />
            <Capability
              icon={BrainCircuit}
              title="Explain"
              body="Local AI or deterministic text"
            />
            <Capability
              icon={LockKeyhole}
              title="Private"
              body="No sensitive data in the cloud"
            />
          </div>
        </div>

        <section className="search-workspace" aria-label="Find routes">
          <div className="workspace-nav">
            <Brand compact />
            <Link className="nav-item active" to="/">
              New search
            </Link>
            <a className="nav-item" href="#route-analysis">
              Results
            </a>
            <Link className="nav-item" to="/flight-plans">
              Saved routes
            </Link>
            <button className="nav-item" type="button">
              Aircraft
            </button>
          </div>
          <form className="route-form" onSubmit={handleSubmit(submit)}>
            <h2>New search</h2>
            <AirportCombobox
              label="Origin"
              onChange={(value) =>
                setValue("origin", value, { shouldValidate: true })
              }
              value={origin}
            />
            {errors.origin ? (
              <span className="field-error">{errors.origin.message}</span>
            ) : null}
            <AirportCombobox
              label="Destination"
              onChange={(value) =>
                setValue("destination", value, { shouldValidate: true })
              }
              value={destination}
            />
            {errors.destination ? (
              <span className="field-error">{errors.destination.message}</span>
            ) : null}
            <Field label="Aircraft">
              <select {...register("aircraft")}>
                <option value="A320">A320</option>
                <option value="B738">B737-800</option>
                <option value="B77W">Boeing 777-300ER</option>
                <option value="B788">Boeing 787-8</option>
                <option value="A359">Airbus A350-900</option>
                <option value="A388">Airbus A380-800</option>
              </select>
            </Field>
            <Field label="Objective">
              <select {...register("profile")}>
                {Object.entries(profiles).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <div className="runway-fields">
              <Field label="Departure runway">
                <select {...register("departureRunway")}>
                  <option value="">
                    {runwayAutoLabel(departureRunways.data?.suggested_runway)}
                  </option>
                  {departureRunways.data?.items.map((runway) => (
                    <option key={runway.identifier} value={runway.identifier}>
                      {runway.identifier} · {Math.round(runway.length_ft)} ft ·{" "}
                      {runway.compatible_procedures} SID
                      {runway.headwind_component_kt != null
                        ? ` · ${runway.headwind_component_kt} kt HW`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Arrival runway">
                <select {...register("arrivalRunway")}>
                  <option value="">
                    {runwayAutoLabel(arrivalRunways.data?.suggested_runway)}
                  </option>
                  {arrivalRunways.data?.items.map((runway) => (
                    <option key={runway.identifier} value={runway.identifier}>
                      {runway.identifier} · {Math.round(runway.length_ft)} ft ·{" "}
                      {runway.compatible_procedures} STAR
                      {runway.headwind_component_kt != null
                        ? ` · ${runway.headwind_component_kt} kt HW`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <p className="runway-note">
              {runwayRecommendationNote(departureRunways.data)}
            </p>
            <div className="planning-fields">
              <Field label="Callsign">
                <input maxLength={12} {...register("callsign")} />
              </Field>
              <Field label="Payload (kg)">
                <input
                  min="0"
                  step="100"
                  type="number"
                  {...register("payloadMassKg", { valueAsNumber: true })}
                />
              </Field>
              <AirportCombobox
                label="Destination alternate (optional)"
                onChange={(value) => setValue("destinationAlternate", value)}
                value={destinationAlternate}
              />
              <Field label="Extra fuel (kg)">
                <input
                  min="0"
                  step="100"
                  type="number"
                  {...register("extraFuelKg", { valueAsNumber: true })}
                />
              </Field>
            </div>
            <Field label="Date and time (UTC)">
              <input type="datetime-local" {...register("departureTime")} />
            </Field>
            <Button icon={Search} loading={loading} type="submit">
              {loading ? "Generating..." : "Generate OFP"}
            </Button>
          </form>
          <div className="map-stage">
            <RouteMap
              alternatives={result.alternatives}
              baseline={result.baseline}
              candidate={winner}
              destinationLabel={endpointLabels.destination}
              originLabel={endpointLabels.origin}
              variant="overview"
              windField={windField}
            />
          </div>
        </section>
      </section>

      {error ? <Alert>{error}</Alert> : null}
      {flightPlanId ? (
        <Alert>
          Flight plan saved.{" "}
          <Link to={`/flight-plans/${flightPlanId}`}>Open OFP</Link>
        </Alert>
      ) : null}

      <section
        className="dashboard-grid"
        id="route-analysis"
        aria-label="Route analysis"
      >
        <Panel title="2. Compare alternatives">
          <ComparisonTable candidates={candidates} />
          <FuelBars candidates={candidates} />
          <p className="fine-print">
            Calculations use synthetic fixture data unless connected to the API.
          </p>
        </Panel>

        <Panel className="wide-panel" title="3. Visualize the route">
          <Tabs
            active={routeView}
            ariaLabel="Route views"
            items={[
              { id: "map", label: "Map" },
              { id: "profile", label: "Vertical profile" },
              { id: "winds", label: "Winds" },
              { id: "details", label: "Details" },
            ]}
            onChange={setRouteView}
          />
          <RouteVisualization
            candidate={winner}
            alternatives={result.alternatives}
            baseline={result.baseline}
            dataQuality={result.data_quality ?? []}
            windField={windField}
            view={routeView}
            destinationLabel={endpointLabels.destination}
            originLabel={endpointLabels.origin}
          />
        </Panel>

        <Panel title="4. Understand why">
          <Tabs
            active={explanationView}
            ariaLabel="Explanation views"
            compact
            items={[
              { id: "explanation", label: "AI explanation" },
              { id: "factors", label: "Key factors" },
              { id: "tradeoffs", label: "Trade-offs" },
            ]}
            onChange={setExplanationView}
          />
          <ExplanationView
            explanation={explanation}
            view={explanationView}
            winner={winner}
          />
          <Button
            onClick={() => void loadExplanation()}
            type="button"
            variant="secondary"
          >
            Regenerate explanation
          </Button>
        </Panel>

        <Panel title="5. Technical details">
          <Tabs
            active={technicalView}
            ariaLabel="Technical views"
            compact
            items={[
              { id: "summary", label: "Summary" },
              { id: "fuel", label: "Fuel plan" },
              { id: "alternates", label: "Alternates" },
              { id: "costs", label: "Costs" },
              { id: "waypoints", label: "Navigation fixes" },
              { id: "profile", label: "Profile" },
              { id: "quality", label: "Data quality" },
            ]}
            onChange={setTechnicalView}
          />
          <TechnicalView
            assumptions={result.assumptions ?? []}
            candidate={winner}
            dataQuality={result.data_quality ?? []}
            destinationAlternate={result.destination_alternate ?? null}
            enrouteDiversions={result.enroute_diversions ?? []}
            fuelPlan={result.fuel_plan ?? null}
            terminalSelection={result.terminal_selection ?? null}
            view={technicalView}
          />
        </Panel>
      </section>

      <footer className="trust-strip">
        <span>No sensitive data in the cloud</span>
        <span>Local execution with MLX</span>
        <span>Traceable and reproducible</span>
        <span>Built for pilots, dispatchers and analysts</span>
      </footer>
      <p className="disclaimer">
        AeroRoute MLX is an educational trajectory-efficiency simulator. Results
        are approximate, may use incomplete public data, and are not suitable
        for operational flight planning or safety-critical decisions.
      </p>
    </main>
  );
}

function ComparisonTable({ candidates }: { candidates: Candidate[] }) {
  return (
    <table className="comparison-table">
      <thead>
        <tr>
          <th>Route</th>
          <th>Fuel (kg)</th>
          <th>Time (min)</th>
          <th>Distance (NM)</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate, index) => (
          <tr key={candidate.path.join("-") || index}>
            <td>
              <StatusBadge tone={index === 0 ? "success" : "neutral"}>
                {index === 0 ? "Optimal" : `Alternative ${index}`}
              </StatusBadge>
            </td>
            <td>{formatNumber(candidate.fuel_kg)}</td>
            <td>{Math.round(candidate.time_s / 60)}</td>
            <td>{formatNumber(metersToNauticalMiles(candidate.distance_m))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FuelBars({ candidates }: { candidates: Candidate[] }) {
  const maxFuel = Math.max(...candidates.map((candidate) => candidate.fuel_kg));
  return (
    <div className="bar-chart" aria-label="Fuel comparison">
      {candidates.map((candidate, index) => (
        <div className="bar-column" key={candidate.path.join("-") || index}>
          <span>{formatNumber(candidate.fuel_kg)}</span>
          <div
            className={`bar bar-${index}`}
            style={{ height: `${(candidate.fuel_kg / maxFuel) * 100}%` }}
          />
          <small>{index === 0 ? "Optimal" : `Alt ${index}`}</small>
        </div>
      ))}
    </div>
  );
}

function SummaryTable({ candidate }: { candidate: Candidate | null }) {
  if (!candidate) {
    return <p>No feasible synthetic trajectory was found.</p>;
  }
  const wind = windStatistics(candidate);
  const cruiseLevel = averageCruiseLevel(candidate);
  const rows = [
    [
      "Distance",
      `${formatNumber(metersToNauticalMiles(candidate.distance_m))} NM`,
    ],
    ["Flight time", `${Math.round(candidate.time_s / 60)} min`],
    ["Fuel", `${formatNumber(candidate.fuel_kg)} kg`],
    ["CO2 estimated", `${formatNumber(candidate.fuel_kg * 3.16)} kg`],
    ["Average cruise level", cruiseLevel ? `FL${cruiseLevel}` : "Unavailable"],
    ["Average wind component", formatWindComponent(wind?.averageKt ?? null)],
  ];
  return (
    <dl className="summary-list">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RouteVisualization({
  alternatives,
  baseline,
  candidate,
  dataQuality,
  destinationLabel,
  originLabel,
  view,
  windField,
}: {
  alternatives: Candidate[];
  baseline: Candidate | null | undefined;
  candidate: Candidate | null;
  dataQuality: DataQualityFlag[];
  destinationLabel: string;
  originLabel: string;
  view: "map" | "profile" | "winds" | "details";
  windField: WindField | null;
}) {
  if (!candidate) {
    return <p>No feasible synthetic trajectory was found.</p>;
  }
  if (view === "profile") {
    return <VerticalProfile candidate={candidate} />;
  }
  if (view === "winds") {
    const wind = windStatistics(candidate);
    const weather = weatherEvidence(dataQuality);
    return (
      <div className="data-view">
        {wind ? <WindScale /> : null}
        <dl className="metric-grid">
          <Metric
            label="Average component"
            value={formatWindComponent(wind?.averageKt ?? null)}
          />
          <Metric
            label="Observed range"
            value={
              wind
                ? `${formatWindComponent(wind.minimumKt)} to ${formatWindComponent(wind.maximumKt)}`
                : "Unavailable"
            }
          />
          <Metric
            label="Samples"
            value={wind ? `${wind.sampleCount} route nodes` : "0 route nodes"}
          />
          <Metric label="Snapshot state" value={weather.state} />
        </dl>
        <p className="fine-print">{weather.source}</p>
      </div>
    );
  }
  if (view === "details") {
    return (
      <div className="data-view">
        <dl className="summary-list">
          <Metric label="Algorithm" value="Layered label-setting" />
          <Metric label="Candidate status" value="Feasible" />
          <Metric label="Path signature" value={candidate.path.join(" · ")} />
          <Metric
            label="Geometry points"
            value={`${candidate.geometry.length}`}
          />
        </dl>
      </div>
    );
  }
  return (
    <RouteMap
      alternatives={alternatives}
      baseline={baseline}
      candidate={candidate}
      destinationLabel={destinationLabel}
      originLabel={originLabel}
      variant="analysis"
      windField={windField}
    />
  );
}

function ExplanationView({
  explanation,
  view,
  winner,
}: {
  explanation: Explanation;
  view: "explanation" | "factors" | "tradeoffs";
  winner: Candidate | null;
}) {
  if (view === "factors") {
    return (
      <ul className="factor-list">
        <li>Stronger tailwind through the central cruise segments.</li>
        <li>Lower estimated fuel than the displayed alternatives.</li>
        <li>Bounded route extension inside the synthetic corridor.</li>
      </ul>
    );
  }
  if (view === "tradeoffs") {
    return (
      <dl className="metric-grid">
        <Metric
          label="Fuel"
          value={`${formatNumber(winner?.fuel_kg ?? 0)} kg`}
        />
        <Metric
          label="Time"
          value={`${Math.round((winner?.time_s ?? 0) / 60)} min`}
        />
        <Metric label="Operational validity" value="Not assessed" />
        <Metric label="Explanation provider" value={explanation.provider} />
      </dl>
    );
  }
  return (
    <>
      <div className="explanation-card">
        <span>
          Recommendation ·{" "}
          {explanation.provider === "mlx"
            ? "Generated locally with MLX"
            : "Deterministic fallback"}
        </span>
        <strong>The selected route is the minimum-fuel candidate.</strong>
      </div>
      <p className="explanation-text">{explanation.text}</p>
      {explanation.warnings.map((warning) => (
        <p className="warning-text" key={warning}>
          {warning}
        </p>
      ))}
    </>
  );
}

function TechnicalView({
  assumptions,
  candidate,
  dataQuality,
  destinationAlternate,
  enrouteDiversions,
  fuelPlan,
  terminalSelection,
  view,
}: {
  assumptions: string[];
  candidate: Candidate | null;
  dataQuality: DataQualityFlag[];
  destinationAlternate: DestinationAlternate | null;
  enrouteDiversions: EnrouteDiversion[];
  fuelPlan: FuelPlan | null;
  terminalSelection: TerminalSelection | null;
  view:
    | "summary"
    | "fuel"
    | "alternates"
    | "costs"
    | "waypoints"
    | "profile"
    | "quality";
}) {
  if (!candidate) {
    return <p>No feasible synthetic trajectory was found.</p>;
  }
  if (view === "waypoints") {
    return (
      <table className="waypoint-table">
        <thead>
          <tr>
            <th>Navigation point</th>
            <th>Via</th>
            <th>Type</th>
            <th>Coordinates</th>
            <th>Flight level</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {candidate.waypoints.map((point, index) => (
            <tr key={point.node_id}>
              <td>{point.display_name ?? `SYN-${index + 1}`}</td>
              <td>
                {point.inbound_via ? (
                  <StatusBadge
                    tone={
                      point.procedure_type
                        ? "info"
                        : point.airway_validated
                          ? "success"
                          : "neutral"
                    }
                  >
                    {point.inbound_via}
                    {point.runway ? ` · RWY ${point.runway}` : ""}
                  </StatusBadge>
                ) : (
                  "—"
                )}
              </td>
              <td>{waypointKindLabel(point.kind)}</td>
              <td>
                {point.latitude_deg.toFixed(2)},{" "}
                {point.longitude_deg.toFixed(2)}
              </td>
              <td>FL{point.flight_level}</td>
              <td>
                {point.navigation_source === "airac.net"
                  ? `AIRAC ${point.airac_cycle ?? "current"}${
                      point.snap_distance_nm != null
                        ? ` · ${point.snap_distance_nm.toFixed(1)} NM`
                        : ""
                    }`
                  : (point.navigation_source ?? "Solver")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  if (view === "profile") {
    return (
      <dl className="metric-grid">
        <Metric label="Representative cruise" value="FL350" />
        <Metric label="Climb/descent" value="Fixed phase estimate" />
        <Metric label="Mass treatment" value="Iterative fuel integration" />
        <Metric label="Internal units" value="SI" />
      </dl>
    );
  }
  if (view === "fuel") {
    if (!fuelPlan) {
      return <p>Fuel planning is unavailable for this stored result.</p>;
    }
    return (
      <div className="planning-detail">
        <div className="planning-heading">
          <strong>Fuel policy · {fuelPlan.policy_identifier}</strong>
          <StatusBadge tone="warning">Not operational</StatusBadge>
        </div>
        <dl className="summary-list">
          <DetailRow
            label="Taxi"
            value={`${formatNumber(fuelPlan.taxi_fuel_kg)} kg`}
          />
          <DetailRow
            label="Trip"
            value={`${formatNumber(fuelPlan.trip_fuel_kg)} kg`}
          />
          <DetailRow
            label="Contingency"
            value={`${formatNumber(fuelPlan.contingency_fuel_kg)} kg`}
          />
          <DetailRow
            label="Destination alternate"
            value={`${formatNumber(fuelPlan.alternate_fuel_kg)} kg`}
          />
          <DetailRow
            label="Final reserve"
            value={`${formatNumber(fuelPlan.final_reserve_fuel_kg)} kg`}
          />
          <DetailRow
            label="Extra"
            value={`${formatNumber(fuelPlan.extra_fuel_kg)} kg`}
          />
          <DetailRow
            label="Block fuel"
            value={`${formatNumber(fuelPlan.block_fuel_kg)} kg`}
          />
          <DetailRow
            label="Takeoff mass"
            value={`${formatNumber(fuelPlan.takeoff_mass_kg)} kg`}
          />
          <DetailRow
            label="Estimated landing fuel"
            value={`${formatNumber(fuelPlan.estimated_landing_fuel_kg)} kg`}
          />
          <DetailRow
            label="Mass convergence"
            value={
              fuelPlan.mass_converged
                ? `Converged in ${fuelPlan.mass_iterations} iterations`
                : `Not converged after ${fuelPlan.mass_iterations} iterations`
            }
          />
        </dl>
        <ul className="factor-list compact-list">
          {(fuelPlan.assumptions ?? []).map((assumption) => (
            <li key={assumption}>{assumption}</li>
          ))}
        </ul>
      </div>
    );
  }
  if (view === "alternates") {
    return (
      <div className="planning-detail">
        {destinationAlternate ? (
          <section className="alternate-primary">
            <div className="planning-heading">
              <strong>
                {destinationAlternate.icao_code} · {destinationAlternate.name}
              </strong>
              <StatusBadge
                tone={
                  destinationAlternate.runway_compatible ? "success" : "warning"
                }
              >
                {destinationAlternate.selection}
              </StatusBadge>
            </div>
            <dl className="metric-grid">
              <Metric
                label="From destination"
                value={`${destinationAlternate.distance_from_destination_nm.toFixed(1)} NM`}
              />
              <Metric
                label="Estimated fuel"
                value={`${formatNumber(destinationAlternate.estimated_fuel_kg)} kg`}
              />
              <Metric
                label="Longest runway"
                value={
                  destinationAlternate.longest_published_runway_ft
                    ? `${formatNumber(destinationAlternate.longest_published_runway_ft)} ft`
                    : "Unavailable"
                }
              />
              <Metric
                label="Navigation source"
                value={
                  destinationAlternate.navigation_source
                    ? `AIRAC ${destinationAlternate.airac_cycle ?? "current"}`
                    : "Unavailable"
                }
              />
            </dl>
          </section>
        ) : (
          <Alert tone="warning">
            No compatible destination alternate was found.
          </Alert>
        )}
        <section>
          <h3>En-route diversion candidates</h3>
          {enrouteDiversions.length ? (
            <table className="waypoint-table diversion-table">
              <thead>
                <tr>
                  <th>Airport</th>
                  <th>Distance to route</th>
                  <th>Runway</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {enrouteDiversions.map((diversion) => (
                  <tr key={diversion.icao_code}>
                    <td>{diversion.icao_code}</td>
                    <td>{diversion.distance_to_route_nm.toFixed(1)} NM</td>
                    <td>
                      {diversion.longest_published_runway_ft
                        ? `${formatNumber(diversion.longest_published_runway_ft)} ft`
                        : "Unavailable"}
                    </td>
                    <td>AIRAC {diversion.airac_cycle ?? "current"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>
              No runway-compatible en-route diversion candidates were found.
            </p>
          )}
        </section>
        <p className="warning-text">
          Candidates do not include weather minima, NOTAM, airport status or
          ETOPS/EDTO approval.
        </p>
      </div>
    );
  }
  if (view === "costs") {
    const fuel = candidate.fuel_breakdown;
    const objective = candidate.objective_breakdown;
    if (!fuel || !objective) {
      return <p>Cost breakdown is unavailable for this stored result.</p>;
    }
    return (
      <dl className="summary-list">
        <DetailRow
          label="Modeled trip fuel"
          value={`${formatNumber(fuel.modeled_trip_fuel_kg)} kg`}
        />
        <DetailRow
          label="Cruise fuel"
          value={`${formatNumber(fuel.cruise_fuel_kg)} kg`}
        />
        <DetailRow
          label="Fixed climb/descent"
          value={`${formatNumber(fuel.fixed_climb_descent_fuel_kg)} kg`}
        />
        <DetailRow
          label="Reserve mass assumption"
          value={`${formatNumber(fuel.mass_assumption_fuel_kg)} kg`}
        />
        <DetailRow
          label="Fuel score component"
          value={objective.fuel_component.toFixed(4)}
        />
        <DetailRow
          label="Time score component"
          value={objective.time_component.toFixed(4)}
        />
        <DetailRow
          label="Extension score component"
          value={objective.extension_component.toFixed(4)}
        />
        <DetailRow
          label="Total score"
          value={objective.total_score.toFixed(4)}
        />
      </dl>
    );
  }
  if (view === "quality") {
    return (
      <div className="quality-view">
        <section>
          <h3>Assumptions</h3>
          <ul className="factor-list">
            {assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Data quality</h3>
          <div className="quality-flags">
            {dataQuality.map((flag) => (
              <div key={flag.code}>
                <StatusBadge
                  tone={flag.severity === "warning" ? "warning" : "info"}
                >
                  {flag.severity}
                </StatusBadge>
                <p>{flag.message}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    );
  }
  return (
    <>
      <SummaryTable candidate={candidate} />
      {terminalSelection ? (
        <dl className="summary-list terminal-summary">
          <DetailRow
            label="Departure"
            value={terminalDescription(
              terminalSelection.departure_runway,
              terminalSelection.sid_identifier,
              terminalSelection.departure_runway_suggested
            )}
          />
          <DetailRow
            label="Arrival"
            value={terminalDescription(
              terminalSelection.arrival_runway,
              terminalSelection.star_identifier,
              terminalSelection.arrival_runway_suggested
            )}
          />
          <DetailRow
            label="Navigation cycle"
            value={`AIRAC ${terminalSelection.airac_cycle ?? "current"}`}
          />
        </dl>
      ) : null}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function VerticalProfile({ candidate }: { candidate: Candidate }) {
  const pointCount = Math.max(candidate.geometry.length, 2);
  const path = candidate.geometry
    .map((_, index) => {
      const x = 35 + (index / (pointCount - 1)) * 730;
      const edge = index === 0 || index === candidate.geometry.length - 1;
      const y = edge ? 315 : 78 + (index % 2) * 14;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <figure className="profile-chart">
      <svg aria-label="Synthetic vertical profile" viewBox="0 0 800 350">
        <path
          className="profile-grid"
          d="M35 80 H765 M35 160 H765 M35 240 H765 M35 315 H765"
        />
        <path className="profile-line" d={path} />
        <text x="35" y="338">
          Origin
        </text>
        <text x="708" y="338">
          Destination
        </text>
        <text x="45" y="70">
          FL350
        </text>
      </svg>
    </figure>
  );
}

function WindScale() {
  return (
    <div className="wind-scale" aria-label="Wind component scale">
      <span>Headwind</span>
      <div />
      <span>Tailwind</span>
    </div>
  );
}

function airportCode(value: string) {
  const icao = value.toUpperCase().match(/\b[A-Z]{4}\b/);
  return (
    icao?.[0] ??
    value
      .split(/[\s·—-]/)[0]
      .trim()
      .toUpperCase()
  );
}

function airportDisplayCode(value: string) {
  return value
    .split(/[\s·—-]/)[0]
    .trim()
    .toUpperCase();
}

function runwayAutoLabel(suggested: string | null | undefined) {
  return suggested ? `Auto · recommended ${suggested}` : "Auto · recommended";
}

function runwayRecommendationNote(options: RunwayOptions | undefined) {
  if (
    options?.surface_wind_speed_kt != null &&
    options.surface_wind_direction_deg != null
  ) {
    return `AIRAC + ${options.surface_wind_source ?? "weather"}: ${Math.round(options.surface_wind_speed_kt)} kt from ${Math.round(options.surface_wind_direction_deg)}°. NOTAM, runway condition and ATC assignment are not applied.`;
  }
  return "AIRAC recommendation; surface wind unavailable. NOTAM, runway condition and ATC assignment are not applied.";
}

function terminalDescription(
  runway: string | null | undefined,
  procedure: string | null | undefined,
  suggested: boolean
) {
  if (!runway && !procedure) return "DCT or unavailable";
  return `${runway ? `RWY ${runway}` : "Runway unavailable"} · ${procedure ?? "DCT"}${suggested ? " · suggested" : ""}`;
}

function waypointKindLabel(kind: WaypointDetail["kind"]) {
  if (kind === "navigation_fix") return "AIRAC fix";
  if (kind === "oceanic_coordinate") return "Oceanic coordinate";
  if (kind === "airport") return "Airport";
  return "Solver node";
}

function defaultDepartureTime() {
  const departure = new Date(Date.now() + 60 * 60 * 1000);
  departure.setMinutes(0, 0, 0);
  const local = new Date(
    departure.getTime() - departure.getTimezoneOffset() * 60_000
  );
  return local.toISOString().slice(0, 16);
}

function metersToNauticalMiles(value: number) {
  return Math.round(value / 1852);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function withDisplayData(
  candidate: Omit<Candidate, "display_geojson" | "waypoints">
): Candidate {
  return {
    ...candidate,
    display_geojson: {
      type: "LineString",
      coordinates: candidate.geometry.map((point) => [
        point.longitude_deg,
        point.latitude_deg,
      ]),
    },
    waypoints: candidate.geometry.map((point, index) => ({
      node_id: candidate.path[index] ?? `P${index + 1}`,
      display_name: `SYN-${String(index + 1).padStart(2, "0")}`,
      kind: "synthetic",
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
