// Small shared pieces for a clear demo: the (i) fine-print popover, single-line caveat badges, outcome pills in
// plain words, the heat gauge, the minutes-since-break bar and the decision-input chips.
// They change how a value looks, never the value.
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Outcome } from "@heatgate/contracts";

// ---------- (i) fine print: opens on click or tap, closes on a second tap, outside tap, Escape or scroll ----------
export function InfoTip({ children, label = "More information" }: { children: ReactNode; label?: string }) {
  const [pos, setPos] = useState<{ left: number; top: number } | undefined>(undefined);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLSpanElement>(null);
  const open = pos !== undefined;

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e.type === "keydown" && (e as KeyboardEvent).key !== "Escape") return;
      if (e.type === "pointerdown" && (btn.current?.contains(e.target as Node) || pop.current?.contains(e.target as Node))) return;
      setPos(undefined);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (open || !btn.current) return setPos(undefined);
    const r = btn.current.getBoundingClientRect();
    const width = Math.min(280, window.innerWidth - 16);
    setPos({ left: Math.min(Math.max(8, r.left + r.width / 2 - width / 2), window.innerWidth - width - 8), top: r.bottom + 6 });
  };

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-expanded={open}
        className="inline-flex items-center justify-center w-6 h-6 -my-1 align-middle rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container focus:outline-none focus:ring-2 focus:ring-primary shrink-0"
      >
        <span className="material-symbols-outlined text-[16px]">info</span>
      </button>
      {open && (
        <span
          ref={pop}
          role="tooltip"
          className="block fixed z-[2000] w-[280px] max-w-[calc(100vw-16px)] rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-xs leading-relaxed text-on-surface shadow-lg normal-case tracking-normal font-normal text-left"
          style={{ left: pos.left, top: pos.top, fontFamily: "Inter, sans-serif", letterSpacing: "normal" }}
        >
          {children}
        </span>
      )}
    </>
  );
}

// ---------- One-line caveat badges that stay visible ----------
export function Badge({ icon = "info", children, tone = "neutral" }: { icon?: string; children: ReactNode; tone?: "neutral" | "warn" }) {
  const cls = tone === "warn" ? "bg-[#FFFBEB] border-[#FDE68A] text-[#92400E]" : "bg-surface-container-low border-outline-variant text-on-surface-variant";
  return (
    <span className={`inline-flex items-center gap-1 self-start max-w-full px-2 py-0.5 rounded-md border text-[11px] font-semibold leading-tight ${cls}`}>
      <span className="material-symbols-outlined text-[13px] shrink-0">{icon}</span>
      <span>{children}</span>
    </span>
  );
}

export const MultiAppBadge = ({ pct }: { pct: number }) => (
  <Badge icon="phone_android">Assumes {pct}% of riders work another app while resting</Badge>
);

// ---------- Outcome pills in plain words ----------
export const OUTCOME_WORDS: Record<Outcome, string> = {
  FORCE_REST: "Rest now",
  DENY: "Not allowed",
  SKIP_ORDER: "Order skipped",
  ALLOW: "Allowed",
};

const PILL: Record<Outcome, { cls: string; icon: string }> = {
  ALLOW: { cls: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]", icon: "check_circle" },
  SKIP_ORDER: { cls: "bg-[#F3F4F6] text-[#374151] border-[#D1D5DB]", icon: "do_not_disturb_on" },
  DENY: { cls: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]", icon: "block" },
  FORCE_REST: { cls: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]", icon: "pause_circle" },
};

export function OutcomePill({ outcome, size = "md" }: { outcome: Outcome; size?: "sm" | "md" | "lg" }) {
  const p = PILL[outcome];
  const sz =
    size === "lg" ? "px-4 py-1.5 text-base gap-2" : size === "sm" ? "px-2 py-0.5 text-[11px] gap-1" : "px-2.5 py-1 text-xs gap-1.5";
  const icon = size === "lg" ? "text-[22px]" : size === "sm" ? "text-[13px]" : "text-[15px]";
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border font-bold ${sz} ${p.cls}`} title={outcome}>
      <span className={`material-symbols-outlined ${icon}`}>{p.icon}</span>
      {OUTCOME_WORDS[outcome]}
    </span>
  );
}

// ---------- Heat index: colour by band, gauge from 26 to 56 °C ----------
// Bands follow the rule thresholds (38 rest rules, 41 short trips, 46 pause). A proxy for heat stress, not medical.
export function heatColor(c: number) {
  if (c >= 46) return "#991B1B";
  if (c >= 41) return "#DC2626";
  if (c >= 38) return "#EA580C";
  if (c >= 32) return "#F59E0B";
  return "#65A30D";
}

const GAUGE_MIN = 26;
const GAUGE_MAX = 56;
const gaugePct = (c: number) => `${Math.min(100, Math.max(0, ((c - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 100))}%`;

export function HeatChip({ c, className = "" }: { c: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap px-2 py-0.5 rounded-full border text-xs font-bold bg-surface-container-lowest ${className}`} style={{ borderColor: heatColor(c), color: heatColor(c) }}>
      <span className="material-symbols-outlined text-[14px]">device_thermostat</span>
      Heat index {c} °C
    </span>
  );
}

export function HeatGauge({ c }: { c: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-on-surface-variant">Heat index</span>
        <span className="font-bold text-lg leading-none" style={{ color: heatColor(c) }}>
          {c} °C
        </span>
      </div>
      <div
        className="relative h-2 rounded-full"
        style={{ background: "linear-gradient(90deg,#65A30D 0%,#F59E0B 20%,#EA580C 40%,#DC2626 50%,#991B1B 67%,#7F1D1D 100%)" }}
        role="meter"
        aria-label="Heat index"
        aria-valuemin={GAUGE_MIN}
        aria-valuemax={GAUGE_MAX}
        aria-valuenow={c}
      >
        <span className="absolute top-1/2 w-3.5 h-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white border-2" style={{ left: gaugePct(c), borderColor: heatColor(c) }} />
      </div>
    </div>
  );
}

// ---------- Minutes since last break, against the 90 and 120 minute marks used by the safety measures ----------
const BAR_MAX = 150;
export function BreakBar({ minutes }: { minutes: number }) {
  const pct = (m: number) => `${Math.min(100, (m / BAR_MAX) * 100)}%`;
  const color = minutes > 120 ? "#DC2626" : minutes > 90 ? "#EA580C" : "#0F766E";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-on-surface-variant">Since last break</span>
        <span className="font-bold text-lg leading-none" style={{ color }}>
          {minutes} min
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-surface-container-high" role="meter" aria-label="Minutes since last break" aria-valuemin={0} aria-valuemax={BAR_MAX} aria-valuenow={minutes}>
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(minutes), background: color }} />
        {[90, 120].map((m) => (
          <span key={m} className="absolute -top-0.5 -bottom-0.5 w-0.5 bg-on-surface" style={{ left: pct(m) }} />
        ))}
      </div>
      <div className="relative h-3 text-[10px] font-mono text-on-surface-variant">
        {[90, 120].map((m) => (
          <span key={m} className="absolute -translate-x-1/2" style={{ left: pct(m) }}>
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------- The inputs a decision was made on ----------
export const DEMAND_WORDS: Record<number, string> = { 0: "Quiet", 1: "Busy", 2: "Rush" };

// Plain labels for every cedarContext key, for the "Show all inputs" table.
const INPUT_LABELS: Record<string, string> = {
  heatIndexC: "Heat index (°C)",
  minutesSinceBreak: "Minutes since last break",
  exposureMinutesToday: "Minutes outdoors today",
  restMinutesRemaining: "Rest minutes left",
  tripMinutes: "Trip time (min)",
  distanceKm: "Order distance (km, rounded up)",
  demandLevel: "Demand",
  alertLevel: "Heat alert level (assumed)",
  hourOfDay: "Hour of day",
};

function Chip({ icon, children }: { icon: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap px-2 py-1 rounded-lg bg-surface-container-low border border-outline-variant text-xs font-semibold text-on-surface">
      <span className="material-symbols-outlined text-[15px] text-on-surface-variant">{icon}</span>
      {children}
    </span>
  );
}

export function DecisionInputs({ ctx }: { ctx: Record<string, number> }) {
  const [all, setAll] = useState(false);
  const has = (k: string) => typeof ctx[k] === "number";
  return (
    <div className="flex flex-col gap-3">
      {has("heatIndexC") && <HeatGauge c={ctx.heatIndexC} />}
      {has("minutesSinceBreak") && <BreakBar minutes={ctx.minutesSinceBreak} />}
      <div className="flex flex-wrap gap-1.5">
        {has("restMinutesRemaining") && ctx.restMinutesRemaining > 0 && <Chip icon="timer">{ctx.restMinutesRemaining} min rest left</Chip>}
        {has("tripMinutes") && <Chip icon="schedule">{ctx.tripMinutes} min trip</Chip>}
        {has("distanceKm") && <Chip icon="route">{ctx.distanceKm} km</Chip>}
        {has("demandLevel") && <Chip icon="trending_up">{DEMAND_WORDS[ctx.demandLevel] ?? ctx.demandLevel}</Chip>}
        {has("alertLevel") && <Chip icon="warning">Alert {ctx.alertLevel} (assumed)</Chip>}
      </div>
      <button type="button" onClick={() => setAll(!all)} aria-expanded={all} className="self-start text-xs font-bold text-primary hover:underline">
        {all ? "Hide inputs" : "Show all inputs"}
      </button>
      {all && (
        <table className="w-full text-xs border border-outline-variant rounded-lg overflow-hidden">
          <tbody>
            {Object.entries(ctx).map(([k, v], i) => (
              <tr key={k} className={`border-b border-outline-variant last:border-b-0 ${i % 2 === 0 ? "bg-surface-container-low" : "bg-surface-container-lowest"}`}>
                <td className="px-3 py-1.5 text-on-surface-variant">
                  {INPUT_LABELS[k] ?? k} <span className="font-mono text-[10px]">{k}</span>
                </td>
                <td className="px-3 py-1.5 text-right font-mono font-bold">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------- Range bar: mean dot and lowest–highest line on a shared axis. Neutral grey: never ranks by colour ----------
export function RangeBar({ mean, min, max, axisMax, oneSeed }: { mean: number; min: number; max: number; axisMax: number; oneSeed: boolean }) {
  const pos = (v: number) => `${Math.max(0, Math.min(100, (v / Math.max(axisMax, 1e-9)) * 100))}%`;
  return (
    <div className="relative h-2.5 rounded-full bg-surface-container-high" aria-hidden="true">
      {!oneSeed && (
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-outline" style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }} />
      )}
      <span className="absolute top-1/2 w-2.5 h-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-on-surface" style={{ left: pos(mean) }} />
    </div>
  );
}
