// The simulator's logged decisions carry what the rider was told: the message in every language and,
// for a cooling break, the nearest of the city's cooling points.
import { expect, test } from "vitest";
import type { DecideRequest } from "@heatgate/contracts";
import { decide } from "@heatgate/engine";
import { COOLING_POINT_COUNT, cityLayout, defaultSimParams, distance, simulateWithAudit } from "../src/index.ts";

const points = cityLayout().coolingPoints;

// A hot afternoon where every rule set forces a rest (ndma-break-due, union-rest-due, fair-rest-due).
const restRequest = (x: number, y: number): DecideRequest => ({
  policyVersion: "heatgate-fair",
  rider: { id: "rider-001", vehicle: "bike", x, y },
  order: { id: "order-1", zone: "city", distanceKm: 2, tripMinutes: 20 },
  conditions: { tempC: 42, humidityPct: 30, hourOfDay: 17, demandLevel: 1, alertLevel: 1 },
  riderState: { minutesSinceBreak: 130, exposureMinutesToday: 200, restMinutesRemaining: 0 },
});

test("coolingPoint is the true nearest of the 8 cooling points, anywhere in the city", () => {
  expect(points).toHaveLength(COOLING_POINT_COUNT);
  expect(COOLING_POINT_COUNT).toBe(8);
  expect(new Set(points.map((p) => p.name)).size).toBe(8);
  let checked = 0;
  for (let x = 0; x <= 10; x += 0.25) {
    for (let y = 0; y <= 10; y += 0.25) {
      for (const policy of ["ndma-2025", "union-demand", "heatgate-fair"] as const) {
        const d = decide({ ...restRequest(x, y), policyVersion: policy }, policy, new Date(0), undefined, points);
        expect(d.outcome).toBe("FORCE_REST");
        const km = points.map((p) => distance({ x, y }, p));
        const best = Math.min(...km);
        const named = points.find((p) => p.name === d.coolingPoint?.name)!;
        expect(distance({ x, y }, named)).toBeCloseTo(best, 9); // no other point is nearer
        expect(Math.abs(d.coolingPoint!.distanceM - best * 1000)).toBeLessThanOrEqual(5);
        checked++;
      }
    }
  }
  expect(checked).toBe(41 * 41 * 3);
});

test("the simulator's audit trail carries messages in every language and the cooling point for rests", () => {
  const params = defaultSimParams({ seeds: [1], riders: 20, startHour: 11, endHour: 17, alertLevel: 1 });
  const { audit } = simulateWithAudit(params, "sim-messages");
  const all = Object.values(audit).flat();
  expect(new Set(all.map((d) => d.outcome))).toEqual(new Set(["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"]));
  const names = new Set(points.map((p) => p.name));
  for (const d of all) {
    for (const lang of ["hi", "te", "ur"] as const) expect(d.messages?.[lang]).toMatch(/\S/);
    if (d.outcome === "FORCE_REST") expect(names.has(d.coolingPoint!.name)).toBe(true);
    else expect(d.coolingPoint).toBeUndefined();
  }
}, 60_000);
