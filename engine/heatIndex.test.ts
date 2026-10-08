import { describe, expect, test } from "vitest";
import type { DecideRequest } from "@heatgate/contracts";
import { decide, heatIndexC, newDecisionId } from "./src/index.ts";

const fToC = (f: number) => (f - 32) / 1.8;

describe("heatIndexC", () => {
  test("returns the air temperature below 27 °C", () => {
    expect(heatIndexC(20, 90)).toBe(20);
    expect(heatIndexC(26.9, 10)).toBe(26.9);
  });

  // Values from the NWS heat index chart (°F), within 1 °F.
  test.each([
    { t: 90, rh: 50, hi: 95 },
    { t: 100, rh: 40, hi: 109 },
    { t: 86, rh: 90, hi: 105 },
  ])("$t °F at $rh% RH is about $hi °F", ({ t, rh, hi }) => {
    expect(Math.abs(heatIndexC(fToC(t), rh) - fToC(hi))).toBeLessThan(1 / 1.8);
  });
});

describe("decide", () => {
  const req: DecideRequest = {
    policyVersion: "no-rules",
    rider: { id: "r1", vehicle: "bike", x: 1, y: 1 },
    order: { id: "o1", zone: "z1", distanceKm: 2.4, tripMinutes: 20 },
    conditions: { tempC: 38, humidityPct: 45, hourOfDay: 17, demandLevel: 1, alertLevel: 1 },
    riderState: { minutesSinceBreak: 30, exposureMinutesToday: 60, restMinutesRemaining: 0 },
  };

  test("rounds the heat index, uses the policy argument and the given time", () => {
    const now = new Date("2026-05-20T11:30:00Z");
    const d = decide(req, "heatgate-fair", now);
    expect(d.policyVersion).toBe("heatgate-fair");
    expect(d.heatIndexC).toBe(Math.round(heatIndexC(38, 45)));
    expect(Number.isInteger(d.heatIndexC)).toBe(true);
    expect(d.cedarContext.heatIndexC).toBe(d.heatIndexC);
    expect(d.cedarContext.distanceKm).toBe(3);
    expect(d.at).toBe(now.toISOString());
    expect(d.riderId).toBe("r1");
  });

  test("decision ids are 26-char, unique and sort by time", () => {
    const a = newDecisionId(new Date(1000));
    const b = newDecisionId(new Date(1000));
    const c = newDecisionId(new Date(2000));
    expect(a).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
    expect(a).not.toBe(b);
    expect(a < c && b < c).toBe(true);
  });
});
