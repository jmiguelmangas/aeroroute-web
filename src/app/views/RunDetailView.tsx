import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";

import { getExplanation, getOptimization } from "../../api/client";
import { Alert, Button, Panel, StatusBadge } from "../../components";
import { RouteMap } from "../../maps/RouteMap";

export function RunDetailView({ runId }: { runId: string }) {
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
    <div
      className="ar-screen ar-screen--narrow"
      aria-label="Detalle de ejecución"
    >
      <div>
        <span className="section-kicker">Historial</span>
        <h1 style={{ margin: "4px 0 0", fontSize: "1.7rem", fontWeight: 800 }}>
          {request
            ? `${request.origin_icao} → ${request.destination_icao}`
            : "Detalle de ejecución"}
        </h1>
      </div>

      {run.isPending ? (
        <p className="loading-state">Cargando ejecución…</p>
      ) : null}
      {run.isError ? (
        <>
          <Alert>{run.error.message}</Alert>
          <Button
            icon={RotateCw}
            onClick={() => void run.refetch()}
            variant="secondary"
          >
            Reintentar
          </Button>
        </>
      ) : null}

      {result ? (
        <>
          <div className="detail-grid">
            <Panel title="Optimización almacenada">
              <dl className="summary-list">
                <Detail label="Estado" value={result.status} />
                <Detail
                  label="Aeronave"
                  value={request?.aircraft_type ?? "No disponible"}
                />
                <Detail
                  label="Objetivo"
                  value={(request?.profile ?? "No disponible").replaceAll(
                    "_",
                    " "
                  )}
                />
                <Detail label="Algoritmo" value={result.algorithm_version} />
                <Detail label="Run ID" value={result.run_id ?? runId} />
              </dl>
            </Panel>
            <Panel title="Trayectoria ganadora">
              {winner ? (
                <dl className="summary-list">
                  <Detail
                    label="Distancia"
                    value={`${formatNumber(winner.distance_m / 1852)} NM`}
                  />
                  <Detail
                    label="Tiempo de vuelo"
                    value={`${Math.round(winner.time_s / 60)} min`}
                  />
                  <Detail
                    label="Combustible"
                    value={`${formatNumber(winner.fuel_kg)} kg`}
                  />
                  <Detail
                    label="Nodos sintéticos"
                    value={`${winner.waypoints.length}`}
                  />
                </dl>
              ) : (
                <p className="empty-state">No hay trayectoria factible.</p>
              )}
            </Panel>
          </div>
          {winner ? (
            <Panel className="stored-map-panel" title="Ruta almacenada">
              <RouteMap
                alternatives={result.alternatives}
                baseline={result.baseline}
                candidate={winner}
                destinationLabel={request?.destination_icao}
                originLabel={request?.origin_icao}
              />
            </Panel>
          ) : null}
          <Panel title="Explicación">
            {explanation.isPending ? (
              <p className="loading-state">Cargando explicación…</p>
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

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
