// api.renderPolicy(), api.health() and api.defaults(): the request each one makes, the API's error message,
// and the fixture fallback. fetch is stubbed, so no API has to run.
import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import { DEFAULT_FAIR_KNOBS, checkPolicyText, policySchema, renderFairPolicy, summarizeFairPolicy } from "@heatgate/engine";
import type { RenderedPolicy } from "../src/api.ts";

const fixture = JSON.parse(readFileSync(new URL("../fixtures/renderPolicy.json", import.meta.url), "utf8")) as RenderedPolicy;
const defaultsFixture = JSON.parse(readFileSync(new URL("../fixtures/defaults.json", import.meta.url), "utf8"));

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

// ---- renderPolicy -------------------------------------------------------------------------------

test("renderPolicy calls POST /policies/render with { knobs }", async () => {
  const fetch = stubFetch(200, fixture);
  const api = await loadApi();
  const rendered = await api.renderPolicy({ workLimitMin: 90, rushHardLimitMin: 90 });
  expect(fetch).toHaveBeenCalledOnce();
  expect(fetch.mock.calls[0][0]).toBe(`${api.API_URL}/policies/render`);
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { "content-type": "application/json" } });
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ knobs: { workLimitMin: 90, rushHardLimitMin: 90 } });
  expect(rendered).toEqual(fixture);
});

test("renderPolicy with no knobs sends an empty knobs object", async () => {
  const fetch = stubFetch(200, fixture);
  const api = await loadApi();
  await api.renderPolicy();
  expect(JSON.parse(fetch.mock.calls[0][1]!.body as string)).toEqual({ knobs: {} });
});

test("renderPolicy shows the API's { error: { code, message } } message", async () => {
  stubFetch(400, { error: { code: "INVALID_REQUEST", message: "knobs.restHeatC must be between 32 and 46" } });
  const api = await loadApi();
  const err = await api.renderPolicy({ restHeatC: 60 }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(api.ApiRequestError);
  expect((err as Error).message).toBe("knobs.restHeatC must be between 32 and 46 (INVALID_REQUEST)");
  expect(err).toMatchObject({ status: 400, code: "INVALID_REQUEST" });
});

test("VITE_USE_FIXTURES=true renders the default knobs from the fixture", async () => {
  const fetch = stubFetch(500, {});
  const api = await loadApi(true);
  expect(await api.renderPolicy()).toEqual(fixture);
  expect(await api.renderPolicy({ ...DEFAULT_FAIR_KNOBS })).toEqual(fixture);
  expect(await api.renderPolicy({ workLimitMin: DEFAULT_FAIR_KNOBS.workLimitMin })).toEqual(fixture);
  expect(fetch).not.toHaveBeenCalled();
});

test("VITE_USE_FIXTURES=true refuses any other knobs", async () => {
  const fetch = stubFetch(500, {});
  const api = await loadApi(true);
  const err = await api.renderPolicy({ workLimitMin: 90, rushHardLimitMin: 90 }).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(api.ApiRequestError);
  expect((err as Error).message).toMatch(/^Rule editing needs the live API/);
  expect(fetch).not.toHaveBeenCalled();
});

test("the render fixture matches the engine for the default knobs (npm run fixtures --workspace web)", () => {
  const text = renderFairPolicy(DEFAULT_FAIR_KNOBS);
  expect(fixture).toEqual({
    knobs: DEFAULT_FAIR_KNOBS,
    text,
    valid: true,
    errors: checkPolicyText(text, policySchema),
    rules: summarizeFairPolicy(DEFAULT_FAIR_KNOBS),
  });
});

// ---- health -------------------------------------------------------------------------------------

test("health calls GET /health", async () => {
  const fetch = stubFetch(200, { status: "ok" });
  const api = await loadApi();
  expect(await api.health()).toEqual({ status: "ok" });
  expect(fetch.mock.calls[0][0]).toBe(`${api.API_URL}/health`);
  expect(fetch.mock.calls[0][1]).toMatchObject({ method: "GET" });
});

test("health says the API is not reachable when fetch fails", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
  const api = await loadApi();
  await expect(api.health()).rejects.toThrow(/Could not reach the HeatGate API/);
});

test("VITE_USE_FIXTURES=true: health answers ok without touching the network", async () => {
  const fetch = stubFetch(500, {});
  const api = await loadApi(true);
  expect(await api.health()).toEqual({ status: "ok" });
  expect(fetch).not.toHaveBeenCalled();
});

// ---- defaults -----------------------------------------------------------------------------------

test("VITE_USE_FIXTURES=true: defaults include the default fairKnobs", async () => {
  stubFetch(500, {});
  const api = await loadApi(true);
  const params = await api.defaults();
  expect(params.fairKnobs).toEqual(DEFAULT_FAIR_KNOBS);
  expect(params).toEqual(defaultsFixture);
});
