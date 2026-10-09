// The rest pay sweep behind npm run sim:sensitivity (printed) and npm run sim:breakeven (written to
// sim/results/break-even.json, served by GET /break-even). See docs/money-model.md.
// ALL RUPEE AMOUNTS ARE PLACEHOLDERS from interview-pending economics.
import type { BreakEvenReport, PolicyVersion, SimParams } from "@heatgate/contracts";
import { runDay } from "./dispatcher.ts";

export const BREAK_EVEN_NOTE: BreakEvenReport["note"] = "All rupee amounts are placeholders from interview-pending economics.";
export const REST_PAY_RATES = [0, 0.25, 0.5, 0.75, 1.0, 1.5];
export const ORDERS_PER_HOUR_LEVELS = [25, 34, 50];
export const BREAK_EVEN_POLICIES: PolicyVersion[] = ["union-demand", "heatgate-fair"];

export interface SweepPoint {
  rate: number;
  noRulesAvg: number[]; // per seed
  avg: number[];
  pct: number[];
  min: number[];
}

// Every rate in `rates` for each policy, on `base` with only economics.restPayPerMinuteInr changed.
export function sweepRestPay(base: SimParams, rates = REST_PAY_RATES, policies = BREAK_EVEN_POLICIES): Record<string, SweepPoint[]> {
  const sweep: Record<string, SweepPoint[]> = Object.fromEntries(policies.map((p) => [p, []]));
  for (const rate of rates) {
    const params = { ...base, economics: { ...base.economics, restPayPerMinuteInr: rate } };
    const noRules = params.seeds.map((seed) => runDay(params, "no-rules", seed, "sensitivity"));
    for (const policy of policies) {
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
  return sweep;
}

export const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
const stat = (v: number[]) => ({ mean: mean(v), min: Math.min(...v), max: Math.max(...v) });

// Smallest rate with earnings >= no-rules, linearly interpolated between sweep points.
// undefined: no point in the sweep reaches it.
export function breakEven(rates: number[], gap: number[]): number | undefined {
  // gap = rule set's average earnings minus no-rules', at each rate
  const i = gap.findIndex((g) => g >= 0);
  if (i < 0) return undefined;
  if (i === 0) return rates[0];
  return rates[i - 1] + ((rates[i] - rates[i - 1]) * -gap[i - 1]) / (gap[i] - gap[i - 1]);
}

// Break-even from the seed-mean earnings, and for each seed on its own.
export function breakEvenOf(points: SweepPoint[]): { overall: number | undefined; perSeed: (number | undefined)[] } {
  const rates = points.map((p) => p.rate);
  const overall = breakEven(rates, points.map((p) => mean(p.avg) - mean(p.noRulesAvg)));
  const perSeed = points[0].avg.map((_, s) => breakEven(rates, points.map((p) => p.avg[s] - p.noRulesAvg[s])));
  return { overall, perSeed };
}

type PolicyReport = NonNullable<BreakEvenReport["levels"][number]["policies"][PolicyVersion]>;

export function policyReport(points: SweepPoint[]): PolicyReport {
  const { overall, perSeed } = breakEvenOf(points);
  const reached = perSeed.filter((b): b is number => b !== undefined);
  const rows = points.map((p) => ({
    restPayInrPerMin: p.rate,
    earningsPctOfNoRules: stat(p.pct),
    avgEarningsInr: stat(p.avg),
    lowestRiderInr: stat(p.min),
  }));
  if (overall !== undefined && reached.length > 0) {
    return {
      breakEven: {
        status: "reached",
        meanInrPerMin: overall,
        perSeedMinInrPerMin: Math.min(...reached),
        perSeedMaxInrPerMin: Math.max(...reached),
        seedsNotReached: perSeed.length - reached.length,
      },
      rows,
    };
  }
  const best = rows.reduce((a, b) => (b.earningsPctOfNoRules.mean > a.earningsPctOfNoRules.mean ? b : a));
  return {
    breakEven: { status: "notReached", bestEarningsPctOfNoRules: best.earningsPctOfNoRules.mean, atRestPayInrPerMin: best.restPayInrPerMin },
    rows,
  };
}

// The whole report: the rest pay sweep at each demand level. `params` is recorded as given.
export function breakEvenReport(
  params: SimParams,
  { levels = ORDERS_PER_HOUR_LEVELS, rates = REST_PAY_RATES, policies = BREAK_EVEN_POLICIES, now = new Date() } = {},
): BreakEvenReport {
  return {
    note: BREAK_EVEN_NOTE,
    generatedAt: now.toISOString(),
    params,
    restPayRatesInrPerMin: rates,
    levels: levels.map((ordersPerHour) => {
      const sweep = sweepRestPay({ ...params, ordersPerHour }, rates, policies);
      return {
        ordersPerHour,
        noRulesAvgEarningsInr: stat(sweep[policies[0]][0].noRulesAvg),
        policies: Object.fromEntries(policies.map((p) => [p, policyReport(sweep[p])])),
      };
    }),
  };
}
