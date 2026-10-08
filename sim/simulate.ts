// Runs every rule set on the same seeds and reports the mean and the min-max range.
import type { Metrics, NumericMetric, Outcome, SimParams, SimResult } from "@heatgate/contracts";
import { runDay } from "./dispatcher.ts";

const OUTCOMES: Outcome[] = ["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"];

export function simulate(params: SimParams, simulationId = `sim-${params.seeds.join("-")}`): SimResult {
  const runs: SimResult["runs"] = {};
  for (const policy of params.policyVersions) {
    const days = params.seeds.map((seed) => runDay(params, policy, seed, simulationId));
    const all = days.map((d) => d.metrics);
    const keys = Object.keys(all[0]).filter((k) => k !== "decisions") as NumericMetric[];
    const mean = { decisions: {} } as Metrics;
    const range = {} as Record<NumericMetric, { min: number; max: number }>;
    for (const k of keys) {
      const values = all.map((m) => m[k]);
      mean[k] = values.reduce((a, b) => a + b, 0) / values.length;
      range[k] = { min: Math.min(...values), max: Math.max(...values) };
    }
    for (const o of OUTCOMES) mean.decisions[o] = all.reduce((a, m) => a + m.decisions[o], 0) / all.length;
    runs[policy] = { metrics: mean, range, frames: days[0].frames };
  }
  return { simulationId, params, runs };
}
