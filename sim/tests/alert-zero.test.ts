// Spec sanity check 2.
import { expect, test } from "vitest";
import { defaultSimParams, simulate } from "../src/index.ts";

test("alert level 0: ndma-2025 and union-demand match no-rules exactly", () => {
  const r = simulate(
    defaultSimParams({ seeds: [1, 2], peakTempC: 44, alertLevel: 0, policyVersions: ["no-rules", "ndma-2025", "union-demand"] }),
  );
  const none = r.runs["no-rules"]!;
  for (const policy of ["ndma-2025", "union-demand"] as const) {
    expect(r.runs[policy]!.metrics).toEqual(none.metrics);
    expect(r.runs[policy]!.range).toEqual(none.range);
  }
}, 60_000);
