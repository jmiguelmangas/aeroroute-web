import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, RotateCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import {
  getExplanation,
  getFlightPlan,
  getFlightPlanPdf,
  getOptimization,
  listFlightPlans,
  listOptimizations,
} from "../api/client";
import { Alert, Brand, Button, Panel, StatusBadge } from "../components";
import { RouteMap } from "../maps/RouteMap";

export function HistoryPage() {
  const history = useQuery({
    queryKey: ["optimization-history"],
    queryFn: listOptimizations,
  });

  return (
    <PageShell title="Run history">
      {history.isPending ? (
        <p className="loading-state">Loading runs…</p>
      ) : null}
      {history.isError ? (
        <>
          <Alert>{history.error.message}</Alert>
          <Button
            icon={RotateCw}
            onClick={() => void history.refetch()}
            variant="secondary"
          >
            Retry
          </Button>
        </>
      ) : null}
      {history.data ? (
        <Panel title="Recent optimizations">
          {history.data.length ? (
            <div className="run-list">
              {history.data.map((run) => (
                <Link
                  className="run-row"
                  key={run.run_id}
                  to={`/runs/${run.run_id}`}
                >
                  <span className="run-row__route">
                    <strong>{run.origin_icao}</strong>
                    <span aria-hidden="true">→</span>
                    <strong>{run.destination_icao}</strong>
                  </span>
                  <span>{run.aircraft_type}</span>
                  <span>{formatProfile(run.profile)}</span>
                  <StatusBadge
                    tone={run.status === "optimal" ? "success" : "info"}
                  >
                    {run.status}
                  </StatusBadge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">No saved runs yet.</p>
          )}
        </Panel>
      ) : null}
    </PageShell>
  );
}

export function FlightPlanHistoryPage() {
  const history = useQuery({
    queryKey: ["flight-plan-history"],
    queryFn: listFlightPlans,
  });

  return (
    <PageShell title="Saved flight plans">
      {history.isPending ? (
        <p className="loading-state">Loading OFPs…</p>
      ) : null}
      {history.isError ? <Alert>{history.error.message}</Alert> : null}
      {history.data ? (
        <Panel title="Immutable OFP snapshots">
          {history.data.length ? (
            <div className="run-list">
              {history.data.map((plan) => (
                <Link
                  className="run-row"
                  key={plan.flight_plan_id}
                  to={`/flight-plans/${plan.flight_plan_id}`}
                >
                  <span className="run-row__route">
                    <strong>{plan.origin_icao}</strong>
                    <span aria-hidden="true">→</span>
                    <strong>{plan.destination_icao}</strong>
                  </span>
                  <span>{plan.callsign ?? "No callsign"}</span>
                  <span>{plan.aircraft_type}</span>
                  <StatusBadge tone="info">OFP</StatusBadge>
                </Link>
              ))}
            </div>
          ) : (
            <p className="empty-state">No saved flight plans yet.</p>
          )}
        </Panel>
      ) : null}
    </PageShell>
  );
}

export function RunDetailPage() {
  const { runId = "" } = useParams();
  const run = useQuery({
    queryKey: ["optimization", runId],
    queryFn: () => getOptimization(runId),
    enabled: Boolean(runId),
  });
  const explanation = useQuery({
    queryKey: ["explanation", runId],
    queryFn: () => getExplanation(runId),
    enabled: Boolean(runId),
    retry: 1,
  });
  const result = run.data;
  const request = result?.request;
  const winner = result?.winner;

  return (
    <PageShell title="Run details">
      {run.isPending ? <p className="loading-state">Loading run…</p> : null}
      {run.isError ? (
        <>
          <Alert>{run.error.message}</Alert>
          <Button
            icon={RotateCw}
            onClick={() => void run.refetch()}
            variant="secondary"
          >
            Retry
          </Button>
        </>
      ) : null}
      {result ? (
        <>
          <div className="detail-grid">
            <Panel
              title={
                request
                  ? `${request.origin_icao} → ${request.destination_icao}`
                  : "Stored optimization"
              }
            >
              <dl className="summary-list">
                <Detail label="Status" value={result.status} />
                <Detail
                  label="Aircraft"
                  value={request?.aircraft_type ?? "Unavailable"}
                />
                <Detail
                  label="Objective"
                  value={formatProfile(request?.profile ?? "Unavailable")}
                />
                <Detail label="Algorithm" value={result.algorithm_version} />
                <Detail label="Run ID" value={result.run_id ?? runId} />
              </dl>
            </Panel>
            <Panel title="Winning trajectory">
              {winner ? (
                <dl className="summary-list">
                  <Detail
                    label="Distance"
                    value={`${formatNumber(winner.distance_m / 1852)} NM`}
                  />
                  <Detail
                    label="Flight time"
                    value={`${Math.round(winner.time_s / 60)} min`}
                  />
                  <Detail
                    label="Fuel"
                    value={`${formatNumber(winner.fuel_kg)} kg`}
                  />
                  <Detail
                    label="Synthetic nodes"
                    value={`${winner.waypoints.length}`}
                  />
                </dl>
              ) : (
                <p className="empty-state">No feasible trajectory.</p>
              )}
            </Panel>
          </div>
          {winner ? (
            <Panel className="stored-map-panel" title="Stored route">
              <RouteMap
                alternatives={result.alternatives}
                baseline={result.baseline}
                candidate={winner}
                destinationLabel={request?.destination_icao}
                originLabel={request?.origin_icao}
              />
            </Panel>
          ) : null}
          <Panel title="Explanation">
            {explanation.isPending ? (
              <p className="loading-state">Loading explanation…</p>
            ) : null}
            {explanation.isError ? (
              <Alert>{explanation.error.message}</Alert>
            ) : null}
            {explanation.data ? (
              <div className="explanation-card">
                <StatusBadge
                  tone={
                    explanation.data.provider === "mlx" ? "info" : "neutral"
                  }
                >
                  {explanation.data.provider === "mlx"
                    ? "MLX local"
                    : "Fallback"}
                </StatusBadge>
                <p>{explanation.data.text}</p>
              </div>
            ) : null}
          </Panel>
        </>
      ) : null}
    </PageShell>
  );
}

export function FlightPlanDetailPage() {
  const { flightPlanId = "" } = useParams();
  const plan = useQuery({
    queryKey: ["flight-plan", flightPlanId],
    queryFn: () => getFlightPlan(flightPlanId),
    enabled: Boolean(flightPlanId),
  });
  const document = plan.data;
  const result = document?.optimization;
  const winner = result?.winner;
  const fuel = result?.fuel_plan;
  const terminal = result?.terminal_selection;
  const diversions = result?.enroute_diversions ?? [];

  return (
    <PageShell title="Pre-operational OFP">
      {plan.isPending ? <p className="loading-state">Loading OFP…</p> : null}
      {plan.isError ? <Alert>{plan.error.message}</Alert> : null}
      {document && result ? (
        <>
          <Alert tone="warning">{document.disclaimer}</Alert>
          <div className="ofp-heading">
            <div>
              <span className="section-kicker">Flight plan</span>
              <h2>
                {document.request.callsign ?? "No callsign"} ·{" "}
                {document.request.origin_icao} →{" "}
                {document.request.destination_icao}
              </h2>
              <p>{new Date(document.created_at).toLocaleString()}</p>
            </div>
            <div className="ofp-actions">
              <Button
                icon={Download}
                onClick={() => downloadJson(document)}
                variant="secondary"
              >
                Export JSON
              </Button>
              <Button
                icon={Download}
                onClick={() => void downloadPdf(document.flight_plan_id)}
                variant="secondary"
              >
                Export PDF
              </Button>
            </div>
          </div>
          <Panel title="Coded route">
            <code className="coded-route">{document.coded_route}</code>
          </Panel>
          <div className="detail-grid ofp-summary-grid">
            <Panel title="Flight summary">
              <dl className="summary-list">
                <Detail
                  label="Aircraft"
                  value={document.request.aircraft_type}
                />
                <Detail
                  label="Payload"
                  value={
                    document.request.payload_mass_kg != null
                      ? `${formatNumber(document.request.payload_mass_kg)} kg`
                      : "Default assumption"
                  }
                />
                <Detail
                  label="Distance"
                  value={
                    winner
                      ? `${formatNumber(winner.distance_m / 1852)} NM`
                      : "Unavailable"
                  }
                />
                <Detail
                  label="Flight time"
                  value={
                    winner
                      ? `${Math.round(winner.time_s / 60)} min`
                      : "Unavailable"
                  }
                />
                <Detail label="Run ID" value={document.optimization_run_id} />
              </dl>
            </Panel>
            <Panel title="Terminal navigation">
              <dl className="summary-list">
                <Detail
                  label="Departure"
                  value={
                    terminal
                      ? `RWY ${terminal.departure_runway ?? "—"} · ${terminal.sid_identifier ?? "No SID"}`
                      : "Unavailable"
                  }
                />
                <Detail
                  label="Arrival"
                  value={
                    terminal
                      ? `RWY ${terminal.arrival_runway ?? "—"} · ${terminal.star_identifier ?? "No STAR"}`
                      : "Unavailable"
                  }
                />
                <Detail
                  label="AIRAC"
                  value={terminal?.airac_cycle ?? "Unavailable"}
                />
                <Detail
                  label="Alternate"
                  value={
                    result.destination_alternate?.icao_code ?? "Unavailable"
                  }
                />
              </dl>
            </Panel>
          </div>
          {fuel ? (
            <Panel title="Fuel and mass">
              <div className="ofp-fuel-grid">
                <FuelMetric label="Taxi" value={fuel.taxi_fuel_kg} />
                <FuelMetric label="Trip" value={fuel.trip_fuel_kg} />
                <FuelMetric
                  label="Contingency"
                  value={fuel.contingency_fuel_kg}
                />
                <FuelMetric label="Alternate" value={fuel.alternate_fuel_kg} />
                <FuelMetric
                  label="Final reserve"
                  value={fuel.final_reserve_fuel_kg}
                />
                <FuelMetric label="Extra" value={fuel.extra_fuel_kg} />
                <FuelMetric label="Block" value={fuel.block_fuel_kg} strong />
                <FuelMetric
                  label="Takeoff mass"
                  value={fuel.takeoff_mass_kg}
                  strong
                />
              </div>
            </Panel>
          ) : null}
          {winner ? (
            <Panel className="stored-map-panel" title="Route map">
              <RouteMap
                alternatives={result.alternatives}
                baseline={result.baseline}
                candidate={winner}
                destinationLabel={document.request.destination_icao}
                originLabel={document.request.origin_icao}
              />
            </Panel>
          ) : null}
          <Panel title="En-route diversion candidates">
            {diversions.length ? (
              <table className="waypoint-table">
                <thead>
                  <tr>
                    <th>Airport</th>
                    <th>Distance to route</th>
                    <th>Longest runway</th>
                    <th>Source</th>
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
                          : "Unavailable"}
                      </td>
                      <td>
                        {diversion.navigation_source ?? "Unavailable"}{" "}
                        {diversion.airac_cycle ?? ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No compatible candidates in the current snapshot.</p>
            )}
          </Panel>
          {winner ? (
            <Panel title="Navigation log">
              <div className="table-scroll">
                <table className="waypoint-table">
                  <thead>
                    <tr>
                      <th>Fix</th>
                      <th>Via</th>
                      <th>Level</th>
                      <th>Elapsed</th>
                      <th>Distance</th>
                      <th>Fuel used</th>
                      <th>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winner.waypoints.map((point) => (
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
                          {formatNumber(point.cumulative_distance_m / 1852)} NM
                        </td>
                        <td>{formatNumber(point.cumulative_fuel_kg)} kg</td>
                        <td>{point.navigation_source ?? "Solver"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ) : null}
        </>
      ) : null}
    </PageShell>
  );
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

export function AboutPage() {
  return (
    <PageShell title="Methodology and limitations">
      <div className="detail-grid">
        <Panel title="Deterministic optimization">
          <p className="page-copy">
            AeroRoute compares synthetic corridor trajectories using bounded
            aircraft-performance and weather inputs. Authoritative scoring
            remains in the backend optimizer.
          </p>
        </Panel>
        <Panel title="Local explanation">
          <p className="page-copy">
            Explanations are constrained to deterministic route facts. MLX is
            optional and falls back to a template provider when unavailable.
          </p>
        </Panel>
      </div>
      <Alert tone="warning">
        Educational simulator only. Results are not suitable for operational
        flight planning or safety-critical decisions.
      </Alert>
    </PageShell>
  );
}

function PageShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <main className="subpage-shell">
      <header className="subpage-header">
        <Link aria-label="Back to route search" to="/">
          <Brand compact />
        </Link>
        <nav aria-label="Primary navigation">
          <Link to="/">New search</Link>
          <Link to="/runs">Run history</Link>
          <Link to="/flight-plans">Saved OFPs</Link>
          <Link to="/about">About</Link>
        </nav>
      </header>
      <div className="subpage-title">
        <Link className="icon-link" aria-label="Back to route search" to="/">
          <ArrowLeft aria-hidden="true" size={19} />
        </Link>
        <h1>{title}</h1>
      </div>
      {children}
    </main>
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

function formatProfile(value: string) {
  return value.replaceAll("_", " ");
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
