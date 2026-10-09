// api.breakEven(): GET /break-even with the stale flag, the API's error message, and the fixture fallback.
// fetch is stubbed, so no API has to run. The report is the committed fixture; its amounts are placeholders.
import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import type { BreakEvenReport } from "@heatgate/contracts";

const fixtureFile = new URL("../fixtures/breakEven.json", import.meta.url);
const fixture = JSON.parse(readFileSync(fixtureFile, "utf8")) as BreakEvenReport;
const defaultsFixture = readFileSync(new URL("../fixtures/defaults.json", import.meta.url), "utf8");

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

test("calls GET /break-even and keeps the stale flag", async () => {
  const fetch = stubFetch(200, { ...fixture, stale: true });
  const api = await loadApi();
  const report = await api.breakEven();
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(`${api.API_URL}/break-even`);
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "GET" });
  expect(report.stale).toBe(true);
  expect(report.note).toBe(fixture.note);
  expect(report.levels).toEqual(fixture.levels);
});

test("shows the API's { error: { code, message } } message", async () => {
  stubFetch(404, { error: { code: "NOT_FOUND", message: "No break-even results yet: run npm run sim:breakeven" } });
  const api = await loadApi();
  const err = await api.breakEven().catch((e: unknown) => e);
  expect(err).toBeInstanceOf(api.ApiRequestError);
  expect((err as Error).message).toBe("No break-even results yet: run npm run sim:breakeven (NOT_FOUND)");
  expect(err).toMatchObject({ status: 404, code: "NOT_FOUND" });
});

test("says the API is not reachable when fetch fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
  const api = await loadApi();
  await expect(api.breakEven()).rejects.toThrow(/Could not reach the HeatGate API/);
});

test("VITE_USE_FIXTURES=true returns the fixture without touching the network", async () => {
  const fetch = stubFetch(500, {});
  const api = await loadApi(true);
  const report = await api.breakEven();
  expect(fetch).not.toHaveBeenCalled();
  expect(report.levels).toEqual(fixture.levels);
  // Like the API: stale when the sweep ran from params other than the defaults fixture (minus fairKnobs,
  // which GET /defaults adds on top of defaultSimParams()).
  const { fairKnobs: _, ...defaultParams } = JSON.parse(defaultsFixture);
  const fresh = JSON.stringify(fixture.params) === JSON.stringify(defaultParams);
  expect(report.stale).toBe(!fresh);
});

test("the fixture is a copy of sim/results/break-even.json (npm run fixtures --workspace web)", () => {
  const results = readFileSync(new URL("../../sim/results/break-even.json", import.meta.url), "utf8");
  expect(readFileSync(fixtureFile, "utf8")).toBe(results);
});
