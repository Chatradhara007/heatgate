// Platform view: all four rule sets side by side on the same simulated days, then the break-even view.
// Every number comes from the active SimResult (mean and lowest–highest seed) or GET /break-even; nothing is typed in.
// Overlapping seed ranges are called "no clear difference", never ranked. Bars are neutral: no colour by rule set.
import { Link } from "react-router-dom";
import type { NumericMetric, PolicyVersion, SimResult } from "@heatgate/contracts";
import { usePolicyLabels } from "../hooks/index.ts";
import { useActiveSimulation } from "../context/SimulationContext.tsx";
import { RunStatus } from "../components/RunStatus.tsx";
import { BreakEvenChart } from "../components/BreakEvenChart.tsx";
import { fmt, overlaps, stat, withRange } from "../lib/stats.ts";

interface MetricDef {
  metric: NumericMetric;
  title: string;
  unit: string; // after the number in the pair verdicts
  digits: number;
  prefix?: string;
  suffix?: string;
  money?: boolean;
  note: string;
}

const METRICS: MetricDef[] = [
  { metric: "ordersDelivered", title: "Delivered orders", unit: "orders", digits: 0, note: "Orders that reached the customer in one simulated day." },
  {
    metric: "unsafeExposureMin90",
    title: "Unsafe minutes beyond 90 min since rest",
    unit: "rider-min",
    digits: 0,
    note: "Rider-minutes outdoors at heat index ≥ 38 °C after 90 minutes without a break (all riders, one day).",
  },
  {
    metric: "unsafeExposureMin120",
    title: "Unsafe minutes beyond 120 min since rest",
    unit: "rider-min",
    digits: 0,
    note: "The same, after 120 minutes without a break.",
  },
  {
    metric: "earningsPctOfNoRules",
    title: "Earnings, % of today",
    unit: "points",
    digits: 1,
    suffix: "%",
    money: true,
    note: "The average rider's earnings as a % of today's on the same seed. At placeholder rest pay a break can pay more than delivering, so this is not evidence that riders earn more.",
  },
  {
    metric: "minEarningsPerRiderInr",
    title: "Lowest-earning rider",
    unit: "₹",
    digits: 0,
    prefix: "₹",
    money: true,
    note: "The worst-paid rider on shift at least 2 hours. ₹ amounts are placeholders.",
  },
];

const card = "bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-3";
const placeholderTag = "text-[10px] font-mono text-on-surface-variant bg-surface-container-low border border-outline-variant px-2 py-0.5 rounded";

function MetricCard({ sim, def, policies, oneSeed }: { sim: SimResult; def: MetricDef; policies: { id: PolicyVersion; label: string; short: string }[]; oneSeed: boolean }) {
  const rows = policies.flatMap((p) => {
    const s = stat(sim, p.id, def.metric);
    return s ? [{ ...p, stat: s }] : [];
  });
  const axis = Math.max(...rows.map((r) => r.stat.max), 1e-9);
  const pos = (v: number) => `${Math.max(0, (v / axis) * 100)}%`;
  const pairs: { a: (typeof rows)[number]; b: (typeof rows)[number]; text: string }[] = [];
  for (let i = 0; i < rows.length; i++)
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      let text: string;
      if (oneSeed) text = "1 seed: no range, run 5 seeds to compare";
      else if (overlaps(a.stat, b.stat)) text = "no clear difference (ranges overlap)";
      else {
        const [lo, hi] = a.stat.mean < b.stat.mean ? [a, b] : [b, a];
        text = `${lo.short} lower by ${def.prefix ?? ""}${fmt(hi.stat.mean - lo.stat.mean, def.digits)} ${def.prefix ? "" : def.unit} (ranges do not overlap)`.replace(/ +\(/, " (");
      }
      pairs.push({ a, b, text });
    }

  return (
    <div className={card}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">{def.title}</h3>
        {def.money && <span className={placeholderTag}>placeholder</span>}
      </div>
      <div className="flex flex-col gap-2.5">
        {rows.map((r) => (
          <div key={r.id} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <span className="text-xs text-on-surface">{r.label}</span>
              <span className="font-mono text-xs font-bold text-on-surface">{withRange(r.stat, oneSeed, def.digits, def.prefix ?? "", def.suffix ?? "")}</span>
            </div>
            <div className="relative h-3 bg-surface-container-low border border-outline-variant rounded" aria-hidden="true">
              <div className="absolute inset-y-0 left-0 rounded bg-outline/60" style={{ width: pos(r.stat.mean) }} />
              {!oneSeed && (
                <div
                  className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-on-surface"
                  style={{ left: pos(r.stat.min), width: `calc(${pos(r.stat.max)} - ${pos(r.stat.min)})` }}
                />
              )}
            </div>
          </div>
        ))}
        {rows.length < policies.length && <p className="text-[11px] text-on-surface-variant">Rule sets missing from this run are not shown.</p>}
      </div>
      <p className="text-[11px] text-on-surface-variant">{def.note}</p>
      {pairs.length > 0 && (
        <details className="text-[11px]" open={rows.length <= 4}>
          <summary className="cursor-pointer font-semibold text-on-surface-variant">Pair by pair</summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-on-surface">
            {pairs.map(({ a, b, text }) => (
              <li key={`${a.id}-${b.id}`}>
                <span className="font-semibold">
                  {a.short} vs {b.short}:
                </span>{" "}
                {text}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export function ComparePage() {
  const { activeSim: sim, loading, restoreError } = useActiveSimulation();
  const labels = usePolicyLabels();

  const header = (
    <div>
      <h1 className="text-2xl lg:text-3xl font-bold text-on-surface">Platform View</h1>
      <p className="text-sm text-on-surface-variant mt-0.5">All four rule sets on the same simulated days, then what rest pay it takes to match today's earnings.</p>
    </div>
  );

  if (!sim) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-4 pb-12">
        {header}
        <RunStatus />
        {!loading && (
          <p className="text-sm text-on-surface-variant">
            {restoreError ? "" : "No results yet. "}Run a simulation (all four rule sets) on the{" "}
            <Link to="/simulator" className="font-bold text-primary underline">
              Policy Sandbox
            </Link>{" "}
            first.
          </p>
        )}
        <BreakEvenChart />
      </div>
    );
  }

  const { params } = sim;
  const seeds = params.seeds.length;
  const oneSeed = seeds === 1;
  const policies = labels.list.filter((p) => sim.runs[p.id]);
  const weather =
    params.weather?.kind === "replay" ? `replay of ${params.weather.weatherDayId}` : `${params.peakTempC}°C peak, ${params.humidityPct}% humidity`;
  const fairRestPay = stat(sim, "heatgate-fair", "restPayTotalInr");
  const fairHeatFee = stat(sim, "heatgate-fair", "heatFeeCollectedInr");
  const feeShare = fairRestPay && fairHeatFee && fairRestPay.mean > 0 ? (fairHeatFee.mean / fairRestPay.mean) * 100 : undefined;

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        {header}
        <span className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-outline-variant bg-surface-container-lowest text-on-surface font-mono text-xs">
          {weather} · {params.riders} riders · {seeds} {oneSeed ? "seed" : "seeds"}
        </span>
      </header>

      <RunStatus />

      <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-4 text-xs text-on-surface-variant leading-relaxed">
        {oneSeed
          ? "1 seed: one simulated day, so no ranges and no comparisons. Use 5 seeds for any number you present. "
          : `Each number is the mean, with the lowest and highest of ${seeds} seeds in brackets. Where two rule sets' ranges overlap we say "no clear difference". `}
        All rupee amounts are placeholders until rider interviews. Assumes {params.multiAppPct}% of riders keep working on another app during
        breaks (to confirm with riders), which keeps their heat exposure counting. The alert level is assumed from the peak temperature, not a
        real IMD alert. Heat index is a proxy for outdoor heat stress, not a medical measure.
        {params.fairFeatures.shadeWaitCountsAsRest && " Shade waiting is ON: it assumes restaurants have shade for riders (unverified)."}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-on-surface">Four rule sets, side by side</h2>
        <p className="text-xs text-on-surface-variant -mt-2">Bars are means; the dark line spans the lowest to highest seed.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {METRICS.map((def) => (
            <MetricCard key={def.metric} sim={sim} def={def} policies={policies} oneSeed={oneSeed} />
          ))}
          {fairRestPay && fairHeatFee && (
            <div className={card}>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Rest pay vs heat fee ({labels.label("heatgate-fair")})</h3>
                <span className={placeholderTag}>placeholder</span>
              </div>
              <p className="text-sm text-on-surface">
                Rest pay paid: <strong className="font-mono">{withRange(fairRestPay, oneSeed, 0, "₹")}</strong>
              </p>
              <p className="text-sm text-on-surface">
                Heat fee collected: <strong className="font-mono">{withRange(fairHeatFee, oneSeed, 0, "₹")}</strong>
              </p>
              <p className="text-xs font-mono text-on-surface-variant">
                {feeShare === undefined ? "No rest pay in this run." : `The heat fee covers ${fmt(feeShare)}% of the rest pay (means, placeholder amounts).`}
              </p>
              <p className="text-[11px] text-on-surface-variant">The heat fee is a hypothesis: customers may order less.</p>
            </div>
          )}
        </div>
      </section>

      <BreakEvenChart />
    </div>
  );
}

