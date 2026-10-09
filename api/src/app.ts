// The HeatGate HTTP API. Errors are always { error: { code, message } }.
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import cors from "cors";
import express, { type ErrorRequestHandler, type Request } from "express";
import { POLICY_LABELS, type ApiError, type BreakEvenReport, type Decision } from "@heatgate/contracts";
import { DEFAULT_FAIR_KNOBS, checkPolicyText, decide, newDecisionId, policySchema, renderFairPolicy, summarizeFairPolicy } from "@heatgate/engine";
import { WEATHER_DAYS, cityLayout, defaultSimParams, weatherDaySummary } from "@heatgate/sim";
import { BadCursorError, MAX_ACTIVE_SIMULATIONS, SIMULATION_STALE_MS, type AuditFilter, type Store } from "../store/types.ts";
import { SimulationQueue, workerRunner, type SimRunner, type SimulationSubmitter } from "./simulations.ts";
import { ApiFailure, OUTCOMES, POLICY_VERSIONS, decideRequest, renderRequest, riderId, simParams, simulationId } from "./validate.ts";

export interface AppOptions {
  store: Store;
  runSimulation?: SimRunner; // default: worker thread
  simulations?: SimulationSubmitter; // default: an in-process SimulationQueue using runSimulation
  breakEvenPath?: string; // default: sim/results/break-even.json (npm run sim:breakeven)
}

export const BREAK_EVEN_FILE = fileURLToPath(new URL("../../sim/results/break-even.json", import.meta.url));

// The demo city's 8 cooling points (sim/city.ts), the same ones the simulator sends resting riders to.
const COOLING_POINTS = cityLayout().coolingPoints;

const errorBody = (code: string, message: string): ApiError => ({ error: { code, message } });

function query(req: Request, name: string): string | undefined {
  const v = req.query[name];
  if (v === undefined) return undefined;
  if (typeof v !== "string") throw new ApiFailure(400, "INVALID_REQUEST", `${name} must be given once`);
  return v;
}

export function createApp({ store, runSimulation = workerRunner, simulations, breakEvenPath = BREAK_EVEN_FILE }: AppOptions) {
  const app = express();
  const jobs = simulations ?? new SimulationQueue(store, runSimulation);

  app.use(cors());
  app.use(express.json({ limit: "100kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/policies", (_req, res) => {
    res.json(POLICY_VERSIONS.map((id) => ({ id, label: POLICY_LABELS[id] })));
  });

  // The real hot days a simulation can replay (sim/data/weather, committed; nothing is fetched).
  // Send an id as weather: { kind: "replay", weatherDayId } to POST /simulations.
  app.get("/weather-days", (_req, res) => {
    res.json(WEATHER_DAYS.map(weatherDaySummary));
  });

  // Default SimParams plus the default heatgate-fair knobs, so the sandbox sliders start at the right values.
  // Sending these knobs back gives the same result as sending none.
  app.get("/defaults", (_req, res) => {
    res.json({ ...defaultSimParams(), fairKnobs: DEFAULT_FAIR_KNOBS });
  });

  // heatgate-fair rendered from number knobs, checked against the schema. Nothing is logged or run.
  app.post("/policies/render", (req, res) => {
    const knobs = renderRequest(req.body);
    const text = renderFairPolicy(knobs);
    const errors = checkPolicyText(text, policySchema);
    res.json({ knobs, text, valid: errors.length === 0, errors, rules: summarizeFairPolicy(knobs) });
  });

  // The committed break-even sweep. All rupee amounts are placeholders from interview-pending economics.
  // Read on every request so a re-run of npm run sim:breakeven shows up without a restart. stale: the file
  // was made with params that differ from today's defaults, so re-run the sweep before quoting it.
  app.get("/break-even", async (_req, res) => {
    let text: string;
    try {
      text = await readFile(breakEvenPath, "utf8");
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      throw new ApiFailure(404, "NOT_FOUND", "No break-even results yet: run npm run sim:breakeven");
    }
    let report: BreakEvenReport;
    try {
      report = JSON.parse(text);
    } catch {
      throw new ApiFailure(500, "INVALID_RESULTS", "The break-even results file is not valid JSON: run npm run sim:breakeven");
    }
    // Compare as JSON, which is how the params were written.
    const defaults = JSON.parse(JSON.stringify(defaultSimParams()));
    const body: BreakEvenReport = { ...report, stale: !isDeepStrictEqual(report.params, defaults) };
    res.json(body);
  });

  app.post("/decide", async (req, res) => {
    const request = decideRequest(req.body);
    // The rider's position (request.rider.x, y) picks the nearest cooling point for a FORCE_REST. The response
    // carries it; the audit log does not (the store writes auditRecord(decision)).
    const decision: Decision = decide(request, request.policyVersion, new Date(), undefined, COOLING_POINTS);
    // dryRun = true means do not write to the audit log (contracts/types.ts).
    if (!request.dryRun) await store.putDecision(decision);
    res.json(decision);
  });

  app.post("/simulations", async (req, res) => {
    const params = simParams(req.body);
    // Knobs are range-checked already; still never queue a run whose rendered rules fail the schema.
    if (params.fairKnobs) {
      const errors = checkPolicyText(renderFairPolicy(params.fairKnobs), policySchema);
      if (errors.length > 0) throw new ApiFailure(400, "INVALID_POLICY", `fairKnobs give rules that fail the schema check: ${errors.join("; ")}`);
    }
    // A cheap guard against runaway cost in the cloud (each job is its own Lambda run). Not atomic: two
    // requests at the same moment can both pass.
    const active = await store.countActiveSimulations(new Date(Date.now() - SIMULATION_STALE_MS));
    if (active >= MAX_ACTIVE_SIMULATIONS) {
      throw new ApiFailure(429, "TOO_MANY_RUNNING", `${active} simulations are already queued or running; try again when one has finished`);
    }
    const job = await jobs.submit(`sim-${newDecisionId(new Date())}`, params);
    res.status(202).json({ simulationId: job.simulationId, status: job.status });
  });

  app.get("/simulations/:id", async (req, res) => {
    const job = await store.getSimulation(req.params.id);
    if (!job) throw new ApiFailure(404, "NOT_FOUND", `No simulation with id ${req.params.id}`);
    res.json(job);
  });

  app.get("/audit", async (req, res) => {
    const filter: AuditFilter = {};
    const rider = query(req, "rider");
    const outcome = query(req, "outcome");
    const policy = query(req, "policy");
    const simId = query(req, "simulationId");
    if (rider !== undefined) filter.riderId = riderId(rider, "rider");
    if (outcome !== undefined) {
      if (!OUTCOMES.includes(outcome as never)) throw new ApiFailure(400, "INVALID_REQUEST", `outcome must be one of ${OUTCOMES.join(", ")}`);
      filter.outcome = outcome as AuditFilter["outcome"];
    }
    if (policy !== undefined) {
      if (!POLICY_VERSIONS.includes(policy as never)) {
        throw new ApiFailure(400, "INVALID_REQUEST", `policy must be one of ${POLICY_VERSIONS.join(", ")}`);
      }
      filter.policyVersion = policy as AuditFilter["policyVersion"];
    }
    if (simId !== undefined) filter.simulationId = simulationId(simId, "simulationId");
    const limitText = query(req, "limit") ?? "50";
    const limit = Number(limitText);
    if (!/^\d+$/.test(limitText) || limit < 1 || limit > 200) {
      throw new ApiFailure(400, "INVALID_REQUEST", "limit must be a whole number from 1 to 200");
    }
    res.json(await store.listDecisions(filter, { limit, cursor: query(req, "cursor") }));
  });

  app.use((req, res) => {
    res.status(404).json(errorBody("NOT_FOUND", `No route for ${req.method} ${req.path}`));
  });

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof ApiFailure) {
      res.status(err.status).json(errorBody(err.code, err.message));
    } else if (err instanceof BadCursorError) {
      res.status(400).json(errorBody("INVALID_REQUEST", err.message));
    } else if (err?.type === "entity.parse.failed") {
      res.status(400).json(errorBody("INVALID_JSON", "Request body is not valid JSON"));
    } else if (err?.type === "entity.too.large") {
      res.status(413).json(errorBody("TOO_LARGE", "Request body is too large"));
    } else {
      console.error(err);
      res.status(500).json(errorBody("INTERNAL", "Something went wrong"));
    }
  };
  app.use(onError);

  return app;
}
