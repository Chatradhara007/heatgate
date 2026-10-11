// Platform view: all four rule sets side by side on the same simulated days. It leads with three key numbers
// per rule set (big tiles with range bars on a shared axis); the full metric cards sit behind "Details", then
// the break-even view.
// Every number comes from the active SimResult (mean and lowest–highest seed) or GET /break-even; nothing is typed in.
// Overlapping seed ranges are called "no clear difference", never ranked. Bars are neutral: no colour by rule set.
import { useState } from "react";
import { Link } from "react-router-dom";
import type { NumericMetric, PolicyVersion, SimResult } from "@heatgate/contracts";
import { usePolicyLabels } from "../hooks/index.ts";
import { useActiveSimulation } from "../context/SimulationContext.tsx";
import { RunStatus } from "../components/RunStatus.tsx";
import { BreakEvenChart } from "../components/BreakEvenChart.tsx";
import { fmt, overlaps, stat, withRange } from "../lib/stats.ts";
import { Badge, InfoTip, MultiAppBadge, RangeBar } from "../components/ui.tsx";

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
        <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
          {def.title}
          <InfoTip>{def.note}</InfoTip>
        </h3>
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
      {pairs.length > 0 && (
        <details className="text-[11px]">
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

// The three numbers each rule set's tile leads with. Same axis per metric across tiles, so bars compare.
const KEY: { metric: NumericMetric; label: string; digits: number; suffix?: string; info: string }[] = [
  {
    metric: "unsafeExposureMin90",
    label: "Unsafe minutes >90",
    digits: 0,
    info: "Rider-minutes outdoors at heat index ≥ 38 °C after 90 minutes without a break (all riders, one day). Lower is safer.",
  },
  { metric: "ordersDelivered", label: "Orders delivered", digits: 0, info: "Orders that reached the customer in one simulated day." },
  {
    metric: "earningsPctOfNoRules",
    label: "Earnings vs today · placeholder pay",
    digits: 1,
    suffix: "%",
    info: "The average rider's earnings as a % of today's on the same seed. Placeholder pay: not evidence that riders earn more.",
  },
];

function KeyTiles({ sim, policies, oneSeed }: { sim: SimResult; policies: { id: PolicyVersion; label: string; short: string }[]; oneSeed: boolean }) {
  const axes = KEY.map((k) => Math.max(...policies.map((p) => stat(sim, p.id, k.metric)?.max ?? 0), 1e-9));
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {policies.map((p) => (
        <div key={p.id} className={card}>
          <h3 className="text-sm font-bold text-on-surface leading-tight min-h-[2.5em]">{p.label}</h3>
          {KEY.map((k, ki) => {
            const s = stat(sim, p.id, k.metric);
            if (!s) return null;
            const num = (v: number) => `${fmt(v, k.digits)}${k.suffix ?? ""}`;
            // Rule sets whose range overlaps this one: "no clear difference".
            const same = oneSeed
              ? []
              : policies.filter((o) => {
                  if (o.id === p.id) return false;
                  const os = stat(sim, o.id, k.metric);
                  return os !== undefined && overlaps(s, os);
                });
            return (
              <div key={k.metric} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">{k.label}</span>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-mono text-[28px] leading-none font-bold text-on-surface">{num(s.mean)}</span>
                  {!oneSeed && (
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      {num(s.min)}–{num(s.max)}
                    </span>
                  )}
                </div>
                <RangeBar mean={s.mean} min={s.min} max={s.max} axisMax={axes[ki]} oneSeed={oneSeed} />
                {same.length > 0 && (
                  <span className="text-[11px] text-on-surface-variant" title="Ranges overlap: no clear difference">
                    ≈ {same.map((o) => o.short).join(", ")}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function ComparePage() {
  const { activeSim: sim, loading, restoreError } = useActiveSimulation();
  const labels = usePolicyLabels();
  const [details, setDetails] = useState(false);

  const header = (
    <div>
      <h1 className="text-2xl lg:text-3xl font-bold text-on-surface">Platform View</h1>
      <p className="text-sm text-on-surface-variant mt-0.5">Four rule sets on the same simulated days.</p>
    </div>
  );

  if (!sim) {
    return (
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-4 pb-12">
        {header}
        <RunStatus />
        {!loading && (
          <p className="text-sm text-on-surface-variant">
            {restoreError ? "" : "No results yet. "}Run a simulation on the{" "}
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

      <section className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-on-surface-variant flex items-center gap-1">
            {oneSeed ? "1 seed: no ranges, nothing compared." : `Mean, then lowest–highest of ${seeds} seeds. ≈ = no clear difference.`}
            <InfoTip label="How to read these numbers">
              {oneSeed
                ? "One simulated day, so no ranges and no comparisons. Use 5 seeds for any number you present. "
                : `Each tile shows the mean, with the lowest and highest of ${seeds} seeds; the bar shows both on a scale shared by all four tiles. Where two rule sets' ranges overlap we say "no clear difference" (≈). `}
              The alert level is assumed from the peak temperature, not a real IMD alert.
            </InfoTip>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <MultiAppBadge pct={params.multiAppPct} />
            {params.fairFeatures.shadeWaitCountsAsRest && (
              <Badge icon="umbrella" tone="warn">
                Shade waiting ON: assumes restaurants have shade (unverified)
              </Badge>
            )}
          </div>
        </div>
        <KeyTiles sim={sim} policies={policies} oneSeed={oneSeed} />
      </section>

      <section className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setDetails(!details)}
          aria-expanded={details}
          className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-bold text-primary hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-[18px]">{details ? "expand_less" : "expand_more"}</span>
          Details
        </button>
        {details && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {METRICS.map((def) => (
              <MetricCard key={def.metric} sim={sim} def={def} policies={policies} oneSeed={oneSeed} />
            ))}
            {fairRestPay && fairHeatFee && (
              <div className={card}>
                <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                  Rest pay vs heat fee ({labels.short("heatgate-fair")})
                  <InfoTip>The heat fee is a hypothesis: customers may order less. Placeholder amounts.</InfoTip>
                </h3>
                <p className="text-sm text-on-surface">
                  Rest pay paid: <strong className="font-mono">{withRange(fairRestPay, oneSeed, 0, "₹")}</strong>
                </p>
                <p className="text-sm text-on-surface">
                  Heat fee collected: <strong className="font-mono">{withRange(fairHeatFee, oneSeed, 0, "₹")}</strong>
                </p>
                <p className="text-xs font-mono text-on-surface-variant">
                  {feeShare === undefined ? "No rest pay in this run." : `Heat fee covers ${fmt(feeShare)}% of rest pay (means).`}
                </p>
              </div>
            )}
          </div>
        )}
      </section>

      <BreakEvenChart />
    </div>
  );
}
