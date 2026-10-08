import { expect, test } from "vitest";
import type { Decision, Outcome } from "@heatgate/contracts";
import { AUDIT_CAP_PER_RULE_SET, AuditSampler, defaultSimParams, runDay, simulate, simulateWithAudit } from "../src/index.ts";

const fake = (i: number, outcome: Outcome) => ({ decisionId: `d${i}`, outcome }) as Decision;

test("sampler keeps every non-ALLOW decision and 1 in 20 ALLOWs, in order", () => {
  const s = new AuditSampler();
  for (let i = 0; i < 100; i++) s.add(fake(i, i % 10 === 0 ? "DENY" : "ALLOW"));
  const kept = s.take();
  expect(kept.filter((d) => d.outcome === "DENY")).toHaveLength(10);
  expect(kept.filter((d) => d.outcome === "ALLOW")).toHaveLength(Math.ceil(90 / 20));
  expect(kept.map((d) => Number(d.decisionId.slice(1)))).toEqual([...kept.map((d) => Number(d.decisionId.slice(1)))].sort((a, b) => a - b));
});

test("over the cap: non-ALLOW first, thinned evenly across the day", () => {
  const s = new AuditSampler();
  for (let i = 0; i < 10; i++) s.add(fake(i, "FORCE_REST"));
  for (let i = 10; i < 410; i++) s.add(fake(i, "ALLOW")); // 20 sampled
  const tight = s.take(8);
  expect(tight).toHaveLength(8);
  expect(tight.every((d) => d.outcome === "FORCE_REST")).toBe(true);
  const kept = s.take(20);
  expect(kept.filter((d) => d.outcome === "FORCE_REST")).toHaveLength(10);
  const allows = kept.filter((d) => d.outcome === "ALLOW").map((d) => Number(d.decisionId.slice(1)));
  expect(allows).toHaveLength(10);
  expect(allows[allows.length - 1]).toBeGreaterThan(300); // not just the morning

  const big = new AuditSampler();
  for (let i = 0; i < 5000; i++) big.add(fake(i, "SKIP_ORDER"));
  const capped = big.take();
  expect(capped).toHaveLength(AUDIT_CAP_PER_RULE_SET);
  expect(capped[capped.length - 1].decisionId).not.toBe("d2999");
});

test("a run's audit trail: first seed, simulated time, the riders from the frames", () => {
  const params = defaultSimParams({ seeds: [3, 4], startHour: 11, endHour: 16, alertLevel: 1 });
  const { result, audit } = simulateWithAudit(params, "sim-audit-test");
  expect(result).toEqual(simulate(params, "sim-audit-test"));
  for (const policy of params.policyVersions) {
    const trail = audit[policy]!;
    const run = result.runs[policy]!;
    expect(trail.length).toBeGreaterThan(0);
    expect(trail.length).toBeLessThanOrEqual(AUDIT_CAP_PER_RULE_SET);
    // Every non-ALLOW decision of the first seed is in the trail.
    const { decisions } = runDay(params, policy, 3, "x").metrics;
    expect(trail.filter((d) => d.outcome !== "ALLOW")).toHaveLength(decisions.SKIP_ORDER + decisions.DENY + decisions.FORCE_REST);
    expect(trail.filter((d) => d.outcome === "ALLOW")).toHaveLength(Math.ceil(decisions.ALLOW / 20));
    const frameRiders = new Set(run.frames.flatMap((f) => f.riders.map((r) => r.id)));
    for (const d of trail) {
      expect(d.simulationId).toBe("sim-audit-test");
      expect(d.policyVersion).toBe(policy);
      expect(frameRiders.has(d.riderId)).toBe(true);
      const hour = new Date(d.at).getUTCHours();
      expect(hour).toBeGreaterThanOrEqual(11);
      expect(hour).toBeLessThan(16);
    }
  }
  // Same seed, same trail (decision ids aside: they come from a process-wide counter).
  const strip = (o: typeof audit) => Object.values(o).flatMap((t) => t!.map(({ decisionId: _, ...rest }) => rest));
  expect(strip(simulateWithAudit(params, "sim-audit-test").audit)).toEqual(strip(audit));
}, 60_000);
