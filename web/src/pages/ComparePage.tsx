// PLACEHOLDER (teammate zone): all four rule sets side by side, mean and range over the seeds.
// Data: useDefaults (params), useSimulation (run + poll).
import type { NumericMetric, PolicyVersion } from "@heatgate/contracts";
import { AsyncView } from "../components/AsyncView.tsx";
import { useDefaults, useSimulation } from "../hooks/index.ts";

const SHOWN: NumericMetric[] = ["unsafeExposureMin90", "ordersDelivered", "avgEarningsPerRiderInr", "minEarningsPerRiderInr"];

export function ComparePage() {
  const defaults = useDefaults();
  const sim = useSimulation();

  return (
    <div className="space-y-md">
      <h1 className="font-display text-xl font-bold">Compare rule sets</h1>
      <AsyncView state={defaults} label="defaults">
        {(params) => (
          <button
            type="button"
            disabled={sim.loading}
            onClick={() => sim.run(params)}
            className="rounded-md bg-brand px-md py-sm text-sm font-semibold text-white disabled:opacity-50"
          >
            {sim.loading ? `Running (${sim.status})…` : "Run all rule sets"}
          </button>
        )}
      </AsyncView>
      {sim.error && (
        <p role="alert" className="text-sm text-danger">
          {sim.error.message}
        </p>
      )}
      {sim.data && (
        <table className="w-full border-collapse bg-panel text-sm">
          <thead>
            <tr>
              <th className="border border-border p-xs text-left">Metric (mean, min–max)</th>
              {Object.keys(sim.data.runs).map((p) => (
                <th key={p} className="border border-border p-xs text-left">
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {SHOWN.map((m) => (
              <tr key={m}>
                <td className="border border-border p-xs">{m}</td>
                {Object.entries(sim.data!.runs).map(([p, run]) => (
                  <td key={p as PolicyVersion} className="border border-border p-xs">
                    {run!.metrics[m].toFixed(0)} ({run!.range[m].min.toFixed(0)}–{run!.range[m].max.toFixed(0)})
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
