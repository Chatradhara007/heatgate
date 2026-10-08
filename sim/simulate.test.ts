// Sanity checks from docs/spec/simulator.md.
import { describe, expect, test } from "vitest";
import { defaultSimParams, runDay, simulate } from "./src/index.ts";

const SLOW = 300_000;

describe("simulator sanity checks", () => {
  test("44 °C peak, alert 1: union-demand has fewer unsafe minutes than no-rules", () => {
    const result = simulate(
      defaultSimParams({ peakTempC: 44, alertLevel: 1, policyVersions: ["no-rules", "union-demand"] }),
    );
    const none = result.runs["no-rules"]!;
    const union = result.runs["union-demand"]!;
    console.log("unsafeExposureMin120 mean (range):",
      `no-rules ${none.metrics.unsafeExposureMin120} (${none.range.unsafeExposureMin120.min}-${none.range.unsafeExposureMin120.max})`,
      `union-demand ${union.metrics.unsafeExposureMin120} (${union.range.unsafeExposureMin120.min}-${union.range.unsafeExposureMin120.max})`);
    expect(union.metrics.unsafeExposureMin120).toBeLessThan(none.metrics.unsafeExposureMin120);
  }, SLOW);

  test("alert level 0: ndma-2025 and union-demand match no-rules exactly", () => {
    const result = simulate(defaultSimParams({ peakTempC: 44, alertLevel: 0, policyVersions: ["no-rules", "ndma-2025", "union-demand"] }));
    const none = result.runs["no-rules"]!;
    expect(result.runs["ndma-2025"]!.metrics).toEqual(none.metrics);
    expect(result.runs["ndma-2025"]!.range).toEqual(none.range);
    expect(result.runs["union-demand"]!.metrics).toEqual(none.metrics);
    expect(result.runs["union-demand"]!.range).toEqual(none.range);
  }, SLOW);

  test("the same seed gives identical results twice", () => {
    // ndma-2025 on an alert day is left out only because it is slow (see the commit notes).
    const params = defaultSimParams({
      seeds: [3],
      peakTempC: 40,
      alertLevel: 1,
      policyVersions: ["no-rules", "union-demand", "heatgate-fair"],
    });
    expect(simulate(params)).toEqual(simulate(params));
  }, SLOW);

  test("prints the no-rules demand histogram (target about 20 / 50 / 30)", () => {
    const params = defaultSimParams();
    const totals = [0, 0, 0];
    for (const seed of params.seeds) {
      const d = runDay(params, "no-rules", seed, "histogram");
      d.demandMinutes.forEach((m, i) => (totals[i] += m));
    }
    const all = totals.reduce((a, b) => a + b, 0);
    const pct = totals.map((m) => Math.round((100 * m) / all));
    console.log(`no-rules demand over ${params.seeds.length} seeds: quiet ${pct[0]}% / normal ${pct[1]}% / rush ${pct[2]}%`);
    expect(all).toBe(params.seeds.length * (params.endHour - params.startHour) * 60);
  }, SLOW);
});
