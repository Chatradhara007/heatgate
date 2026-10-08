// Audit trail of one simulated day: every decision that is not ALLOW, plus 1 in 20 ALLOWs.
// No randomness: the ALLOW sample is every 20th ALLOW, so a seed always gives the same trail.
import type { Decision } from "@heatgate/contracts";

export const AUDIT_ALLOW_EVERY = 20;
export const AUDIT_CAP_PER_RULE_SET = 3000;

// n items at evenly spaced positions, in their original order.
function spread<T>(items: T[], n: number): T[] {
  if (n >= items.length) return items;
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, k) => items[Math.floor((k * items.length) / n)]);
}

export class AuditSampler {
  private kept: { order: number; decision: Decision }[] = [];
  private seen = 0;
  private allows = 0;

  add(decision: Decision): void {
    const order = this.seen++;
    if (decision.outcome === "ALLOW" && this.allows++ % AUDIT_ALLOW_EVERY !== 0) return;
    this.kept.push({ order, decision });
  }

  // At most `cap` decisions, in time order. Over the cap, non-ALLOW decisions are kept first;
  // whatever is dropped is thinned evenly over the day, not cut off at the end.
  take(cap = AUDIT_CAP_PER_RULE_SET): Decision[] {
    const others = this.kept.filter((k) => k.decision.outcome !== "ALLOW");
    const allows = this.kept.filter((k) => k.decision.outcome === "ALLOW");
    const keptOthers = spread(others, cap);
    const keptAllows = spread(allows, cap - keptOthers.length);
    return [...keptOthers, ...keptAllows].sort((a, b) => a.order - b.order).map((k) => k.decision);
  }
}
