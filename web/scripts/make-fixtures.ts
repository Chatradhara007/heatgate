// One-off: writes web/fixtures/*.json from a short real simulation and real engine decisions.
// Run from the repo root: npx tsx web/scripts/make-fixtures.ts
import { copyFileSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { POLICY_LABELS, type DecideRequest, type Decision, type PolicyVersion } from "@heatgate/contracts";
import { decide } from "@heatgate/engine";
import { between, dayAlertLevel, defaultSimParams, dropDistanceKm, simulate, stream, temperatureAt } from "@heatgate/sim";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "fixtures");
mkdirSync(OUT, { recursive: true });

function write(name: string, data: unknown, compact = false) {
  const file = join(OUT, name);
  writeFileSync(file, JSON.stringify(data, null, compact ? undefined : 1) + "\n");
  console.log(`${name}: ${(statSync(file).size / 1024).toFixed(0)} KB`);
}

// policies.json: what GET /policies returns.
const policies = (Object.keys(POLICY_LABELS) as PolicyVersion[]).map((id) => ({ id, label: POLICY_LABELS[id] }));
write("policies.json", policies);

// defaults.json: what GET /defaults returns.
write("defaults.json", defaultSimParams());

// breakEven.json: what GET /break-even returns, minus the stale flag the API adds. A byte-for-byte copy
// of sim/results/break-even.json, so run npm run sim:breakeven first if that file is out of date.
const breakEvenFile = join(OUT, "breakEven.json");
copyFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "..", "sim", "results", "break-even.json"), breakEvenFile);
console.log(`breakEven.json: ${(statSync(breakEvenFile).size / 1024).toFixed(0)} KB (copied from sim/results/break-even.json)`);

// simResult.json: a short real run. 1 seed, 20 riders, 08:00-21:00 (13 hours), all four rule sets.
const params = defaultSimParams({ seeds: [1], riders: 20, startHour: 8, endHour: 21 });
const result = simulate(params, "sim-fixture-seed1");
write("simResult.json", result, true); // compact, to stay under 1 MB

// audit.json: what GET /audit returns. Real engine decisions under the same day's weather,
// for riders and moments taken from the simulation's frames. Rider IDs are the sim's pseudonymous ones.
const rng = stream(1, "fixtures");
const alertLevel = dayAlertLevel(params.alertLevel, params.peakTempC);
const IST_MIDNIGHT_MS = Date.UTC(2026, 4, 20) - 330 * 60_000; // 20 May 2026, 00:00 India time
const decisions: Decision[] = [];
for (const policy of params.policyVersions) {
  const frames = result.runs[policy]!.frames;
  for (let i = 0; i < 10; i++) {
    const frame = frames[Math.floor(rng() * frames.length)];
    const rider = frame.riders[Math.floor(rng() * frame.riders.length)];
    if (!rider) continue;
    const hour = params.startHour + frame.minute / 60;
    const distanceKm = Math.round(dropDistanceKm(rng) * 10) / 10;
    const request: DecideRequest = {
      policyVersion: policy,
      rider: { id: rider.id, vehicle: "bike", x: rider.x, y: rider.y },
      order: { id: `order-${policy}-${i + 1}`, zone: `Z${1 + Math.floor(rng() * 6)}`, distanceKm, tripMinutes: Math.ceil(distanceKm / 0.3) + 5 },
      conditions: {
        tempC: Math.round(temperatureAt(params.peakTempC, hour) * 10) / 10,
        humidityPct: params.humidityPct,
        hourOfDay: Math.floor(hour),
        demandLevel: frame.demandLevel,
        alertLevel,
      },
      riderState: {
        minutesSinceBreak: Math.round(between(rng, 0, 140)),
        exposureMinutesToday: Math.round(between(rng, 30, 360)),
        restMinutesRemaining: 0,
      },
    };
    const at = new Date(IST_MIDNIGHT_MS + Math.round(hour * 60) * 60_000);
    decisions.push(decide(request, policy, at));
  }
}
decisions.sort((a, b) => b.at.localeCompare(a.at) || b.decisionId.localeCompare(a.decisionId));
write("audit.json", { items: decisions });

const counts: Record<string, number> = {};
for (const d of decisions) counts[d.outcome] = (counts[d.outcome] ?? 0) + 1;
console.log("audit outcomes:", counts);
