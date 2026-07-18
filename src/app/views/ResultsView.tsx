import { useState } from "react";

import {
  AssuranceReadiness,
  Candidate,
  DataQualityFlag,
  DestinationAlternate,
  DispatchReadiness,
  EnrouteDiversion,
  Explanation,
  FuelPlan,
  type IcaoFplValidation,
  OperationalDataSources,
  OperationalReadiness,
  OperatorApprovalReadiness,
  OptimizationProfile,
  TerminalSelection,
  WaypointDetail,
  WindField,
} from "../../api/client";
import {
  Accordion,
  Alert,
  Button,
  Metric,
  StatusBadge,
  Tabs,
} from "../../components";
import { RouteMap } from "../../maps/RouteMap";
import {
  averageCruiseLevel,
  formatWindComponent,
  weatherEvidence,
  windStatistics,
} from "../../maps/routeMetrics";
import type { SearchResult } from "../useSearchResult";

export function ResultsView({
  onOpenFlightPlan,
  searchResult,
}: {
  onOpenFlightPlan: () => void;
  searchResult: SearchResult;
}) {
  const [routeView, setRouteView] = useState<
    "map" | "profile" | "winds" | "details"
  >("map");
  const [explanationView, setExplanationView] = useState<
    "explanation" | "factors" | "tradeoffs"
  >("explanation");
  const [techOpen, setTechOpen] = useState(false);
  const [technicalView, setTechnicalView] = useState<
    | "summary"
    | "fuel"
    | "alternates"
    | "costs"
    | "waypoints"
    | "profile"
    | "quality"
  >("summary");

  const { result } = searchResult;
  const winner = result.winner;
  const candidates = [winner, ...result.alternatives].filter(
    Boolean
  ) as Candidate[];
  const originIcao = result.request?.origin_icao ?? "—";
  const destinationIcao = result.request?.destination_icao ?? "—";

  return (
    <div className="ar-screen" aria-label="Resultados">
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <div className="section-kicker">
            Resultados · {originIcao} → {destinationIcao}
          </div>
          <h1
            style={{ margin: "4px 0 0", fontSize: "1.7rem", fontWeight: 800 }}
          >
            Comparación de rutas
          </h1>
        </div>
        <Button
          disabled={!winner}
          onClick={onOpenFlightPlan}
          variant="secondary"
        >
          Ver plan de vuelo completo →
        </Button>
      </div>

      {searchResult.error ? <Alert>{searchResult.error}</Alert> : null}
      {searchResult.flightPlanId ? (
        <Alert tone="warning">Plan de vuelo guardado.</Alert>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.15fr 1fr",
          gap: 20,
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <ComparisonTable candidates={candidates} />
          <div
            style={{
              borderRadius: "var(--ar-radius-panel)",
              border: "1px solid var(--ar-border)",
              overflow: "hidden",
              minHeight: 420,
            }}
          >
            <Tabs
              active={routeView}
              ariaLabel="Vistas de la ruta"
              items={[
                { id: "map", label: "Mapa" },
                { id: "profile", label: "Perfil vertical" },
                { id: "winds", label: "Vientos" },
                { id: "details", label: "Detalles" },
              ]}
              onChange={setRouteView}
            />
            <RouteVisualization
              candidate={winner}
              alternatives={result.alternatives}
              baseline={result.baseline}
              dataQuality={result.data_quality ?? []}
              windField={searchResult.windField}
              view={routeView}
              destinationLabel={searchResult.endpointLabels.destination}
              originLabel={searchResult.endpointLabels.origin}
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: 14 }}>
          <div
            style={{
              display: "grid",
              gap: 12,
              padding: 18,
              borderRadius: "var(--ar-radius-panel)",
              background:
                "linear-gradient(155deg, var(--ar-panel-grad-1), var(--ar-panel-grad-2))",
              border: "1px solid var(--ar-panel-border)",
            }}
          >
            <Tabs
              active={explanationView}
              ariaLabel="Vistas de explicación"
              compact
              items={[
                { id: "explanation", label: "Explicación IA" },
                { id: "factors", label: "Factores clave" },
                { id: "tradeoffs", label: "Compensaciones" },
              ]}
              onChange={setExplanationView}
            />
            <ExplanationView
              errorMessage={
                searchResult.explanationQuery.error?.message ?? null
              }
              explanation={searchResult.explanation}
              isError={
                Boolean(result.run_id) && searchResult.explanationQuery.isError
              }
              isLoading={
                Boolean(result.run_id) &&
                searchResult.explanationQuery.isPending
              }
              profile={result.request?.profile ?? "balanced"}
              view={explanationView}
              winner={winner}
            />
            <Button
              disabled={!result.run_id}
              loading={
                Boolean(result.run_id) &&
                searchResult.explanationQuery.isFetching
              }
              onClick={() => void searchResult.explanationQuery.refetch()}
              type="button"
              variant="secondary"
            >
              Regenerar explicación
            </Button>
          </div>

          <Accordion
            onToggle={() => setTechOpen((open) => !open)}
            open={techOpen}
            title="Detalles técnicos"
          >
            <Tabs
              active={technicalView}
              ariaLabel="Vistas técnicas"
              compact
              items={[
                { id: "summary", label: "Resumen" },
                { id: "fuel", label: "Plan de combustible" },
                { id: "alternates", label: "Alternos" },
                { id: "costs", label: "Costes" },
                { id: "waypoints", label: "Fijos de navegación" },
                { id: "profile", label: "Perfil" },
                { id: "quality", label: "Calidad de datos" },
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
          </Accordion>
        </div>
      </div>

      <div
        style={{
          padding: "16px 18px",
          borderRadius: 10,
          border: "1px solid var(--ar-warning-border)",
          background: "var(--ar-warning-bg)",
          color: "var(--ar-warning-text)",
          fontSize: 12.5,
          lineHeight: 1.5,
        }}
      >
        AeroRoute MLX genera una simulación educativa pre-operacional. Los
        resultados son aproximados y no son aptos para decisiones operacionales
        o de seguridad.
      </div>

      <footer className="trust-strip">
        <span>Sin datos sensibles en la nube</span>
        <span>Ejecución local con MLX</span>
        <span>Trazable y reproducible</span>
        <span>Diseñado para pilotos, despachadores y analistas</span>
      </footer>
      <OperationalReadinessPanel
        assuranceReadiness={searchResult.assuranceReadiness.data}
        dataSources={searchResult.operationalDataSources.data}
        dispatchReadiness={searchResult.dispatchReadiness.data}
        fplValidation={searchResult.icaoFplValidation.data}
        operatorApprovalReadiness={searchResult.operatorApprovalReadiness.data}
        readiness={searchResult.operationalReadiness.data}
      />
      <p className="disclaimer">
        AeroRoute MLX genera una simulación educativa de plan de vuelo
        pre-operacional. Los resultados son aproximados, pueden usar datos
        públicos incompletos, no constituyen un plan de vuelo presentable ante
        ICAO y no son aptos para decisiones operacionales o de seguridad.
      </p>
    </div>
  );
}

function ComparisonTable({ candidates }: { candidates: Candidate[] }) {
  if (!candidates.length) {
    return <p>No se encontró ninguna trayectoria sintética factible.</p>;
  }
  return (
    <table className="comparison-table">
      <thead>
        <tr>
          <th>Ruta</th>
          <th>Fuel (kg)</th>
          <th>Tiempo (min)</th>
          <th>Distancia (NM)</th>
        </tr>
      </thead>
      <tbody>
        {candidates.map((candidate, index) => (
          <tr key={candidate.path.join("-") || index}>
            <td>
              <StatusBadge tone={index === 0 ? "success" : "neutral"}>
                {index === 0 ? "Óptima" : `Alternativa ${index}`}
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
    return <p>No se encontró ninguna trayectoria sintética factible.</p>;
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
            label="Componente medio"
            value={formatWindComponent(wind?.averageKt ?? null)}
          />
          <Metric
            label="Rango observado"
            value={
              wind
                ? `${formatWindComponent(wind.minimumKt)} a ${formatWindComponent(wind.maximumKt)}`
                : "No disponible"
            }
          />
          <Metric
            label="Muestras"
            value={
              wind ? `${wind.sampleCount} nodos de ruta` : "0 nodos de ruta"
            }
          />
          <Metric label="Estado del snapshot" value={weather.state} />
        </dl>
        <p className="fine-print">{weather.source}</p>
      </div>
    );
  }
  if (view === "details") {
    return (
      <div className="data-view">
        <dl className="summary-list">
          <Metric label="Algoritmo" value="Label-setting por capas" />
          <Metric label="Estado del candidato" value="Factible" />
          <Metric label="Firma de ruta" value={candidate.path.join(" · ")} />
          <Metric
            label="Puntos de geometría"
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

const profileClaims: Record<OptimizationProfile, string> = {
  minimum_fuel:
    "La ruta seleccionada es la candidata de mínimo combustible entre las alternativas evaluadas.",
  minimum_time:
    "La ruta seleccionada es la candidata de mínimo tiempo entre las alternativas evaluadas.",
  balanced:
    "La ruta seleccionada equilibra combustible y tiempo según los pesos del objetivo configurado.",
};

function ExplanationView({
  errorMessage,
  explanation,
  isError,
  isLoading,
  profile,
  view,
  winner,
}: {
  errorMessage: string | null;
  explanation: Explanation | null;
  isError: boolean;
  isLoading: boolean;
  profile: OptimizationProfile;
  view: "explanation" | "factors" | "tradeoffs";
  winner: Candidate | null;
}) {
  if (view === "factors") {
    return (
      <ul className="factor-list">
        {deriveFactors(winner).map((factor) => (
          <li key={factor}>{factor}</li>
        ))}
      </ul>
    );
  }
  if (view === "tradeoffs") {
    return (
      <dl className="metric-grid">
        <Metric
          label="Combustible"
          value={`${formatNumber(winner?.fuel_kg ?? 0)} kg`}
        />
        <Metric
          label="Tiempo"
          value={`${Math.round((winner?.time_s ?? 0) / 60)} min`}
        />
        <Metric label="Validez operacional" value="No evaluada" />
        <Metric
          label="Proveedor de explicación"
          value={explanation?.provider ?? "No disponible"}
        />
      </dl>
    );
  }
  if (isLoading) {
    return <p className="loading-state">Generando explicación…</p>;
  }
  if (isError || !explanation) {
    return <Alert>{errorMessage ?? "No se pudo cargar la explicación."}</Alert>;
  }
  return (
    <>
      <div className="explanation-card">
        <span>
          Recomendación ·{" "}
          {explanation.provider === "mlx"
            ? "Generada localmente con MLX"
            : "Fallback determinista"}
        </span>
        <strong>{profileClaims[profile]}</strong>
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

function deriveFactors(candidate: Candidate | null): string[] {
  const breakdown = candidate?.objective_breakdown;
  if (!breakdown) {
    return [
      "El detalle de puntuación por componente no está disponible para esta ruta.",
    ];
  }
  const components = [
    {
      key: "fuel" as const,
      label: "el consumo de combustible",
      magnitude: Math.abs(breakdown.fuel_component),
      delta: breakdown.fuel_delta,
    },
    {
      key: "time" as const,
      label: "el tiempo de vuelo",
      magnitude: Math.abs(breakdown.time_component),
      delta: breakdown.time_delta,
    },
    {
      key: "extension" as const,
      label: "la extensión de ruta",
      magnitude: Math.abs(breakdown.extension_component),
      delta: breakdown.route_extension,
    },
  ].sort((a, b) => b.magnitude - a.magnitude);
  const [dominant, secondary] = components;
  if (dominant.magnitude === 0) {
    return [
      "Todos los componentes puntuados fueron neutros para esta ruta frente al candidato base.",
    ];
  }
  const sentences: string[] = [];
  const direction = dominant.delta < 0 ? "menor" : "mayor";
  sentences.push(
    `La ruta se seleccionó principalmente por ${direction} ${dominant.label} (${formatPercentDelta(dominant.delta)} frente al base).`
  );
  if (
    dominant.key !== "extension" &&
    Math.abs(breakdown.route_extension) >= 0.005
  ) {
    sentences.push(
      `Añade aproximadamente ${formatPercentDelta(breakdown.route_extension)} de extensión de ruta frente al candidato más corto.`
    );
  }
  if (
    secondary &&
    secondary.magnitude > 0 &&
    secondary.magnitude >= dominant.magnitude * 0.3
  ) {
    sentences.push(
      `${capitalize(secondary.label)} también contribuyó a la puntuación (${formatPercentDelta(secondary.delta)}).`
    );
  }
  return sentences.slice(0, 3);
}

function formatPercentDelta(value: number) {
  const percent = Math.abs(value * 100);
  const formatted = percent >= 10 ? percent.toFixed(0) : percent.toFixed(1);
  return `${formatted}%`;
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    return <p>No se encontró ninguna trayectoria sintética factible.</p>;
  }
  if (view === "waypoints") {
    return (
      <table className="waypoint-table">
        <thead>
          <tr>
            <th>Punto de navegación</th>
            <th>Vía</th>
            <th>Tipo</th>
            <th>Coordenadas</th>
            <th>Nivel de vuelo</th>
            <th>Fuente</th>
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
                  ? `AIRAC ${point.airac_cycle ?? "actual"}${
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
        <Metric label="Crucero representativo" value="FL350" />
        <Metric label="Subida/descenso" value="Estimación de fase fija" />
        <Metric
          label="Tratamiento de masa"
          value="Integración iterativa de combustible"
        />
        <Metric label="Unidades internas" value="SI" />
      </dl>
    );
  }
  if (view === "fuel") {
    if (!fuelPlan) {
      return (
        <p>El plan de combustible no está disponible para este resultado.</p>
      );
    }
    return (
      <div className="planning-detail">
        <div className="planning-heading">
          <strong>
            Política de combustible · {fuelPlan.policy_identifier}
          </strong>
          <StatusBadge tone="warning">No operacional</StatusBadge>
        </div>
        <dl className="summary-list">
          <DetailRow
            label="Rodaje"
            value={`${formatNumber(fuelPlan.taxi_fuel_kg)} kg`}
          />
          <DetailRow
            label="Trayecto"
            value={`${formatNumber(fuelPlan.trip_fuel_kg)} kg`}
          />
          <DetailRow
            label="Contingencia"
            value={`${formatNumber(fuelPlan.contingency_fuel_kg)} kg`}
          />
          <DetailRow
            label="Alterno de destino"
            value={`${formatNumber(fuelPlan.alternate_fuel_kg)} kg`}
          />
          <DetailRow
            label="Reserva final"
            value={`${formatNumber(fuelPlan.final_reserve_fuel_kg)} kg`}
          />
          <DetailRow
            label="Extra"
            value={`${formatNumber(fuelPlan.extra_fuel_kg)} kg`}
          />
          <DetailRow
            label="Combustible de bloque"
            value={`${formatNumber(fuelPlan.block_fuel_kg)} kg`}
          />
          <DetailRow
            label="Masa de despegue"
            value={`${formatNumber(fuelPlan.takeoff_mass_kg)} kg`}
          />
          <DetailRow
            label="Combustible estimado de aterrizaje"
            value={`${formatNumber(fuelPlan.estimated_landing_fuel_kg)} kg`}
          />
          <DetailRow
            label="Convergencia de masa"
            value={
              fuelPlan.mass_converged
                ? `Convergió en ${fuelPlan.mass_iterations} iteraciones`
                : `No convergió tras ${fuelPlan.mass_iterations} iteraciones`
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
          <section>
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
                label="Desde el destino"
                value={`${destinationAlternate.distance_from_destination_nm.toFixed(1)} NM`}
              />
              <Metric
                label="Combustible estimado"
                value={`${formatNumber(destinationAlternate.estimated_fuel_kg)} kg`}
              />
              <Metric
                label="Pista más larga"
                value={
                  destinationAlternate.longest_published_runway_ft
                    ? `${formatNumber(destinationAlternate.longest_published_runway_ft)} ft`
                    : "No disponible"
                }
              />
              <Metric
                label="Fuente de navegación"
                value={
                  destinationAlternate.navigation_source
                    ? `AIRAC ${destinationAlternate.airac_cycle ?? "actual"}`
                    : "No disponible"
                }
              />
            </dl>
          </section>
        ) : (
          <Alert tone="warning">
            No se encontró un alterno de destino compatible.
          </Alert>
        )}
        <section>
          <h3>Candidatos de desvío en ruta</h3>
          {enrouteDiversions.length ? (
            <table className="waypoint-table">
              <thead>
                <tr>
                  <th>Aeropuerto</th>
                  <th>Distancia a la ruta</th>
                  <th>Pista</th>
                  <th>Fuente</th>
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
                        : "No disponible"}
                    </td>
                    <td>AIRAC {diversion.airac_cycle ?? "actual"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>No se encontraron candidatos de desvío en ruta compatibles.</p>
          )}
        </section>
        <p className="warning-text">
          Los candidatos no incluyen mínimos meteorológicos, NOTAM, estado del
          aeropuerto ni aprobación ETOPS/EDTO.
        </p>
      </div>
    );
  }
  if (view === "costs") {
    const fuel = candidate.fuel_breakdown;
    const objective = candidate.objective_breakdown;
    if (!fuel || !objective) {
      return (
        <p>El desglose de costes no está disponible para este resultado.</p>
      );
    }
    return (
      <dl className="summary-list">
        <DetailRow
          label="Combustible de trayecto modelado"
          value={`${formatNumber(fuel.modeled_trip_fuel_kg)} kg`}
        />
        <DetailRow
          label="Combustible de crucero"
          value={`${formatNumber(fuel.cruise_fuel_kg)} kg`}
        />
        <DetailRow
          label="Subida/descenso fijo"
          value={`${formatNumber(fuel.fixed_climb_descent_fuel_kg)} kg`}
        />
        <DetailRow
          label="Reserva de masa asumida"
          value={`${formatNumber(fuel.mass_assumption_fuel_kg)} kg`}
        />
        <DetailRow
          label="Componente de puntuación: combustible"
          value={objective.fuel_component.toFixed(4)}
        />
        <DetailRow
          label="Componente de puntuación: tiempo"
          value={objective.time_component.toFixed(4)}
        />
        <DetailRow
          label="Componente de puntuación: extensión"
          value={objective.extension_component.toFixed(4)}
        />
        <DetailRow
          label="Puntuación total"
          value={objective.total_score.toFixed(4)}
        />
      </dl>
    );
  }
  if (view === "quality") {
    return (
      <div className="quality-view">
        <section>
          <h3>Supuestos</h3>
          <ul className="factor-list">
            {assumptions.map((assumption) => (
              <li key={assumption}>{assumption}</li>
            ))}
          </ul>
        </section>
        <section>
          <h3>Calidad de datos</h3>
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
            label="Salida"
            value={terminalDescription(
              terminalSelection.departure_runway,
              terminalSelection.sid_identifier,
              terminalSelection.departure_runway_suggested
            )}
          />
          <DetailRow
            label="Llegada"
            value={terminalDescription(
              terminalSelection.arrival_runway,
              terminalSelection.star_identifier,
              terminalSelection.arrival_runway_suggested
            )}
          />
          <DetailRow
            label="Ciclo de navegación"
            value={`AIRAC ${terminalSelection.airac_cycle ?? "actual"}`}
          />
        </dl>
      ) : null}
    </>
  );
}

function SummaryTable({ candidate }: { candidate: Candidate | null }) {
  if (!candidate) {
    return <p>No se encontró ninguna trayectoria sintética factible.</p>;
  }
  const wind = windStatistics(candidate);
  const cruiseLevel = averageCruiseLevel(candidate);
  const rows: [string, string][] = [
    [
      "Distancia",
      `${formatNumber(metersToNauticalMiles(candidate.distance_m))} NM`,
    ],
    ["Tiempo de vuelo", `${Math.round(candidate.time_s / 60)} min`],
    ["Combustible", `${formatNumber(candidate.fuel_kg)} kg`],
    ["CO2 estimado", `${formatNumber(candidate.fuel_kg * 3.16)} kg`],
    [
      "Nivel de crucero medio",
      cruiseLevel ? `FL${cruiseLevel}` : "No disponible",
    ],
    [
      "Componente de viento medio",
      formatWindComponent(wind?.averageKt ?? null),
    ],
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function VerticalProfile({ candidate }: { candidate: Candidate }) {
  const waypoints = candidate.waypoints;
  if (waypoints.length < 2) {
    return (
      <figure className="profile-chart">
        <p className="empty-state">
          Perfil vertical no disponible: no hay datos de nivel de vuelo por
          punto para esta ruta.
        </p>
      </figure>
    );
  }
  const maxLevel = Math.max(...waypoints.map((point) => point.flight_level), 0);
  const scaleCeiling = Math.max(400, maxLevel);
  const totalDistance = waypoints.at(-1)?.cumulative_distance_m ?? 0;
  const chartTop = 78;
  const chartBottom = 315;
  const path = waypoints
    .map((point, index) => {
      const fraction =
        totalDistance > 0
          ? point.cumulative_distance_m / totalDistance
          : index / (waypoints.length - 1);
      const x = 35 + fraction * 730;
      const altitudeFraction = point.flight_level / scaleCeiling;
      const y = chartBottom - altitudeFraction * (chartBottom - chartTop);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  return (
    <figure className="profile-chart">
      <svg aria-label="Perfil vertical sintético" viewBox="0 0 800 350">
        <path
          className="profile-grid"
          d="M35 80 H765 M35 160 H765 M35 240 H765 M35 315 H765"
        />
        <path className="profile-line" d={path} />
        <text x="35" y="338">
          Origen
        </text>
        <text x="708" y="338">
          Destino
        </text>
        <text x="45" y="70">
          FL{scaleCeiling}
        </text>
      </svg>
    </figure>
  );
}

function WindScale() {
  return (
    <div className="wind-scale" aria-label="Escala de componente de viento">
      <span>Viento en contra</span>
      <div />
      <span>Viento en cola</span>
    </div>
  );
}

function waypointKindLabel(kind: WaypointDetail["kind"]) {
  if (kind === "navigation_fix") return "Fijo AIRAC";
  if (kind === "oceanic_coordinate") return "Coordenada oceánica";
  if (kind === "airport") return "Aeropuerto";
  return "Nodo del solver";
}

function terminalDescription(
  runway: string | null | undefined,
  procedure: string | null | undefined,
  suggested: boolean
) {
  if (!runway && !procedure) return "DCT o no disponible";
  return `${runway ? `RWY ${runway}` : "Pista no disponible"} · ${procedure ?? "DCT"}${suggested ? " · sugerida" : ""}`;
}

function metersToNauticalMiles(value: number) {
  return Math.round(value / 1852);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}

function OperationalReadinessPanel({
  assuranceReadiness,
  dataSources,
  dispatchReadiness,
  fplValidation,
  operatorApprovalReadiness,
  readiness,
}: {
  assuranceReadiness: AssuranceReadiness | undefined;
  dataSources: OperationalDataSources | undefined;
  dispatchReadiness: DispatchReadiness | undefined;
  fplValidation: IcaoFplValidation | undefined;
  operatorApprovalReadiness: OperatorApprovalReadiness | undefined;
  readiness: OperationalReadiness | undefined;
}) {
  const gaps = (readiness?.gaps ?? []).slice(0, 3);
  const blockingDomains = (dataSources?.blocking_domains ?? []).slice(0, 4);
  return (
    <section
      className="operational-readiness"
      aria-label="Preparación operacional"
    >
      <div>
        <span>Preparación operacional</span>
        <strong>
          {readiness?.operational_use_enabled
            ? "Build de operador aprobado"
            : "Solo modo simulador"}
        </strong>
      </div>
      <p>
        {readiness?.disclaimer ??
          "La preparación operacional no está disponible; sigue tratando cada resultado como no operacional."}
      </p>
      {readiness?.evidence_baseline ? (
        <p>
          Línea base de evidencia: {readiness.evidence_baseline}
          {readiness.hazard_log_baseline
            ? ` · Registro de peligros: ${readiness.hazard_log_baseline}`
            : ""}
        </p>
      ) : null}
      {dataSources?.data_baseline ? (
        <p>
          Línea base de datos: {dataSources.data_baseline}
          {blockingDomains.length
            ? ` · Bloqueante: ${blockingDomains.join(", ")}`
            : ""}
        </p>
      ) : null}
      {fplValidation?.baseline ? (
        <p>
          Validación de presentación: {fplValidation.baseline}
          {fplValidation.filing_enabled ? "" : " · Presentación deshabilitada"}
          {fplValidation.aircraft_capability?.capability_baseline
            ? ` · Capacidad de aeronave: ${fplValidation.aircraft_capability.capability_baseline}`
            : ""}
        </p>
      ) : null}
      {dispatchReadiness?.baseline ? (
        <p>
          Preparación de despacho: {dispatchReadiness.baseline}
          {dispatchReadiness.dispatch_release_enabled
            ? ""
            : " · Liberación deshabilitada"}
        </p>
      ) : null}
      {assuranceReadiness?.baseline ? (
        <p>
          Preparación de aseguramiento: {assuranceReadiness.baseline}
          {assuranceReadiness.assurance_enabled
            ? ""
            : " · Aseguramiento deshabilitado"}
        </p>
      ) : null}
      {operatorApprovalReadiness?.baseline ? (
        <p>
          Aprobación de operador: {operatorApprovalReadiness.baseline}
          {operatorApprovalReadiness.operator_approval_enabled
            ? ""
            : " · Despliegue bloqueado"}
        </p>
      ) : null}
      {gaps.length ? (
        <ul>
          {gaps.map((gap) => (
            <li key={gap.code}>{gap.title}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
