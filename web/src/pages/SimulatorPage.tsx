// PLACEHOLDER (teammate zone): the Sandbox. Sliders, rule-set selector, map area, results.
// Data: useDefaults (slider starting values), usePolicies (selector), useSimulation (run + poll).
import { useEffect, useState } from "react";
import type { PolicyVersion, SimParams } from "@heatgate/contracts";
import { AsyncView } from "../components/AsyncView.tsx";
import { useDefaults, usePolicies, useSimulation } from "../hooks/index.ts";

export function SimulatorPage() {
  const defaults = useDefaults();
  const policies = usePolicies();
  const sim = useSimulation();
  const [params, setParams] = useState<SimParams | undefined>(undefined);
  const [policy, setPolicy] = useState<PolicyVersion>("heatgate-fair");

  useEffect(() => {
    if (defaults.data) setParams(defaults.data);
  }, [defaults.data]);

  const run = sim.data?.runs[policy];

  return (
    <div className="grid gap-lg md:grid-cols-[280px_1fr]">
      <section className="space-y-md rounded-lg border border-border bg-panel p-md" data-testid="controls">
        <h1 className="font-display text-xl font-bold">Simulator</h1>
        <AsyncView state={defaults} label="defaults">
          {() =>
            params && (
              <div className="space-y-sm text-sm">
                <label className="block">
                  Peak temperature: {params.peakTempC} °C
                  <input
                    type="range"
                    min={34}
                    max={46}
                    value={params.peakTempC}
                    onChange={(e) => setParams({ ...params, peakTempC: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  Humidity: {params.humidityPct}%
                  <input
                    type="range"
                    min={10}
                    max={80}
                    value={params.humidityPct}
                    onChange={(e) => setParams({ ...params, humidityPct: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
                <label className="block">
                  Riders: {params.riders}
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={params.riders}
                    onChange={(e) => setParams({ ...params, riders: Number(e.target.value) })}
                    className="w-full"
                  />
                </label>
                <p className="text-xs text-ink-muted" data-testid="defaults-summary">
                  Defaults: {params.seeds.length} seeds, {params.startHour}:00–{params.endHour}:00
                </p>
              </div>
            )
          }
        </AsyncView>
        <AsyncView state={policies} label="rule sets">
          {(list) => (
            <select
              value={policy}
              onChange={(e) => setPolicy(e.target.value as PolicyVersion)}
              className="w-full rounded-md border border-border p-xs text-sm"
              data-testid="policy-select"
            >
              {list.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </AsyncView>
        <button
          type="button"
          disabled={!params || sim.loading}
          onClick={() => params && sim.run(params)}
          className="w-full rounded-md bg-brand px-md py-sm text-sm font-semibold text-white disabled:opacity-50"
        >
          {sim.loading ? `Running (${sim.status}, ${Math.round(sim.elapsedMs / 1000)} s)…` : "Run simulation"}
        </button>
      </section>

      <section className="space-y-md">
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-border bg-panel text-sm text-ink-muted">
          Map area ({sim.data ? `${run?.frames.length ?? 0} frames for ${policy}` : "run a simulation"})
        </div>
        <div className="rounded-lg border border-border bg-panel p-md" data-testid="results">
          <h2 className="mb-sm font-display text-lg font-bold">Results</h2>
          {sim.status === "idle" && <p className="text-sm text-ink-muted">Press “Run simulation”.</p>}
          {sim.loading && <p className="text-sm text-ink-muted">Simulation {sim.status}…</p>}
          {sim.error && (
            <p role="alert" className="text-sm text-danger">
              {sim.error.message}
            </p>
          )}
          {sim.data && run && (
            <pre className="overflow-auto font-mono text-xs" data-testid="results-data">
              {JSON.stringify({ simulationId: sim.data.simulationId, policy, metrics: run.metrics }, null, 2)}
            </pre>
          )}
        </div>
      </section>
    </div>
  );
}
