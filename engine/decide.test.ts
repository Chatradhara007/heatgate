// Golden tests from docs/spec/golden-tests.md. They feed the Cedar context directly.
import { describe, expect, test } from "vitest";
import type { DecideRequest, Decision, Outcome, PolicyVersion } from "@heatgate/contracts";
import { decideWithHeatIndex } from "./src/index.ts";

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

type Expected = { outcome: Outcome; rest?: number; rule?: string };

const ALLOW: Expected = { outcome: "ALLOW" };

function request(row: Row): DecideRequest {
  return {
    policyVersion: "no-rules",
    rider: { id: "r-test", vehicle: "bike", x: 0, y: 0 },
    order: { id: "o-test", zone: "z1", distanceKm: row.distKm, tripMinutes: row.trip },
    conditions: { tempC: 0, humidityPct: 0, hourOfDay: row.hour, demandLevel: row.demand, alertLevel: row.alert },
    riderState: { minutesSinceBreak: row.sinceBreak, exposureMinutesToday: 0, restMinutesRemaining: row.restLeft },
  };
}

const run = (row: Row, policy: PolicyVersion) => decideWithHeatIndex(request(row), policy, row.heat);

// [#, row, ndma-2025, union-demand, heatgate-fair]
const CASES: [number, Row, Expected, Expected, Expected][] = [
  [1, { heat: 35, hour: 13, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 0 },
    ALLOW, ALLOW, ALLOW],
  [2, { heat: 42, hour: 13, sinceBreak: 30, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 1 },
    { outcome: "DENY", rule: "ndma-peak-hours-pause" }, ALLOW, ALLOW],
  [3, { heat: 42, hour: 17, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 1 },
    { outcome: "FORCE_REST", rest: 15, rule: "ndma-break-due" }, ALLOW,
    { outcome: "FORCE_REST", rest: 20, rule: "fair-rest-due" }],
  [4, { heat: 47, hour: 9, sinceBreak: 10, trip: 15, distKm: 2, restLeft: 0, demand: 1, alert: 2 },
    ALLOW, ALLOW, { outcome: "DENY", rule: "fair-extreme-heat-stop" }],
  [5, { heat: 39, hour: 14, sinceBreak: 0, trip: 15, distKm: 2, restLeft: 12, demand: 1, alert: 1 },
    { outcome: "FORCE_REST", rest: 12, rule: "ndma-rest-in-progress" },
    { outcome: "FORCE_REST", rest: 12, rule: "union-rest-in-progress" },
    { outcome: "FORCE_REST", rest: 12, rule: "fair-rest-in-progress" }],
  [6, { heat: 47, hour: 13, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 2 },
    { outcome: "FORCE_REST", rest: 15, rule: "ndma-break-due" }, ALLOW,
    { outcome: "FORCE_REST", rest: 20, rule: "fair-rest-due" }],
  [7, { heat: 42, hour: 13, sinceBreak: 90, trip: 20, distKm: 2, restLeft: 0, demand: 2, alert: 1 },
    { outcome: "FORCE_REST", rest: 15, rule: "ndma-break-due" }, ALLOW, ALLOW],
  [8, { heat: 42, hour: 13, sinceBreak: 110, trip: 20, distKm: 2, restLeft: 0, demand: 2, alert: 1 },
    { outcome: "FORCE_REST", rest: 15, rule: "ndma-break-due" },
    { outcome: "FORCE_REST", rest: 20, rule: "union-rest-due" },
    { outcome: "FORCE_REST", rest: 20, rule: "fair-rest-hard-limit" }],
  [9, { heat: 42, hour: 17, sinceBreak: 30, trip: 35, distKm: 5, restLeft: 0, demand: 1, alert: 1 },
    { outcome: "SKIP_ORDER", rule: "ndma-reduced-radius" }, ALLOW,
    { outcome: "SKIP_ORDER", rule: "fair-short-trips-only" }],
  [10, { heat: 39, hour: 16, sinceBreak: 75, trip: 10, distKm: 1, restLeft: 0, demand: 0, alert: 0 },
    ALLOW, ALLOW, { outcome: "FORCE_REST", rest: 20, rule: "fair-rest-early-in-lull" }],
  [11, { heat: 44, hour: 13, sinceBreak: 130, trip: 20, distKm: 2, restLeft: 0, demand: 1, alert: 0 },
    ALLOW, ALLOW, { outcome: "FORCE_REST", rest: 20, rule: "fair-rest-due" }],
];

describe("golden tests", () => {
  for (const [n, row, ndma, union, fair] of CASES) {
    const expectations: [PolicyVersion, Expected][] = [
      ["no-rules", ALLOW],
      ["ndma-2025", ndma],
      ["union-demand", union],
      ["heatgate-fair", fair],
    ];
    for (const [policy, want] of expectations) {
      test(`case ${n} ${policy}: ${want.outcome}${want.rule ? ` (${want.rule})` : ""}`, () => {
        const d = run(row, policy);
        expect(d.outcome).toBe(want.outcome);
        expect(d.restMinutes).toBe(want.rest ?? 0);
        if (want.rule) expect(d.firedRules[0]).toBe(want.rule);
        else expect(d.firedRules).toEqual([]);
      });
    }
  }

  test("case 6: rest beats deny (the deny rule fired too)", () => {
    const row = CASES[5][1];
    expect(run(row, "ndma-2025").firedRules).toContain("ndma-peak-hours-pause");
    expect(run(row, "heatgate-fair").firedRules).toContain("fair-extreme-heat-stop");
  });

  test("case 11: fair-rest-due wins the tie, fair-rest-hard-limit also fired", () => {
    expect(run(CASES[10][1], "heatgate-fair").firedRules).toEqual(["fair-rest-due", "fair-rest-hard-limit"]);
  });
});

describe("penaltyWaived", () => {
  const case1 = CASES[0][1];
  const case2 = CASES[1][1];

  test("case 1: false for all four rule sets", () => {
    for (const policy of ["no-rules", "ndma-2025", "union-demand", "heatgate-fair"] as const) {
      expect(run(case1, policy).penaltyWaived).toBe(false);
    }
  });

  test("case 2: ALLOW under union-demand and heatgate-fair gives true", () => {
    for (const policy of ["union-demand", "heatgate-fair"] as const) {
      const d = run(case2, policy);
      expect(d.outcome).toBe("ALLOW");
      expect(d.penaltyWaived).toBe(true);
    }
  });

  test("no-rules is always false", () => {
    for (const [, row] of CASES) expect(run(row, "no-rules").penaltyWaived).toBe(false);
  });

  test("NDMA and the union waive only on alert days; Fair whenever heat index >= 38", () => {
    const hotNoAlert = { ...case2, alert: 0 as const };
    expect(run(hotNoAlert, "ndma-2025").penaltyWaived).toBe(false);
    expect(run(hotNoAlert, "union-demand").penaltyWaived).toBe(false);
    expect(run(hotNoAlert, "heatgate-fair").penaltyWaived).toBe(true);
    const coolAlert = { ...case2, heat: 35, hour: 17 };
    expect(run(coolAlert, "ndma-2025").penaltyWaived).toBe(true);
    expect(run(coolAlert, "union-demand").penaltyWaived).toBe(true);
    expect(run(coolAlert, "heatgate-fair").penaltyWaived).toBe(false);
  });

  test("always true for SKIP_ORDER, DENY and FORCE_REST", () => {
    for (const [, row, ...wants] of CASES) {
      for (const [policy, want] of [
        ["ndma-2025", wants[0]],
        ["union-demand", wants[1]],
        ["heatgate-fair", wants[2]],
      ] as const) {
        if (want.outcome !== "ALLOW") expect(run(row, policy).penaltyWaived).toBe(true);
      }
    }
    // Cedar's decline check is false here (heat index < 38), but the rest still waives the penalty.
    const restingCool = { ...CASES[4][1], heat: 30 };
    const d = run(restingCool, "heatgate-fair");
    expect(d.outcome).toBe("FORCE_REST");
    expect(d.penaltyWaived).toBe(true);
  });
});

describe("distance rounding", () => {
  const alertDay: Row = { heat: 42, hour: 17, sinceBreak: 30, trip: 20, distKm: 0, restLeft: 0, demand: 1, alert: 1 };

  test("a 3.0 km order is allowed by NDMA's radius rule on an alert day", () => {
    const d = run({ ...alertDay, distKm: 3.0 }, "ndma-2025");
    expect(d.outcome).toBe("ALLOW");
    expect(d.cedarContext.distanceKm).toBe(3);
  });

  test("a 3.2 km order is skipped (rounded up to 4)", () => {
    const d = run({ ...alertDay, distKm: 3.2 }, "ndma-2025");
    expect(d.outcome).toBe("SKIP_ORDER");
    expect(d.firedRules[0]).toBe("ndma-reduced-radius");
    expect(d.cedarContext.distanceKm).toBe(4);
  });
});

// Messages and the cooling point only describe a decision: the 11 golden rows must decide the same with them.
describe("golden rows: messages and cooling point", () => {
  const POINTS = [
    { name: "Point A", x: 1, y: 1 },
    { name: "Point B", x: 3, y: 4 },
  ];
  const core = ({ decisionId, messages, coolingPoint, ...rest }: Decision) => rest;
  const now = new Date("2026-05-20T08:00:00Z");
  for (const [n, row] of CASES) {
    for (const policy of ["no-rules", "ndma-2025", "union-demand", "heatgate-fair"] as const) {
      test(`case ${n} ${policy}`, () => {
        const plain = decideWithHeatIndex(request(row), policy, row.heat, now);
        const full = decideWithHeatIndex({ ...request(row), rider: { ...request(row).rider, x: 3, y: 3.5 } }, policy, row.heat, now, undefined, POINTS);
        expect(core(full)).toEqual(core(plain));
        for (const lang of ["hi", "te", "ur"] as const) expect(full.messages?.[lang]).toMatch(/\S/);
        for (const text of [full.message, ...Object.values(full.messages ?? {})]) expect(text).not.toMatch(/[{}]/);
        if (full.outcome === "FORCE_REST") expect(full.coolingPoint).toEqual({ name: "Point B", distanceM: 500 });
        else expect(full.coolingPoint).toBeUndefined();
        expect(plain.coolingPoint).toBeUndefined(); // no cooling points given, none named
      });
    }
  }
});
