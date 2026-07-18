import { useQuery } from "@tanstack/react-query";
import { RotateCw } from "lucide-react";

import { listFlightPlans } from "../../api/client";
import { Alert, Button } from "../../components";

export function SavedRoutesView({
  onSelect,
}: {
  onSelect: (flightPlanId: string) => void;
}) {
  const history = useQuery({
    queryKey: ["flight-plan-history"],
    queryFn: listFlightPlans,
  });

  return (
    <div className="ar-screen ar-screen--narrow" aria-label="Rutas guardadas">
      <div>
        <span className="section-kicker">Historial</span>
        <h1 style={{ margin: "4px 0 0", fontSize: "1.7rem", fontWeight: 800 }}>
          Rutas guardadas
        </h1>
      </div>

      {history.isPending ? (
        <p className="loading-state">Cargando OFPs…</p>
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
          <div
            style={{
              borderRadius: "var(--ar-radius-panel)",
              border: "1px solid var(--ar-border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 0.7fr 0.9fr 0.7fr",
                padding: "12px 18px",
                color: "var(--ar-text-meta)",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                background: "var(--ar-list-header-bg)",
              }}
            >
              <span>Ruta</span>
              <span>Aeronave</span>
              <span>Fecha</span>
              <span>Callsign</span>
            </div>
            {history.data.map((plan) => (
              <button
                className="run-row"
                key={plan.flight_plan_id}
                onClick={() => onSelect(plan.flight_plan_id)}
                style={{
                  gridTemplateColumns: "1.4fr 0.7fr 0.9fr 0.7fr",
                  width: "100%",
                  border: 0,
                  borderTop: "1px solid var(--ar-divider-faint)",
                  background: "transparent",
                }}
                type="button"
              >
                <span className="run-row__route">
                  {plan.origin_icao} → {plan.destination_icao}
                </span>
                <span>{plan.aircraft_type}</span>
                <span>{new Date(plan.created_at).toLocaleDateString()}</span>
                <span>{plan.callsign ?? "—"}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="empty-state">
            Todavía no hay planes de vuelo guardados.
          </p>
        )
      ) : null}
    </div>
  );
}
