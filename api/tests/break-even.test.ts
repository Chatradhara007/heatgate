// GET /break-even: serves sim/results/break-even.json with a stale flag, or the standard error body.
import { mkdtempSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vitest";
import type { BreakEvenReport } from "@heatgate/contracts";
import { BREAK_EVEN_NOTE, defaultSimParams } from "@heatgate/sim";
import { createApp } from "../src/app.ts";
import { MemoryStore } from "../store/memory.ts";

let server: Server | undefined;
afterEach(() => server?.close());

async function get(breakEvenPath?: string) {
  server = createApp({ store: new MemoryStore(), runSimulation: async () => { throw new Error("not called"); }, breakEvenPath }).listen(0);
  await new Promise((r) => server!.once("listening", r));
  const res = await fetch(`http://localhost:${(server.address() as AddressInfo).port}/break-even`);
  return { status: res.status, json: (await res.json()) as any };
}

const dir = mkdtempSync(join(tmpdir(), "break-even-"));
function file(name: string, content: string): string {
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}
const report = (params = defaultSimParams()): BreakEvenReport => ({
  note: BREAK_EVEN_NOTE,
  generatedAt: "2026-10-09T00:00:00.000Z",
  params,
  restPayRatesInrPerMin: [0, 1.5],
  levels: [],
});

test("missing file -> 404 with the standard error body", async () => {
  const r = await get(join(dir, "missing.json"));
  expect(r.status).toBe(404);
  expect(r.json).toEqual({ error: { code: "NOT_FOUND", message: expect.stringContaining("sim:breakeven") } });
});

test("made with today's defaults -> the file as written, stale false", async () => {
  const r = await get(file("fresh.json", JSON.stringify(report())));
  expect(r.status).toBe(200);
  expect(r.json).toEqual({ ...JSON.parse(JSON.stringify(report())), stale: false });
});

test("made with other params -> stale true", async () => {
  const r = await get(file("old.json", JSON.stringify(report(defaultSimParams({ ordersPerHour: 50 })))));
  expect(r.status).toBe(200);
  expect(r.json.stale).toBe(true);
  expect(r.json.params.ordersPerHour).toBe(50);
});

test("not valid JSON -> 500 with the standard error body", async () => {
  const r = await get(file("broken.json", "{not json"));
  expect(r.status).toBe(500);
  expect(r.json).toEqual({ error: { code: "INVALID_RESULTS", message: expect.any(String) } });
});

test("the committed file: labelled, all three demand levels, both rule sets, a row per rest pay rate", async () => {
  const r = await get();
  expect(r.status).toBe(200);
  const body = r.json as BreakEvenReport;
  expect(body.note).toBe(BREAK_EVEN_NOTE);
  expect(typeof body.stale).toBe("boolean");
  expect(body.levels.map((l) => l.ordersPerHour)).toEqual([25, 34, 50]);
  for (const level of body.levels) {
    for (const policy of ["union-demand", "heatgate-fair"] as const) {
      expect(level.policies[policy]!.rows).toHaveLength(body.restPayRatesInrPerMin.length);
    }
  }
});
