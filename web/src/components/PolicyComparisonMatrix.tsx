// All four rule sets on every metric, mean and (lowest–highest seed). Headers are the labels from GET /policies.
// No colour ranks a rule set: each cell has a neutral range bar on the row's shared axis, and a row whose ranges
// overlap says "no clear difference". The key rows show first; the rest sit behind "Show all metrics".
import type { NumericMetric, SimResult } from "@heatgate/contracts";
import { usePolicyLabels } from "../hooks/index.ts";
import { useState } from "react";
import { fmt, overlappingPairs, stat } from "../lib/stats.ts";
import { InfoTip, MultiAppBadge, RangeBar } from "./ui.tsx";

interface Row {
  metric: NumericMetric;
  label: string;
  digits?: number;
  prefix?: string;
  suffix?: string;
  money?: boolean;
  key?: boolean; // shown before "Show all metrics"
}

const SECTIONS: { title: string; icon: string; rows: Row[] }[] = [
  {
    title: "Safety",
    icon: "shield",
    rows: [
      { metric: "unsafeExposureMin90", label: "Unsafe minutes, >90 min since rest", key: true },
      { metric: "unsafeExposureMin120", label: "Unsafe minutes, >120 min since rest", key: true },
      { metric: "restsForced", label: "Breaks forced" },
      { metric: "pausedRiderMinutes", label: "Paused rider-minutes" },
    ],
  },
  {
    title: "Speed and reliability",
    icon: "speed",
    rows: [
      { metric: "ordersDelivered", label: "Delivered orders", key: true },
      { metric: "avgDeliveryMinutes", label: "Avg delivery time (min)", digits: 1 },
      { metric: "p90DeliveryMinutes", label: "Slowest 10% of deliveries (min)" },
      { metric: "ordersLate", label: "Late orders" },
    ],
  },
  {
    title: "Rider earnings · placeholder pay",
    icon: "currency_rupee",
    rows: [
      { metric: "avgEarningsPerRiderInr", label: "Average rider earnings", prefix: "₹", money: true, key: true },
      { metric: "minEarningsPerRiderInr", label: "Lowest-earning rider", prefix: "₹", money: true },
      { metric: "incentiveHitRatePct", label: "Riders at bonus target", suffix: "%", money: true },
    ],
  },
];

const NOTES: Partial<Record<NumericMetric, string>> = {
  unsafeExposureMin90: "Rider-minutes outdoors at heat index ≥ 38 °C after 90 minutes without a break (all riders, one day).",
  unsafeExposureMin120: "The same, after 120 minutes without a break.",
  ordersLate: "Over 45 minutes, or not taken within 30 minutes.",
  avgEarningsPerRiderInr: "Placeholder pay amounts: not evidence that riders earn more.",
};

export function PolicyComparisonMatrix({ sim }: { sim: SimResult | undefined }) {
  const labels = usePolicyLabels();
  const [all, setAll] = useState(false);
  if (!sim) {
    return (
      <div className="w-full h-24 flex items-center justify-center border border-dashed border-outline-variant rounded-xl text-on-surface-variant text-xs">
        Run a simulation to compare the rule sets
      </div>
    );
  }

  const { params } = sim;
  const seeds = params.seeds.length;
  const oneSeed = seeds === 1;
  const policies = labels.list.filter((p) => sim.runs[p.id]);
  const weather =
    params.weather?.kind === "replay" ? `Replay: ${params.weather.weatherDayId}` : `${params.peakTempC}°C peak · ${params.humidityPct}%`;

  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="p-4 lg:p-5 border-b border-outline-variant bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "24px" }}>
            Four rule sets, same days
          </h2>
          <p className="text-xs text-on-surface-variant flex items-center gap-1">
            {oneSeed ? "1 seed: no ranges, nothing compared." : `Mean (lowest–highest) over ${seeds} seeds.`}
            <InfoTip label="How to read the table">
              {oneSeed
                ? "One simulated day, so there is no range and nothing is compared. Use 5 seeds for any number you present."
                : `Big number = mean; small = lowest–highest of ${seeds} seeds; the bar shows both on a shared scale. Every rule set sees the same simulated days. Where ranges overlap we say "no clear difference". Colour never ranks a rule set.`}
            </InfoTip>
          </p>
          <MultiAppBadge pct={params.multiAppPct} />
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant font-mono text-xs font-semibold text-on-surface">
            {params.riders} riders · {seeds} {oneSeed ? "seed" : "seeds"}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant font-mono text-xs font-semibold text-on-surface">
            {weather}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full table-fixed text-left border-collapse min-w-[860px]">
          <thead>
            <tr className="border-b border-outline-variant text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold bg-surface-container-low">
              <th className="py-2.5 px-4 w-1/4">Metric</th>
              {policies.map((p) => (
                <th key={p.id} className="py-2.5 px-3.5">
                  {p.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-xs">
            {SECTIONS.map((section) => ({ ...section, rows: section.rows.filter((r) => all || r.key) }))
              .filter((section) => section.rows.length > 0)
              .map((section) => [
              <tr key={section.title} className="bg-surface-container-high/60">
                <td className="py-1.5 px-4 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant" colSpan={policies.length + 1}>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">{section.icon}</span>
                    {section.title}
                  </span>
                </td>
              </tr>,
              ...section.rows.map((row) => {
                const stats = policies.map((p) => stat(sim, p.id, row.metric));
                const items = policies.flatMap((p, i) => (stats[i] ? [{ ...p, stat: stats[i]! }] : []));
                const same = oneSeed ? [] : overlappingPairs(items);
                const axis = Math.max(...items.map((it) => it.stat.max), 1e-9);
                return (
                  <tr key={row.metric} className="hover:bg-surface-container-low transition-colors align-top">
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-on-surface flex items-center gap-1">
                        {row.label}
                        {NOTES[row.metric] && <InfoTip>{NOTES[row.metric]}</InfoTip>}
                      </div>
                      {same.length > 0 && (
                        <div className="text-[11px] text-on-surface-variant mt-0.5 flex items-center gap-1">
                          ≈ Some ranges overlap
                          <InfoTip label="Which rule sets overlap">
                            No clear difference (ranges overlap): {same.map(([a, b]) => `${a.short} ≈ ${b.short}`).join(", ")}.
                          </InfoTip>
                        </div>
                      )}
                    </td>
                    {policies.map((p, i) => {
                      const s = stats[i];
                      const num = (v: number) => `${row.prefix ?? ""}${fmt(v, row.digits ?? 0)}${row.suffix ?? ""}`;
                      return (
                        <td key={p.id} className="py-2.5 px-3.5">
                          {s ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-baseline gap-1.5 flex-wrap">
                                <span className="font-mono text-base font-bold text-on-surface">{num(s.mean)}</span>
                                {!oneSeed && (
                                  <span className="font-mono text-[10px] text-on-surface-variant">
                                    {num(s.min)}–{num(s.max)}
                                  </span>
                                )}
                              </div>
                              <RangeBar mean={s.mean} min={s.min} max={s.max} axisMax={axis} oneSeed={oneSeed} />
                            </div>
                          ) : (
                            <span className="text-on-surface-variant">not in this run</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        onClick={() => setAll(!all)}
        aria-expanded={all}
        className="self-start m-3 px-3 py-1.5 rounded-lg border border-outline-variant text-xs font-bold text-primary hover:bg-surface-container"
      >
        {all ? "Show key metrics only" : "Show all metrics"}
      </button>
    </div>
  );
}
