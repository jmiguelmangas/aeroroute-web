import { FormEvent, useEffect, useState } from "react";

import {
  createOptimization,
  Explanation,
  getExplanation,
  listOptimizations,
  OptimizationHistoryItem,
  OptimizationProfile,
  OptimizationResult,
} from "../api/client";
import { RouteMap } from "../maps/RouteMap";

const profiles: Record<OptimizationProfile, string> = {
  minimum_fuel: "Minimum fuel",
  minimum_time: "Minimum time",
  balanced: "Balanced",
};

export function App() {
  const [origin, setOrigin] = useState("LEMD");
  const [destination, setDestination] = useState("KJFK");
  const [aircraft, setAircraft] = useState<"A320" | "B738">("A320");
  const [profile, setProfile] = useState<OptimizationProfile>("balanced");
  const [result, setResult] = useState<OptimizationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [history, setHistory] = useState<OptimizationHistoryItem[]>([]);

  useEffect(() => {
    void listOptimizations()
      .then(setHistory)
      .catch(() => setHistory([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setExplanation(null);
    try {
      setResult(
        await createOptimization({
          origin_icao: origin.toUpperCase(),
          destination_icao: destination.toUpperCase(),
          aircraft_type: aircraft,
          profile,
        })
      );
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "The simulation could not be completed."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <h1>AeroRoute MLX</h1>
      <p>Educational synthetic trajectory-efficiency simulator</p>
      <p>
        Results are approximate, may use incomplete public data, and are not
        suitable for operational flight planning or safety-critical decisions.
      </p>
      <form onSubmit={submit}>
        <label>
          Origin ICAO
          <input
            value={origin}
            onChange={(event) => setOrigin(event.target.value)}
            maxLength={8}
            required
          />
        </label>
        <label>
          Destination ICAO
          <input
            value={destination}
            onChange={(event) => setDestination(event.target.value)}
            maxLength={8}
            required
          />
        </label>
        <label>
          Aircraft
          <select
            value={aircraft}
            onChange={(event) =>
              setAircraft(event.target.value as "A320" | "B738")
            }
          >
            <option value="A320">A320</option>
            <option value="B738">B737-800</option>
          </select>
        </label>
        <label>
          Optimization profile
          <select
            value={profile}
            onChange={(event) =>
              setProfile(event.target.value as OptimizationProfile)
            }
          >
            {Object.entries(profiles).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button disabled={loading} type="submit">
          {loading ? "Simulating…" : "Simulate trajectory"}
        </button>
      </form>
      {error ? <p role="alert">{error}</p> : null}
      {result?.winner ? (
        <Result
          explanation={explanation}
          loadExplanation={async () => {
            if (result.run_id) {
              setExplanation(await getExplanation(result.run_id));
            }
          }}
          result={result}
        />
      ) : null}
      <section aria-label="Simulation history">
        <h2>Recent simulations</h2>
        {history.length === 0 ? <p>No stored simulations yet.</p> : null}
        <ul>
          {history.map((run) => (
            <li key={run.run_id}>
              {run.origin_icao}–{run.destination_icao} · {run.aircraft_type} ·{" "}
              {run.profile} · {run.status}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Result({
  explanation,
  loadExplanation,
  result,
}: {
  explanation: Explanation | null;
  loadExplanation: () => Promise<void>;
  result: OptimizationResult;
}) {
  const { winner } = result;
  if (!winner) {
    return <p>No feasible synthetic trajectory was found.</p>;
  }
  return (
    <section aria-label="Simulation result">
      <h2>Selected synthetic trajectory</h2>
      <dl>
        <div>
          <dt>Estimated fuel</dt>
          <dd>{Math.round(winner.fuel_kg)} kg</dd>
        </div>
        <div>
          <dt>Estimated airborne time</dt>
          <dd>{Math.round(winner.time_s / 60)} min</dd>
        </div>
        <div>
          <dt>Route distance</dt>
          <dd>{Math.round(winner.distance_m / 1000)} km</dd>
        </div>
      </dl>
      <p>Solver status: {result.status}</p>
      <RouteMap points={winner.geometry} />
      {result.run_id ? (
        <button onClick={() => void loadExplanation()} type="button">
          Explain this result
        </button>
      ) : null}
      {explanation ? (
        <section aria-label="Trajectory explanation">
          <h3>Explanation ({explanation.provider})</h3>
          <p>{explanation.text}</p>
          {explanation.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      ) : null}
    </section>
  );
}
