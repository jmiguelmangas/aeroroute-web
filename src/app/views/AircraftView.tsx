import { AIRCRAFT_SPECS } from "../../data/aircraftSpecs";

export function AircraftView() {
  return (
    <div
      className="ar-screen"
      aria-label="Aeronaves"
      style={{ maxWidth: 1100 }}
    >
      <div>
        <span className="section-kicker">Flota</span>
        <h1 style={{ margin: "4px 0 0", fontSize: "1.7rem", fontWeight: 800 }}>
          Aeronaves
        </h1>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 14,
        }}
      >
        {AIRCRAFT_SPECS.map((aircraft) => (
          <div
            key={aircraft.code}
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
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <strong style={{ fontSize: 15 }}>{aircraft.name}</strong>
              <span
                style={{
                  flexShrink: 0,
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                  color:
                    aircraft.category === "Corto/medio radio"
                      ? "var(--ar-badge-success-text)"
                      : "var(--ar-link)",
                }}
              >
                {aircraft.category}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
                fontSize: 12.5,
              }}
            >
              <Spec
                label="MTOW"
                value={`${formatNumber(aircraft.mtowKg)} kg`}
              />
              <Spec
                label="Crucero"
                value={`Mach ${aircraft.cruiseMach.toFixed(2)}`}
              />
              <Spec
                label="Alcance"
                value={`${formatNumber(aircraft.rangeNm)} NM`}
              />
              <Spec label="Capacidad" value={`${aircraft.capacityPax} pax`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: "var(--ar-stat-label)" }}>{label}</div>
      <div style={{ marginTop: 3, fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value);
}
