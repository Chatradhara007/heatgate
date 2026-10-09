// npm run sim:sensitivity — how rider earnings depend on the rest pay rate (not part of npm test).
// Default day, 5 seeds. Sweeps economics.restPayPerMinuteInr and finds the break-even rest pay: the smallest
// rate at which a rule set's average earnings are at least those of no-rules. Repeats the sweep for several
// demand levels (ordersPerHour), because the break-even depends on how much a rider earns by delivering.
// Nothing else changes: every other rupee amount and every rule stays at its default. All rupee amounts
// are placeholders. npm run sim:breakeven runs the same sweep and writes it to sim/results/break-even.json.
import {
  BREAK_EVEN_POLICIES as POLICIES,
  ORDERS_PER_HOUR_LEVELS,
  REST_PAY_RATES as RATES,
  breakEvenOf,
  defaultSimParams,
  mean,
  sweepRestPay,
} from "../src/index.ts";

const defaults = defaultSimParams();
const cell = (v: number[], digits = 0) =>
  `${mean(v).toFixed(digits)} (${Math.min(...v).toFixed(digits)}-${Math.max(...v).toFixed(digits)})`;

const start = Date.now();
console.log(`Rest pay sensitivity: default day (peak ${defaults.peakTempC} °C, humidity ${defaults.humidityPct}%), seeds ${defaults.seeds.join(",")}`);
console.log("₹ amounts are placeholders. Mean over the seeds, (min-max) across them.");
console.log("Lowest rider leaves out riders with less than 2 hours on shift (sim/earnings.ts).");

const summary: string[] = [];
for (const ordersPerHour of ORDERS_PER_HOUR_LEVELS) {
  const sweep = sweepRestPay({ ...defaults, ordersPerHour });
  const label = `ordersPerHour ${ordersPerHour}${ordersPerHour === defaults.ordersPerHour ? " (default)" : ""}`;
  console.log(`\n=== ${label} ===\n`);
  const noRulesAvg = sweep[POLICIES[0]][0].noRulesAvg;
  console.log(`no-rules average earnings ₹ (no paid rest, the same at every rate): ${cell(noRulesAvg)}\n`);

  const row: string[] = [];
  for (const policy of POLICIES) {
    console.log(policy);
    console.log("rest ₹/min | avg earnings ₹   | % of no-rules       | lowest rider ₹");
    for (const p of sweep[policy]) {
      console.log(`${p.rate.toFixed(2).padStart(10)} | ${cell(p.avg).padEnd(16)} | ${cell(p.pct, 1).padEnd(19)} | ${cell(p.min)}`);
    }
    const { overall, perSeed } = breakEvenOf(sweep[policy]);
    const reached = perSeed.filter((b): b is number => b !== undefined);
    const where = overall === undefined ? `not reached within ₹${RATES[0]}-${RATES[RATES.length - 1]}/min` : `₹${overall.toFixed(2)}/min`;
    const seeds =
      reached.length === perSeed.length
        ? `per seed ${Math.min(...reached).toFixed(2)}-${Math.max(...reached).toFixed(2)}`
        : `${perSeed.length - reached.length} of ${perSeed.length} seeds not reached in the sweep`;
    const atStart = overall === RATES[0] ? " (already at or above no-rules at the lowest rate in the sweep)" : "";
    console.log(`break-even rest pay: ${where}${atStart}, ${seeds} (interpolated between sweep points)\n`);
    row.push(`${policy} ${where} (${seeds})`);
  }
  summary.push(`${label.padEnd(26)} | ${row.join(" | ")}`);
}

console.log("=== Break-even rest pay by demand level ===");
for (const line of summary) console.log(line);
console.log(`\nrun time: ${((Date.now() - start) / 1000).toFixed(1)} s`);
