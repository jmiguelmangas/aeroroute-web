import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  Fuel,
  LockKeyhole,
  Minus,
  Plus,
  Search,
  Wind,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import {
  createFlightPlan,
  getRouteSupport,
  getRunwayOptions,
  getWindField,
  RouteSupport,
  RunwayOptions,
} from "../../api/client";
import {
  AirportCombobox,
  Alert,
  Capability,
  Field,
  Button,
} from "../../components";
import { AIRCRAFT_SPECS } from "../../data/aircraftSpecs";
import { RouteMap } from "../../maps/RouteMap";
import { averageCruiseLevel } from "../../maps/routeMetrics";
import type { SearchResult } from "../useSearchResult";

const profiles: Record<string, string> = {
  minimum_fuel: "Mínimo combustible",
  minimum_time: "Mínimo tiempo",
  balanced: "Equilibrado",
};

const searchSchema = z.object({
  origin: z.string().min(3, "Selecciona un aeropuerto de origen."),
  destination: z.string().min(3, "Selecciona un aeropuerto de destino."),
  aircraft: z.enum(["A320", "B738", "B77W", "B788", "A359", "A388"]),
  profile: z.enum(["minimum_fuel", "minimum_time", "balanced"]),
  departureTime: z.string().min(1, "La hora de salida es obligatoria."),
  departureRunway: z.string(),
  arrivalRunway: z.string(),
  destinationAlternate: z.string(),
  extraFuelKg: z.number().min(0).max(100_000),
  callsign: z.string().max(12),
  payloadMassKg: z.number().min(0).max(100_000),
});

type SearchForm = z.infer<typeof searchSchema>;

export function SearchView({
  onSubmitted,
  searchResult,
}: {
  onSubmitted: (flightPlanId: string) => void;
  searchResult: SearchResult;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
  const routeSupport = useQuery({
    queryKey: ["route-support", originIcao, destinationIcao],
    queryFn: () => getRouteSupport(originIcao, destinationIcao),
    enabled: originIcao.length === 4 && destinationIcao.length === 4,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });

  useEffect(() => {
    setValue("departureRunway", "");
  }, [originIcao, setValue]);

  useEffect(() => {
    setValue("arrivalRunway", "");
  }, [destinationIcao, setValue]);

  async function submit(values: SearchForm) {
    searchResult.setLoading(true);
    searchResult.setError(null);
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
      searchResult.setResult(apiResult);
      searchResult.setFlightPlanId(flightPlan.flight_plan_id);
      const windCandidate = apiResult.winner;
      const originPoint = windCandidate?.geometry[0];
      const destinationPoint = windCandidate?.geometry.at(-1);
      searchResult.setWindField(
        originPoint && destinationPoint
          ? await getWindField(
              departureUtc,
              originPoint,
              destinationPoint,
              averageCruiseLevel(windCandidate) ?? 350
            ).catch(() => null)
          : null
      );
      searchResult.setEndpointLabels({
        destination: airportDisplayCode(values.destination),
        origin: airportDisplayCode(values.origin),
      });
      onSubmitted(flightPlan.flight_plan_id);
    } catch (submissionError) {
      searchResult.setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The simulation could not be completed."
      );
    } finally {
      searchResult.setLoading(false);
    }
  }

  const AdvancedGlyph = advancedOpen ? Minus : Plus;

  return (
    <div className="ar-screen" aria-label="Nueva búsqueda">
      <section
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 40,
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: 16 }}>
          <h1
            style={{
              margin: 0,
              fontSize: "2.5rem",
              fontWeight: 800,
              lineHeight: 1.08,
              letterSpacing: "-0.02em",
            }}
          >
            Rutas más inteligentes.
            <br />
            <span style={{ color: "var(--ar-accent)" }}>
              Decisiones más claras.
            </span>
          </h1>
          <p
            style={{
              margin: 0,
              maxWidth: 520,
              color: "var(--ar-text-secondary)",
              fontSize: "1.02rem",
              lineHeight: 1.55,
            }}
          >
            Compara trayectorias sintéticas con optimización determinista,
            puntuación consciente del viento y explicaciones locales, en un solo
            flujo.
          </p>
        </div>
        <div className="capability-grid">
          <Capability
            icon={Fuel}
            title="Optimiza"
            body="Combustible, tiempo, emisiones o coste"
          />
          <Capability
            icon={Wind}
            title="Viento"
            body="Vientos de crucero y tiempos actualizados"
          />
          <Capability
            icon={BrainCircuit}
            title="Explica"
            body="IA local o texto determinista"
          />
          <Capability
            icon={LockKeyhole}
            title="Privado"
            body="Sin datos sensibles en la nube"
          />
        </div>
      </section>

      <section
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(360px, 460px) 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <form
          className="route-form"
          style={{
            padding: 24,
            borderRadius: "var(--ar-radius-panel-lg)",
            background:
              "linear-gradient(155deg, var(--ar-panel-grad-1), var(--ar-panel-grad-2))",
            border: "1px solid var(--ar-panel-border)",
            boxShadow: "0 24px 60px var(--ar-panel-shadow)",
          }}
          onSubmit={handleSubmit(submit)}
        >
          <h2>Nueva búsqueda</h2>
          <AirportCombobox
            label="Origen"
            onChange={(value) =>
              setValue("origin", value, { shouldValidate: true })
            }
            value={origin}
          />
          {errors.origin ? (
            <span className="field-error">{errors.origin.message}</span>
          ) : null}
          <AirportCombobox
            label="Destino"
            onChange={(value) =>
              setValue("destination", value, { shouldValidate: true })
            }
            value={destination}
          />
          {errors.destination ? (
            <span className="field-error">{errors.destination.message}</span>
          ) : null}
          <div className="runway-fields">
            <Field label="Aeronave">
              <select {...register("aircraft")}>
                {AIRCRAFT_SPECS.map((aircraft) => (
                  <option key={aircraft.code} value={aircraft.code}>
                    {aircraft.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Objetivo">
              <select {...register("profile")}>
                {Object.entries(profiles).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <button
            className="ar-disclosure"
            onClick={() => setAdvancedOpen((open) => !open)}
            type="button"
          >
            <span>Opciones avanzadas (pista, callsign, carga, alterno...)</span>
            <AdvancedGlyph aria-hidden="true" size={15} strokeWidth={2} />
          </button>

          {advancedOpen ? (
            <div
              style={{
                display: "grid",
                gap: 10,
                paddingTop: 2,
                borderTop: "1px solid var(--ar-border-subtle)",
              }}
            >
              <div className="runway-fields">
                <Field label="Pista salida">
                  <select {...register("departureRunway")}>
                    <option value="">
                      {runwayAutoLabel(departureRunways.data?.suggested_runway)}
                    </option>
                    {departureRunways.data?.items.map((runway) => (
                      <option key={runway.identifier} value={runway.identifier}>
                        {runway.identifier} · {Math.round(runway.length_ft)} ft
                        · {runway.compatible_procedures} SID
                        {runway.headwind_component_kt != null
                          ? ` · ${runway.headwind_component_kt} kt HW`
                          : ""}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Pista llegada">
                  <select {...register("arrivalRunway")}>
                    <option value="">
                      {runwayAutoLabel(arrivalRunways.data?.suggested_runway)}
                    </option>
                    {arrivalRunways.data?.items.map((runway) => (
                      <option key={runway.identifier} value={runway.identifier}>
                        {runway.identifier} · {Math.round(runway.length_ft)} ft
                        · {runway.compatible_procedures} STAR
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
              <RouteSupportNote
                loading={routeSupport.isFetching}
                support={routeSupport.data}
              />
              <div className="runway-fields">
                <Field label="Callsign">
                  <input maxLength={12} {...register("callsign")} />
                </Field>
                <Field label="Carga (kg)">
                  <input
                    min="0"
                    step="100"
                    type="number"
                    {...register("payloadMassKg", { valueAsNumber: true })}
                  />
                </Field>
              </div>
              <AirportCombobox
                label="Alterno de destino (opcional)"
                onChange={(value) => setValue("destinationAlternate", value)}
                value={destinationAlternate}
              />
              <Field label="Combustible extra (kg)">
                <input
                  min="0"
                  step="100"
                  type="number"
                  {...register("extraFuelKg", { valueAsNumber: true })}
                />
              </Field>
            </div>
          ) : null}

          <Field label="Fecha y hora (UTC)">
            <input type="datetime-local" {...register("departureTime")} />
          </Field>

          <Button icon={Search} loading={searchResult.loading} type="submit">
            {searchResult.loading ? "Generando..." : "Generar plan de vuelo"}
          </Button>
        </form>

        <div className="map-stage" style={{ borderLeft: 0, minHeight: 480 }}>
          <RouteMap
            alternatives={searchResult.result.alternatives}
            baseline={searchResult.result.baseline}
            candidate={searchResult.result.winner}
            destinationLabel={searchResult.endpointLabels.destination}
            originLabel={searchResult.endpointLabels.origin}
            variant="overview"
            windField={searchResult.windField}
          />
        </div>
      </section>

      {searchResult.error ? <Alert>{searchResult.error}</Alert> : null}
    </div>
  );
}

function RouteSupportNote({
  loading,
  support,
}: {
  loading: boolean;
  support: RouteSupport | undefined;
}) {
  if (loading && !support) {
    return (
      <p className="route-support-note">
        Comprobando compatibilidad de ruta AIRAC...
      </p>
    );
  }
  if (!support) return null;
  const firstProblem = support.problems?.[0];
  const loadingMode =
    typeof support.navigation_manifest.loading === "string"
      ? support.navigation_manifest.loading
      : "on-demand";
  if (support.supported) {
    return (
      <p className="route-support-note supported">
        Snapshot de ruta compatible · AIRAC {support.airac_cycle ?? "actual"} ·{" "}
        {loadingMode}
      </p>
    );
  }
  return (
    <p className={`route-support-note ${support.status}`}>
      {support.status === "unavailable"
        ? "Compatibilidad de ruta AIRAC no disponible"
        : "Ruta no totalmente compatible"}
      {firstProblem ? ` · ${firstProblem.message}` : ""}
    </p>
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
  return suggested ? `Auto · recomendada ${suggested}` : "Auto · recomendada";
}

function runwayRecommendationNote(options: RunwayOptions | undefined) {
  if (
    options?.surface_wind_speed_kt != null &&
    options.surface_wind_direction_deg != null
  ) {
    return `AIRAC + ${options.surface_wind_source ?? "weather"}: ${Math.round(options.surface_wind_speed_kt)} kt desde ${Math.round(options.surface_wind_direction_deg)}°. NOTAM, estado de pista y ATC no se aplican.`;
  }
  return "Recomendación AIRAC; viento de superficie no disponible. NOTAM, estado de pista y ATC no se aplican.";
}

function defaultDepartureTime() {
  const departure = new Date(Date.now() + 60 * 60 * 1000);
  departure.setMinutes(0, 0, 0);
  const local = new Date(
    departure.getTime() - departure.getTimezoneOffset() * 60_000
  );
  return local.toISOString().slice(0, 16);
}
