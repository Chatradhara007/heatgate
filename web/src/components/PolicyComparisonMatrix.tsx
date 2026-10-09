import React from "react";
import type { SimResult, PolicyVersion } from "@heatgate/contracts";

const POLICIES: PolicyVersion[] = [
  "no-rules",
  "ndma-2025",
  "union-demand",
  "heatgate-fair",
];

interface MatrixProps {
  sim: SimResult | undefined;
}

const formatNum = (num: number, isCurrency = false, isPct = false) => {
  if (num === undefined || num === null) return "0";
  const str = Math.round(num).toLocaleString("en-IN");
  if (isCurrency) return `₹${str}`;
  if (isPct) return `${str}%`;
  return str;
};

const formatFloat = (num: number) => {
  if (num === undefined || num === null) return "0.0";
  return num.toFixed(1);
};

export function PolicyComparisonMatrix({ sim }: MatrixProps) {
  if (!sim) {
    return (
      <div className="w-full h-24 flex items-center justify-center border border-dashed border-outline-variant rounded-xl text-on-surface-variant text-xs">
        Run simulation to view comparison matrix
      </div>
    );
  }

  const getMetric = (policy: PolicyVersion, key: string, type: "int" | "float" | "currency" | "pct" = "int") => {
    const run = sim.runs[policy];
    if (!run) return { mean: "-", range: "-" };
    
    // @ts-ignore
    const meanVal = run.metrics[key];
    // @ts-ignore
    const rangeVal = run.range?.[key];

    let mean = "-";
    let range = "-";

    if (type === "int") {
      mean = formatNum(meanVal);
      range = rangeVal ? `${formatNum(rangeVal.min)}–${formatNum(rangeVal.max)}` : "-";
    } else if (type === "float") {
      mean = formatFloat(meanVal);
      range = rangeVal ? `${formatFloat(rangeVal.min)}–${formatFloat(rangeVal.max)}` : "-";
    } else if (type === "currency") {
      mean = formatNum(meanVal, true);
      range = "[placeholder]";
    } else if (type === "pct") {
      mean = formatNum(meanVal, false, true);
      range = rangeVal ? `${formatNum(rangeVal.min)}–${formatNum(rangeVal.max)}%` : "-";
    }

    return { mean, range };
  };

  const peak = sim.params.peakTempC;

  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Header & Scenario Context (compact) */}
      <div className="p-4 lg:p-5 border-b border-outline-variant bg-surface-container-low flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h2 className="font-headline-md text-headline-md font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "24px" }}>
            Policy Comparison Matrix (50 Riders · Heatwave Scenario)
          </h2>
          <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
            Mean and range across 5 seeds. Same simulated day for every rule set.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant font-mono text-xs font-semibold text-on-surface shadow-xs">
            Sample: n=5 seeds
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant font-mono text-xs font-semibold text-on-surface shadow-xs">
            Weather: {peak}°C Peak
          </span>
        </div>
      </div>

      {/* Responsive Comparison Table (compact py-2.5 rows) */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="border-b border-outline-variant text-on-surface-variant text-[11px] uppercase tracking-wider font-semibold bg-surface-container-low">
              <th className="py-2.5 px-4 w-1/4">Metric</th>
              <th className="py-2.5 px-3.5 w-[18%]">Today: Voluntary Measures<br /><span className="text-[10px] font-normal lowercase">(nothing enforced)</span></th>
              <th className="py-2.5 px-3.5 w-[18%]">NDMA Advisory Rules<br /><span className="text-[10px] font-normal lowercase">(government advisory)</span></th>
              <th className="py-2.5 px-3.5 w-[18%]">Union Demand (IFAT)<br /><span className="text-[10px] font-normal lowercase">(labor federation)</span></th>
              <th className="py-2.5 px-4 w-[21%] bg-[#E6F4F1] border-t-2 border-primary text-primary">
                <div className="flex items-center justify-between">
                  <span>HeatGate Fair</span>
                  <span className="text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-primary text-on-primary">Our proposal</span>
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant text-xs">
            
            {/* SECTION 1: SAFETY */}
            <tr className="bg-surface-container-high/60 font-semibold text-on-surface">
              <td className="py-1.5 px-4 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5" colSpan={5}>
                <span className="material-symbols-outlined text-[14px] text-primary">shield</span>
                <span>Section 1: Occupational Safety</span>
              </td>
            </tr>

            {/* Unsafe outdoor minutes beyond 90 min */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Unsafe outdoor minutes beyond 90 min since rest</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "unsafeExposureMin90");
                const isFair = p === "heatgate-fair";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>

            {/* Unsafe outdoor minutes beyond 120 min */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Unsafe outdoor minutes beyond 120 min since rest</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "unsafeExposureMin120");
                const isFair = p === "heatgate-fair";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>

            {/* Breaks forced */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Breaks forced</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "restsForced");
                const isFair = p === "heatgate-fair";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>

            {/* Paused rider-minutes */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Paused rider-minutes</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "pausedRiderMinutes");
                const isFair = p === "heatgate-fair";
                const isError = p === "ndma-2025";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : isError ? 'text-error' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>

            {/* SECTION 2: SPEED */}
            <tr className="bg-surface-container-high/60 font-semibold text-on-surface">
              <td className="py-1.5 px-4 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5" colSpan={5}>
                <span className="material-symbols-outlined text-[14px] text-primary">speed</span>
                <span>Section 2: Fulfillment Velocity &amp; Reliability</span>
              </td>
            </tr>

            {/* Average delivery time */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Average delivery time (min)</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "avgDeliveryMinutes", "float");
                const isFair = p === "heatgate-fair";
                const isError = p === "ndma-2025";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : isError ? 'text-error' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>

            {/* Slowest 10% of deliveries */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Slowest 10% of deliveries (min)</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "p90DeliveryMinutes", "int");
                const isFair = p === "heatgate-fair";
                const isError = p === "ndma-2025";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : isError ? 'text-error' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>

            {/* Late orders */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Late orders (over 45 min)</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "ordersLate", "int");
                const isFair = p === "heatgate-fair";
                const isError = p === "ndma-2025";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : isError ? 'text-error' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>

            {/* SECTION 3: MONEY */}
            <tr className="bg-surface-container-high/60 font-semibold text-on-surface">
              <td className="py-1.5 px-4 font-mono text-[11px] uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5" colSpan={5}>
                <span className="material-symbols-outlined text-[14px] text-primary">currency_rupee</span>
                <span>Section 3: Economics &amp; Rider Earnings</span>
              </td>
            </tr>

            {/* Average rider earnings */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Average rider earnings</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "avgEarningsPerRiderInr", "currency");
                const isFair = p === "heatgate-fair";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`flex items-center gap-1 font-mono text-sm font-bold ${isFair ? 'text-primary' : 'text-on-surface'}`}>
                      <span>{mean}</span>
                      <span className={`text-[10px] font-normal ${isFair ? 'text-primary/70' : 'text-on-surface-variant'}`}>{range}</span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Lowest-earning rider */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Lowest-earning rider</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "minEarningsPerRiderInr", "currency");
                const isFair = p === "heatgate-fair";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`flex items-center gap-1 font-mono text-sm font-bold ${isFair ? 'text-primary' : 'text-on-surface'}`}>
                      <span>{mean}</span>
                      <span className={`text-[10px] font-normal ${isFair ? 'text-primary/70' : 'text-on-surface-variant'}`}>{range}</span>
                    </div>
                  </td>
                );
              })}
            </tr>

            {/* Riders who reached incentive target */}
            <tr className="hover:bg-[#F7F7F4] transition-colors">
              <td className="py-2 px-4 font-medium text-on-surface">Riders who reached incentive target</td>
              {POLICIES.map((p) => {
                const { mean, range } = getMetric(p, "incentiveHitRatePct", "pct");
                const isFair = p === "heatgate-fair";
                const isError = p === "ndma-2025";
                return (
                  <td key={p} className={`py-2 ${isFair ? 'px-4 bg-[#E6F4F1]/60' : 'px-3.5'}`}>
                    <div className={`font-mono text-sm font-bold ${isFair ? 'text-primary' : isError ? 'text-error' : 'text-on-surface'}`}>{mean}</div>
                    <div className={`font-mono text-[10px] ${isFair ? 'text-primary/80' : 'text-on-surface-variant'}`}>{range}</div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
