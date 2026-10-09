// npm run smoke: start the real server, call every route, check the answers.
// npm run smoke -- --url <ApiUrl>: the same checks against a deployed API (docs/deploy.md); no local server.
// Exits non-zero on any failure. Uses 1 seed and a short day so it finishes fast.
// A deployed audit log already holds other decisions, so there the audit checks use rider ids made for
// this run and only look at the newest entries.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { POLICY_LABELS, type BreakEvenReport, type DecideRequest, type Decision, type SimulationJob } from "@heatgate/contracts";
import { DEFAULT_FAIR_KNOBS } from "@heatgate/engine";
import { WEATHER_DAYS, defaultSimParams, weatherDaySummary } from "@heatgate/sim";

function urlArg(): string | undefined {
  const i = process.argv.indexOf("--url");
  if (i === -1) return undefined;
  const url = process.argv[i + 1];
  if (!url || !/^https?:\/\//.test(url)) {
    console.error("usage: npm run smoke -- --url https://<api-id>.execute-api.ap-south-1.amazonaws.com");
    process.exit(2);
  }
  return url.replace(/\/+$/, "");
}

const REMOTE = urlArg();
const PORT = Number(process.env.SMOKE_PORT ?? 3101); // not 3001, so a running dev server does not clash
const BASE = REMOTE ?? `http://localhost:${PORT}`;
const SIM_TIMEOUT_MS = REMOTE ? 300_000 : 120_000; // the cloud adds cold starts
const POLL_MS = REMOTE ? 2000 : 100;
// Fresh rider ids per run in the cloud (from the clock: no randomness outside sim/rng.ts).
const runTag = String(Date.now()).slice(-7);
const COOL_RIDER = REMOTE ? `R-${runTag}1` : "R-014";
const HOT_RIDER = REMOTE ? `R-${runTag}2` : "R-015";
const DRY_RIDER = REMOTE ? `R-${runTag}9` : "R-099";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === undefined ? "" : `  -> ${JSON.stringify(detail).slice(0, 300)}`}`);
  if (!ok) failures++;
}

// The deployed API is throttled (template.yaml: 10 requests/s, burst 20), so space calls out there.
let lastCall = 0;
async function call(method: string, path: string, body?: unknown, raw?: string) {
  if (REMOTE) {
    await sleep(Math.max(0, lastCall + 150 - Date.now()));
    lastCall = Date.now();
  }
  const res = await fetch(BASE + path, {
    method,
    headers: { "content-type": "application/json", origin: "http://localhost:5173" },
    body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  return { status: res.status, headers: res.headers, json: (await res.json()) as any };
}

const isError = (j: any, code?: string) =>
  typeof j?.error?.code === "string" && typeof j?.error?.message === "string" && (code === undefined || j.error.code === code);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const coolRequest: DecideRequest = {
  policyVersion: "no-rules",
  rider: { id: COOL_RIDER, vehicle: "bike", x: 2, y: 3 },
  order: { id: "order-1", zone: "Z1", distanceKm: 2.2, tripMinutes: 12 },
  conditions: { tempC: 30, humidityPct: 40, hourOfDay: 9, demandLevel: 1, alertLevel: 0 },
  riderState: { minutesSinceBreak: 10, exposureMinutesToday: 10, restMinutesRemaining: 0 },
};
// NDMA on an orange-alert afternoon, break overdue, long trip: three rules fire, FORCE_REST wins.
const hotRequest: DecideRequest = {
  ...coolRequest,
  policyVersion: "ndma-2025",
  rider: { ...coolRequest.rider, id: HOT_RIDER },
  order: { id: "order-2", zone: "Z2", distanceKm: 3.4, tripMinutes: 20 },
  conditions: { tempC: 42, humidityPct: 30, hourOfDay: 14, demandLevel: 2, alertLevel: 1 },
  riderState: { minutesSinceBreak: 80, exposureMinutesToday: 200, restMinutesRemaining: 0 },
};

const SMALL_SIM = { seeds: [1], startHour: 12, endHour: 14, riders: 20 };
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

async function waitForJob(id: string, started = Date.now()): Promise<SimulationJob | undefined> {
  const seen = new Set<string>();
  let job: SimulationJob | undefined;
  while (Date.now() - started < SIM_TIMEOUT_MS) {
    const r = await call("GET", `/simulations/${id}`);
    job = r.json as SimulationJob;
    seen.add(job.status);
    if (r.status !== 200 || job.status === "done" || job.status === "failed") break;
    // The server must keep answering while the run is in progress.
    if ((await call("GET", "/health")).status !== 200) check("server answers during a run", false);
    await sleep(POLL_MS);
  }
  console.log(`      statuses seen while polling: ${[...seen].join(" -> ")} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
  return job;
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`${BASE}/health`)).ok) return;
    } catch {
      // not up yet
    }
    await sleep(200);
  }
  throw new Error("server did not start within 20 s");
}

async function run() {
  // health, CORS, unknown route
  const health = await call("GET", "/health");
  check("GET /health -> 200 { status: ok }", health.status === 200 && health.json.status === "ok", health);
  check("CORS header present", health.headers.get("access-control-allow-origin") === "*", health.headers.get("access-control-allow-origin"));
  const unknown = await call("GET", "/nope");
  check("unknown route -> 404 error body", unknown.status === 404 && isError(unknown.json, "NOT_FOUND"), unknown);

  // policies and defaults
  const policies = await call("GET", "/policies");
  const expectedPolicies = Object.entries(POLICY_LABELS).map(([id, label]) => ({ id, label }));
  check("GET /policies -> the four rule sets with POLICY_LABELS", policies.status === 200 && isDeepStrictEqual(policies.json, expectedPolicies), policies.json);
  const defaults = await call("GET", "/defaults");
  check(
    "GET /defaults -> defaultSimParams() + default fairKnobs",
    defaults.status === 200 && isDeepStrictEqual(defaults.json, { ...defaultSimParams(), fairKnobs: DEFAULT_FAIR_KNOBS }),
    defaults.json,
  );

  // rule knobs: render only (nothing logged, nothing run)
  const committedFair = readFileSync(fileURLToPath(new URL("../../policies/heatgate-fair.cedar", import.meta.url)), "utf8").replace(/\r\n/g, "\n"); // CRLF on a Windows checkout
  const rendered = await call("POST", "/policies/render", { knobs: DEFAULT_FAIR_KNOBS });
  check(
    "POST /policies/render (default knobs) -> the committed heatgate-fair.cedar, valid, 8 rule summaries",
    rendered.status === 200 && rendered.json.text === committedFair && rendered.json.valid === true && rendered.json.rules?.length === 8,
    rendered,
  );
  const tighter = await call("POST", "/policies/render", { knobs: { workLimitMin: 90 } });
  check(
    "POST /policies/render (workLimitMin 90) -> valid, the number changed",
    tighter.status === 200 && tighter.json.valid === true && /tripMinutes > 90\n/.test(tighter.json.text),
    tighter,
  );
  const outOfRange = await call("POST", "/policies/render", { knobs: { restHeatC: 60 } });
  check("POST /policies/render out of range -> 400", outOfRange.status === 400 && isError(outOfRange.json, "INVALID_REQUEST"), outOfRange);
  const rawCedar = await call("POST", "/policies/render", { knobs: {}, text: "permit (principal, action, resource);" });
  check("POST /policies/render with raw Cedar text -> 400", rawCedar.status === 400 && isError(rawCedar.json, "INVALID_REQUEST"), rawCedar);

  // break-even results (sim/results/break-even.json, from npm run sim:breakeven)
  const be = await call("GET", "/break-even");
  const report = be.json as BreakEvenReport;
  check(
    "GET /break-even -> labelled report, 3 demand levels x 2 rule sets, a row per rest pay rate",
    be.status === 200 &&
      /placeholders/.test(report.note) &&
      typeof report.generatedAt === "string" &&
      isDeepStrictEqual(report.levels?.map((l) => l.ordersPerHour), [25, 34, 50]) &&
      report.levels.every((l) =>
        (["union-demand", "heatgate-fair"] as const).every(
          (p) => l.policies[p]?.rows.length === report.restPayRatesInrPerMin.length && ["reached", "notReached"].includes(l.policies[p]!.breakEven.status),
        ),
      ),
    be,
  );
  check("GET /break-even is not stale (else run npm run sim:breakeven and commit the file)", report.stale === false, { stale: report.stale, params: report.params });

  // decide
  const cool = await call("POST", "/decide", coolRequest);
  const c = cool.json as Decision;
  check(
    "POST /decide (cool, no-rules) -> ALLOW",
    cool.status === 200 && c.outcome === "ALLOW" && c.riderId === COOL_RIDER && c.policyVersion === "no-rules" && typeof c.decisionId === "string",
    cool.json,
  );
  check("Decision has no rider location", !("x" in c) && !("y" in c) && !("x" in c.cedarContext) && !("y" in c.cedarContext), c);
  const hot = await call("POST", "/decide", hotRequest);
  const h = hot.json as Decision;
  check(
    "POST /decide (hot, ndma-2025) -> FORCE_REST 15 min, winner first, penalty waived",
    hot.status === 200 &&
      h.outcome === "FORCE_REST" &&
      h.restMinutes === 15 &&
      h.firedRules[0] === "ndma-break-due" &&
      h.firedRules.length === 3 &&
      h.penaltyWaived === true &&
      h.cedarContext.distanceKm === 4,
    hot.json,
  );
  check(
    "FORCE_REST names the nearest cooling point and has the message in hi, te, ur",
    typeof h.coolingPoint?.name === "string" && typeof h.coolingPoint?.distanceM === "number" && Boolean(h.messages?.hi && h.messages?.te && h.messages?.ur),
    h,
  );
  const dry = await call("POST", "/decide", { ...coolRequest, rider: { ...coolRequest.rider, id: DRY_RIDER }, dryRun: true });
  check("POST /decide dryRun -> 200", dry.status === 200 && dry.json.outcome === "ALLOW", dry);
  const named = await call("POST", "/decide", { ...coolRequest, rider: { ...coolRequest.rider, id: "Ravi Kumar" } });
  check("POST /decide with a real name as rider id -> 400", named.status === 400 && isError(named.json, "INVALID_REQUEST"), named);
  const missing = await call("POST", "/decide", { policyVersion: "ndma-2025" });
  check("POST /decide missing fields -> 400", missing.status === 400 && isError(missing.json, "INVALID_REQUEST"), missing);
  const badJson = await call("POST", "/decide", undefined, "{not json");
  check("POST /decide bad JSON -> 400", badJson.status === 400 && isError(badJson.json, "INVALID_JSON"), badJson);

  // audit
  // Locally the log holds exactly these two; in the cloud they must be the newest (run when nobody else calls).
  const only = (items: unknown[], n: number) => REMOTE !== undefined || items.length === n;
  const all = await call("GET", "/audit");
  check(
    `GET /audit -> ${REMOTE ? "the 2 newest are ours" : "2 logged decisions"}, newest first`,
    all.status === 200 && only(all.json.items, 2) && all.json.items[0]?.riderId === HOT_RIDER && all.json.items[1]?.riderId === COOL_RIDER,
    all.json,
  );
  const loggedHot = all.json.items?.find((d: Decision) => d.riderId === HOT_RIDER);
  check(
    "Audit entry keeps the messages but no cooling point or position",
    loggedHot !== undefined && loggedHot.messages?.hi === h.messages?.hi && !("coolingPoint" in loggedHot) && !("x" in loggedHot) && !("y" in loggedHot),
    loggedHot,
  );
  const dryLogged = await call("GET", `/audit?rider=${DRY_RIDER}`);
  check("dryRun not logged", dryLogged.status === 200 && dryLogged.json.items.length === 0, dryLogged.json);
  const byRider = await call("GET", `/audit?rider=${COOL_RIDER}`);
  check(`GET /audit?rider=${COOL_RIDER}`, byRider.status === 200 && byRider.json.items.length === 1 && byRider.json.items[0].riderId === COOL_RIDER, byRider.json);
  const byOutcome = await call("GET", "/audit?outcome=FORCE_REST");
  check(
    "GET /audit?outcome=FORCE_REST",
    byOutcome.status === 200 &&
      only(byOutcome.json.items, 1) &&
      byOutcome.json.items[0]?.riderId === HOT_RIDER &&
      byOutcome.json.items.every((d: Decision) => d.outcome === "FORCE_REST"),
    byOutcome.json,
  );
  const byPolicy = await call("GET", "/audit?policy=no-rules");
  check(
    "GET /audit?policy=no-rules",
    byPolicy.status === 200 &&
      only(byPolicy.json.items, 1) &&
      byPolicy.json.items[0]?.riderId === COOL_RIDER &&
      byPolicy.json.items.every((d: Decision) => d.policyVersion === "no-rules"),
    byPolicy.json,
  );
  const page1 = await call("GET", "/audit?limit=1");
  const page2 = await call("GET", `/audit?limit=1&cursor=${encodeURIComponent(page1.json.nextCursor)}`);
  check(
    "GET /audit paging (limit=1, then cursor)",
    page1.json.items.length === 1 &&
      typeof page1.json.nextCursor === "string" &&
      page2.json.items.length === 1 &&
      page2.json.items[0].decisionId !== page1.json.items[0].decisionId &&
      (REMOTE !== undefined || page2.json.nextCursor === undefined),
    { page1: page1.json, page2: page2.json },
  );
  const badOutcome = await call("GET", "/audit?outcome=MAYBE");
  check("GET /audit?outcome=MAYBE -> 400", badOutcome.status === 400 && isError(badOutcome.json, "INVALID_REQUEST"), badOutcome);

  // real weather days (sim/data/weather, committed)
  const days = await call("GET", "/weather-days");
  check(
    "GET /weather-days -> every committed day with peak temperature, peak heat index and source",
    days.status === 200 && isDeepStrictEqual(days.json, WEATHER_DAYS.map(weatherDaySummary)),
    days.json,
  );
  const badDay = await call("POST", "/simulations", { weather: { kind: "replay", weatherDayId: "atlantis-2024-01-01" } });
  check("POST /simulations unknown weather day -> 400", badDay.status === 400 && isError(badDay.json, "INVALID_REQUEST"), badDay);

  // simulations
  const badSim = await call("POST", "/simulations", { startHour: 14, endHour: 12 });
  check("POST /simulations invalid hours -> 400", badSim.status === 400 && isError(badSim.json, "INVALID_REQUEST"), badSim);
  const badKnobs = await call("POST", "/simulations", { fairKnobs: { workLimitMin: 59 } });
  check("POST /simulations fairKnobs out of range -> 400", badKnobs.status === 400 && isError(badKnobs.json, "INVALID_REQUEST"), badKnobs);
  const notFound = await call("GET", "/simulations/sim-does-not-exist");
  check("GET /simulations/<unknown> -> 404 error body", notFound.status === 404 && isError(notFound.json, "NOT_FOUND"), notFound);

  const started = Date.now();
  const sim = await call("POST", "/simulations", SMALL_SIM);
  check(
    "POST /simulations -> 202 { simulationId, status: queued }",
    sim.status === 202 && typeof sim.json.simulationId === "string" && sim.json.status === "queued" && Object.keys(sim.json).length === 2,
    sim,
  );
  const job = await waitForJob(sim.json.simulationId, started);
  check("GET /simulations/:id reaches done", job?.status === "done", job && { ...job, result: undefined });
  const runs = job?.result?.runs ?? {};
  check(
    "SimResult has all four rule sets, with metrics, ranges and frames",
    job?.result?.simulationId === sim.json.simulationId &&
      Object.keys(POLICY_LABELS).every((p) => {
        const run = runs[p as keyof typeof runs];
        return run !== undefined && typeof run.metrics.ordersTotal === "number" && run.range.ordersTotal !== undefined && run.frames.length > 0;
      }),
    Object.keys(runs),
  );
  check(
    "SimResult params = defaults + overrides (1 seed, 12-14 h, 20 riders)",
    isDeepStrictEqual(job?.result?.params, defaultSimParams({ seeds: [1], startHour: 12, endHour: 14, riders: 20 })),
    job?.result?.params,
  );
  check("done job has finishedAt, no error", typeof job?.finishedAt === "string" && job?.error === undefined, job && { ...job, result: undefined });

  // The run's audit trail: tagged with the simulationId, rider ids that match the frames.
  const simId = sim.json.simulationId as string;
  const trail = await call("GET", `/audit?simulationId=${encodeURIComponent(simId)}&limit=200`);
  const items = (trail.json.items ?? []) as Decision[];
  check(
    "GET /audit?simulationId=<id> -> entries from that run, simulated time",
    trail.status === 200 && items.length > 0 && items.every((d) => d.simulationId === simId && d.at.startsWith("2026-05-20T1")),
    trail.json,
  );
  const frameRider = runs["ndma-2025"]?.frames.find((f) => f.riders.length > 0)?.riders[0].id;
  const riderTrail = frameRider && (await call("GET", `/audit?simulationId=${encodeURIComponent(simId)}&rider=${frameRider}`));
  check(
    `a rider id from a frame (${frameRider}) has at least one audit entry`,
    !!riderTrail && riderTrail.status === 200 && riderTrail.json.items.length > 0 && riderTrail.json.items.every((d: Decision) => d.riderId === frameRider),
    riderTrail && riderTrail.json,
  );

  // rule knobs in a simulation: default knobs repeat the plain run exactly; changed knobs change Fair only.
  const withDefaults = await call("POST", "/simulations", { ...SMALL_SIM, fairKnobs: DEFAULT_FAIR_KNOBS });
  const defJob = withDefaults.status === 202 ? await waitForJob(withDefaults.json.simulationId) : undefined;
  check(
    "POST /simulations with default fairKnobs -> done, same runs hash as no knobs",
    defJob?.status === "done" && hash(defJob.result?.runs) === hash(job?.result?.runs),
    withDefaults.status === 202 ? defJob && { ...defJob, result: undefined } : withDefaults,
  );
  const withKnobs = await call("POST", "/simulations", { ...SMALL_SIM, fairKnobs: { shortTripHeatC: 36, shortTripMaxKm: 1 } });
  const knobJob = withKnobs.status === 202 ? await waitForJob(withKnobs.json.simulationId) : undefined;
  const kr = knobJob?.result?.runs;
  check(
    "POST /simulations with changed fairKnobs -> done, other rule sets unchanged, heatgate-fair changed",
    knobJob?.status === "done" &&
      (["no-rules", "ndma-2025", "union-demand"] as const).every((p) => hash(kr?.[p]) === hash(runs[p])) &&
      hash(kr?.["heatgate-fair"]) !== hash(runs["heatgate-fair"]),
    withKnobs.status === 202 ? knobJob && { ...knobJob, result: undefined } : withKnobs,
  );

  // A real hot day: the same seed and hours on Lucknow's 29 May 2024 changes the runs; asking twice gives the same runs.
  const replay = { ...SMALL_SIM, weather: { kind: "replay", weatherDayId: "lucknow-2024-05-29" } };
  const [r1, r2] = [await call("POST", "/simulations", replay), await call("POST", "/simulations", replay)];
  const [j1, j2] = [r1, r2].map((r) => (r.status === 202 ? waitForJob(r.json.simulationId) : undefined));
  const [replayJob, replayJob2] = [await j1, await j2];
  check(
    "POST /simulations with a weather day -> done, params echo the day, runs differ from the slider day, same runs twice",
    replayJob?.status === "done" &&
      isDeepStrictEqual(replayJob.result?.params.weather, replay.weather) &&
      hash(replayJob.result?.runs) !== hash(runs) &&
      hash(replayJob.result?.runs) === hash(replayJob2?.result?.runs),
    r1.status === 202 ? replayJob && { ...replayJob, result: undefined } : r1,
  );
}

// Locally: the in-memory store, whatever STORE is set to in this shell.
const server = REMOTE
  ? undefined
  : spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("../src/index.ts", import.meta.url))], {
      env: { ...process.env, PORT: String(PORT), STORE: "memory" },
      stdio: ["ignore", "inherit", "inherit"],
    });
let code = 1;
try {
  console.log(`smoke: ${BASE}${REMOTE ? " (deployed API)" : ""}`);
  await waitForServer();
  await run();
  code = failures === 0 ? 0 : 1;
  console.log(failures === 0 ? "\nsmoke: all checks passed" : `\nsmoke: ${failures} check(s) FAILED`);
} catch (err) {
  console.error("smoke: crashed:", err);
} finally {
  server?.kill();
}
process.exit(code);
