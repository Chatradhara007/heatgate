// HeatGate Fair sandbox: the rendered rules (POST /policies/render) and the three knob sliders (api-guide §4).
import { useEffect, useState } from "react";
import type { FairKnobs, SimParams } from "@heatgate/contracts";
import { useRenderPolicy } from "../hooks/index.ts";
import type { FairRuleSummary } from "../hooks/index.ts";

interface BottomCardsProps {
  params: SimParams;
  setParams: (p: SimParams) => void;
  runSimulation?: () => void;
  running?: boolean;
}

// The API's allowed ranges (contracts/types.ts FairKnobs, docs/api-guide.md §4). Only these three are on screen.
const SLIDERS: { key: keyof FairKnobs; label: string; unit: string; min: number; max: number; mark?: { at: number; label: string } }[] = [
  { key: "restHeatC", label: "Rest heat index threshold", unit: "°C", min: 32, max: 46 },
  { key: "workLimitMin", label: "Work limit before a paid break", unit: "min", min: 60, max: 120, mark: { at: 90, label: "NDMA 90" } },
  { key: "rushHardLimitMin", label: "Rush-hour hard limit", unit: "min", min: 90, max: 150, mark: { at: 120, label: "Union 120" } },
];

const RENDER_DEBOUNCE_MS = 300;

// Keeps the cross-rules so the user cannot build a set the API refuses:
// rushHardLimitMin >= workLimitMin, and earlyRestMin < workLimitMin.
function withKnob(knobs: FairKnobs, key: keyof FairKnobs, value: number): FairKnobs {
  const next = { ...knobs, [key]: value };
  if (key === "workLimitMin") {
    next.workLimitMin = Math.max(value, knobs.earlyRestMin + 1);
    if (next.rushHardLimitMin < next.workLimitMin) next.rushHardLimitMin = next.workLimitMin;
  }
  if (key === "rushHardLimitMin") next.rushHardLimitMin = Math.max(value, knobs.workLimitMin);
  return next;
}

const BADGE: Record<FairRuleSummary["outcome"], string> = {
  ALLOW: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  SKIP_ORDER: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
  DENY: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]",
  FORCE_REST: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
  NO_PENALTY: "bg-[#ECFDF5] text-[#065F46] border-[#A7F3D0]",
};

const titleStyle = { fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "22px" };

export function BottomCards({ params, setParams, runSimulation, running }: BottomCardsProps) {
  const knobs = params.fairKnobs;
  const render = useRenderPolicy();
  const { run: renderRun } = render;
  const [showCedar, setShowCedar] = useState(false);

  const knobsKey = JSON.stringify(knobs ?? {});
  useEffect(() => {
    if (!knobs) return;
    const t = setTimeout(() => renderRun(knobs), RENDER_DEBOUNCE_MS);
    return () => clearTimeout(t);
    // knobsKey stands in for knobs, which is a new object on every params change.
  }, [knobsKey, renderRun]);

  const rendered = render.data;
  const blocked = !knobs || !!render.error || (rendered !== undefined && !rendered.valid);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
      {/* Rendered rules */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-bold text-on-surface" style={titleStyle}>
            HeatGate Fair rules, as set below
          </h3>
          {rendered && (
            <button
              type="button"
              onClick={() => setShowCedar(!showCedar)}
              aria-pressed={showCedar}
              className="text-xs font-bold text-primary border border-outline-variant rounded-lg px-2.5 py-1 hover:bg-surface-container"
            >
              {showCedar ? "Show plain rules" : "Show the Cedar code"}
            </button>
          )}
        </div>
        {render.error ? (
          <p role="alert" className="text-xs font-bold text-error border border-error/30 bg-error/10 rounded-lg p-2.5">
            Could not render the rules: {render.error.message}
          </p>
        ) : !rendered ? (
          <p className="text-xs text-on-surface-variant">{render.loading ? "Rendering the rules…" : "No rules rendered yet."}</p>
        ) : showCedar ? (
          <pre className="bg-[#FAF9F5] p-3 rounded-xl border border-outline-variant/70 font-mono text-[12px] leading-relaxed text-[#1B1F23] max-h-[340px] overflow-auto whitespace-pre">
            {rendered.text}
          </pre>
        ) : (
          <ol className="flex flex-col gap-2 max-h-[340px] overflow-auto">
            {rendered.rules.map((r) => (
              <li key={r.id} className="flex items-start gap-2 text-xs text-on-surface">
                <span className={`shrink-0 px-1.5 py-0.5 rounded border text-[10px] font-bold ${BADGE[r.outcome]}`}>{r.outcome}</span>
                <span>
                  {r.summary} <span className="font-mono text-[10px] text-on-surface-variant">({r.id})</span>
                </span>
              </li>
            ))}
          </ol>
        )}
        {rendered && !rendered.valid && (
          <ul role="alert" className="text-xs text-error list-disc pl-4">
            {rendered.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <p className="text-[11px] text-on-surface-variant">
          Only HeatGate Fair changes with the knobs. NDMA and union rules copy the published documents and never change.
        </p>
      </div>

      {/* Knobs */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3">
        <div>
          <h3 className="font-bold text-on-surface" style={titleStyle}>
            Change the numbers in the rules
          </h3>
          {!knobs ? (
            <p role="alert" className="mt-2 text-xs text-error">
              The API's defaults have no rule knobs (fairKnobs), so the sliders are off.
            </p>
          ) : (
            <div className="flex flex-col gap-3.5 mt-3">
              {SLIDERS.map((s) => {
                const value = knobs[s.key];
                return (
                  <label key={s.key} className="flex flex-col gap-1 bg-[#FAF9F5] p-2.5 rounded-xl border border-outline-variant/60">
                    <span className="flex justify-between items-center text-xs font-semibold text-on-surface">
                      <span>{s.label}</span>
                      <span className="font-mono text-xs text-primary font-bold">
                        {value} {s.unit}
                      </span>
                    </span>
                    <input
                      className="accent-primary w-full mt-1"
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={1}
                      value={value}
                      onChange={(e) => setParams({ ...params, fairKnobs: withKnob(knobs, s.key, Number(e.target.value)) })}
                    />
                    <span className="relative h-4 text-[10px] font-mono text-on-surface-variant">
                      <span className="absolute left-0">
                        {s.min} {s.unit}
                      </span>
                      {s.mark && (
                        <span
                          className="absolute -translate-x-1/2 font-bold text-on-surface"
                          style={{ left: `${((s.mark.at - s.min) / (s.max - s.min)) * 100}%` }}
                        >
                          ▲ {s.mark.label}
                        </span>
                      )}
                      <span className="absolute right-0">
                        {s.max} {s.unit}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        {runSimulation && (
          <button
            onClick={runSimulation}
            disabled={blocked || running}
            className="w-full mt-2 h-11 px-5 rounded-xl bg-primary hover:bg-[#0B4F4A] text-on-primary text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            type="button"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
            <span>{running ? "Running…" : "Run Simulation"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
