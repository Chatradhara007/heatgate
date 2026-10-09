// npm run sim:weather — every rule set on every committed real weather day (sim/data/weather).
// Default params (5 seeds), only the weather changes. Mean (min-max over the seeds).
import type { NumericMetric } from "@heatgate/contracts";
import { WEATHER_DAYS, dayAlertLevel, defaultSimParams, simulate, weatherDaySummary } from "../src/index.ts";

const base = defaultSimParams();
console.log(`Default params, ${base.seeds.length} seeds (${base.seeds.join(",")}), ${base.startHour}:00-${base.endHour}:00, ${base.riders} riders, alert ${base.alertLevel}`);
for (const day of WEATHER_DAYS) {
  const s = weatherDaySummary(day);
  const params = defaultSimParams({ weather: { kind: "replay", weatherDayId: day.id } });
  const hours = day.hourly.slice(base.startHour, base.endHour + 1);
  console.log(
    `\n${s.id}: peak ${s.peakTempC} °C, peak heat index ${s.peakHeatIndexC} °C, alert ${dayAlertLevel(base.alertLevel, s.peakTempC)} (assumed), ` +
      `${base.startHour}-${base.endHour} h: ${Math.min(...hours.map((h) => h.tempC))}-${Math.max(...hours.map((h) => h.tempC))} °C, RH ${Math.min(...hours.map((h) => h.humidityPct))}-${Math.max(...hours.map((h) => h.humidityPct))}%`,
  );
  const result = simulate(params, `weather-${day.id}`);
  const cell = (run: NonNullable<(typeof result.runs)["no-rules"]>, k: NumericMetric, digits = 0) =>
    `${run.metrics[k].toFixed(digits)} (${run.range[k].min.toFixed(digits)}-${run.range[k].max.toFixed(digits)})`;
  console.log("  rule set        delivered        unsafe>120 min     unsafe>90 min      earnings % of no-rules   FORCE_REST/DENY/SKIP");
  for (const [policy, run] of Object.entries(result.runs)) {
    const d = run!.metrics.decisions;
    console.log(
      `  ${policy.padEnd(15)} ${cell(run!, "ordersDelivered").padEnd(16)} ${cell(run!, "unsafeExposureMin120").padEnd(18)} ${cell(run!, "unsafeExposureMin90").padEnd(18)} ` +
        `${cell(run!, "earningsPctOfNoRules", 1).padEnd(24)} ${d.FORCE_REST.toFixed(0)}/${d.DENY.toFixed(0)}/${d.SKIP_ORDER.toFixed(0)}`,
    );
  }
}
