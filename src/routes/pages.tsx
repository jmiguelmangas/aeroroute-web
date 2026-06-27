import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCw } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import {
  getExplanation,
  getOptimization,
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
