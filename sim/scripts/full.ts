// npm run sim:full — the full 5-seed run, plus the tuning and heat index tables.
import { heatIndexC } from "@heatgate/engine";
import type { NumericMetric } from "@heatgate/contracts";
import { defaultSimParams, runDay, simulateWithAudit, temperatureAt } from "../src/index.ts";

console.log("3 PM heat index (°C) by peak air temperature and humidity");
console.log("peak   RH25 RH35 RH45");
for (const peak of [34, 36, 38, 40, 42, 44]) {
  const row = [25, 35, 45].map((rh) => String(Math.round(heatIndexC(temperatureAt(peak, 15), rh))).padStart(4));
  console.log(`${peak} °C ${row.join(" ")}`);
}

const tuning = defaultSimParams({ peakTempC: 34 });
const minutes = [0, 0, 0];
for (const seed of tuning.seeds) runDay(tuning, "no-rules", seed, "tuning").demandMinutes.forEach((m, i) => (minutes[i] += m));
const total = minutes.reduce((a, b) => a + b, 0);
const [quiet, normal, rush] = minutes.map((m) => ((100 * m) / total).toFixed(0));
console.log(
  `\nno-rules demand on a 34 °C day, ordersPerHour ${tuning.ordersPerHour}, ${tuning.seeds.length} seeds: ` +
    `quiet ${quiet}% / normal ${normal}% / rush ${rush}% (target 20 / 50 / 30)`,
);

const params = defaultSimParams();
const start = Date.now();
const { result, earningsPctOfNoRules } = simulateWithAudit(params);
console.log(`\nDefault day: peak ${params.peakTempC} °C, humidity ${params.humidityPct}%, alert ${params.alertLevel}, seeds ${params.seeds.join(",")}`);
const show = (k: NumericMetric, digits = 0) =>
  Object.entries(result.runs).map(([policy, run]) => {
    const m = run!.metrics[k], r = run!.range[k];
    return `${policy} ${m.toFixed(digits)} (${r.min.toFixed(digits)}-${r.max.toFixed(digits)})`;
  }).join(" | ");
console.log(`orders total:     ${show("ordersTotal")}`);
console.log(`delivered:        ${show("ordersDelivered")}`);
console.log(`avg delivery min: ${show("avgDeliveryMinutes", 1)}`);
console.log(`late (incl. expired): ${show("ordersLate")}`);
console.log(`unsafe min > 90:  ${show("unsafeExposureMin90")}`);
console.log(`unsafe min > 120: ${show("unsafeExposureMin120")}`);
// Money: all rupee amounts are placeholders from params.economics.
const f = params.fairFeatures;
console.log(`\nmoney (₹ placeholders; heat fee ${f.heatFee ? "on" : "off"}, shade waiting ${f.shadeWaitCountsAsRest ? "ON" : "off"}):`);
console.log(`avg earnings ₹:   ${show("avgEarningsPerRiderInr")}`);
console.log(
  `% of no-rules:    ${Object.entries(earningsPctOfNoRules).map(([p, r]) => `${p} ${r!.mean.toFixed(1)} (${r!.min.toFixed(1)}-${r!.max.toFixed(1)})`).join(" | ")}`,
);
console.log(`lowest rider ₹:   ${show("minEarningsPerRiderInr")}`);
console.log(`rest pay ₹:       ${show("restPayTotalInr")}`);
console.log(`heat fee ₹:       ${show("heatFeeCollectedInr")}`);
console.log(`incentive hit %:  ${show("incentiveHitRatePct", 1)}`);
console.log(`\nrun time: ${((Date.now() - start) / 1000).toFixed(1)} s`);
