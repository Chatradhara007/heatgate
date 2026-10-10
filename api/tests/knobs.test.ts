// POST /policies/render and fairKnobs on POST /simulations (docs/spec/day3-features.md, "Change the rule live").
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, expect, test } from "vitest";
import type { SimParams, SimulationJob } from "@heatgate/contracts";
import { DEFAULT_FAIR_KNOBS } from "@heatgate/engine";
import { defaultSimParams, simulateWithAudit } from "@heatgate/sim";
import { createApp } from "../src/app.ts";
import type { SimRunner } from "../src/simulations.ts";
import { MemoryStore } from "../store/memory.ts";

const COMMITTED_FAIR = readFileSync(new URL("../../policies/heatgate-fair.cedar", import.meta.url), "utf8").replace(/\r\n/g, "\n"); // CRLF on a Windows checkout

let server: Server | undefined;
afterEach(() => server?.close());

async function start(runSimulation: SimRunner = async (p, id) => simulateWithAudit(p, id), store = new MemoryStore()) {
  server = createApp({ store, runSimulation }).listen(0);
  await new Promise((r) => server!.once("listening", r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json()) as any };
  };
}

type Call = Awaited<ReturnType<typeof start>>;

async function runToDone(call: Call, body: unknown): Promise<SimulationJob> {
  const post = await call("POST", "/simulations", body);
  expect(post.status).toBe(202);
  for (;;) {
    const { json } = await call("GET", `/simulations/${post.json.simulationId}`);
    if (json.status === "done" || json.status === "failed") return json;
    await new Promise((r) => setTimeout(r, 5));
  }
}

const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");
const SMALL = { seeds: [1], riders: 20, startHour: 12, endHour: 15 };

const expectBad = (r: { status: number; json: any }, message: RegExp) => {
  expect(r.status).toBe(400);
  expect(r.json).toEqual({ error: { code: "INVALID_REQUEST", message: expect.stringMatching(message) } });
};

test("GET /defaults includes the default fair knobs", async () => {
  const call = await start();
  const r = await call("GET", "/defaults");
  expect(r.status).toBe(200);
  expect(r.json).toEqual({ ...defaultSimParams(), fairKnobs: DEFAULT_FAIR_KNOBS });
  expect(r.json.fairKnobs).toEqual({
    restHeatC: 38,
    workLimitMin: 100,
    rushHardLimitMin: 120,
    earlyRestMin: 70,
    shortTripHeatC: 41,
    shortTripMaxKm: 3,
    extremeHeatC: 46,
  });
});

test("POST /policies/render: default knobs give the committed file; changed knobs change only their numbers", async () => {
  const store = new MemoryStore();
  let runs = 0;
  const call = await start(async () => {
    runs++;
    throw new Error("not called");
  }, store);
  const def = await call("POST", "/policies/render", { knobs: DEFAULT_FAIR_KNOBS });
  expect(def.status).toBe(200);
  expect(def.json).toEqual({ knobs: DEFAULT_FAIR_KNOBS, text: COMMITTED_FAIR, valid: true, errors: [], rules: expect.any(Array) });
  expect(def.json.rules).toHaveLength(8);

  const empty = await call("POST", "/policies/render", {});
  expect(empty.json.text).toBe(COMMITTED_FAIR);

  const changed = await call("POST", "/policies/render", { knobs: { workLimitMin: 90, rushHardLimitMin: 110 } });
  expect(changed.status).toBe(200);
  expect(changed.json.valid).toBe(true);
  expect(changed.json.knobs).toEqual({ ...DEFAULT_FAIR_KNOBS, workLimitMin: 90, rushHardLimitMin: 110 });
  expect(changed.json.text).toContain("context.minutesSinceBreak + context.tripMinutes > 90");
  expect(changed.json.text).toContain("context.minutesSinceBreak + context.tripMinutes > 110 }");
  expect(changed.json.text.replace(/\d+/g, "N")).toBe(COMMITTED_FAIR.replace(/\d+/g, "N"));
  expect(changed.json.rules.find((r: any) => r.id === "fair-rest-due").summary).toContain("90 minutes");

  // Not logged, not run.
  expect((await call("GET", "/audit")).json.items).toEqual([]);
  expect(runs).toBe(0);
});

test("POST /policies/render: out-of-range, non-numbers, unknown fields and raw Cedar -> 400", async () => {
  const call = await start();
  expectBad(await call("POST", "/policies/render", { knobs: { restHeatC: 31 } }), /^knobs\.restHeatC must be between 32 and 46$/);
  expectBad(await call("POST", "/policies/render", { knobs: { extremeHeatC: 53 } }), /extremeHeatC must be between 42 and 52/);
  expectBad(await call("POST", "/policies/render", { knobs: { shortTripMaxKm: 2.5 } }), /shortTripMaxKm must be a whole number/);
  expectBad(await call("POST", "/policies/render", { knobs: { workLimitMin: "90" } }), /workLimitMin must be a whole number/);
  expectBad(await call("POST", "/policies/render", { knobs: { workLimitMin: 120, rushHardLimitMin: 110 } }), /rushHardLimitMin must be at least knobs\.workLimitMin/);
  expectBad(await call("POST", "/policies/render", { knobs: { earlyRestMin: 100 } }), /earlyRestMin must be less than knobs\.workLimitMin/);
  expectBad(await call("POST", "/policies/render", { knobs: { restHeatC: 38, bogus: 1 } }), /^unknown field: knobs\.bogus$/);
  expectBad(await call("POST", "/policies/render", { knobs: DEFAULT_FAIR_KNOBS, text: "permit (principal, action, resource);" }), /^unknown field: text$/);
  expectBad(await call("POST", "/policies/render", { knobs: { restHeatC: "38 }; permit (principal, action, resource" } }), /whole number/);
  expectBad(await call("POST", "/policies/render", { knobs: [38] }), /knobs must be an object/);
});

test("POST /simulations: fairKnobs out of range, unknown or wrong type -> 400 before anything is queued", async () => {
  const store = new MemoryStore();
  const call = await start(async () => {
    throw new Error("not called");
  }, store);
  expectBad(await call("POST", "/simulations", { fairKnobs: { workLimitMin: 59 } }), /^fairKnobs\.workLimitMin must be between 60 and 120$/);
  expectBad(await call("POST", "/simulations", { fairKnobs: { rushHardLimitMin: 151 } }), /rushHardLimitMin must be between 90 and 150/);
  expectBad(await call("POST", "/simulations", { fairKnobs: { workLimitMin: 120, rushHardLimitMin: 110 } }), /rushHardLimitMin must be at least fairKnobs\.workLimitMin/);
  expectBad(await call("POST", "/simulations", { fairKnobs: { cedar: "forbid (principal, action, resource);" } }), /^unknown field: fairKnobs\.cedar$/);
  expectBad(await call("POST", "/simulations", { fairKnobs: "restHeatC=40" }), /fairKnobs must be an object/);
  expectBad(await call("POST", "/simulations", { fairKnobs: { restHeatC: null } }), /restHeatC must be a whole number/);
  // Existing caps still hold alongside knobs.
  expectBad(await call("POST", "/simulations", { fairKnobs: DEFAULT_FAIR_KNOBS, riders: 301 }), /riders must be between 1 and 300/);
  expectBad(await call("POST", "/simulations", { fairKnobs: DEFAULT_FAIR_KNOBS, seeds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] }), /seeds/);
  expect(await store.countActiveSimulations(new Date(0))).toBe(0);
});

test("POST /simulations: default knobs give the same result as no knobs (same seed, same hash)", { timeout: 60_000 }, async () => {
  const call = await start();
  const plain = await runToDone(call, SMALL);
  const withDefaults = await runToDone(call, { ...SMALL, fairKnobs: DEFAULT_FAIR_KNOBS });
  expect(plain.status).toBe("done");
  expect(withDefaults.status).toBe("done");
  expect(withDefaults.result!.params).toEqual({ ...defaultSimParams(SMALL as Partial<SimParams>), fairKnobs: DEFAULT_FAIR_KNOBS });
  expect(hash(withDefaults.result!.runs)).toBe(hash(plain.result!.runs));
});

test("POST /simulations: changed knobs change heatgate-fair only, and the same knobs repeat exactly", { timeout: 60_000 }, async () => {
  const call = await start();
  // A cooler rest trigger and a tighter work limit: Fair rests more on a 40 °C day.
  const knobs = { restHeatC: 34, workLimitMin: 80, earlyRestMin: 60 };
  const plain = await runToDone(call, SMALL);
  const a = await runToDone(call, { ...SMALL, fairKnobs: knobs });
  const b = await runToDone(call, { ...SMALL, fairKnobs: knobs });
  expect(a.status).toBe("done");
  expect(hash(a.result!.runs)).toBe(hash(b.result!.runs));
  for (const p of ["no-rules", "ndma-2025", "union-demand"] as const) {
    expect(hash(a.result!.runs[p])).toBe(hash(plain.result!.runs[p]));
  }
  const fair = a.result!.runs["heatgate-fair"]!.metrics;
  expect(hash(fair)).not.toBe(hash(plain.result!.runs["heatgate-fair"]!.metrics));
  expect(fair.restsForced).toBeGreaterThan(plain.result!.runs["heatgate-fair"]!.metrics.restsForced);
});
