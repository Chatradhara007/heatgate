import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, expect, test } from "vitest";
import type { SimResult, SimulationJob } from "@heatgate/contracts";
import { createApp } from "../src/app.ts";
import type { SimRunner } from "../src/simulations.ts";
import { MemoryStore } from "../store/memory.ts";

let server: Server | undefined;
afterEach(() => server?.close());

async function start(runSimulation: SimRunner) {
  server = createApp({ store: new MemoryStore(), runSimulation }).listen(0);
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
    return { simulationId, params, runs: {} } satisfies SimResult;
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

test("unknown simulation id -> 404 with the standard error body; unsupported fields -> 400", async () => {
  const call = await start(async () => {
    throw new Error("not called");
  });
  const r = await call("GET", "/simulations/nope");
  expect(r.status).toBe(404);
  expect(r.json).toEqual({ error: { code: "NOT_FOUND", message: expect.any(String) } });
  const w = await call("POST", "/simulations", { weather: { kind: "slider" } });
  expect(w.status).toBe(400);
  expect(w.json.error.code).toBe("NOT_SUPPORTED");
});
