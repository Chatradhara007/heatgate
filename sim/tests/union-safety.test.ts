// Spec sanity check 1. Test files run in parallel; each keeps to the rule sets it needs.
import { expect, test } from "vitest";
import { defaultSimParams, simulate } from "../src/index.ts";

test("44 °C peak, alert 1: union-demand has fewer unsafe minutes than no-rules", () => {
  const r = simulate(
    defaultSimParams({ seeds: [1, 2], peakTempC: 44, alertLevel: 1, policyVersions: ["no-rules", "union-demand"] }),
  );
  expect(r.runs["union-demand"]!.metrics.unsafeExposureMin120).toBeLessThan(r.runs["no-rules"]!.metrics.unsafeExposureMin120);
}, 60_000);
