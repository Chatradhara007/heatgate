// api.weatherDays() and weather replay through api.createSimulation(): the request each one makes, the API's
// error message, and the fixture fallback. fetch is stubbed, so no API has to run.
import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import type { SimParams, SimResult } from "@heatgate/contracts";
import { WEATHER_DAYS, weatherDaySummary } from "@heatgate/sim";
import type { Defaults, WeatherDaySummary } from "../src/api.ts";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/weatherDays.json", import.meta.url), "utf8")) as WeatherDaySummary[];
const simFixture = JSON.parse(readFileSync(new URL("../fixtures/simResult.json", import.meta.url), "utf8")) as SimResult;
const { fairKnobs: _, ...params } = JSON.parse(readFileSync(new URL("../fixtures/defaults.json", import.meta.url), "utf8")) as Defaults;
const defaultParams: SimParams = params;

function stubFetch(status: number, body: unknown) {
  const fetch = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

// api.ts reads VITE_USE_FIXTURES once, when it loads, so each test loads a fresh copy.
async function loadApi(useFixtures = false) {
  vi.resetModules();
  vi.stubEnv("VITE_USE_FIXTURES", useFixtures ? "true" : "false");
  return import("../src/api.ts");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

// ---- weatherDays --------------------------------------------------------------------------------

test("weatherDays calls GET /weather-days", async () => {
  const fetch = stubFetch(200, fixture);
  const api = await loadApi();
  expect(await api.weatherDays()).toEqual(fixture);
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(`${api.API_URL}/weather-days`);
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "GET" });
});

test("weatherDays says the API is not reachable when fetch fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
  const api = await loadApi();
  await expect(api.weatherDays()).rejects.toThrow(/Could not reach the HeatGate API/);
});

test("VITE_USE_FIXTURES=true: weatherDays returns the fixture without touching the network", async () => {
  const fetch = stubFetch(500, {});
  const api = await loadApi(true);
  expect(await api.weatherDays()).toEqual(fixture);
  expect(fetch).not.toHaveBeenCalled();
});

test("the weather days fixture matches the committed days (npm run fixtures --workspace web)", () => {
  expect(fixture).toEqual(WEATHER_DAYS.map(weatherDaySummary));
});

// ---- createSimulation with weather ---------------------------------------------------------------

test("createSimulation sends weather: { kind: \"replay\", weatherDayId } in the body", async () => {
  const fetch = stubFetch(202, { simulationId: "sim-1", status: "queued" });
  const api = await loadApi();
  const weather = { kind: "replay", weatherDayId: fixture[0].id } as const;
  expect(await api.createSimulation({ ...defaultParams, weather })).toEqual({ simulationId: "sim-1", status: "queued" });
  expect(fetch.mock.calls[0][0]).toBe(`${api.API_URL}/simulations`);
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST" });
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).weather).toEqual(weather);
});

test("createSimulation sends weather: { kind: \"slider\" } in the body", async () => {
  const fetch = stubFetch(202, { simulationId: "sim-1", status: "queued" });
  const api = await loadApi();
  await api.createSimulation({ ...defaultParams, weather: { kind: "slider" } });
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string).weather).toEqual({ kind: "slider" });
});

test("createSimulation shows the API's message for an unknown weather day", async () => {
  const message = 'weather.weatherDayId: no weather day "delhi-2024-06-19" (see GET /weather-days)';
  stubFetch(400, { error: { code: "INVALID_REQUEST", message } });
  const api = await loadApi();
  const err = await api.createSimulation({ ...defaultParams, weather: { kind: "replay", weatherDayId: "delhi-2024-06-19" } }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(api.ApiRequestError);
  expect((err as Error).message).toBe(`${message} (INVALID_REQUEST)`);
  expect(err).toMatchObject({ status: 400, code: "INVALID_REQUEST" });
});

test("VITE_USE_FIXTURES=true: a replay returns the fixture result with a note that the weather day was ignored", async () => {
  const fetch = stubFetch(500, {});
  const api = await loadApi(true);
  const day = fixture[0].id;
  const { simulationId, status } = await api.createSimulation({ ...defaultParams, weather: { kind: "replay", weatherDayId: day } });
  expect(status).toBe("queued");
  const result = await api.waitForSimulation(simulationId);
  expect(result.fixtureNote).toMatch(/^Fixture mode ignores the weather day/);
  expect(result.fixtureNote).toContain(day);
  expect(result.runs).toEqual(simFixture.runs);
  expect(result.params).toEqual(simFixture.params); // what the fixture really ran, not the requested day
  expect(fetch).not.toHaveBeenCalled();
});

test("VITE_USE_FIXTURES=true: a slider run has no fixture note", async () => {
  stubFetch(500, {});
  const api = await loadApi(true);
  const { simulationId } = await api.createSimulation({ ...defaultParams, weather: { kind: "slider" } });
  expect(simulationId).toBe(simFixture.simulationId);
  const result = await api.waitForSimulation(simulationId);
  expect(result.fixtureNote).toBeUndefined();
  expect(result.simulationId).toBe(simFixture.simulationId);
});

test("VITE_USE_FIXTURES=true: an unknown weather day is refused like the API does", async () => {
  stubFetch(500, {});
  const api = await loadApi(true);
  const err = await api.createSimulation({ ...defaultParams, weather: { kind: "replay", weatherDayId: "nowhere-2024-01-01" } }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(api.ApiRequestError);
  expect(err).toMatchObject({ status: 400, code: "INVALID_REQUEST" });
  expect((err as Error).message).toMatch(/no weather day "nowhere-2024-01-01"/);
});
