// DIAGNOSTIC ONLY (throwaway, not part of npm test or any result). Branch core-zero-earner.
// Finds riders with at least 2 hours on shift (MIN_SHIFT_MIN_FOR_LOWEST) who earn ₹0 in a run, and prints what
// they did all day. Changes no value and no simulator code: it reads runDay()'s frames (every 5 minutes) and
// events (every decide() call), so idle/delivering minutes are 5-minute samples and offers in the last few
// minutes of the day (after the last frame) are not counted.
//
//   npx tsx sim/scripts/diagnose-zero.ts [firstSeed] [lastSeed]      (default seeds 1-20)
//
// Cases: no-rules at the default 34 orders/h, and the break-even.json rows that hit ₹0 at ₹0/min rest pay
// (heatgate-fair at 34/h, union-demand at 25/h).
import type { PolicyVersion, SimParams } from "@heatgate/contracts";
import {
  MIN_SHIFT_MIN_FOR_LOWEST,
  cityLayout,
  defaultSimParams,
  distance,
  makeRiders,
  nearest,
  riderEarnings,
  runDay,
} from "../src/index.ts";

const firstSeed = Number(process.argv[2] ?? 1);
const lastSeed = Number(process.argv[3] ?? 20);
const seeds = Array.from({ length: lastSeed - firstSeed + 1 }, (_, i) => firstSeed + i);

const base = defaultSimParams();
const zeroRest = { ...base.economics, restPayPerMinuteInr: 0 };
const cases: { label: string; policy: PolicyVersion; params: SimParams }[] = [
  { label: "no-rules @34/h", policy: "no-rules", params: base },
  { label: "heatgate-fair @34/h rest ₹0", policy: "heatgate-fair", params: { ...base, economics: zeroRest } },
  { label: "union-demand @25/h rest ₹0", policy: "union-demand", params: { ...base, ordersPerHour: 25, economics: zeroRest } },
];

const { hubs } = cityLayout();
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const hubIndex = (p: { x: number; y: number }) => hubs.indexOf(nearest(p, hubs)) + 1;

for (const c of cases) {
  console.log(`\n=== ${c.label} ===`);
  const perSeed: number[] = [];
  const inFlight: number[] = [];
  const lowest: number[] = [];
  const lowestNonZero: number[] = [];
  for (const seed of seeds) {
    const params = { ...c.params, seeds: [seed] };
    const day = runDay(params, c.policy, seed, "diagnose");
    const plan = makeRiders(params, seed); // the same riders runDay used (same seed stream)
    const endMin = params.endHour * 60;
    let zeros = 0;
    for (const [i, t] of day.riders.entries()) {
      if (t.shiftMinutes < MIN_SHIFT_MIN_FOR_LOWEST) continue;
      const e = riderEarnings(t, day.targetOrders, params.economics, params.pay[c.policy]);
      if (e.totalInr > 0) continue;
      zeros++;
      const r = plan[i];
      let offered = 0;
      let allowed = 0;
      const outcomes: Record<string, number> = {};
      const sampled: Record<string, number> = {};
      const idleHubKm: number[] = [];
      const ranks: number[] = []; // per idle frame: this rider's best rank (1 = closest) among idle riders to any hub
      const timeline: string[] = [];
      for (const f of day.frames) {
        for (const ev of f.events) {
          if (ev.riderId !== r.id) continue;
          timeline.push(`${hhmm(f.minute + params.startHour * 60)} ${ev.outcome}`);
          offered++;
          if (ev.outcome === "ALLOW") allowed++;
          outcomes[ev.outcome] = (outcomes[ev.outcome] ?? 0) + 1;
        }
        const me = f.riders.find((x) => x.id === r.id);
        if (!me) continue;
        sampled[me.state] = (sampled[me.state] ?? 0) + 5;
        if (me.state === "idle") {
          idleHubKm.push(distance(me, nearest(me, hubs)));
          const idle = f.riders.filter((x) => x.state === "idle");
          ranks.push(Math.min(...hubs.map((h) => 1 + idle.filter((x) => distance(x, h) < distance(me, h)).length)));
        }
      }
      const avgKm = idleHubKm.length ? idleHubKm.reduce((a, b) => a + b, 0) / idleHubKm.length : NaN;
      console.log(
        `seed ${seed} ${r.id} ${r.vehicle} login ${hhmm(r.loginMin)} logout ${hhmm(r.logoutMin)} (cut to ${hhmm(Math.min(r.logoutMin, endMin))}) ` +
          `shift ${(t.shiftMinutes / 60).toFixed(2)} h | offered ${offered} accepted ${allowed} delivered ${t.ordersDelivered} ` +
          `${JSON.stringify(outcomes)} | rest ${t.restMinutes} min, rest+pause ${t.restOrPauseMinutes} min, ` +
          `sampled ${JSON.stringify(sampled)} | home hub ${hubIndex(r.pos)} start ${distance(r.pos, nearest(r.pos, hubs)).toFixed(2)} km from it, ` +
          `idle avg ${avgKm.toFixed(2)} km from nearest hub | target ${e.target.toFixed(1)} hit ${e.hitTarget} | multiApp ${r.multiApp}`,
      );
      const rankHist: Record<number, number> = {};
      for (const k of ranks) rankHist[k] = (rankHist[k] ?? 0) + 1;
      console.log(`    best rank among idle riders to any hub, per idle frame (rank: frames): ${JSON.stringify(rankHist)}`);
      console.log(`    decisions (frame time): ${timeline.join(", ") || "none"}`);
      const last = day.frames[day.frames.length - 1].riders.find((x) => x.id === r.id);
      console.log(`    state at last frame (${hhmm(day.frames[day.frames.length - 1].minute + params.startHour * 60)}): ${last?.state ?? "offline"}`);
    }
    perSeed.push(zeros);
    // Orders assigned (ALLOW) but still on the road when the day ends: never delivered, never paid.
    inFlight.push(day.metrics.decisions.ALLOW - day.metrics.ordersDelivered);
    lowest.push(day.metrics.minEarningsPerRiderInr);
    const longPaid = day.riders
      .filter((t) => t.shiftMinutes >= MIN_SHIFT_MIN_FOR_LOWEST)
      .map((t) => riderEarnings(t, day.targetOrders, params.economics, params.pay[c.policy]).totalInr)
      .filter((v) => v > 0);
    lowestNonZero.push(Math.min(...longPaid));
  }
  const total = perSeed.reduce((a, b) => a + b, 0);
  console.log(`zero earners (>=2 h on shift) per seed: ${perSeed.join(" ")} | total ${total} over ${seeds.length} seeds`);
  console.log(`orders assigned but undelivered at day end, per seed: ${inFlight.join(" ")}`);
  console.log(`lowest rider ₹ as reported, per seed: ${lowest.map((v) => v.toFixed(0)).join(" ")}`);
  console.log(`lowest rider ₹ among riders who earned > 0, per seed: ${lowestNonZero.map((v) => v.toFixed(0)).join(" ")}`);
}

// --- Evidence for the candidate causes (default seeds 1-5, 34 orders/h) ---
console.log("\n=== checks (default seeds 1-5) ===");
const defaultSeeds = base.seeds;

// (a) Earnings model: every delivered order is paid, and per-rider deliveries add up to the run total.
for (const seed of defaultSeeds) {
  const day = runDay({ ...base, seeds: [seed] }, "no-rules", seed, "diagnose");
  const sum = day.riders.reduce((a, t) => a + t.ordersDelivered, 0);
  const unpaid = day.riders.filter((t) => t.ordersDelivered > 0 && t.orderPayInr <= 0).length;
  console.log(`seed ${seed}: sum of rider deliveries ${sum} = ordersDelivered ${day.metrics.ordersDelivered}: ${sum === day.metrics.ordersDelivered}; riders with deliveries but no pay: ${unpaid}`);
}

// (b) Second-wave riders (no-rules): distance from the start point to the nearest hub vs minutes until the first
// offer. Idle riders do not move, so a rider who logs in far from every hub waits until they are the nearest idle rider.
console.log("\nno-rules, riders logging in 15:00-18:00: start km to nearest hub -> minutes to first offer (mean over riders)");
const buckets = [0, 1, 2, 3, 4, 99];
const waits: number[][] = buckets.slice(1).map(() => []);
const neverOffered: number[] = buckets.slice(1).map(() => 0);
for (const seed of defaultSeeds) {
  const params = { ...base, seeds: [seed] };
  const day = runDay(params, "no-rules", seed, "diagnose");
  for (const r of makeRiders(params, seed)) {
    if (r.loginMin < 15 * 60) continue;
    const km = distance(r.pos, nearest(r.pos, hubs));
    const b = buckets.findIndex((lo, k) => km >= lo && km < buckets[k + 1]);
    const first = day.frames.find((f) => f.events.some((e) => e.riderId === r.id));
    if (first) waits[b].push(first.minute + params.startHour * 60 - r.loginMin);
    else neverOffered[b]++;
  }
}
for (const [k, w] of waits.entries()) {
  const m = w.length ? (w.reduce((a, b) => a + b, 0) / w.length).toFixed(0) : "-";
  console.log(`  ${buckets[k]}-${buckets[k + 1] === 99 ? "" : buckets[k + 1]} km: riders ${w.length + neverOffered[k]}, mean wait ${m} min, max ${w.length ? Math.max(...w) : "-"}, never offered ${neverOffered[k]}`);
}

// (c) Headline effect of orders still on the road at 20:00 (assigned, never delivered, never paid). Estimate only:
// each is valued at the run's mean pay per delivered order; bonus effects are ignored.
console.log("\nunpaid orders at day end, estimated per rule set (34 orders/h, seeds 1-5):");
for (const rate of [0, base.economics.restPayPerMinuteInr]) {
  const params = { ...base, economics: { ...base.economics, restPayPerMinuteInr: rate } };
  const rows: Record<string, { avg: number[]; est: number[] }> = {};
  for (const policy of base.policyVersions) {
    rows[policy] = { avg: [], est: [] };
    for (const seed of defaultSeeds) {
      const day = runDay({ ...params, seeds: [seed] }, policy, seed, "diagnose");
      const pay = day.riders.reduce((a, t) => a + t.orderPayInr, 0);
      const perOrder = pay / Math.max(1, day.metrics.ordersDelivered);
      const missing = day.metrics.decisions.ALLOW - day.metrics.ordersDelivered;
      rows[policy].avg.push(day.metrics.avgEarningsPerRiderInr);
      rows[policy].est.push(day.metrics.avgEarningsPerRiderInr + (missing * perOrder) / day.riders.length);
    }
  }
  const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
  for (const policy of base.policyVersions) {
    const pct = rows[policy].avg.map((v, i) => (100 * v) / rows["no-rules"].avg[i]);
    const pctEst = rows[policy].est.map((v, i) => (100 * v) / rows["no-rules"].est[i]);
    console.log(
      `  rest ₹${rate}/min ${policy.padEnd(13)} avg ₹${mean(rows[policy].avg).toFixed(0)} -> ₹${mean(rows[policy].est).toFixed(0)} if paid; ` +
        `% of no-rules ${mean(pct).toFixed(1)} -> ${mean(pctEst).toFixed(1)}`,
    );
  }
}
