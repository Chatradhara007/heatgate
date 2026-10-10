// Hand-written request checks. Each returns the clean value or throws ApiFailure (400).
import {
  DEFAULT_PAY,
  type FairKnobs,
  POLICY_LABELS,
  type DecideRequest,
  type Outcome,
  type PolicyVersion,
  type SimParams,
  type WeatherSource,
} from "@heatgate/contracts";
import { DEFAULT_FAIR_KNOBS, FAIR_KNOB_NAMES, fairKnobErrors } from "@heatgate/engine";
import { defaultSimParams, weatherDay } from "@heatgate/sim";

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const bad = (message: string) => new ApiFailure(400, "INVALID_REQUEST", message);

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function obj(v: unknown, path: string): Obj {
  if (!isObj(v)) throw bad(`${path} must be an object`);
  return v;
}

function num(v: unknown, path: string, min = -Infinity, max = Infinity): number {
  if (typeof v !== "number" || !Number.isFinite(v)) throw bad(`${path} must be a number`);
  if (v < min || v > max) throw bad(`${path} must be between ${min} and ${max}`);
  return v;
}

function int(v: unknown, path: string, min: number, max: number): number {
  const n = num(v, path, min, max);
  if (!Number.isInteger(n)) throw bad(`${path} must be a whole number`);
  return n;
}

function str(v: unknown, path: string, max = 64): string {
  if (typeof v !== "string" || v.length === 0 || v.length > max) throw bad(`${path} must be a string of 1-${max} characters`);
  return v;
}

function oneOf<T>(v: unknown, allowed: readonly T[], path: string): T {
  if (!allowed.includes(v as T)) throw bad(`${path} must be one of ${allowed.map((a) => JSON.stringify(a)).join(", ")}`);
  return v as T;
}

const bool = (v: unknown, path: string): boolean => {
  if (typeof v !== "boolean") throw bad(`${path} must be true or false`);
  return v;
};

export const POLICY_VERSIONS = Object.keys(POLICY_LABELS) as PolicyVersion[];
export const OUTCOMES: Outcome[] = ["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"];
const LEVELS = [0, 1, 2] as const;

// Pseudonymous rider IDs only, like "R-014" or "rider-014": a short letter prefix and a number.
// Rejects names and phone numbers by shape.
const RIDER_ID = /^[A-Za-z]{1,8}-\d{1,8}$/;

export function riderId(v: unknown, path: string): string {
  const id = str(v, path, 20);
  if (!RIDER_ID.test(id)) throw bad(`${path} must be a pseudonymous ID like "R-014" (never a name or phone number)`);
  return id;
}

// Simulation ids look like "sim-01J..." (POST /simulations) or "sim-1-2-3" (simulate() default).
const SIMULATION_ID = /^[A-Za-z0-9-]{1,64}$/;

export function simulationId(v: unknown, path: string): string {
  const id = str(v, path);
  if (!SIMULATION_ID.test(id)) throw bad(`${path} must be letters, digits and dashes`);
  return id;
}

export function decideRequest(body: unknown): DecideRequest {
  const b = obj(body, "body");
  const rider = obj(b.rider, "rider");
  const order = obj(b.order, "order");
  const c = obj(b.conditions, "conditions");
  const s = obj(b.riderState, "riderState");
  const req: DecideRequest = {
    policyVersion: oneOf(b.policyVersion, POLICY_VERSIONS, "policyVersion"),
    rider: {
      id: riderId(rider.id, "rider.id"),
      vehicle: oneOf(rider.vehicle, ["bike", "cycle", "ev"] as const, "rider.vehicle"),
      x: num(rider.x, "rider.x", 0, 10),
      y: num(rider.y, "rider.y", 0, 10),
    },
    order: {
      id: str(order.id, "order.id"),
      zone: str(order.zone, "order.zone"),
      distanceKm: num(order.distanceKm, "order.distanceKm", 0, 100),
      tripMinutes: num(order.tripMinutes, "order.tripMinutes", 0, 600),
    },
    conditions: {
      tempC: num(c.tempC, "conditions.tempC", -20, 60),
      humidityPct: num(c.humidityPct, "conditions.humidityPct", 0, 100),
      hourOfDay: num(c.hourOfDay, "conditions.hourOfDay", 0, 23),
      demandLevel: oneOf(c.demandLevel, LEVELS, "conditions.demandLevel"),
      alertLevel: oneOf(c.alertLevel, LEVELS, "conditions.alertLevel"),
    },
    riderState: {
      minutesSinceBreak: num(s.minutesSinceBreak, "riderState.minutesSinceBreak", 0, 24 * 60),
      exposureMinutesToday: num(s.exposureMinutesToday, "riderState.exposureMinutesToday", 0, 24 * 60),
      restMinutesRemaining: num(s.restMinutesRemaining, "riderState.restMinutesRemaining", 0, 24 * 60),
    },
  };
  if (b.simulationId !== undefined) req.simulationId = str(b.simulationId, "simulationId");
  if (b.dryRun !== undefined) req.dryRun = bool(b.dryRun, "dryRun");
  return req;
}

// Partial SimParams in, full SimParams out (defaults from sim/params.ts).
// Nested objects (economics, pay, fairFeatures, shiftHours) are merged field by field.
// Limits keep one request from tying up the server for minutes.
export function simParams(body: unknown): SimParams {
  const b = obj(body ?? {}, "body");
  const p = defaultSimParams();
  const known = new Set(Object.keys(p).concat("fairKnobs", "weather"));
  // fairKnobs: numbers only, merged over the defaults. The worker renders heatgate-fair from them.
  for (const key of Object.keys(b)) if (!known.has(key)) throw bad(`unknown field: ${key}`);

  if (b.seeds !== undefined) {
    if (!Array.isArray(b.seeds) || b.seeds.length < 1 || b.seeds.length > 10) throw bad("seeds must be a list of 1-10 numbers");
    p.seeds = b.seeds.map((s, i) => int(s, `seeds[${i}]`, 0, 2 ** 31 - 1));
  }
  if (b.riders !== undefined) p.riders = int(b.riders, "riders", 1, 300);
  if (b.peakTempC !== undefined) p.peakTempC = num(b.peakTempC, "peakTempC", 20, 55);
  if (b.humidityPct !== undefined) p.humidityPct = num(b.humidityPct, "humidityPct", 0, 100);
  if (b.alertLevel !== undefined) p.alertLevel = oneOf(b.alertLevel, ["auto", 0, 1, 2] as const, "alertLevel");
  if (b.startHour !== undefined) p.startHour = int(b.startHour, "startHour", 0, 23);
  if (b.endHour !== undefined) p.endHour = int(b.endHour, "endHour", 1, 24);
  if (p.startHour >= p.endHour) throw bad("startHour must be before endHour");
  if (b.ordersPerHour !== undefined) p.ordersPerHour = num(b.ordersPerHour, "ordersPerHour", 0, 500);
  if (b.shiftHours !== undefined) {
    const sh = obj(b.shiftHours, "shiftHours");
    if (sh.min !== undefined) p.shiftHours.min = num(sh.min, "shiftHours.min", 1, 16);
    if (sh.max !== undefined) p.shiftHours.max = num(sh.max, "shiftHours.max", 1, 16);
    if (p.shiftHours.min > p.shiftHours.max) throw bad("shiftHours.min must not be more than shiftHours.max");
  }
  if (b.multiAppPct !== undefined) p.multiAppPct = num(b.multiAppPct, "multiAppPct", 0, 100);
  if (b.feeDemandDropPctPerInr !== undefined) p.feeDemandDropPctPerInr = num(b.feeDemandDropPctPerInr, "feeDemandDropPctPerInr", 0, 100);
  if (b.policyVersions !== undefined) {
    if (!Array.isArray(b.policyVersions) || b.policyVersions.length < 1) throw bad("policyVersions must be a non-empty list");
    p.policyVersions = [...new Set(b.policyVersions.map((v, i) => oneOf(v, POLICY_VERSIONS, `policyVersions[${i}]`)))];
  }
  if (b.economics !== undefined) {
    const e = obj(b.economics, "economics");
    const econ = { ...p.economics };
    for (const key of Object.keys(e)) {
      if (!(key in econ)) throw bad(`unknown field: economics.${key}`);
      econ[key as keyof typeof econ] = num(e[key], `economics.${key}`, 0, 100_000);
    }
    p.economics = econ;
  }
  if (b.pay !== undefined) {
    const pay = obj(b.pay, "pay");
    const merged = structuredClone(DEFAULT_PAY);
    for (const key of Object.keys(pay)) {
      const version = oneOf(key, POLICY_VERSIONS, "pay key");
      const pp = obj(pay[key], `pay.${key}`);
      if (pp.paidRest !== undefined) merged[version].paidRest = bool(pp.paidRest, `pay.${key}.paidRest`);
      if (pp.protectIncentive !== undefined) merged[version].protectIncentive = bool(pp.protectIncentive, `pay.${key}.protectIncentive`);
    }
    p.pay = merged;
  }
  if (b.fairFeatures !== undefined) {
    const f = obj(b.fairFeatures, "fairFeatures");
    p.fairFeatures = { ...p.fairFeatures };
    if (f.heatFee !== undefined) p.fairFeatures.heatFee = bool(f.heatFee, "fairFeatures.heatFee");
    if (f.shadeWaitCountsAsRest !== undefined) {
      p.fairFeatures.shadeWaitCountsAsRest = bool(f.shadeWaitCountsAsRest, "fairFeatures.shadeWaitCountsAsRest");
    }
  }
  if (b.fairKnobs !== undefined) p.fairKnobs = fairKnobs(b.fairKnobs, "fairKnobs");
  if (b.weather !== undefined) p.weather = weatherSource(b.weather);
  return p;
}

// { kind: "slider" } (peakTempC + humidityPct) or { kind: "replay", weatherDayId } with an id from GET /weather-days.
function weatherSource(v: unknown): WeatherSource {
  const w = obj(v, "weather");
  const kind = oneOf(w.kind, ["slider", "replay"] as const, "weather.kind");
  const allowed = kind === "replay" ? ["kind", "weatherDayId"] : ["kind"];
  for (const key of Object.keys(w)) if (!allowed.includes(key)) throw bad(`unknown field: weather.${key}`);
  if (kind === "slider") return { kind };
  const id = str(w.weatherDayId, "weather.weatherDayId");
  if (!weatherDay(id)) throw bad(`weather.weatherDayId: no weather day ${JSON.stringify(id)} (see GET /weather-days)`);
  return { kind, weatherDayId: id };
}

// Partial FairKnobs in, full FairKnobs out (defaults from engine/src/fairKnobs.ts). Whole numbers in the
// contract ranges only; never text, so a client can change the numbers in heatgate-fair but not its rules.
export function fairKnobs(v: unknown, path: string): FairKnobs {
  const k = obj(v, path);
  for (const key of Object.keys(k)) if (!(FAIR_KNOB_NAMES as string[]).includes(key)) throw bad(`unknown field: ${path}.${key}`);
  const knobs = { ...DEFAULT_FAIR_KNOBS, ...k } as FairKnobs;
  const errors = fairKnobErrors(knobs).map((e) => e.replace(/^fairKnobs\./, `${path}.`).replace(/ fairKnobs\./g, ` ${path}.`));
  if (errors.length > 0) throw bad(errors.join("; "));
  return knobs;
}

// POST /policies/render: { knobs: Partial<FairKnobs> }.
export function renderRequest(body: unknown): FairKnobs {
  const b = obj(body ?? {}, "body");
  for (const key of Object.keys(b)) if (key !== "knobs") throw bad(`unknown field: ${key}`);
  return fairKnobs(b.knobs ?? {}, "knobs");
}
