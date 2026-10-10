// Break-even view from GET /break-even: rest pay per minute (x) against the average rider's earnings as a % of
// today's (y), one line per rule set per demand level, with a 100 % line (= today). Every rupee is a placeholder.
// There is no single break-even figure: the table gives the per-seed range, or "not reached".
import { useEffect, useState } from "react";
import type { BreakEvenReport, PolicyVersion } from "@heatgate/contracts";
import { useBreakEven, usePolicyLabels } from "../hooks/index.ts";
import { fmt } from "../lib/stats.ts";

// Categorical hues in fixed order (validated: CVD ΔE 29, contrast ≥ 3:1). Identity only, not good/bad.
const HUES = ["#0051d5", "#a15600", "#6b4fbb", "#3e4947"];
// Demand level is the second encoding: dash pattern, lowest demand first.
const DASHES = ["2 4", "", "8 5"];

const M = { top: 16, right: 16, bottom: 44, left: 52 };

// The SVG is drawn at the container's real pixel width, so its 11 px text stays 11 px on a phone and on a wide screen.
// A callback ref, because the chart's box only mounts once the sweep has loaded.
function useWidth() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, width] as const;
}

type Level = BreakEvenReport["levels"][number];
type PolicyEntry = NonNullable<Level["policies"][PolicyVersion]>;

const rupees = (n: number) => `₹${fmt(n, 2)}`;

function breakEvenText(p: PolicyEntry): string {
  const b = p.breakEven;
  if (b.status === "notReached") {
    return `not reached within the sweep (best ${fmt(b.bestEarningsPctOfNoRules, 1)}% of today at ${rupees(b.atRestPayInrPerMin)}/min, placeholder)`;
  }
  const notAll = b.seedsNotReached > 0 ? `; ${b.seedsNotReached} seed${b.seedsNotReached === 1 ? "" : "s"} never reached it within the sweep` : "";
  return `${rupees(b.perSeedMinInrPerMin)}–${rupees(b.perSeedMaxInrPerMin)} per min across seeds (placeholder)${notAll}`;
}

// Compares the rule sets' per-seed break-even ranges at one demand level. Overlap = "no clear difference".
function levelCompare(entries: PolicyEntry[]): string {
  if (entries.length < 2) return "—";
  const reached = entries.map((e) => e.breakEven).filter((b) => b.status === "reached");
  if (reached.length === 0) return "Not reached by any rule set within the sweep.";
  if (reached.length !== entries.length) return "Not reached by every rule set, so no range to compare.";
  const lo = Math.max(...reached.map((b) => b.perSeedMinInrPerMin));
  const hi = Math.min(...reached.map((b) => b.perSeedMaxInrPerMin));
  return lo <= hi ? "Ranges overlap: no clear difference." : "Ranges do not overlap.";
}

export function BreakEvenChart() {
  const report = useBreakEven();
  const labels = usePolicyLabels();
  const [hover, setHover] = useState<number | undefined>(undefined);
  const [boxRef, W] = useWidth();
  const H = Math.min(380, Math.max(260, Math.round(W * 0.5)));

  const shell = (body: React.ReactNode) => (
    <section className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 sm:p-6 shadow-xs flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-bold text-on-surface">Break-even rest pay</h2>
        <p className="text-xs text-on-surface-variant mt-0.5">
          The rest pay per minute at which a rule set's average rider earns as much as today. Pre-computed sweep, not this run.
        </p>
      </div>
      {body}
    </section>
  );

  if (report.loading) return shell(<p className="text-sm text-on-surface-variant">Loading the break-even sweep…</p>);
  if (report.error || !report.data) {
    return shell(
      <p role="alert" className="text-sm text-error">
        Could not load the break-even sweep: {report.error?.message ?? "no data"}
      </p>,
    );
  }

  const data = report.data;
  const rates = data.restPayRatesInrPerMin;
  const policyIds = labels.list.map((p) => p.id).filter((id) => data.levels.some((l) => l.policies[id]));
  const series = data.levels.flatMap((level, li) =>
    policyIds.flatMap((id, pi) => {
      const entry = level.policies[id];
      if (!entry) return [];
      return [{ key: `${id}-${level.ordersPerHour}`, id, level, entry, hue: HUES[pi % HUES.length], dash: DASHES[li % DASHES.length] }];
    }),
  );

  const allY = series.flatMap((s) => s.entry.rows.flatMap((r) => [r.earningsPctOfNoRules.min, r.earningsPctOfNoRules.max])).concat(100);
  const yMin = Math.floor(Math.min(...allY) / 10) * 10;
  const yMax = Math.ceil(Math.max(...allY) / 10) * 10;
  const xMax = Math.max(...rates, 1e-9);
  const x = (v: number) => M.left + (v / xMax) * (W - M.left - M.right);
  const y = (v: number) => M.top + ((yMax - v) / (yMax - yMin)) * (H - M.top - M.bottom);
  const yTicks: number[] = [];
  for (let t = yMin; t <= yMax; t += 10) yTicks.push(t);

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    rates.forEach((r, i) => Math.abs(x(r) - px) < Math.abs(x(rates[best]) - px) && (best = i));
    setHover(best);
  };

  const hoverRate = hover === undefined ? undefined : rates[hover];
  const narrow = W < 520; // phone: the tooltip goes under the chart instead of over it
  const tipLeft = hover === undefined ? 0 : (x(rates[hover]) / W) * 100;

  return shell(
    <>
      <div className="rounded-xl border border-outline-variant bg-surface-container-low p-3 text-xs text-on-surface-variant leading-relaxed">
        {data.note} Every ₹ on this chart is a placeholder, so read the shapes, not the prices. Each line is the mean over{" "}
        {data.params.seeds.length} seeds; the table below gives the lowest–highest seed.
        {data.stale && (
          <strong className="block mt-1 text-error">
            Warning: this sweep was made with settings that differ from today's defaults. Re-run npm run sim:breakeven before quoting it.
          </strong>
        )}
      </div>

      {/* Legend: colour = rule set, dash = demand level */}
      <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-on-surface">
        {policyIds.map((id, pi) => (
          <span key={id} className="flex items-center gap-1.5">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" stroke={HUES[pi % HUES.length]} strokeWidth="2" strokeLinecap="round" />
            </svg>
            {labels.label(id)}
          </span>
        ))}
        {data.levels.map((l, li) => (
          <span key={l.ordersPerHour} className="flex items-center gap-1.5 text-on-surface-variant">
            <svg width="22" height="8" aria-hidden="true">
              <line x1="1" y1="4" x2="21" y2="4" stroke="currentColor" strokeWidth="2" strokeDasharray={DASHES[li % DASHES.length]} />
            </svg>
            {l.ordersPerHour} orders/h
          </span>
        ))}
      </div>

      <div ref={boxRef} className="relative w-full min-w-0 overflow-hidden">
        <svg
          width={W}
          height={H}
          viewBox={`0 0 ${W} ${H}`}
          className="block touch-pan-y"
          role="img"
          aria-label="Earnings as a percent of today against placeholder rest pay per minute, one line per rule set and demand level"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(undefined)}
        >
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="#e0e3e8" strokeWidth="1" />
              <text x={M.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#3e4947">
                {t}%
              </text>
            </g>
          ))}
          {rates.map((r) => (
            <text key={r} x={x(r)} y={H - M.bottom + 16} textAnchor="middle" fontSize="11" fill="#3e4947">
              ₹{fmt(r, 2)}
            </text>
          ))}
          <text x={(M.left + W - M.right) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#3e4947">
            Rest pay per minute (₹, placeholder)
          </text>
          <text transform={`translate(12 ${(M.top + H - M.bottom) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#3e4947">
            Earnings, % of today
          </text>

          {/* 100 % = today's earnings */}
          <line x1={M.left} x2={W - M.right} y1={y(100)} y2={y(100)} stroke="#181c20" strokeWidth="1.5" strokeDasharray="4 3" />
          <text x={W - M.right} y={y(100) - 5} textAnchor="end" fontSize="11" fill="#181c20" fontWeight="600">
            100% = today
          </text>

          {series.map((s) => (
            <polyline
              key={s.key}
              fill="none"
              stroke={s.hue}
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={s.dash}
              points={s.entry.rows.map((r) => `${x(r.restPayInrPerMin)},${y(r.earningsPctOfNoRules.mean)}`).join(" ")}
            />
          ))}

          {hoverRate !== undefined && (
            <g>
              <line x1={x(hoverRate)} x2={x(hoverRate)} y1={M.top} y2={H - M.bottom} stroke="#6e7977" strokeWidth="1" />
              {series.map((s) => {
                const row = s.entry.rows.find((r) => r.restPayInrPerMin === hoverRate);
                return row ? (
                  <circle key={s.key} cx={x(hoverRate)} cy={y(row.earningsPctOfNoRules.mean)} r="4" fill={s.hue} stroke="#ffffff" strokeWidth="2" />
                ) : null;
              })}
            </g>
          )}
        </svg>

        {hoverRate !== undefined && (
          <div
            className={`pointer-events-none rounded-lg border border-outline-variant bg-surface-container-lowest p-2.5 text-[11px] shadow-md ${
              narrow ? "mt-2" : "absolute top-2 z-10 w-72 max-w-[85%]"
            }`}
            style={narrow ? undefined : tipLeft > 50 ? { right: `${100 - tipLeft + 2}%` } : { left: `${tipLeft + 2}%` }}
          >
            <div className="font-bold text-on-surface mb-1">Rest pay ₹{fmt(hoverRate, 2)}/min (placeholder)</div>
            {series.map((s) => {
              const row = s.entry.rows.find((r) => r.restPayInrPerMin === hoverRate);
              if (!row) return null;
              const e = row.earningsPctOfNoRules;
              return (
                <div key={s.key} className="flex items-start gap-1.5 text-on-surface">
                  <svg width="14" height="6" aria-hidden="true" className="shrink-0 mt-1.5">
                    <line x1="1" y1="3" x2="13" y2="3" stroke={s.hue} strokeWidth="2" strokeDasharray={s.dash} />
                  </svg>
                  <span>
                    {labels.short(s.id)}, {s.level.ordersPerHour}/h: {fmt(e.mean, 1)}% ({fmt(e.min, 1)}–{fmt(e.max, 1)})
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse min-w-[520px]">
          <thead>
            <tr className="border-b border-outline-variant text-on-surface-variant uppercase tracking-wider text-[10px]">
              <th className="py-2 pr-3">Demand</th>
              {policyIds.map((id) => (
                <th key={id} className="py-2 pr-3">
                  {labels.label(id)}
                </th>
              ))}
              <th className="py-2 pr-3">Comparison</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {data.levels.map((l) => {
              const entries = policyIds.map((id) => l.policies[id]).filter((e): e is PolicyEntry => e !== undefined);
              return (
                <tr key={l.ordersPerHour} className="align-top">
                  <td className="py-2 pr-3 font-mono whitespace-nowrap">
                    {l.ordersPerHour} orders/h
                    {l.ordersPerHour === data.params.ordersPerHour && <div className="text-[10px] text-on-surface-variant">default</div>}
                  </td>
                  {policyIds.map((id) => {
                    const e = l.policies[id];
                    return (
                      <td key={id} className="py-2 pr-3 text-on-surface">
                        {e ? breakEvenText(e) : "not in the sweep"}
                      </td>
                    );
                  })}
                  <td className="py-2 pr-3 text-on-surface-variant">{levelCompare(entries)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <details className="text-xs">
        <summary className="cursor-pointer text-primary font-semibold">Show every point of the chart</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-left border-collapse min-w-[420px]">
            <thead>
              <tr className="border-b border-outline-variant text-on-surface-variant text-[10px] uppercase tracking-wider">
                <th className="py-1.5 pr-3">Rule set</th>
                <th className="py-1.5 pr-3">Demand</th>
                <th className="py-1.5 pr-3">Rest pay (₹/min, placeholder)</th>
                <th className="py-1.5 pr-3">Earnings, % of today (lowest–highest seed)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant font-mono">
              {series.flatMap((s) =>
                s.entry.rows.map((r) => (
                  <tr key={`${s.key}-${r.restPayInrPerMin}`}>
                    <td className="py-1 pr-3 font-sans">{labels.short(s.id)}</td>
                    <td className="py-1 pr-3">{s.level.ordersPerHour}/h</td>
                    <td className="py-1 pr-3">₹{fmt(r.restPayInrPerMin, 2)}</td>
                    <td className="py-1 pr-3">
                      {fmt(r.earningsPctOfNoRules.mean, 1)} ({fmt(r.earningsPctOfNoRules.min, 1)}–{fmt(r.earningsPctOfNoRules.max, 1)})
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </details>
    </>,
  );
}
