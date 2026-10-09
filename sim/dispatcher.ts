// One simulated day for one rule set and one seed, one step per minute (docs/spec/simulator.md).
import type { DecideRequest, Decision, Frame, Metrics, Outcome, PolicyVersion, RiderState, SimParams } from "@heatgate/contracts";
import { decide, heatIndexC } from "@heatgate/engine";
import { CITY_KM, cityLayout, dayAlertLevel, demandLevelFor, distance, nearest, temperatureAt, type Point } from "./city.ts";
import { between, poisson, stream, type Rng } from "./rng.ts";
import { AuditSampler } from "./audit.ts";
import { dailyTarget, earningsSummary, orderPayInr, type RiderTally } from "./earnings.ts";
import { applyHeatFee, shadeWaitOn, waitInShade } from "./fair.ts";

const HANDOVER_MIN = 5;
const PAUSE_MIN = 15;
const LATE_AFTER_MIN = 45;
const CANDIDATES_PER_ORDER = 5;
const FRAME_EVERY_MIN = 5;
const MAX_DROP_KM = 5;
const EXPIRE_AFTER_MIN = 30;
const SPEED_KM_PER_MIN = { bike: 18 / 60, ev: 18 / 60, cycle: 12 / 60 } as const;

interface Leg {
  to: Point;
  minutesLeft: number;
}

interface SimOrder {
  id: string;
  createdMin: number; // minute of day
  hub: Point;
  drop: Point;
  distanceKm: number;
}

type InternalState = "offline" | "idle" | "delivering" | "toCooling" | "resting" | "paused";

interface SimRider {
  id: string;
  vehicle: "bike" | "cycle" | "ev";
  speed: number;
  pos: Point;
  loginMin: number;
  logoutMin: number;
  multiApp: boolean;
  state: InternalState;
  route: Leg[];
  order?: SimOrder;
  pendingRest: number; // rest minutes that start on arrival at the cooling point
  restLeft: number;
  pauseLeft: number;
  minutesSinceBreak: number;
  exposureMinutesToday: number;
  rodeThisMinute: boolean;
  // earnings (sim/earnings.ts)
  ordersDelivered: number;
  orderPayInr: number;
  restMinutes: number;
  restOrPauseMinutes: number;
  shadeMinutes: number; // continuous minutes idle at a hub (shade waiting, sim/fair.ts)
}

export interface DayResult {
  metrics: Metrics;
  frames: Frame[];
  demandMinutes: [number, number, number]; // minutes spent quiet / normal / rush
  expiredOrders: number; // also inside ordersLate and missing from ordersDelivered
  cancelledOrders: number; // dropped by customers because of the heat fee; not in ordersTotal
  targetOrders: number; // the daily target before incentive protection
  riders: RiderTally[];
  audit?: Decision[]; // only with { audit: true }: see sim/audit.ts
}

const legMinutes = (from: Point, to: Point, speed: number) => Math.ceil(distance(from, to) / speed);

// ASSUMPTION: riders log in in two waves, half between 8 and 9 AM and half between 3 and 6 PM (not
// measured; replace with real login data when we have it). Each rider then works shiftHours; the
// second wave's shifts are cut off at endHour. The windows were tuned with ordersPerHour so the
// no-rules demand mix on a 34 °C day is close to 20 / 50 / 30 (it comes out at 21 / 51 / 28).
export interface LoginWave {
  share: number; // share of riders in this wave; the last wave takes the rest
  fromMin: number; // minute of day
  toMin: number;
}
export const LOGIN_WAVES: LoginWave[] = [
  { share: 0.5, fromMin: 8 * 60, toMin: 9 * 60 },
  { share: 0.5, fromMin: 15 * 60, toMin: 18 * 60 },
];

function loginWave(i: number, riders: number): LoginWave {
  let upTo = 0;
  for (const wave of LOGIN_WAVES) {
    upTo += wave.share * riders;
    if (i < Math.round(upTo)) return wave;
  }
  return LOGIN_WAVES[LOGIN_WAVES.length - 1];
}

export function makeRiders(params: SimParams, seed: number): SimRider[] {
  const rng = stream(seed, "riders");
  return Array.from({ length: params.riders }, (_, i) => {
    const v = rng();
    const vehicle = v < 0.7 ? "bike" : v < 0.9 ? "ev" : "cycle";
    const wave = loginWave(i, params.riders);
    // On the 5-minute frame clock, so every rider is in a frame from their first minute on shift.
    const loginMin = Math.floor(between(rng, wave.fromMin, wave.toMin) / FRAME_EVERY_MIN) * FRAME_EVERY_MIN;
    const shiftMin = Math.round(between(rng, params.shiftHours.min, params.shiftHours.max) * 60);
    return {
      id: `rider-${String(i + 1).padStart(3, "0")}`, // pseudonymous
      vehicle,
      speed: SPEED_KM_PER_MIN[vehicle],
      pos: { x: rng() * 10, y: rng() * 10 },
      loginMin,
      logoutMin: loginMin + shiftMin,
      multiApp: rng() * 100 < params.multiAppPct,
      state: "offline",
      route: [],
      pendingRest: 0,
      restLeft: 0,
      pauseLeft: 0,
      minutesSinceBreak: 0,
      exposureMinutesToday: 0,
      rodeThisMinute: false,
      ordersDelivered: 0,
      orderPayInr: 0,
      restMinutes: 0,
      restOrPauseMinutes: 0,
      shadeMinutes: 0,
    };
  });
}

function makeOrders(params: SimParams, seed: number, hubs: Point[]): SimOrder[] {
  const rng = stream(seed, "orders");
  const orders: SimOrder[] = [];
  for (let minute = params.startHour * 60; minute < params.endHour * 60; minute++) {
    const hour = minute / 60;
    const busy = (hour >= 12 && hour < 14) || (hour >= 19 && hour < 21);
    const count = poisson(rng, ((busy ? 1.5 : 1) * params.ordersPerHour) / 60);
    for (let k = 0; k < count; k++) {
      const hub = hubs[Math.floor(rng() * hubs.length)];
      const drop = dropPoint(rng, hub);
      orders.push({ id: `order-${orders.length + 1}`, createdMin: minute, hub, drop, distanceKm: distance(hub, drop) });
    }
  }
  return orders;
}

// ASSUMPTION: drop distances are short-skewed (log-normal, median about 2.5 km, capped at 5 km).
// Not measured; replace with real order data when we have it.
const DROP_MEDIAN_KM = 2.6; // before the cap; the capped median comes out at about 2.5 km
const DROP_SIGMA = 0.5;

export function dropDistanceKm(rng: Rng): number {
  for (;;) {
    const normal = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    const d = DROP_MEDIAN_KM * Math.exp(DROP_SIGMA * normal);
    if (d <= MAX_DROP_KM) return d;
  }
}

// A drop point at a sampled distance from the hub, inside the city (tries a few directions first).
function dropPoint(rng: Rng, hub: Point): Point {
  const d = dropDistanceKm(rng);
  let p = hub;
  for (let tries = 0; tries < 8; tries++) {
    const angle = rng() * 2 * Math.PI;
    p = { x: hub.x + d * Math.cos(angle), y: hub.y + d * Math.sin(angle) };
    if (p.x >= 0 && p.x <= CITY_KM && p.y >= 0 && p.y <= CITY_KM) return p;
  }
  return { x: Math.min(CITY_KM, Math.max(0, p.x)), y: Math.min(CITY_KM, Math.max(0, p.y)) };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.ceil(p * sorted.length) - 1)];
}

const FRAME_STATE: Record<Exclude<InternalState, "offline">, RiderState> = {
  idle: "idle",
  delivering: "delivering",
  toCooling: "resting",
  resting: "resting",
  paused: "paused",
};

// options.noRulesOrdersPerRider: orders per rider in the no-rules run on the same seed, for the daily
// target. Left out, it comes from this run (no-rules) or from an extra no-rules run.
export function runDay(
  params: SimParams,
  policy: PolicyVersion,
  seed: number,
  simulationId: string,
  options: { audit?: boolean; noRulesOrdersPerRider?: number[] } = {},
): DayResult {
  const { hubs, coolingPoints } = cityLayout();
  const riders = makeRiders(params, seed);
  const heatIndexAt = (minute: number) =>
    Math.round(heatIndexC(temperatureAt(params.peakTempC, minute / 60), params.humidityPct));
  const fee = applyHeatFee(makeOrders(params, seed, hubs), heatIndexAt, params, policy, seed);
  const orders = fee.orders;
  const alertLevel = dayAlertLevel(params.alertLevel, params.peakTempC);
  const shade = shadeWaitOn(params, policy);
  const atHub = (p: Point) => distance(p, nearest(p, hubs)) < 1e-9;

  const waiting: SimOrder[] = [];
  const deliveryMinutes: number[] = [];
  const decisions: Record<Outcome, number> = { ALLOW: 0, SKIP_ORDER: 0, DENY: 0, FORCE_REST: 0 };
  const demandMinutes: [number, number, number] = [0, 0, 0];
  const frames: Frame[] = [];
  const audit = options.audit ? new AuditSampler() : undefined;
  let events: Frame["events"] = [];
  let nextOrder = 0;
  let unsafe90 = 0;
  let unsafe120 = 0;
  let restsForced = 0;
  let pausedRiderMinutes = 0;
  let expired = 0;

  for (let minute = params.startHour * 60; minute < params.endHour * 60; minute++) {
    const hour = minute / 60;
    const tempC = temperatureAt(params.peakTempC, hour);
    const hi = heatIndexAt(minute);
    const now = new Date(Date.UTC(2026, 4, 20, 0, minute)); // simulated time

    // 1. Log riders in and out (a rider on a delivery finishes it first). A run that starts after a
    //    rider's login time (a short test day) starts with that rider already on shift.
    for (const r of riders) {
      if (r.state === "offline" && minute >= r.loginMin && minute < r.logoutMin) r.state = "idle";
      else if (r.state !== "offline" && minute >= r.logoutMin && r.state !== "delivering") r.state = "offline";
    }
    const onShift = riders.filter((r) => r.state !== "offline");

    // 2. Demand level.
    const demandLevel = demandLevelFor(onShift.filter((r) => r.state === "delivering").length, onShift.length);
    demandMinutes[demandLevel]++;

    // 3. Count down rests and pauses.
    for (const r of onShift) {
      r.rodeThisMinute = false;
      if (r.state === "resting") {
        r.restMinutes++;
        r.restOrPauseMinutes++;
        if (--r.restLeft <= 0) {
          r.state = "idle";
          if (!r.multiApp) r.minutesSinceBreak = 0;
        }
      } else if (r.state === "paused") {
        r.restOrPauseMinutes++;
        if (--r.pauseLeft <= 0) r.state = "idle";
      }
    }

    // 3b. Shade waiting (heatgate-fair, off by default): idle riders ride to the nearest hub and wait there.
    if (shade) {
      for (const r of onShift) {
        if (r.state !== "idle" || atHub(r.pos)) continue;
        const hub = nearest(r.pos, hubs);
        const d = distance(r.pos, hub);
        r.pos = d <= r.speed ? { x: hub.x, y: hub.y } : { x: r.pos.x + ((hub.x - r.pos.x) * r.speed) / d, y: r.pos.y + ((hub.y - r.pos.y) * r.speed) / d };
        r.rodeThisMinute = true;
      }
    }

    // 4. Move riders along their route.
    for (const r of onShift) {
      if (r.state !== "delivering" && r.state !== "toCooling") continue;
      const leg = r.route[0];
      if (leg) {
        r.pos = {
          x: r.pos.x + (leg.to.x - r.pos.x) / leg.minutesLeft,
          y: r.pos.y + (leg.to.y - r.pos.y) / leg.minutesLeft,
        };
        r.rodeThisMinute = true;
        if (--leg.minutesLeft <= 0) r.route.shift();
      }
      if (r.route.length > 0) continue;
      if (r.state === "delivering") {
        deliveryMinutes.push(minute + 1 - r.order!.createdMin);
        r.ordersDelivered++;
        r.orderPayInr += orderPayInr(r.order!.distanceKm, params.economics);
        r.order = undefined;
        r.state = "idle";
      } else {
        r.state = "resting";
        r.restLeft = r.pendingRest;
      }
    }

    // 5. Dispatch waiting orders, oldest first.
    while (nextOrder < orders.length && orders[nextOrder].createdMin === minute) waiting.push(orders[nextOrder++]);
    // Orders unassigned for 30 minutes expire: undelivered, and counted as late.
    while (waiting.length > 0 && minute - waiting[0].createdMin >= EXPIRE_AFTER_MIN) {
      waiting.shift();
      expired++;
    }
    for (let i = 0; i < waiting.length; i++) {
      const order = waiting[i];
      const candidates = onShift
        .filter((r) => r.state === "idle")
        .sort((a, b) => distance(a.pos, order.hub) - distance(b.pos, order.hub))
        .slice(0, CANDIDATES_PER_ORDER);
      for (const r of candidates) {
        const route: Leg[] = [
          { to: order.hub, minutesLeft: legMinutes(r.pos, order.hub, r.speed) },
          { to: order.hub, minutesLeft: HANDOVER_MIN },
          { to: order.drop, minutesLeft: legMinutes(order.hub, order.drop, r.speed) },
        ].filter((leg) => leg.minutesLeft > 0);
        const request: DecideRequest = {
          policyVersion: policy,
          rider: { id: r.id, vehicle: r.vehicle, x: r.pos.x, y: r.pos.y },
          order: {
            id: order.id,
            zone: "city",
            distanceKm: order.distanceKm,
            tripMinutes: route.reduce((sum, leg) => sum + leg.minutesLeft, 0),
          },
          conditions: { tempC, humidityPct: params.humidityPct, hourOfDay: Math.floor(hour), demandLevel, alertLevel },
          riderState: {
            minutesSinceBreak: r.minutesSinceBreak,
            exposureMinutesToday: r.exposureMinutesToday,
            restMinutesRemaining: 0,
          },
          simulationId,
          dryRun: true,
        };
        const d = decide(request, policy, now);
        decisions[d.outcome]++;
        audit?.add(d);
        events.push({ riderId: r.id, outcome: d.outcome, rule: d.firedRules[0] ?? "" });
        if (d.outcome === "ALLOW") {
          r.state = "delivering";
          r.route = route;
          r.order = order;
          waiting.splice(i--, 1);
          break;
        }
        if (d.outcome === "FORCE_REST") {
          restsForced++;
          const point = nearest(r.pos, coolingPoints);
          const minutes = legMinutes(r.pos, point, r.speed);
          r.pendingRest = d.restMinutes;
          if (minutes > 0) {
            r.state = "toCooling";
            r.route = [{ to: point, minutesLeft: minutes }];
          } else {
            r.state = "resting";
            r.restLeft = d.restMinutes;
          }
        } else if (d.outcome === "DENY") {
          r.state = "paused";
          r.pauseLeft = PAUSE_MIN;
        }
        // SKIP_ORDER: the rider stays idle and available.
      }
    }

    // 6. Exposure. Idle, delivering and riding-to-rest riders are outdoors.
    //    Paused and resting riders are on break, except multi-app riders.
    //    With shade waiting on, an idle rider who stays at a hub is in shade (multi-app riders excepted:
    //    like a rest, they are taken to keep working on the other app).
    for (const r of riders) {
      if (r.state === "offline") continue;
      if (r.state === "paused") pausedRiderMinutes++;
      if (shade && r.state === "idle" && !r.rodeThisMinute && !r.multiApp && atHub(r.pos)) {
        waitInShade(r);
        continue;
      }
      r.shadeMinutes = 0;
      const outdoors =
        r.state === "idle" || r.state === "delivering" || r.state === "toCooling" || r.rodeThisMinute;
      const onBreak = r.state === "resting" || r.state === "paused";
      if (!outdoors && !(onBreak && r.multiApp)) continue;
      r.minutesSinceBreak++;
      r.exposureMinutesToday++;
      if (hi >= 38 && r.minutesSinceBreak > 90) unsafe90++;
      if (hi >= 38 && r.minutesSinceBreak > 120) unsafe120++;
    }

    // 7. Frame every 5 minutes.
    if ((minute - params.startHour * 60) % FRAME_EVERY_MIN === 0) {
      frames.push({
        minute: minute - params.startHour * 60,
        heatIndexC: hi,
        demandLevel,
        riders: riders
          .filter((r) => r.state !== "offline")
          .map((r) => ({ id: r.id, x: r.pos.x, y: r.pos.y, state: FRAME_STATE[r.state as Exclude<InternalState, "offline">] })),
        events,
      });
      events = [];
    }
  }

  const tallies: RiderTally[] = riders.map((r) => ({
    id: r.id,
    ordersDelivered: r.ordersDelivered,
    orderPayInr: r.orderPayInr,
    restMinutes: r.restMinutes,
    restOrPauseMinutes: r.restOrPauseMinutes,
  }));
  const noRulesOrders =
    options.noRulesOrdersPerRider ??
    (policy === "no-rules" ? tallies : runDay(params, "no-rules", seed, simulationId).riders).map((t) => t.ordersDelivered);
  const targetOrders = dailyTarget(noRulesOrders, params.economics);
  const money = earningsSummary(tallies, targetOrders, params.economics, params.pay[policy]);

  const sorted = [...deliveryMinutes].sort((a, b) => a - b);
  const metrics: Metrics = {
    unsafeExposureMin90: unsafe90,
    unsafeExposureMin120: unsafe120,
    restsForced,
    pausedRiderMinutes,
    ordersTotal: orders.length,
    ordersDelivered: sorted.length,
    avgDeliveryMinutes: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0,
    p90DeliveryMinutes: percentile(sorted, 0.9),
    ordersLate: sorted.filter((m) => m > LATE_AFTER_MIN).length + expired, // expired orders count as late
    // Money: placeholder rupee amounts from params.economics (sim/earnings.ts, sim/fair.ts).
    ...money,
    heatFeeCollectedInr: fee.heatFeeCollectedInr,
    decisions,
  };
  const result: DayResult = {
    metrics,
    frames,
    demandMinutes,
    expiredOrders: expired,
    cancelledOrders: fee.cancelled,
    targetOrders,
    riders: tallies,
  };
  if (audit) result.audit = audit.take();
  return result;
}
