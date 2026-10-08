// npm run smoke: start the real server, call every route, check the answers.
// Exits non-zero on any failure. Uses 1 seed and a short day so it finishes fast.
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import { POLICY_LABELS, type DecideRequest, type Decision, type SimulationJob } from "@heatgate/contracts";
import { defaultSimParams } from "@heatgate/sim";

const PORT = Number(process.env.SMOKE_PORT ?? 3101); // not 3001, so a running dev server does not clash
const BASE = `http://localhost:${PORT}`;
const SIM_TIMEOUT_MS = 120_000;

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok || detail === undefined ? "" : `  -> ${JSON.stringify(detail).slice(0, 300)}`}`);
  if (!ok) failures++;
}

async function call(method: string, path: string, body?: unknown, raw?: string) {
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
  rider: { id: "R-014", vehicle: "bike", x: 2, y: 3 },
  order: { id: "order-1", zone: "Z1", distanceKm: 2.2, tripMinutes: 12 },
  conditions: { tempC: 30, humidityPct: 40, hourOfDay: 9, demandLevel: 1, alertLevel: 0 },
  riderState: { minutesSinceBreak: 10, exposureMinutesToday: 10, restMinutesRemaining: 0 },
};
// NDMA on an orange-alert afternoon, break overdue, long trip: three rules fire, FORCE_REST wins.
const hotRequest: DecideRequest = {
  ...coolRequest,
  policyVersion: "ndma-2025",
  rider: { ...coolRequest.rider, id: "R-015" },
  order: { id: "order-2", zone: "Z2", distanceKm: 3.4, tripMinutes: 20 },
  conditions: { tempC: 42, humidityPct: 30, hourOfDay: 14, demandLevel: 2, alertLevel: 1 },
  riderState: { minutesSinceBreak: 80, exposureMinutesToday: 200, restMinutesRemaining: 0 },
};

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
  check("GET /defaults -> defaultSimParams()", defaults.status === 200 && isDeepStrictEqual(defaults.json, defaultSimParams()), defaults.json);

  // decide
  const cool = await call("POST", "/decide", coolRequest);
  const c = cool.json as Decision;
  check(
    "POST /decide (cool, no-rules) -> ALLOW",
    cool.status === 200 && c.outcome === "ALLOW" && c.riderId === "R-014" && c.policyVersion === "no-rules" && typeof c.decisionId === "string",
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
  const dry = await call("POST", "/decide", { ...coolRequest, rider: { ...coolRequest.rider, id: "R-099" }, dryRun: true });
  check("POST /decide dryRun -> 200", dry.status === 200 && dry.json.outcome === "ALLOW", dry);
  const named = await call("POST", "/decide", { ...coolRequest, rider: { ...coolRequest.rider, id: "Ravi Kumar" } });
  check("POST /decide with a real name as rider id -> 400", named.status === 400 && isError(named.json, "INVALID_REQUEST"), named);
  const missing = await call("POST", "/decide", { policyVersion: "ndma-2025" });
  check("POST /decide missing fields -> 400", missing.status === 400 && isError(missing.json, "INVALID_REQUEST"), missing);
  const badJson = await call("POST", "/decide", undefined, "{not json");
  check("POST /decide bad JSON -> 400", badJson.status === 400 && isError(badJson.json, "INVALID_JSON"), badJson);

  // audit
  const all = await call("GET", "/audit");
  check(
    "GET /audit -> 2 logged decisions, newest first, dryRun not logged",
    all.status === 200 && all.json.items.length === 2 && all.json.items[0].riderId === "R-015" && all.json.items[1].riderId === "R-014",
    all.json,
  );
  const byRider = await call("GET", "/audit?rider=R-014");
  check("GET /audit?rider=R-014", byRider.status === 200 && byRider.json.items.length === 1 && byRider.json.items[0].riderId === "R-014", byRider.json);
  const byOutcome = await call("GET", "/audit?outcome=FORCE_REST");
  check("GET /audit?outcome=FORCE_REST", byOutcome.status === 200 && byOutcome.json.items.length === 1 && byOutcome.json.items[0].outcome === "FORCE_REST", byOutcome.json);
  const byPolicy = await call("GET", "/audit?policy=no-rules");
  check("GET /audit?policy=no-rules", byPolicy.status === 200 && byPolicy.json.items.length === 1 && byPolicy.json.items[0].policyVersion === "no-rules", byPolicy.json);
  const page1 = await call("GET", "/audit?limit=1");
  const page2 = await call("GET", `/audit?limit=1&cursor=${encodeURIComponent(page1.json.nextCursor)}`);
  check(
    "GET /audit paging (limit=1, then cursor)",
    page1.json.items.length === 1 &&
      typeof page1.json.nextCursor === "string" &&
      page2.json.items.length === 1 &&
      page2.json.items[0].decisionId !== page1.json.items[0].decisionId &&
      page2.json.nextCursor === undefined,
    { page1: page1.json, page2: page2.json },
  );
  const badOutcome = await call("GET", "/audit?outcome=MAYBE");
  check("GET /audit?outcome=MAYBE -> 400", badOutcome.status === 400 && isError(badOutcome.json, "INVALID_REQUEST"), badOutcome);

  // simulations
  const badSim = await call("POST", "/simulations", { startHour: 14, endHour: 12 });
  check("POST /simulations invalid hours -> 400", badSim.status === 400 && isError(badSim.json, "INVALID_REQUEST"), badSim);
  const notFound = await call("GET", "/simulations/sim-does-not-exist");
  check("GET /simulations/<unknown> -> 404 error body", notFound.status === 404 && isError(notFound.json, "NOT_FOUND"), notFound);

  const started = Date.now();
  const sim = await call("POST", "/simulations", { seeds: [1], startHour: 12, endHour: 14, riders: 20 });
  check(
    "POST /simulations -> 202 { simulationId, status: queued }",
    sim.status === 202 && typeof sim.json.simulationId === "string" && sim.json.status === "queued" && Object.keys(sim.json).length === 2,
    sim,
  );
  const seen = new Set<string>();
  let job: SimulationJob | undefined;
  while (Date.now() - started < SIM_TIMEOUT_MS) {
    const r = await call("GET", `/simulations/${sim.json.simulationId}`);
    job = r.json as SimulationJob;
    seen.add(job.status);
    if (r.status !== 200 || job.status === "done" || job.status === "failed") break;
    // The server must keep answering while the run is in progress.
    if ((await call("GET", "/health")).status !== 200) check("server answers during a run", false);
    await sleep(100);
  }
  console.log(`      statuses seen while polling: ${[...seen].join(" -> ")} (${((Date.now() - started) / 1000).toFixed(1)} s)`);
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
}

const server = spawn(process.execPath, ["--import", "tsx", fileURLToPath(new URL("../src/index.ts", import.meta.url))], {
  env: { ...process.env, PORT: String(PORT) },
  stdio: ["ignore", "inherit", "inherit"],
});
let code = 1;
try {
  await waitForServer();
  await run();
  code = failures === 0 ? 0 : 1;
  console.log(failures === 0 ? "\nsmoke: all checks passed" : `\nsmoke: ${failures} check(s) FAILED`);
} catch (err) {
  console.error("smoke: crashed:", err);
} finally {
  server.kill();
}
process.exit(code);
