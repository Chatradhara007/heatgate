// The ONLY file in the web app that talks to the network. Pages and components use the hooks
// in src/hooks/, which call these functions. Never call fetch anywhere else.
//
// VITE_API_URL      where the API runs (default http://localhost:3001)
// VITE_USE_FIXTURES "true" = return the JSON in web/fixtures/ and never touch the network
import type {
  ApiError,
  BreakEvenReport,
  DecideRequest,
  Decision,
  FairKnobs,
  Outcome,
  PolicyVersion,
  SimParams,
  SimResult,
  SimulationJob,
  SimulationStatus,
} from "@heatgate/contracts";

export const API_URL: string = (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/+$/, "");
export const USE_FIXTURES: boolean = import.meta.env.VITE_USE_FIXTURES === "true";

export const POLL_INTERVAL_MS = 1_000;
export const SIMULATION_TIMEOUT_MS = 120_000;

// Response shapes that are not in contracts/types.ts. They mirror api/src/app.ts and api/store/types.ts.
export interface PolicyInfo {
  id: PolicyVersion;
  label: string;
}

// GET /health.
export interface HealthStatus {
  status: "ok";
}

// GET /defaults: SimParams plus the default heatgate-fair knobs (always present here, optional in SimParams).
export type Defaults = SimParams & { fairKnobs: FairKnobs };

// One plain-language line per heatgate-fair rule, in file order. Mirrors FairRuleSummary in engine/src/fairKnobs.ts.
// NO_PENALTY is not a decision outcome: it marks the decline-without-penalty rule.
export interface FairRuleSummary {
  id: string;
  outcome: Outcome | "NO_PENALTY";
  summary: string;
}

// POST /policies/render: heatgate-fair rendered from knobs. Nothing is logged or run.
export interface RenderedPolicy {
  knobs: FairKnobs; // every knob, missing ones filled with their default
  text: string; // the Cedar policy text
  valid: boolean; // passes the Cedar schema check
  errors: string[]; // why not, when valid is false
  rules: FairRuleSummary[];
}

export interface AuditQuery {
  rider?: string; // pseudonymous ID like "rider-014"
  outcome?: Outcome;
  policy?: PolicyVersion;
  simulationId?: string; // only decisions logged by this simulation run
  limit?: number; // 1-200, default 50
  cursor?: string; // nextCursor from the previous page
}

export interface AuditPage {
  items: Decision[]; // newest first
  nextCursor?: string;
}

// React key / Map key for one audit row. Decision ids repeat across simulations, so a row is only
// unique by simulationId plus decisionId. Rows from live /decide calls have no simulationId.
// Simulation ids are letters, digits and dashes, so ":" cannot appear inside one.
export function auditRowKey(d: Pick<Decision, "simulationId" | "decisionId">): string {
  return `${d.simulationId ?? ""}:${d.decisionId}`;
}

export interface SimulationAccepted {
  simulationId: string;
  status: SimulationStatus;
}

// ---- errors -------------------------------------------------------------------------------------

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number, // HTTP status, when the server answered
    readonly code?: string, // error.code from the API body
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function isApiError(body: unknown): body is ApiError {
  const e = (body as ApiError | null)?.error;
  return typeof e?.code === "string" && typeof e?.message === "string";
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (signal?.aborted) throw err;
    throw new ApiRequestError(`Could not reach the HeatGate API at ${API_URL}. Is it running?`);
  }
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = undefined;
  }
  if (!res.ok) {
    if (isApiError(json)) throw new ApiRequestError(`${json.error.message} (${json.error.code})`, res.status, json.error.code);
    throw new ApiRequestError(`The API answered ${method} ${path} with HTTP ${res.status}`, res.status);
  }
  if (json === undefined) throw new ApiRequestError(`The API sent an empty or non-JSON answer to ${method} ${path}`, res.status);
  return json as T;
}

// ---- fixtures (VITE_USE_FIXTURES=true) ---------------------------------------------------------
// Loaded lazily so they stay out of the main bundle.

const fixtures = {
  policies: async () => (await import("../fixtures/policies.json")).default as PolicyInfo[],
  defaults: async () => (await import("../fixtures/defaults.json")).default as unknown as Defaults,
  renderPolicy: async () => (await import("../fixtures/renderPolicy.json")).default as unknown as RenderedPolicy,
  audit: async () => (await import("../fixtures/audit.json")).default as unknown as AuditPage,
  decide: async () => (await import("../fixtures/decide.json")).default as unknown as AuditPage, // full POST /decide answers
  simResult: async () => (await import("../fixtures/simResult.json")).default as unknown as SimResult,
  breakEven: async () => (await import("../fixtures/breakEven.json")).default as unknown as BreakEvenReport,
};

async function fixtureDecision(req: DecideRequest): Promise<Decision> {
  const { items } = await fixtures.decide();
  const match = items.find((d) => d.policyVersion === req.policyVersion) ?? items[0];
  return { ...match, riderId: req.rider.id, orderId: req.order.id, policyVersion: req.policyVersion, simulationId: req.simulationId };
}

// ---- the API -----------------------------------------------------------------------------------

// GET /policies: the four rule sets with their on-screen labels.
export async function policies(signal?: AbortSignal): Promise<PolicyInfo[]> {
  if (USE_FIXTURES) return fixtures.policies();
  return request("GET", "/policies", undefined, signal);
}

// GET /health: { status: "ok" } when the API is up. Fixture mode answers ok without the network.
export async function health(signal?: AbortSignal): Promise<HealthStatus> {
  if (USE_FIXTURES) return { status: "ok" };
  return request("GET", "/health", undefined, signal);
}

// GET /defaults: the default SimParams plus fairKnobs, the starting point for the Simulator sliders.
export async function defaults(signal?: AbortSignal): Promise<Defaults> {
  if (USE_FIXTURES) return fixtures.defaults();
  return request("GET", "/defaults", undefined, signal);
}

// POST /policies/render: the heatgate-fair rules for these knobs. Missing knobs take their default; the API
// answers 400 INVALID_REQUEST for out-of-range or unknown knobs. Fixture mode has the default knobs only.
export async function renderPolicy(knobs: Partial<FairKnobs> = {}, signal?: AbortSignal): Promise<RenderedPolicy> {
  if (USE_FIXTURES) {
    const rendered = await fixtures.renderPolicy();
    const isDefault = Object.entries(knobs).every(([k, v]) => v === undefined || rendered.knobs[k as keyof FairKnobs] === v);
    if (!isDefault) throw new ApiRequestError("Rule editing needs the live API: fixture mode only has the default knobs.");
    return rendered;
  }
  return request("POST", "/policies/render", { knobs }, signal);
}

// POST /decide: one decision. Logged to the audit log unless req.dryRun is true.
export async function decide(req: DecideRequest, signal?: AbortSignal): Promise<Decision> {
  if (USE_FIXTURES) return fixtureDecision(req);
  return request("POST", "/decide", req, signal);
}

// GET /audit: logged decisions, newest first, one page at a time. query.simulationId narrows it to one run.
export async function audit(query: AuditQuery = {}, signal?: AbortSignal): Promise<AuditPage> {
  if (USE_FIXTURES) {
    const page = await fixtures.audit();
    const items = page.items.filter(
      (d) =>
        (query.rider === undefined || d.riderId === query.rider) &&
        (query.outcome === undefined || d.outcome === query.outcome) &&
        (query.policy === undefined || d.policyVersion === query.policy) &&
        (query.simulationId === undefined || d.simulationId === query.simulationId),
    );
    return { items: items.slice(0, query.limit ?? 50) };
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined) qs.set(k, String(v));
  const search = qs.toString();
  return request("GET", search ? `/audit?${search}` : "/audit", undefined, signal);
}

// POST /simulations: starts a simulation. The API answers 202 with a simulationId.
export async function createSimulation(params: SimParams, signal?: AbortSignal): Promise<SimulationAccepted> {
  if (USE_FIXTURES) return { simulationId: (await fixtures.simResult()).simulationId, status: "queued" };
  return request("POST", "/simulations", params, signal);
}

// GET /simulations/:id: the job, with its result once status is "done".
export async function getSimulation(simulationId: string, signal?: AbortSignal): Promise<SimulationJob> {
  if (USE_FIXTURES) {
    const result = await fixtures.simResult();
    const now = new Date().toISOString();
    return { simulationId, status: "done", createdAt: now, finishedAt: now, result: { ...result, simulationId } };
  }
  return request("GET", `/simulations/${encodeURIComponent(simulationId)}`, undefined, signal);
}

// GET /break-even: the committed break-even rest pay sweep (sim/results/break-even.json), with stale = true
// when it was made with params other than today's defaults. All rupee amounts are placeholders from
// interview-pending economics. The API answers 404 NOT_FOUND if the file has not been generated.
export async function breakEven(signal?: AbortSignal): Promise<BreakEvenReport> {
  if (USE_FIXTURES) {
    const [report, { fairKnobs: _, ...params }] = await Promise.all([fixtures.breakEven(), fixtures.defaults()]);
    // Like the API: compare with defaultSimParams(), which has no fairKnobs. Both fixtures come from it, so the key order matches.
    return { ...report, stale: JSON.stringify(report.params) !== JSON.stringify(params) };
  }
  return request("GET", "/break-even", undefined, signal);
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(signal.reason);
    }, { once: true });
  });

// Polls GET /simulations/:id every second until the job is done or failed (120 s timeout).
// Returns the finished result; throws on failure or timeout. onStatus sees every poll.
export async function waitForSimulation(
  simulationId: string,
  opts: { signal?: AbortSignal; onStatus?: (job: SimulationJob) => void } = {},
): Promise<SimResult> {
  const deadline = Date.now() + SIMULATION_TIMEOUT_MS;
  for (;;) {
    const job = await getSimulation(simulationId, opts.signal);
    opts.onStatus?.(job);
    if (job.status === "done") {
      if (!job.result) throw new ApiRequestError(`Simulation ${simulationId} finished without a result`);
      return job.result;
    }
    if (job.status === "failed") {
      const e = job.error;
      throw new ApiRequestError(
        e ? `Simulation failed: ${e.message} (${e.code})` : `Simulation ${simulationId} failed`,
        undefined,
        e?.code,
      );
    }
    if (Date.now() + POLL_INTERVAL_MS > deadline) {
      throw new ApiRequestError(`Simulation ${simulationId} did not finish within ${SIMULATION_TIMEOUT_MS / 1000} seconds`);
    }
    await sleep(POLL_INTERVAL_MS, opts.signal);
  }
}
