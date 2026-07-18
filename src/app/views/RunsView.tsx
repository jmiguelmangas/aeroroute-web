import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";

import { listOptimizations } from "../../api/client";
import { Alert, Button, StatusBadge } from "../../components";

export function RunsView({ onSelect }: { onSelect: (runId: string) => void }) {
  const history = useQuery({
    queryKey: ["optimization-history"],
    queryFn: listOptimizations,
  });

  return (
    <div className="ar-screen ar-screen--narrow" aria-label="Historial">
      <div>
        <span className="section-kicker">Historial</span>
        <h1 style={{ margin: "4px 0 0", fontSize: "1.7rem", fontWeight: 800 }}>
          Optimizaciones ejecutadas
        </h1>
      </div>

      {history.isPending ? (
        <p className="loading-state">Cargando ejecuciones…</p>
      ) : null}
      {history.isError ? (
        <>
          <Alert>{history.error.message}</Alert>
          <Button
            icon={RotateCw}
            onClick={() => void history.refetch()}
            variant="secondary"
          >
            Reintentar
          </Button>
        </>
      ) : null}

      {history.data ? (
        history.data.length ? (
          <div className="run-list">
            {history.data.map((run) => (
              <button
                className="run-row"
                key={run.run_id}
                onClick={() => onSelect(run.run_id)}
                style={{ width: "100%", border: 0, background: "transparent" }}
                type="button"
              >
                <span className="run-row__route">
                  <strong>{run.origin_icao}</strong>
                  <span aria-hidden="true">→</span>
                  <strong>{run.destination_icao}</strong>
                </span>
                <span>{run.aircraft_type}</span>
                <span>{run.profile.replaceAll("_", " ")}</span>
                <StatusBadge
                  tone={run.status === "optimal" ? "success" : "info"}
                >
                  {run.status}
                </StatusBadge>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">Todavía no hay ejecuciones guardadas.</p>
        )
      ) : null}
    </div>
  );
}
