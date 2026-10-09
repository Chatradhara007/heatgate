// Earnings, target, bonus and pay protections: small hand-computed cases, then one real day.
// Economics are the placeholder defaults: ₹25 per order + ₹6 per km, target share 0.9, bonus ₹150,
// rest pay ₹1.5 per minute.
import { DEFAULT_PAY } from "@heatgate/contracts";
import { describe, expect, test } from "vitest";
import {
  adjustedTarget,
  dailyTarget,
  defaultSimParams,
  earningsSummary,
  median,
  orderPayInr,
  pctOfBaseline,
  riderEarnings,
  runDay,
  type RiderTally,
} from "../src/index.ts";

const econ = defaultSimParams().economics;
const tally = (t: Partial<RiderTally>): RiderTally => ({
  id: "rider-001",
  ordersDelivered: 0,
  orderPayInr: 0,
  restMinutes: 0,
  restOrPauseMinutes: 0,
  shiftMinutes: 480,
  ...t,
});

describe("hand-computed", () => {
  test("pay per order: ₹25 + ₹6 x km", () => {
    expect(orderPayInr(2.5, econ)).toBe(40); // 25 + 15
    expect(orderPayInr(0, econ)).toBe(25);
    expect(orderPayInr(4.2, econ)).toBeCloseTo(50.2); // 25 + 25.2
  });

  test("daily target: 0.9 x median orders per rider in the no-rules run", () => {
    expect(median([4, 10, 12, 6, 8])).toBe(8);
    expect(dailyTarget([4, 10, 12, 6, 8], econ)).toBeCloseTo(7.2);
    expect(dailyTarget([2, 8, 4, 6], econ)).toBeCloseTo(4.5); // even count: median (4 + 6) / 2 = 5
  });

  test("bonus: ₹150 when the target is reached, nothing below it", () => {
    const pay = DEFAULT_PAY["no-rules"];
    expect(riderEarnings(tally({ ordersDelivered: 8, orderPayInr: 320 }), 7.2, econ, pay)).toMatchObject({ hitTarget: true, bonusInr: 150, totalInr: 470 });
    expect(riderEarnings(tally({ ordersDelivered: 7, orderPayInr: 280 }), 7.2, econ, pay)).toMatchObject({ hitTarget: false, bonusInr: 0, totalInr: 280 });
  });

  test("incentive protection: every full 30 minutes of rest or pause lowers the target by 1 order", () => {
    const on = DEFAULT_PAY["union-demand"];
    const off = DEFAULT_PAY["ndma-2025"];
    expect(adjustedTarget(7.2, 29, on)).toBeCloseTo(7.2);
    expect(adjustedTarget(7.2, 30, on)).toBeCloseTo(6.2);
    expect(adjustedTarget(7.2, 95, on)).toBeCloseTo(4.2); // 3 full half-hours
    expect(adjustedTarget(2, 300, on)).toBe(0); // never below 0
    expect(adjustedTarget(7.2, 95, off)).toBeCloseTo(7.2);
    // 7 orders, 35 min resting: reaches the lowered target 6.2 only with protection.
    const t = tally({ ordersDelivered: 7, orderPayInr: 280, restMinutes: 35, restOrPauseMinutes: 35 });
    expect(riderEarnings(t, 7.2, econ, on).hitTarget).toBe(true);
    expect(riderEarnings(t, 7.2, econ, off).hitTarget).toBe(false);
  });

  test("paid rest: rest minutes x ₹1.5 where paidRest is on; pause minutes are not rest", () => {
    const t = tally({ ordersDelivered: 0, restMinutes: 20, restOrPauseMinutes: 35 }); // 20 resting + 15 paused
    expect(riderEarnings(t, 7.2, econ, DEFAULT_PAY["ndma-2025"]).restPayInr).toBe(30);
    expect(riderEarnings(t, 7.2, econ, DEFAULT_PAY["no-rules"]).restPayInr).toBe(0);
  });

  test("summary: average, lowest rider, hit rate, rest pay, % of baseline", () => {
    const pay = DEFAULT_PAY["union-demand"];
    const a = tally({ id: "rider-001", ordersDelivered: 8, orderPayInr: 320, restMinutes: 20, restOrPauseMinutes: 35 });
    const b = tally({ id: "rider-002", ordersDelivered: 3, orderPayInr: 100, restMinutes: 40, restOrPauseMinutes: 70 });
    // a: target 7.2 - 1 = 6.2, hit: 320 + 150 + 30 = 500. b: target 7.2 - 2 = 5.2, missed: 100 + 0 + 60 = 160.
    expect(earningsSummary([a, b], 7.2, econ, pay)).toEqual({
      avgEarningsPerRiderInr: 330,
      minEarningsPerRiderInr: 160,
      incentiveHitRatePct: 50,
      restPayTotalInr: 90,
    });
    expect(pctOfBaseline(330, 300)).toBeCloseTo(110);
  });

  test("lowest rider leaves out riders with less than 2 hours on shift; the average keeps them", () => {
    const pay = DEFAULT_PAY["no-rules"];
    const full = tally({ id: "rider-001", ordersDelivered: 8, orderPayInr: 320, shiftMinutes: 480 });
    const twoHours = tally({ id: "rider-002", ordersDelivered: 2, orderPayInr: 80, shiftMinutes: 120 });
    const late = tally({ id: "rider-003", ordersDelivered: 0, orderPayInr: 0, shiftMinutes: 119 });
    // Target 7.2: only rider-001 hits it (320 + 150 = 470). rider-002: 80. rider-003: 0, but < 2 h.
    const s = earningsSummary([full, twoHours, late], 7.2, econ, pay);
    expect(s.minEarningsPerRiderInr).toBe(80);
    expect(s.avgEarningsPerRiderInr).toBeCloseTo((470 + 80 + 0) / 3);
    expect(earningsSummary([late], 7.2, econ, pay).minEarningsPerRiderInr).toBe(0); // nobody qualifies
  });
});

describe("one real day (11:00-16:00, 40 °C, alert 1)", () => {
  const params = defaultSimParams({ startHour: 11, endHour: 16, alertLevel: 1 });
  const noRules = runDay(params, "no-rules", 2, "t");
  const union = runDay(params, "union-demand", 2, "t");

  test("the target comes from the no-rules run on the same seed", () => {
    const orders = noRules.riders.map((r) => r.ordersDelivered);
    expect(noRules.targetOrders).toBeCloseTo(0.9 * median(orders));
    expect(union.targetOrders).toBe(noRules.targetOrders);
    expect(runDay(params, "union-demand", 2, "t", { noRulesOrdersPerRider: orders }).metrics).toEqual(union.metrics);
  }, 30_000);

  test("earningsPctOfNoRules: average earnings as a % of the no-rules run on the same seed", () => {
    expect(noRules.metrics.earningsPctOfNoRules).toBe(100);
    expect(union.metrics.earningsPctOfNoRules).toBeCloseTo((100 * union.metrics.avgEarningsPerRiderInr) / noRules.metrics.avgEarningsPerRiderInr);
    const passedIn = runDay(params, "union-demand", 2, "t", {
      noRulesOrdersPerRider: noRules.riders.map((r) => r.ordersDelivered),
      noRulesAvgEarningsInr: noRules.metrics.avgEarningsPerRiderInr,
    });
    expect(passedIn.metrics).toEqual(union.metrics);
  }, 30_000);

  test("money metrics add up from the riders' tallies", () => {
    for (const [policy, day] of [["no-rules", noRules], ["union-demand", union]] as const) {
      const m = day.metrics;
      expect(day.riders).toHaveLength(params.riders);
      expect(day.riders.reduce((s, r) => s + r.ordersDelivered, 0)).toBe(m.ordersDelivered);
      const each = day.riders.map((r) => riderEarnings(r, day.targetOrders, params.economics, params.pay[policy]));
      expect(m.avgEarningsPerRiderInr * params.riders).toBeCloseTo(each.reduce((s, e) => s + e.totalInr, 0));
      const counted = each.filter((_, i) => day.riders[i].shiftMinutes >= 120);
      expect(m.minEarningsPerRiderInr).toBe(Math.min(...counted.map((e) => e.totalInr)));
      expect(day.riders.some((r) => r.shiftMinutes < 120)).toBe(true); // second-wave riders log in late
      // A delivery under way at the end of the day finishes after it, so a rider can go a little past it.
      expect(day.riders.every((r) => r.shiftMinutes <= (params.endHour - params.startHour + 2) * 60)).toBe(true);
      expect(m.avgEarningsPerRiderInr).toBeGreaterThan(0);
      expect(m.heatFeeCollectedInr).toBe(0); // heat fee is heatgate-fair only
    }
    expect(noRules.metrics.restPayTotalInr).toBe(0);
    expect(union.metrics.restsForced).toBeGreaterThan(0);
    const restMinutes = union.riders.reduce((s, r) => s + r.restMinutes, 0);
    expect(restMinutes).toBeGreaterThan(0);
    expect(restMinutes).toBeLessThanOrEqual(union.metrics.restsForced * 20);
    expect(union.metrics.restPayTotalInr).toBeCloseTo(restMinutes * 1.5);
  }, 30_000);
});
