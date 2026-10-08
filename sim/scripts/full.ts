// npm run sim:full — the full 5-seed run, plus the tuning and heat index tables.
import { heatIndexC } from "@heatgate/engine";
import type { NumericMetric } from "@heatgate/contracts";
import { defaultSimParams, runDay, simulate, temperatureAt } from "../src/index.ts";

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
const result = simulate(params);
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
console.log(`\nrun time: ${((Date.now() - start) / 1000).toFixed(1)} s`);
