// npm run sim:sensitivity — how rider earnings depend on the rest pay rate (not part of npm test).
// Default day, 5 seeds. Sweeps economics.restPayPerMinuteInr and finds the break-even rest pay: the smallest
// rate at which a rule set's average earnings are at least those of no-rules. Nothing else changes: every
// other rupee amount and every rule stays at its default. All rupee amounts are placeholders.
import type { PolicyVersion } from "@heatgate/contracts";
import { defaultSimParams, runDay } from "../src/index.ts";

const RATES = [0, 0.25, 0.5, 0.75, 1.0, 1.5];
const POLICIES: PolicyVersion[] = ["union-demand", "heatgate-fair"];
const base = defaultSimParams();

interface Point {
  rate: number;
  noRulesAvg: number[]; // per seed
  avg: number[];
  pct: number[];
  min: number[];
}

const start = Date.now();
const sweep: Record<string, Point[]> = Object.fromEntries(POLICIES.map((p) => [p, []]));
for (const rate of RATES) {
  const params = { ...base, economics: { ...base.economics, restPayPerMinuteInr: rate } };
  const noRules = params.seeds.map((seed) => runDay(params, "no-rules", seed, "sensitivity"));
  for (const policy of POLICIES) {
    const days = params.seeds.map((seed, i) =>
      runDay(params, policy, seed, "sensitivity", {
        noRulesOrdersPerRider: noRules[i].riders.map((r) => r.ordersDelivered),
        noRulesAvgEarningsInr: noRules[i].metrics.avgEarningsPerRiderInr,
      }).metrics,
    );
    sweep[policy].push({
      rate,
      noRulesAvg: noRules.map((d) => d.metrics.avgEarningsPerRiderInr),
      avg: days.map((m) => m.avgEarningsPerRiderInr),
      pct: days.map((m) => m.earningsPctOfNoRules),
      min: days.map((m) => m.minEarningsPerRiderInr),
    });
  }
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const cell = (v: number[], digits = 0) =>
  `${mean(v).toFixed(digits)} (${Math.min(...v).toFixed(digits)}-${Math.max(...v).toFixed(digits)})`;

// Smallest rate with earnings >= no-rules, linearly interpolated between sweep points.
// undefined: no point in the sweep reaches it.
function breakEven(rates: number[], gap: number[]): number | undefined {
  // gap = rule set's average earnings minus no-rules', at each rate
  const i = gap.findIndex((g) => g >= 0);
  if (i < 0) return undefined;
  if (i === 0) return rates[0];
  return rates[i - 1] + ((rates[i] - rates[i - 1]) * -gap[i - 1]) / (gap[i] - gap[i - 1]);
}

console.log(`Rest pay sensitivity: default day (peak ${base.peakTempC} °C, humidity ${base.humidityPct}%), seeds ${base.seeds.join(",")}`);
console.log("₹ amounts are placeholders. Mean over the seeds, (min-max) across them.\n");
const noRulesAvg = sweep[POLICIES[0]][0].noRulesAvg;
console.log(`no-rules average earnings ₹ (no paid rest, the same at every rate): ${cell(noRulesAvg)}\n`);

for (const policy of POLICIES) {
  console.log(policy);
  console.log("rest ₹/min | avg earnings ₹   | % of no-rules       | lowest rider ₹");
  for (const p of sweep[policy]) {
    console.log(`${p.rate.toFixed(2).padStart(10)} | ${cell(p.avg).padEnd(16)} | ${cell(p.pct, 1).padEnd(19)} | ${cell(p.min)}`);
  }
  const points = sweep[policy];
  const meanGap = points.map((p) => mean(p.avg) - mean(p.noRulesAvg));
  const seedGaps = base.seeds.map((_, s) => points.map((p) => p.avg[s] - p.noRulesAvg[s]));
  const overall = breakEven(RATES, meanGap);
  const perSeed = seedGaps.map((g) => breakEven(RATES, g));
  const reached = perSeed.filter((b): b is number => b !== undefined);
  const where = overall === undefined ? `not reached within ₹${RATES[0]}-${RATES[RATES.length - 1]}/min` : `₹${overall.toFixed(2)}/min`;
  const seeds =
    reached.length === perSeed.length
      ? `per seed ${Math.min(...reached).toFixed(2)}-${Math.max(...reached).toFixed(2)}`
      : `${perSeed.length - reached.length} of ${perSeed.length} seeds not reached in the sweep`;
  const atStart = overall === RATES[0] ? " (already at or above no-rules at the lowest rate in the sweep)" : "";
  console.log(`break-even rest pay: ${where}${atStart}, ${seeds} (interpolated between sweep points)\n`);
}
console.log(`run time: ${((Date.now() - start) / 1000).toFixed(1)} s`);
