import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, expect, test } from "vitest";
import type { Decision, Outcome, SimResult, SimulationJob } from "@heatgate/contracts";
import { createApp } from "../src/app.ts";
import type { SimRunner } from "../src/simulations.ts";
import { MemoryStore } from "../store/memory.ts";
import { MAX_ACTIVE_SIMULATIONS, MAX_AUDITED_SIMULATIONS } from "../store/types.ts";

let server: Server | undefined;
afterEach(() => server?.close());

async function start(runSimulation: SimRunner, store = new MemoryStore()) {
  server = createApp({ store, runSimulation }).listen(0);
  await new Promise((r) => server!.once("listening", r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json()) as any };
  };
}

async function poll(call: Awaited<ReturnType<typeof start>>, id: string): Promise<SimulationJob> {
  for (;;) {
    const { json } = await call("GET", `/simulations/${id}`);
    if (json.status === "done" || json.status === "failed") return json;
    await new Promise((r) => setTimeout(r, 5));
  }
}

test("simulation job: queued -> done, result only when done", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const call = await start(async (params, simulationId) => {
    await gate;
    return { result: { simulationId, params, runs: {} } satisfies SimResult, audit: {} };
  });
  const post = await call("POST", "/simulations", { seeds: [3] });
  expect(post.status).toBe(202);
  expect(post.json).toEqual({ simulationId: expect.any(String), status: "queued" });
  const running = await call("GET", `/simulations/${post.json.simulationId}`);
  expect(running.json.status).toBe("running");
  expect(running.json.result).toBeUndefined();
  release();
  const job = await poll(call, post.json.simulationId);
  expect(job.status).toBe("done");
  expect(job.result?.params.seeds).toEqual([3]);
  expect(job.error).toBeUndefined();
});

test("simulation job: a crash in the run gives status failed with an error and no result", async () => {
  const call = await start(async () => {
    throw new Error("boom");
  });
  const post = await call("POST", "/simulations", {});
  const job = await poll(call, post.json.simulationId);
  expect(job.status).toBe("failed");
  expect(job.error).toEqual({ code: "SIMULATION_FAILED", message: expect.any(String) });
  expect(job.result).toBeUndefined();
});

test("POST /simulations -> 429 TOO_MANY_RUNNING while 3 jobs are queued or running", async () => {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  const call = await start(async (params, simulationId) => {
    await gate;
    return { result: { simulationId, params, runs: {} }, audit: {} };
  });
  const ids: string[] = [];
  for (let i = 0; i < MAX_ACTIVE_SIMULATIONS; i++) {
    const r = await call("POST", "/simulations", {});
    expect(r.status).toBe(202);
    ids.push(r.json.simulationId);
  }
  const busy = await call("POST", "/simulations", {});
  expect(busy.status).toBe(429);
  expect(busy.json).toEqual({ error: { code: "TOO_MANY_RUNNING", message: expect.any(String) } });
  const invalid = await call("POST", "/simulations", { startHour: 14, endHour: 12 });
  expect(invalid.status).toBe(400); // bad params are still a 400, busy or not
  release();
  for (const id of ids) expect((await poll(call, id)).status).toBe("done");
  expect((await call("POST", "/simulations", {})).status).toBe(202);
});

test("unknown simulation id -> 404 with the standard error body", async () => {
  const call = await start(async () => {
    throw new Error("not called");
  });
  const r = await call("GET", "/simulations/nope");
  expect(r.status).toBe(404);
  expect(r.json).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
});

const decision = (simulationId: string, riderId: string, minute: number, outcome: Outcome = "ALLOW"): Decision => ({
  decisionId: `${simulationId}-${riderId}-${minute}`,
  at: new Date(Date.UTC(2026, 4, 20, 0, minute)).toISOString(),
  policyVersion: "ndma-2025",
  riderId,
  orderId: `order-${minute}`,
  simulationId,
  outcome,
  restMinutes: 0,
  penaltyWaived: outcome !== "ALLOW",
  heatIndexC: 40,
  firedRules: [],
  message: "",
  cedarContext: {},
});

test("a finished simulation writes its audit trail; GET /audit filters by simulationId, latest simulated time first", async () => {
  const call = await start(async (params, simulationId) => ({
    result: { simulationId, params, runs: {} },
    audit: {
      "ndma-2025": [decision(simulationId, "rider-001", 600, "FORCE_REST"), decision(simulationId, "rider-002", 700)],
      "no-rules": [decision(simulationId, "rider-001", 650)],
    },
  }));
  const live = await call("POST", "/decide", {
    policyVersion: "no-rules",
    rider: { id: "R-001", vehicle: "bike", x: 1, y: 1 },
    order: { id: "o", zone: "Z", distanceKm: 1, tripMinutes: 5 },
    conditions: { tempC: 30, humidityPct: 40, hourOfDay: 9, demandLevel: 1, alertLevel: 0 },
    riderState: { minutesSinceBreak: 0, exposureMinutesToday: 0, restMinutesRemaining: 0 },
  });
  expect(live.status).toBe(200);
  const a = (await call("POST", "/simulations", {})).json.simulationId;
  const b = (await call("POST", "/simulations", {})).json.simulationId;
  await poll(call, a);
  await poll(call, b);

  const trail = await call("GET", `/audit?simulationId=${a}`);
  expect(trail.status).toBe(200);
  expect(trail.json.items.map((d: Decision) => [d.simulationId, d.riderId, d.orderId])).toEqual([
    [a, "rider-002", "order-700"],
    [a, "rider-001", "order-650"],
    [a, "rider-001", "order-600"],
  ]);
  const rider = await call("GET", `/audit?simulationId=${b}&rider=rider-001&outcome=FORCE_REST`);
  expect(rider.json.items).toHaveLength(1);
  expect((await call("GET", "/audit")).json.items).toHaveLength(7); // 2 trails + the live decision
  expect((await call("GET", "/audit?simulationId=sim-unknown")).json.items).toEqual([]);
  const bad = await call("GET", "/audit?simulationId=sim%20x");
  expect(bad.status).toBe(400);
  expect(bad.json.error.code).toBe("INVALID_REQUEST");
});

test("the store keeps only the last 5 simulations' audit trails, and never drops live decisions", async () => {
  const store = new MemoryStore();
  const live = { ...decision("x", "R-001", 1) };
  delete live.simulationId;
  await store.putDecision(live);
  const ids = Array.from({ length: MAX_AUDITED_SIMULATIONS + 2 }, (_, i) => `sim-${i}`);
  for (const id of ids) await store.putSimulationDecisions(id, [decision(id, "rider-001", 600), decision(id, "rider-002", 601)]);
  for (const [i, id] of ids.entries()) {
    const page = await store.listDecisions({ simulationId: id }, { limit: 200 });
    expect(page.items).toHaveLength(i < 2 ? 0 : 2);
  }
  // Writing a kept simulation again replaces its trail and makes it the newest.
  await store.putSimulationDecisions("sim-2", [decision("sim-2", "rider-009", 900)]);
  expect((await store.listDecisions({ simulationId: "sim-2" }, { limit: 200 })).items.map((d) => d.riderId)).toEqual(["rider-009"]);
  await store.putSimulationDecisions("sim-7", []);
  expect((await store.listDecisions({ simulationId: "sim-2" }, { limit: 200 })).items).toHaveLength(1);
  expect((await store.listDecisions({ simulationId: "sim-3" }, { limit: 200 })).items).toHaveLength(0);
  const all = await store.listDecisions({}, { limit: 200 });
  expect(all.items.filter((d) => d.simulationId === undefined)).toHaveLength(1);
  expect(new Set(all.items.flatMap((d) => (d.simulationId ? [d.simulationId] : []))).size).toBeLessThanOrEqual(MAX_AUDITED_SIMULATIONS);
});

// Keys that would say where a rider is. None may appear anywhere in an audit entry.
const LOCATION_KEYS = ["x", "y", "lat", "lng", "position", "coolingPoint", "distanceM"];
const keysOf = (v: unknown): string[] =>
  v && typeof v === "object" ? Object.entries(v).flatMap(([k, inner]) => [k, ...keysOf(inner)]) : [];

test("POST /decide: a FORCE_REST tells the rider the nearest cooling point and the message in every language; the audit entry has no location", async () => {
  const { simulateWithAudit, defaultSimParams } = await import("@heatgate/sim");
  const call = await start(async (params, simulationId) => simulateWithAudit({ ...params, seeds: [1], riders: 10, startHour: 12, endHour: 16 }, simulationId));
  const hot = await call("POST", "/decide", {
    policyVersion: "ndma-2025",
    rider: { id: "R-015", vehicle: "bike", x: 2, y: 3 },
    order: { id: "order-2", zone: "Z2", distanceKm: 3.4, tripMinutes: 20 },
    conditions: { tempC: 42, humidityPct: 30, hourOfDay: 14, demandLevel: 2, alertLevel: 1 },
    riderState: { minutesSinceBreak: 80, exposureMinutesToday: 200, restMinutesRemaining: 0 },
  });
  expect(hot.json.outcome).toBe("FORCE_REST");
  expect(hot.json.coolingPoint).toEqual({ name: expect.stringMatching(/^Cooling point [1-8]$/), distanceM: expect.any(Number) });
  expect(Object.keys(hot.json.messages).sort()).toEqual(["hi", "te", "ur"]);
  expect(keysOf(hot.json)).not.toContain("x"); // the response names a place, never the rider's position

  const sim = (await call("POST", "/simulations", { alertLevel: 1, peakTempC: defaultSimParams().peakTempC })).json.simulationId;
  expect((await poll(call, sim)).status).toBe("done");
  const items: Decision[] = (await call("GET", "/audit?limit=200")).json.items;
  expect(items.some((d) => d.simulationId === sim && d.outcome === "FORCE_REST")).toBe(true);
  const live = items.find((d) => d.riderId === "R-015")!;
  expect(live.messages).toEqual(hot.json.messages); // the audit shows what the rider was told
  for (const d of items) {
    expect(d.messages?.hi).toMatch(/\S/);
    for (const key of LOCATION_KEYS) expect(keysOf(d)).not.toContain(key);
  }
}, 60_000);
