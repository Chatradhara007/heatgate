// heatgate-fair's heat fee and shade waiting, plus determinism of the money metrics.
import { expect, test } from "vitest";
import { applyHeatFee, defaultSimParams, runDay, simulateWithAudit, waitInShade } from "../src/index.ts";

// 10 orders, one per minute: heat index 37 for minutes 0-4, 38 for minutes 5-9.
const orders = Array.from({ length: 10 }, (_, i) => ({ id: `o${i}`, createdMin: i }));
const hiAt = (minute: number) => (minute < 5 ? 37 : 38);

test("heat fee: ₹5 per order placed at heat index >= 38 (no demand drop)", () => {
  const params = defaultSimParams({ feeDemandDropPctPerInr: 0 });
  const r = applyHeatFee(orders, hiAt, params, "heatgate-fair", 1);
  expect(r).toEqual({ orders, cancelled: 0, heatFeeCollectedInr: 25 }); // 5 hot orders x ₹5
});

test("heat fee: heatgate-fair only, and only behind its flag", () => {
  const params = defaultSimParams();
  expect(applyHeatFee(orders, hiAt, params, "union-demand", 1)).toEqual({ orders, cancelled: 0, heatFeeCollectedInr: 0 });
  const off = defaultSimParams({ fairFeatures: { heatFee: false, shadeWaitCountsAsRest: false } });
  expect(applyHeatFee(orders, hiAt, off, "heatgate-fair", 1)).toEqual({ orders, cancelled: 0, heatFeeCollectedInr: 0 });
});

test("demand drop: ₹5 x 20 %/₹ cancels every hot order and none of the cool ones", () => {
  const params = defaultSimParams({ feeDemandDropPctPerInr: 20 });
  const r = applyHeatFee(orders, hiAt, params, "heatgate-fair", 1);
  expect(r.orders.map((o) => o.createdMin)).toEqual([0, 1, 2, 3, 4]);
  expect(r.cancelled).toBe(5);
  expect(r.heatFeeCollectedInr).toBe(0);
});

test("demand drop: ₹5 x 1 %/₹ cancels about 5% of hot orders, seeded", () => {
  const hot = Array.from({ length: 10_000 }, (_, i) => ({ id: `o${i}`, createdMin: i }));
  const params = defaultSimParams(); // fee ₹5, 1 %/₹
  const r = applyHeatFee(hot, () => 40, params, "heatgate-fair", 3);
  expect(r.cancelled).toBeGreaterThan(400); // expected 500, sd about 22
  expect(r.cancelled).toBeLessThan(600);
  expect(r.heatFeeCollectedInr).toBe((10_000 - r.cancelled) * 5);
  expect(applyHeatFee(hot, () => 40, params, "heatgate-fair", 3)).toEqual(r); // same seed, same cancellations
  expect(applyHeatFee(hot, () => 40, params, "heatgate-fair", 4).orders).not.toEqual(r.orders);
});

test("shade waiting is OFF by default", () => {
  expect(defaultSimParams().fairFeatures.shadeWaitCountsAsRest).toBe(false);
});

test("shade waiting: 20 continuous minutes count as a break, no exposure added", () => {
  const r = { shadeMinutes: 0, minutesSinceBreak: 50, exposureMinutesToday: 200 };
  for (let i = 0; i < 19; i++) waitInShade(r);
  expect(r).toEqual({ shadeMinutes: 19, minutesSinceBreak: 50, exposureMinutesToday: 200 });
  waitInShade(r);
  expect(r).toEqual({ shadeMinutes: 20, minutesSinceBreak: 0, exposureMinutesToday: 200 });
});

test("in a real day: fee collected and orders dropped only for heatgate-fair; shade flag changes only Fair", () => {
  const params = defaultSimParams({ startHour: 11, endHour: 16, alertLevel: 1 });
  const noRules = runDay(params, "no-rules", 1, "t");
  const fair = runDay(params, "heatgate-fair", 1, "t");
  expect(fair.metrics.heatFeeCollectedInr).toBeGreaterThan(0);
  expect(fair.cancelledOrders).toBeGreaterThan(0);
  expect(fair.metrics.ordersTotal).toBe(noRules.metrics.ordersTotal - fair.cancelledOrders);
  expect(fair.metrics.heatFeeCollectedInr % params.economics.heatFeePerOrderInr).toBe(0);

  const shadeOn = defaultSimParams({ startHour: 11, endHour: 16, alertLevel: 1, fairFeatures: { heatFee: true, shadeWaitCountsAsRest: true } });
  expect(runDay(shadeOn, "heatgate-fair", 1, "t").metrics).not.toEqual(fair.metrics);
  expect(runDay(shadeOn, "union-demand", 1, "t").metrics).toEqual(runDay(params, "union-demand", 1, "t").metrics);
}, 60_000);

test("money metrics are deterministic for the same seed", () => {
  const params = defaultSimParams({ seeds: [1, 2], startHour: 11, endHour: 16, alertLevel: 1, policyVersions: ["no-rules", "heatgate-fair"] });
  const first = simulateWithAudit(params);
  const second = simulateWithAudit(params);
  expect(second.result).toEqual(first.result);
  expect(second.earningsPctOfNoRules).toEqual(first.earningsPctOfNoRules);
  expect(first.result.runs["heatgate-fair"]!.metrics.heatFeeCollectedInr).toBeGreaterThan(0);
  expect(first.earningsPctOfNoRules["no-rules"]).toEqual({ mean: 100, min: 100, max: 100 });
  // Mean and min-max range over the seeds, like every other numeric metric, and the same as SimReport.
  const fair = first.result.runs["heatgate-fair"]!;
  const perSeed = params.seeds.map((seed) => runDay(params, "heatgate-fair", seed, "t").metrics.earningsPctOfNoRules);
  expect(fair.metrics.earningsPctOfNoRules).toBeCloseTo((perSeed[0] + perSeed[1]) / 2);
  expect(fair.range.earningsPctOfNoRules).toEqual({ min: Math.min(...perSeed), max: Math.max(...perSeed) });
  expect(first.earningsPctOfNoRules["heatgate-fair"]).toEqual({ mean: fair.metrics.earningsPctOfNoRules, ...fair.range.earningsPctOfNoRules });
}, 60_000);
