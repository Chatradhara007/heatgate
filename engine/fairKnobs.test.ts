// The heatgate-fair knob template (engine/src/fairKnobs.ts) against the committed policies/heatgate-fair.cedar.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { DecideRequest, FairKnobs } from "@heatgate/contracts";
import {
  DEFAULT_FAIR_KNOBS,
  FAIR_KNOB_NAMES,
  FAIR_KNOB_RANGES,
  checkPolicyText,
  decideWithHeatIndex,
  fairKnobErrors,
  policySchema,
  renderFairPolicy,
  summarizeFairPolicy,
} from "./src/index.ts";

const COMMITTED = readFileSync(join(import.meta.dirname, "..", "policies", "heatgate-fair.cedar"), "utf8").replace(/\r\n/g, "\n"); // CRLF on a Windows checkout

interface Row {
  heat: number;
  hour: number;
  sinceBreak: number;
  trip: number;
  distKm: number;
  restLeft: number;
  demand: 0 | 1 | 2;
  alert: 0 | 1 | 2;
}

// The 11 golden rows (docs/spec/golden-tests.md).
const GOLDEN: Row[] = [
  { heat: 35, hour: 13, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 0 },
  { heat: 42, hour: 13, sinceBreak: 30, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 1 },
  { heat: 42, hour: 17, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 1 },
  { heat: 47, hour: 9, sinceBreak: 10, trip: 15, distKm: 2, restLeft: 0, demand: 1, alert: 2 },
  { heat: 39, hour: 14, sinceBreak: 0, trip: 15, distKm: 2, restLeft: 12, demand: 1, alert: 1 },
  { heat: 47, hour: 13, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 2 },
  { heat: 42, hour: 13, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 2, alert: 1 },
  { heat: 42, hour: 13, sinceBreak: 110, trip: 20, distKm: 2, restLeft: 0, demand: 2, alert: 1 },
  { heat: 42, hour: 17, sinceBreak: 30, trip: 35, distKm: 5, restLeft: 0, demand: 1, alert: 1 },
  { heat: 39, hour: 16, sinceBreak: 75, trip: 10, distKm: 1, restLeft: 0, demand: 0, alert: 0 },
  { heat: 44, hour: 13, sinceBreak: 130, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 0 },
];

function request(row: Row): DecideRequest {
  return {
    policyVersion: "heatgate-fair",
    rider: { id: "r-test", vehicle: "bike", x: 0, y: 0 },
    order: { id: "o-test", zone: "z1", distanceKm: row.distKm, tripMinutes: row.trip },
    conditions: { tempC: 0, humidityPct: 0, hourOfDay: row.hour, demandLevel: row.demand, alertLevel: row.alert },
    riderState: { minutesSinceBreak: row.sinceBreak, exposureMinutesToday: 0, restMinutesRemaining: row.restLeft },
  };
}

const NOW = new Date("2026-05-20T12:00:00Z");
// Everything in a Decision except the id, which is new each call.
const run = (row: Row, knobs?: FairKnobs) => {
  const { decisionId: _id, ...rest } = decideWithHeatIndex(request(row), "heatgate-fair", row.heat, NOW, knobs);
  return rest;
};

function sweep(): Row[] {
  const rows: Row[] = [];
  for (let heat = 30; heat <= 52; heat++)
    for (const distKm of [1, 2.9, 3, 3.2, 7])
      for (const sinceBreak of [0, 69, 70, 81, 100, 101, 121, 140])
        for (const trip of [0, 21])
          for (const demand of [0, 1, 2] as const)
            rows.push({ heat, hour: 13, sinceBreak, trip, distKm, restLeft: sinceBreak === 0 ? 7 : 0, demand, alert: 0 });
  return rows;
}

describe("default knobs", () => {
  test("render to exactly the committed policies/heatgate-fair.cedar", () => {
    expect(renderFairPolicy(DEFAULT_FAIR_KNOBS)).toBe(COMMITTED);
  });

  test("give the same decisions as the committed file on the 11 golden rows", () => {
    for (const row of GOLDEN) expect(run(row, DEFAULT_FAIR_KNOBS)).toEqual(run(row));
  });

  test("give the same decisions as the committed file over a sweep of heat index, distance, time and demand", () => {
    const rows = sweep();
    let notAllowed = 0;
    for (const row of rows) {
      const a = run(row);
      expect(run(row, DEFAULT_FAIR_KNOBS)).toEqual(a);
      if (a.outcome !== "ALLOW") notAllowed++;
    }
    // The sweep reaches every outcome, not just ALLOW.
    expect(notAllowed).toBeGreaterThan(rows.length / 4);
  }, 30_000); // the sweep takes 4-5.5 s, around vitest's 5 s default on slower machines
});

describe("knob values", () => {
  test("change only numbers: every range end renders a text that passes the schema and contract checks", () => {
    const lo = Object.fromEntries(FAIR_KNOB_NAMES.map((n) => [n, FAIR_KNOB_RANGES[n].min])) as unknown as FairKnobs;
    const hi = Object.fromEntries(FAIR_KNOB_NAMES.map((n) => [n, FAIR_KNOB_RANGES[n].max])) as unknown as FairKnobs;
    const lowest = { ...lo, workLimitMin: 90, rushHardLimitMin: 90 }; // keep earlyRest < workLimit <= rushHardLimit
    for (const k of [lowest, hi, { ...lo, earlyRestMin: 40, workLimitMin: 60, rushHardLimitMin: 90 }]) {
      expect(fairKnobErrors(k)).toEqual([]);
      const text = renderFairPolicy(k);
      expect(checkPolicyText(text, policySchema)).toEqual([]);
      // Same structure: strip the numbers and it is the committed file with its numbers stripped.
      expect(text.replace(/\d+/g, "N")).toBe(COMMITTED.replace(/\d+/g, "N"));
    }
  });

  test("a lower work limit forces the rest earlier (golden row 3 with sinceBreak 75)", () => {
    const row: Row = { ...GOLDEN[2], sinceBreak: 75 };
    expect(run(row).outcome).toBe("ALLOW"); // 75 + 20 = 95 <= 100
    const d = run(row, { ...DEFAULT_FAIR_KNOBS, workLimitMin: 90, earlyRestMin: 70 });
    expect(d.outcome).toBe("FORCE_REST");
    expect(d.firedRules[0]).toBe("fair-rest-due");
  });

  test("each knob moves its own threshold", () => {
    const k = (over: Partial<FairKnobs>) => ({ ...DEFAULT_FAIR_KNOBS, ...over });
    // restHeatC: golden row 3 at heat index 37 rests only when restHeatC <= 37
    expect(run({ ...GOLDEN[2], heat: 37 }).outcome).toBe("ALLOW");
    expect(run({ ...GOLDEN[2], heat: 37 }, k({ restHeatC: 36 })).outcome).toBe("FORCE_REST");
    // rushHardLimitMin: golden row 8 (rush, 110 + 20) is allowed with a 130 hard limit
    expect(run(GOLDEN[7], k({ rushHardLimitMin: 130 })).outcome).toBe("ALLOW");
    // earlyRestMin: golden row 10 (quiet, 75 min) is allowed with an 80-minute early rest
    expect(run(GOLDEN[9], k({ earlyRestMin: 80 })).outcome).toBe("ALLOW");
    // shortTrip: golden row 9 (5 km at 42) passes with a 5 km radius or a 43 °C trigger
    expect(run(GOLDEN[8], k({ shortTripMaxKm: 5 })).outcome).toBe("ALLOW");
    expect(run(GOLDEN[8], k({ shortTripHeatC: 43 })).outcome).toBe("ALLOW");
    // extremeHeatC: golden row 4 (47) is allowed with a 48 °C stop
    expect(run(GOLDEN[3], k({ extremeHeatC: 48 })).outcome).toBe("ALLOW");
    // the decline waiver is not a knob: stays at 38
    expect(run({ ...GOLDEN[0], heat: 38 }, k({ restHeatC: 44 })).penaltyWaived).toBe(true);
  });

  test("out-of-range, fractional and inconsistent values are refused before rendering", () => {
    const k = (over: Partial<FairKnobs>) => ({ ...DEFAULT_FAIR_KNOBS, ...over });
    expect(fairKnobErrors(k({ restHeatC: 31 }))).toEqual(["fairKnobs.restHeatC must be between 32 and 46"]);
    expect(fairKnobErrors(k({ shortTripMaxKm: 2.5 }))).toEqual(["fairKnobs.shortTripMaxKm must be a whole number"]);
    expect(fairKnobErrors(k({ workLimitMin: 110, rushHardLimitMin: 100 }))).toEqual([
      "fairKnobs.rushHardLimitMin must be at least fairKnobs.workLimitMin",
    ]);
    expect(fairKnobErrors(k({ earlyRestMin: 100 }))).toEqual(["fairKnobs.earlyRestMin must be less than fairKnobs.workLimitMin"]);
    expect(() => renderFairPolicy(k({ extremeHeatC: 99 }))).toThrow(/extremeHeatC/);
    expect(() => renderFairPolicy(k({ restHeatC: "38 }; permit (principal, action, resource" as never }))).toThrow(/whole number/);
  });

  test("summaries name each rule in file order with the knob values", () => {
    const s = summarizeFairPolicy({ ...DEFAULT_FAIR_KNOBS, workLimitMin: 90 });
    expect(s.map((r) => r.id)).toEqual([...COMMITTED.matchAll(/@id\("([^"]+)"\)/g)].map((m) => m[1]));
    expect(s.find((r) => r.id === "fair-rest-due")!.summary).toContain("90 minutes");
  });
});
