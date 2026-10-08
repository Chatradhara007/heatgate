import { describe, expect, test } from "vitest";
import { defaultSimParams, dropDistanceKm, makeRiders, runDay, stream } from "../src/index.ts";

describe("multi-app riders", () => {
  test("multiAppPct = 0 gives no multi-app riders, 100 gives all", () => {
    expect(makeRiders(defaultSimParams({ multiAppPct: 0 }), 1).some((r) => r.multiApp)).toBe(false);
    expect(makeRiders(defaultSimParams({ multiAppPct: 100 }), 1).every((r) => r.multiApp)).toBe(true);
  });

  test("multiAppPct = 0 runs, and only changes multi-app behaviour (same riders otherwise)", () => {
    const zero = makeRiders(defaultSimParams({ multiAppPct: 0 }), 2);
    const forty = makeRiders(defaultSimParams({ multiAppPct: 40 }), 2);
    expect(zero.map(({ multiApp, ...r }) => r)).toEqual(forty.map(({ multiApp, ...r }) => r));
    const d = runDay(defaultSimParams({ multiAppPct: 0, startHour: 11, endHour: 16, alertLevel: 1 }), "union-demand", 2, "t");
    expect(d.metrics.ordersDelivered).toBeGreaterThan(0);
    expect(d.metrics.restsForced).toBeGreaterThan(0);
  }, 30_000);
});

test("drop distances: short-skewed, median about 2.5 km, never over 5 km", () => {
  const rng = stream(7, "drops");
  const d = Array.from({ length: 5000 }, () => dropDistanceKm(rng)).sort((a, b) => a - b);
  expect(d[2500]).toBeGreaterThan(2.3);
  expect(d[2500]).toBeLessThan(2.7);
  expect(d[d.length - 1]).toBeLessThanOrEqual(5);
  const mean = d.reduce((a, b) => a + b, 0) / d.length;
  expect(d[Math.floor(d.length * 0.25)]).toBeLessThan(mean); // more short trips than long ones
});

test("orders unassigned for 30 minutes expire and count as late and undelivered", () => {
  const d = runDay(defaultSimParams({ ordersPerHour: 200, startHour: 12, endHour: 14 }), "no-rules", 1, "t");
  expect(d.expiredOrders).toBeGreaterThan(0);
  expect(d.metrics.ordersLate).toBeGreaterThanOrEqual(d.expiredOrders);
  expect(d.metrics.ordersDelivered).toBeLessThanOrEqual(d.metrics.ordersTotal - d.expiredOrders);
}, 30_000);
