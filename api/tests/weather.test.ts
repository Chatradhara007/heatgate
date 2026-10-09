// GET /weather-days and weather in POST /simulations (sim/data/weather, real Open-Meteo days).
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterEach, expect, test } from "vitest";
import type { SimParams, SimResult } from "@heatgate/contracts";
import { WEATHER_DAYS, weatherDay, weatherDaySummary } from "@heatgate/sim";
import { createApp } from "../src/app.ts";
import { MemoryStore } from "../store/memory.ts";

let server: Server | undefined;
afterEach(() => server?.close());

// The runner records the params it was given instead of running the simulator.
async function start() {
  const seen: SimParams[] = [];
  server = createApp({
    store: new MemoryStore(),
    runSimulation: async (params, simulationId) => {
      seen.push(params);
      return { result: { simulationId, params, runs: {} } satisfies SimResult, audit: {} };
    },
  }).listen(0);
  await new Promise((r) => server!.once("listening", r));
  const base = `http://localhost:${(server.address() as AddressInfo).port}`;
  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(base + path, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, json: (await res.json()) as any };
  };
  return { call, seen };
}

test("GET /weather-days: every committed day with its peaks and source", async () => {
  const { call } = await start();
  const r = await call("GET", "/weather-days");
  expect(r.status).toBe(200);
  expect(r.json).toHaveLength(WEATHER_DAYS.length);
  for (const d of r.json) {
    expect(Object.keys(d).sort()).toEqual(["city", "date", "id", "peakHeatIndexC", "peakTempC", "source"]);
    expect(d.source).toBe("Open-Meteo historical weather API");
    // Exactly the engine's peaks. Not "heat index >= temperature": on a dry day (Delhi 2024-05-26, 46 °C at
    // 9% humidity) the heat index is below the air temperature.
    expect(d).toEqual(weatherDaySummary(weatherDay(d.id)!));
  }
  expect(r.json.map((d: { id: string }) => d.id)).toContain("lucknow-2024-05-29");
});

test("POST /simulations with a known weather day -> 202, passed to the simulator", async () => {
  const { call, seen } = await start();
  const r = await call("POST", "/simulations", { seeds: [1], weather: { kind: "replay", weatherDayId: "delhi-2024-06-18" } });
  expect(r.status).toBe(202);
  await new Promise((r) => setTimeout(r, 20));
  expect(seen[0].weather).toEqual({ kind: "replay", weatherDayId: "delhi-2024-06-18" });
  expect((await call("POST", "/simulations", { weather: { kind: "slider" } })).status).toBe(202);
});

test.each([
  [{ kind: "replay", weatherDayId: "atlantis-2024-01-01" }, /no weather day "atlantis-2024-01-01"/],
  [{ kind: "replay" }, /weather\.weatherDayId must be a string/],
  [{ kind: "live" }, /weather\.kind must be one of/],
  [{ kind: "slider", weatherDayId: "delhi-2024-06-18" }, /unknown field: weather\.weatherDayId/],
  [{ kind: "replay", weatherDayId: "delhi-2024-06-18", tempC: 50 }, /unknown field: weather\.tempC/],
  ["delhi-2024-06-18", /weather must be an object/],
])("POST /simulations weather %j -> 400 INVALID_REQUEST", async (weather, message) => {
  const { call, seen } = await start();
  const r = await call("POST", "/simulations", { weather });
  expect(r.status).toBe(400);
  expect(r.json).toEqual({ error: { code: "INVALID_REQUEST", message: expect.stringMatching(message) } });
  expect(seen).toHaveLength(0);
});

test("web/fixtures/weatherDays.json is what GET /weather-days returns (npm run fixtures --workspace web)", async () => {
  const { call } = await start();
  const fixture = JSON.parse(readFileSync(new URL("../../web/fixtures/weatherDays.json", import.meta.url), "utf8"));
  expect((await call("GET", "/weather-days")).json).toEqual(fixture);
});
