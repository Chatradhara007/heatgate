// Runs every rule set on the same seeds and reports the mean and the min-max range.
import type { Decision, Metrics, NumericMetric, Outcome, PolicyVersion, SimParams, SimResult } from "@heatgate/contracts";
import { runDay, type DayResult } from "./dispatcher.ts";
import { pctOfBaseline } from "./earnings.ts";

const OUTCOMES: Outcome[] = ["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"];

export interface SimOutput {
  result: SimResult;
  // First seed only, per rule set: every non-ALLOW decision plus 1 in 20 ALLOWs, at most 3000 (sim/audit.ts).
  // Simulated time, and the same pseudonymous rider ids as the frames.
  audit: Partial<Record<PolicyVersion, Decision[]>>;
}

// SimOutput plus numbers that are not in contracts' Metrics.
export interface SimReport extends SimOutput {
  // Average earnings as a % of the no-rules ("today") run, paired by seed: mean and range over the seeds.
  earningsPctOfNoRules: Partial<Record<PolicyVersion, { mean: number; min: number; max: number }>>;
}

export function simulateWithAudit(params: SimParams, simulationId = `sim-${params.seeds.join("-")}`): SimReport {
  const runs: SimResult["runs"] = {};
  const audit: SimOutput["audit"] = {};
  const earningsPctOfNoRules: SimReport["earningsPctOfNoRules"] = {};
  // The no-rules run on each seed sets the daily target and the earnings baseline for every rule set.
  const wantNoRules = params.policyVersions.includes("no-rules");
  const baseline = params.seeds.map((seed, i) => runDay(params, "no-rules", seed, simulationId, { audit: wantNoRules && i === 0 }));
  for (const policy of params.policyVersions) {
    const days: DayResult[] =
      policy === "no-rules"
        ? baseline
        : params.seeds.map((seed, i) =>
            runDay(params, policy, seed, simulationId, {
              audit: i === 0,
              noRulesOrdersPerRider: baseline[i].riders.map((r) => r.ordersDelivered),
            }),
          );
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
    audit[policy] = days[0].audit ?? [];
    const pct = days.map((d, i) => pctOfBaseline(d.metrics.avgEarningsPerRiderInr, baseline[i].metrics.avgEarningsPerRiderInr));
    earningsPctOfNoRules[policy] = { mean: pct.reduce((a, b) => a + b, 0) / pct.length, min: Math.min(...pct), max: Math.max(...pct) };
  }
  return { result: { simulationId, params, runs }, audit, earningsPctOfNoRules };
}

export function simulate(params: SimParams, simulationId = `sim-${params.seeds.join("-")}`): SimResult {
  return simulateWithAudit(params, simulationId).result;
}
