// All four rule sets on every metric, mean and (lowest–highest seed). Headers are the labels from GET /policies.
// Colour comes only from the values: a cell is tinted when its seed range lies clearly beyond every other rule
// set's range (better or worse for riders' safety and service). Overlapping ranges stay neutral and the row
// says "no clear difference". Money rows are never tinted: pay amounts are placeholders.
import type { NumericMetric, PolicyVersion, SimResult } from "@heatgate/contracts";
import { usePolicyLabels } from "../hooks/index.ts";
import { clearExtreme, fmt, overlappingPairs, stat } from "../lib/stats.ts";

interface Row {
  metric: NumericMetric;
  label: string;
  digits?: number;
  prefix?: string;
  suffix?: string;
  better?: "low" | "high"; // no value = never coloured
  money?: boolean;
}

const SECTIONS: { title: string; icon: string; rows: Row[] }[] = [
  {
    title: "Safety",
    icon: "shield",
    rows: [
      { metric: "unsafeExposureMin90", label: "Unsafe outdoor minutes beyond 90 min since rest", better: "low" },
      { metric: "unsafeExposureMin120", label: "Unsafe outdoor minutes beyond 120 min since rest", better: "low" },
      { metric: "restsForced", label: "Breaks forced" },
      { metric: "pausedRiderMinutes", label: "Paused rider-minutes" },
    ],
  },
  {
    title: "Speed and reliability",
    icon: "speed",
    rows: [
      { metric: "ordersDelivered", label: "Delivered orders", better: "high" },
      { metric: "avgDeliveryMinutes", label: "Average delivery time (min)", digits: 1, better: "low" },
      { metric: "p90DeliveryMinutes", label: "Slowest 10% of deliveries (min)", better: "low" },
      { metric: "ordersLate", label: "Late orders (over 45 min or untaken 30 min)", better: "low" },
    ],
  },
  {
    title: "Rider earnings (placeholder pay)",
    icon: "currency_rupee",
    rows: [
      { metric: "avgEarningsPerRiderInr", label: "Average rider earnings", prefix: "₹", money: true },
      { metric: "minEarningsPerRiderInr", label: "Lowest-earning rider", prefix: "₹", money: true },
      { metric: "incentiveHitRatePct", label: "Riders who reached their bonus target", suffix: "%", money: true },
    ],
  },
];

// Rule sets that pay for rest: their earnings rest on placeholder pay, so they carry a caveat.
const EARNINGS_CAVEAT: PolicyVersion[] = ["union-demand", "heatgate-fair"];

export function PolicyComparisonMatrix({ sim }: { sim: SimResult | undefined }) {
  const labels = usePolicyLabels();
  if (!sim) {
    return (
      <div className="w-full h-24 flex items-center justify-center border border-dashed border-outline-variant rounded-xl text-on-surface-variant text-xs">
        Run a simulation to see the comparison matrix
      </div>
    );
  }

  const { params } = sim;
  const seeds = params.seeds.length;
  const oneSeed = seeds === 1;
  const policies = labels.list.filter((p) => sim.runs[p.id]);
  const weather =
    params.weather?.kind === "replay" ? `Replay: ${params.weather.weatherDayId}` : `Slider: ${params.peakTempC}°C peak, ${params.humidityPct}% humidity`;

  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden flex flex-col">
      <div className="p-4 lg:p-5 border-b border-outline-variant bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "24px" }}>
            Policy Comparison Matrix ({params.riders} riders)
          </h2>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {oneSeed
              ? "1 seed: one simulated day, so there is no range and nothing is compared. Use 5 seeds for any number you present."
              : `Mean and (lowest–highest) across ${seeds} seeds. Every rule set sees the same simulated days.`}{" "}
            Assumes {params.multiAppPct}% of riders keep working on another app during breaks (to confirm with riders).
          </p>
          {!oneSeed && (
            <p className="text-[11px] text-on-surface-variant mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#E6F4F1] border border-primary/40" /> range clearly better than every other rule set
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-error-container border border-error/40" /> clearly worse than every other
              </span>
              <span>Otherwise neutral. Money rows are never coloured.</span>
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant font-mono text-xs font-semibold text-on-surface">
            {seeds} {oneSeed ? "seed" : "seeds"}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant font-mono text-xs font-semibold text-on-surface">
            {weather}
          </span>
        </div>
      </div>

      <div className="overflow-x-auto w-full">
        <table className="w-full table-fixed text-left border-collapse min-w-[980px]">
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
            {SECTIONS.map((section) => [
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
                return (
                  <tr key={row.metric} className="hover:bg-surface-container-low transition-colors align-top">
                    <td className="py-2 px-4">
                      <div className="font-medium text-on-surface">{row.label}</div>
                      {same.length > 0 && (
                        <div className="text-[10px] text-on-surface-variant mt-0.5">
                          No clear difference: {same.map(([a, b]) => `${a.short} ≈ ${b.short}`).join(", ")}
                        </div>
                      )}
                    </td>
                    {policies.map((p, i) => {
                      const s = stats[i];
                      const extreme = row.better && !row.money ? clearExtreme(stats, i, oneSeed) : undefined;
                      const num = (v: number) => `${row.prefix ?? ""}${fmt(v, row.digits ?? 0)}${row.suffix ?? ""}`;
                      const tone = extreme === undefined ? "" : extreme === row.better ? "bg-[#E6F4F1]" : "bg-error-container/60";
                      return (
                        <td key={p.id} className={`py-2 px-3.5 ${tone}`}>
                          {s ? (
                            <>
                              <div className="font-mono text-sm font-bold text-on-surface">{num(s.mean)}</div>
                              {!oneSeed && (
                                <div className="font-mono text-[10px] text-on-surface-variant">
                                  ({num(s.min)}–{num(s.max)})
                                  {row.prefix === "₹" && " placeholder"}
                                </div>
                              )}
                              {row.money && row.metric === "avgEarningsPerRiderInr" && EARNINGS_CAVEAT.includes(p.id) && (
                                <div className="text-[10px] text-on-surface-variant mt-0.5 max-w-[22ch]">
                                  Placeholder pay amounts: not evidence that riders earn more.
                                </div>
                              )}
                            </>
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
    </div>
  );
}
