// Mean and lowest–highest seed for one metric of one rule set, and the overlap test behind every
// "no clear difference" on screen (docs/api-guide.md §5, "Ranges across seeds").
import type { NumericMetric, PolicyVersion, SimResult } from "@heatgate/contracts";

export interface Stat {
  mean: number;
  min: number;
  max: number;
}

export function stat(sim: SimResult, policy: PolicyVersion, metric: NumericMetric): Stat | undefined {
  const run = sim.runs[policy];
  if (!run) return undefined;
  const r = run.range[metric];
  return { mean: run.metrics[metric], min: r.min, max: r.max };
}

// Touching ranges count as overlapping: we only call a difference clear when there is a gap.
export const overlaps = (a: Stat, b: Stat) => a.min <= b.max && b.min <= a.max;

export function fmt(n: number, digits = 0) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

// "4,175 (3,587–5,362)"; with one seed just the mean.
export function withRange(s: Stat, oneSeed: boolean, digits = 0, prefix = "", suffix = "") {
  const mean = `${prefix}${fmt(s.mean, digits)}${suffix}`;
  return oneSeed ? mean : `${mean} (${prefix}${fmt(s.min, digits)}–${prefix}${fmt(s.max, digits)}${suffix})`;
}

// Per cell: is its range clearly on one side of EVERY other rule set's range? "low" = entirely below all
// others, "high" = entirely above all others, undefined = it overlaps at least one (or there is one seed).
export function clearExtreme(stats: (Stat | undefined)[], index: number, oneSeed: boolean): "low" | "high" | undefined {
  const me = stats[index];
  const others = stats.filter((s, i): s is Stat => i !== index && s !== undefined);
  if (!me || oneSeed || others.length === 0) return undefined;
  if (others.every((o) => me.max < o.min)) return "low";
  if (others.every((o) => me.min > o.max)) return "high";
  return undefined;
}

// Every pair of rule sets whose ranges overlap on this metric.
export function overlappingPairs<T extends { stat: Stat }>(items: T[]): [T, T][] {
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) if (overlaps(items[i].stat, items[j].stat)) pairs.push([items[i], items[j]]);
  return pairs;
}
