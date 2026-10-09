// npm run sim:breakeven — runs the rest pay sweep of npm run sim:sensitivity (25, 34 and 50 orders an hour,
// default seeds, union-demand and heatgate-fair) and writes sim/results/break-even.json for GET /break-even.
// ALL RUPEE AMOUNTS ARE PLACEHOLDERS from interview-pending economics. Re-run after changing any default.
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { breakEvenReport, defaultSimParams } from "../src/index.ts";

const out = fileURLToPath(new URL("../results/break-even.json", import.meta.url));
const start = Date.now();
const report = breakEvenReport(defaultSimParams());
mkdirSync(fileURLToPath(new URL("../results/", import.meta.url)), { recursive: true });
writeFileSync(out, JSON.stringify(report, null, 2) + "\n");

console.log(`wrote ${out} (${((Date.now() - start) / 1000).toFixed(1)} s). ${report.note}`);
for (const level of report.levels) {
  const cells = Object.entries(level.policies).map(([policy, r]) => {
    const b = r!.breakEven;
    return b.status === "reached"
      ? `${policy} ₹${b.meanInrPerMin.toFixed(2)}/min (per seed ${b.perSeedMinInrPerMin.toFixed(2)}-${b.perSeedMaxInrPerMin.toFixed(2)}` +
          `${b.seedsNotReached ? `, ${b.seedsNotReached} seeds not reached` : ""})`
      : `${policy} not reached (best ${b.bestEarningsPctOfNoRules.toFixed(1)}% of no-rules at ₹${b.atRestPayInrPerMin}/min)`;
  });
  console.log(`ordersPerHour ${level.ordersPerHour}: ${cells.join(" | ")}`);
}
