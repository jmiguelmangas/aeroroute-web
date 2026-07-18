import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Minus, Plus } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { getFlightPlan, getFlightPlanPdf } from "../../api/client";
import { Alert, Button, Panel } from "../../components";
import { RouteMap } from "../../maps/RouteMap";

export function FlightPlanView({
  flightPlanId,
}: {
  flightPlanId: string | null;
}) {
  const navigate = useNavigate();
  const [navLogExpanded, setNavLogExpanded] = useState(false);
  const plan = useQuery({
    queryKey: ["flight-plan", flightPlanId],
    queryFn: () => getFlightPlan(flightPlanId as string),
    enabled: Boolean(flightPlanId),
  });
  const document = plan.data;
  const result = document?.optimization;
  const winner = result?.winner;
  const fuel = result?.fuel_plan;
  const terminal = result?.terminal_selection;
  const diversions = result?.enroute_diversions ?? [];
  const NavLogGlyph = navLogExpanded ? Minus : Plus;

  if (!flightPlanId) {
    return (
      <div className="ar-screen" aria-label="Plan de vuelo">
        <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800 }}>
          Plan de vuelo pre-operacional
        </h1>
        <p className="empty-state">
          Genera un plan de vuelo desde Nueva búsqueda o abre uno desde Rutas
          guardadas.
        </p>
      </div>
    );
  }

  return (
    <div className="ar-screen" aria-label="Plan de vuelo">
      {plan.isPending ? <p className="loading-state">Cargando OFP…</p> : null}
      {plan.isError ? <Alert>{plan.error.message}</Alert> : null}
      {document && result ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <h1 style={{ margin: 0, fontSize: "1.6rem", fontWeight: 800 }}>
              Plan de vuelo pre-operacional
            </h1>
          </div>

          <Alert tone="warning">{document.disclaimer}</Alert>

          <div className="ofp-heading">
            <div>
              <span className="section-kicker">Plan de vuelo</span>
              <h2>
                {document.request.callsign ?? "Sin callsign"} ·{" "}
                {document.request.origin_icao} →{" "}
                {document.request.destination_icao}
              </h2>
              <p>{new Date(document.created_at).toLocaleString()}</p>
            </div>
            <div className="ofp-actions">
              <Button
                icon={ArrowLeft}
                onClick={() => navigate(-1)}
                variant="ghost"
              >
                Volver
              </Button>
              <Button
                icon={Download}
                onClick={() => downloadJson(document)}
                variant="secondary"
              >
                Exportar JSON
              </Button>
              <Button
                icon={Download}
                onClick={() => void downloadPdf(document.flight_plan_id)}
                variant="secondary"
              >
                Exportar PDF
              </Button>
            </div>
          </div>

          <Panel title="Ruta codificada">
            <code className="coded-route">{document.coded_route}</code>
          </Panel>

          {fuel ? (
            <div
              className="ofp-fuel-grid"
              style={{ gridTemplateColumns: "repeat(6, 1fr)" }}
            >
              <FuelMetric label="Taxi" value={fuel.taxi_fuel_kg} />
              <FuelMetric label="Trip" value={fuel.trip_fuel_kg} />
              <FuelMetric
                label="Contingencia"
                value={fuel.contingency_fuel_kg}
              />
              <FuelMetric
                label="Reserva final"
                value={fuel.final_reserve_fuel_kg}
              />
              <FuelMetric label="Block" value={fuel.block_fuel_kg} strong />
              <FuelMetric
                label="Masa de despegue"
                value={fuel.takeoff_mass_kg}
              />
            </div>
          ) : null}

          {winner ? (
            <Panel className="stored-map-panel" title="Mapa de ruta">
              <RouteMap
                alternatives={result.alternatives}
                baseline={result.baseline}
                candidate={winner}
                destinationLabel={document.request.destination_icao}
                originLabel={document.request.origin_icao}
              />
            </Panel>
          ) : null}

          <div className="detail-grid">
            <Panel title="Resumen de vuelo">
              <dl className="summary-list">
                <Detail
                  label="Aeronave"
                  value={document.request.aircraft_type}
                />
                <Detail
                  label="Carga de pago"
                  value={
                    document.request.payload_mass_kg != null
                      ? `${formatNumber(document.request.payload_mass_kg)} kg`
                      : "Supuesto por defecto"
                  }
                />
                <Detail
                  label="Distancia"
                  value={
                    winner
                      ? `${formatNumber(winner.distance_m / 1852)} NM`
                      : "No disponible"
                  }
                />
                <Detail
                  label="Tiempo de vuelo"
                  value={
                    winner
                      ? `${Math.round(winner.time_s / 60)} min`
                      : "No disponible"
                  }
                />
                <Detail label="Run ID" value={document.optimization_run_id} />
              </dl>
            </Panel>
            <Panel title="Navegación terminal">
              <dl className="summary-list">
                <Detail
                  label="Salida"
                  value={
                    terminal
                      ? `RWY ${terminal.departure_runway ?? "—"} · ${terminal.sid_identifier ?? "Sin SID"}`
                      : "No disponible"
                  }
                />
                <Detail
                  label="Llegada"
                  value={
                    terminal
                      ? `RWY ${terminal.arrival_runway ?? "—"} · ${terminal.star_identifier ?? "Sin STAR"}`
                      : "No disponible"
                  }
                />
                <Detail
                  label="AIRAC"
                  value={terminal?.airac_cycle ?? "No disponible"}
                />
                <Detail
                  label="Alterno"
                  value={
                    result.destination_alternate?.icao_code ?? "No disponible"
                  }
                />
              </dl>
            </Panel>
          </div>

          <Panel title="Candidatos de desvío en ruta">
            {diversions.length ? (
              <table className="waypoint-table">
                <thead>
                  <tr>
                    <th>Aeropuerto</th>
                    <th>Distancia a la ruta</th>
                    <th>Pista más larga</th>
                    <th>Fuente</th>
                  </tr>
                </thead>
                <tbody>
                  {diversions.map((diversion) => (
                    <tr key={diversion.icao_code}>
                      <td>
                        {diversion.icao_code} · {diversion.name}
                      </td>
                      <td>{diversion.distance_to_route_nm.toFixed(1)} NM</td>
                      <td>
                        {diversion.longest_published_runway_ft
                          ? `${formatNumber(diversion.longest_published_runway_ft)} ft`
                          : "No disponible"}
                      </td>
                      <td>
                        {diversion.navigation_source ?? "No disponible"}{" "}
                        {diversion.airac_cycle ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No hay candidatos compatibles en el snapshot actual.</p>
            )}
          </Panel>

          {winner ? (
            <div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 10,
                }}
              >
                <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700 }}>
                  Registro de navegación
                </h3>
                {winner.waypoints.length > 4 ? (
                  <button
                    className="ar-disclosure"
                    style={{ width: "auto" }}
                    onClick={() => setNavLogExpanded((open) => !open)}
                    type="button"
                  >
                    <span>
                      {navLogExpanded
                        ? "Mostrar menos"
                        : "Mostrar todos los fixes"}
                    </span>
                    <NavLogGlyph aria-hidden="true" size={14} strokeWidth={2} />
                  </button>
                ) : null}
              </div>
              <div className="table-scroll">
                <table className="waypoint-table">
                  <thead>
                    <tr>
                      <th>Fix</th>
                      <th>Vía</th>
                      <th>Nivel</th>
                      <th>Transcurrido</th>
                      <th>Distancia</th>
                      <th>Fuel usado</th>
                      <th>Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleWaypoints(winner.waypoints, navLogExpanded).map(
                      (point) => (
                        <tr key={point.node_id}>
                          <td>{point.display_name}</td>
                          <td>{point.inbound_via ?? "—"}</td>
                          <td>
                            {point.flight_level > 0
                              ? `FL${point.flight_level}`
                              : "—"}
                          </td>
                          <td>{Math.round(point.elapsed_time_s / 60)} min</td>
                          <td>
                            {formatNumber(point.cumulative_distance_m / 1852)}{" "}
                            NM
                          </td>
                          <td>{formatNumber(point.cumulative_fuel_kg)} kg</td>
                          <td>{point.navigation_source ?? "Solver"}</td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function visibleWaypoints<T>(waypoints: T[], expanded: boolean): T[] {
  if (expanded || waypoints.length <= 4) return waypoints;
  return [...waypoints.slice(0, 3), waypoints[waypoints.length - 1]];
}

function FuelMetric({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: number;
}) {
  return (
    <div className={strong ? "fuel-metric fuel-metric--strong" : "fuel-metric"}>
      <span>{label}</span>
      <strong>{formatNumber(value)} kg</strong>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function downloadJson(document: object) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(document, null, 2)], { type: "application/json" })
  );
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = "aeroroute-ofp.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

async function downloadPdf(flightPlanId: string) {
  const content = await getFlightPlanPdf(flightPlanId);
  downloadBlob(content, `aeroroute-ofp-${flightPlanId}.pdf`);
}

function downloadBlob(content: Blob, filename: string) {
  const url = URL.createObjectURL(content);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
