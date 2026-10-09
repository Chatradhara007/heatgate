// The break-even sweep behind npm run sim:breakeven: hand-computed interpolation, then one tiny real sweep.
import { expect, test } from "vitest";
import { BREAK_EVEN_NOTE, breakEven, breakEvenReport, defaultSimParams, policyReport, type SweepPoint } from "../src/index.ts";

test("break-even: interpolated between sweep points, the first rate if already there, undefined if never", () => {
  const rates = [0, 0.5, 1, 1.5];
  expect(breakEven(rates, [-30, -10, 10, 30])).toBeCloseTo(0.75); // halfway from 0.5 to 1
  expect(breakEven(rates, [-20, 0, 20, 40])).toBe(0.5); // exactly level counts
  expect(breakEven(rates, [5, 10, 15, 20])).toBe(0);
  expect(breakEven(rates, [-40, -30, -20, -10])).toBeUndefined();
});

// Two seeds, no-rules earns 100 on both; seed 1 catches up at 1.0, seed 2 never does.
const points: SweepPoint[] = [
  { rate: 0, noRulesAvg: [100, 100], avg: [80, 60], pct: [80, 60], min: [10, 5] },
  { rate: 1, noRulesAvg: [100, 100], avg: [100, 80], pct: [100, 80], min: [20, 15] },
  { rate: 2, noRulesAvg: [100, 100], avg: [120, 96], pct: [120, 96], min: [30, 25] },
];

test("policy report: reached, with per-seed range over the seeds that reach it and a count of the rest", () => {
  const r = policyReport(points);
  // seed mean gap: -30, -10, +8 -> 1 + 10/18
  expect(r.breakEven).toEqual({ status: "reached", meanInrPerMin: expect.closeTo(1 + 10 / 18), perSeedMinInrPerMin: 1, perSeedMaxInrPerMin: 1, seedsNotReached: 1 });
  expect(r.rows).toHaveLength(3);
  expect(r.rows[1]).toEqual({
    restPayInrPerMin: 1,
    earningsPctOfNoRules: { mean: 90, min: 80, max: 100 },
    avgEarningsInr: { mean: 90, min: 80, max: 100 },
    lowestRiderInr: { mean: 17.5, min: 15, max: 20 },
  });
});

test("policy report: not reached gives the best earnings % and where", () => {
  const short = points.map((p) => ({ ...p, avg: p.avg.map((a) => a - 30), pct: p.pct.map((a) => a - 30) }));
  expect(policyReport(short).breakEven).toEqual({ status: "notReached", bestEarningsPctOfNoRules: 78, atRestPayInrPerMin: 2 });
});

test("a tiny real sweep: labelled, params recorded as given, one row per rate", () => {
  const params = defaultSimParams({ seeds: [1], startHour: 11, endHour: 16, alertLevel: 1 });
  const now = new Date("2026-10-09T00:00:00Z");
  const report = breakEvenReport(params, { levels: [25, 50], rates: [0, 1.5], now });
  expect(report.note).toBe(BREAK_EVEN_NOTE);
  expect(report.note).toMatch(/placeholders/);
  expect(report.generatedAt).toBe("2026-10-09T00:00:00.000Z");
  expect(report.params).toEqual(params); // the sweep's overrides are not written back
  expect(report.restPayRatesInrPerMin).toEqual([0, 1.5]);
  expect(report.levels.map((l) => l.ordersPerHour)).toEqual([25, 50]);
  for (const level of report.levels) {
    expect(Object.keys(level.policies)).toEqual(["union-demand", "heatgate-fair"]);
    for (const r of Object.values(level.policies)) {
      expect(r!.rows.map((row) => row.restPayInrPerMin)).toEqual([0, 1.5]);
      expect(["reached", "notReached"]).toContain(r!.breakEven.status);
    }
  }
  expect(report.stale).toBeUndefined(); // only the API sets it
}, 60_000);
