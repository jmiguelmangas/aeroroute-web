import { Alert, Panel } from "../../components";

export function AboutView() {
  return (
    <div className="ar-screen ar-screen--narrow" aria-label="Acerca de">
      <div>
        <span className="section-kicker">Acerca de</span>
        <h1 style={{ margin: "4px 0 0", fontSize: "1.7rem", fontWeight: 800 }}>
          Metodología y limitaciones
        </h1>
      </div>
      <div className="detail-grid">
        <Panel title="Optimización determinista">
          <p className="page-copy">
            AeroRoute compara trayectorias de corredor sintéticas usando
            entradas de rendimiento de aeronave y meteorología acotadas. La
            puntuación autoritativa permanece en el optimizador del backend.
          </p>
        </Panel>
        <Panel title="Explicación local">
          <p className="page-copy">
            Las explicaciones se limitan a hechos deterministas de la ruta. MLX
            es opcional y recurre a un proveedor basado en plantillas cuando no
            está disponible.
          </p>
        </Panel>
      </div>
      <Alert tone="warning">
        Simulador educativo únicamente. Los resultados no son aptos para
        planificación de vuelo operacional ni decisiones críticas de seguridad.
      </Alert>
    </div>
  );
}
