import React from "react";
import type { SimResult, PolicyVersion } from "@heatgate/contracts";

interface SelectedRiderCardProps {
  sim: SimResult | undefined;
  policy: PolicyVersion;
}

export function SelectedRiderCard({ sim, policy }: SelectedRiderCardProps) {
  if (!sim) {
    return (
      <div className="lg:col-span-4 flex flex-col gap-4 opacity-50 pointer-events-none">
        {/* Placeholder state */}
      </div>
    );
  }

  const peakTemp = sim.params.peakTempC;

  return (
    <div className="lg:col-span-4 flex flex-col justify-between gap-4 h-full">
      {/* Phone-Style Card: R-014 in FORCE_REST (compact) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 lg:p-5 shadow-xs flex flex-col gap-3.5">
        {/* Phone Card Header */}
        <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center font-bold text-on-surface font-mono shadow-xs text-xs">
              RK
            </div>
            <div>
              <div className="font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.05em", fontSize: "22px" }}>
                R-014 · Rahul K.
              </div>
              <div className="font-mono text-[11px] text-on-surface-variant font-medium">Active Stint: 105 min</div>
            </div>
          </div>
          {/* FORCE_REST Policy Badge */}
          <div className="h-8 px-2.5 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-[11px] font-bold flex items-center gap-1 shadow-xs">
            <span className="material-symbols-outlined text-[15px]">pause_circle</span>
            <span>FORCE_REST</span>
          </div>
        </div>

        {/* Rest Countdown Box (compact) */}
        <div className="bg-[#FFFBEB] border border-[#FDE68A] rounded-xl p-3.5 flex flex-col items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-[#92400E] uppercase tracking-wider">Mandatory Rest Remaining</span>
          <div className="text-[#92400E] font-bold tracking-tight my-0.5" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.06em", fontSize: "42px", lineHeight: 1 }}>
            18:42
          </div>
          <div className="font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "20px" }}>
            Rest 20 minutes
          </div>
          <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed max-w-xs">
            Dispatches temporarily suspended to allow physiological cool-down.
          </p>
        </div>

        {/* Route Guidance to Shade & Water (compact) */}
        <div className="bg-surface-container-low border border-outline-variant rounded-lg p-3 flex items-start gap-2.5 shadow-xs">
          <span className="material-symbols-outlined text-primary text-[20px] mt-0.5">near_me</span>
          <div className="flex flex-col">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Nearest shade and water:</span>
            <span className="text-sm text-primary font-bold">Cooling Point 3, 420 m away</span>
            <span className="text-[11px] text-on-surface-variant mt-0.5">Begumpet Bus Shelter Hub · Water refill + mister</span>
          </div>
        </div>

        {/* Reassurance Pill (compact) */}
        <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-bold shadow-xs">
          <span className="material-symbols-outlined text-[16px]">verified</span>
          <span>Paid rest · No platform penalty</span>
        </div>
      </div>

      {/* "Why this decision" Audit Panel (compact) */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 lg:p-5 shadow-xs flex flex-col gap-3">
        <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
          <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">Policy Audit Inspector</span>
          <div className="h-7 px-2 rounded bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-[10px] font-bold flex items-center gap-1 shadow-xs">
            <span className="material-symbols-outlined text-[14px]">pause_circle</span>
            <span>FORCE_REST</span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] text-primary font-bold">Winning rule: fair-rest-due</span>
          <p className="text-xs text-on-surface bg-surface-container-low p-2 rounded-lg border border-outline-variant leading-relaxed">
            Heat index ≥ 42°C and continuous active stint exceeds 90 minutes. Mandatory paid rest cycle triggered.
          </p>
        </div>

        {/* Telemetry Key-Value Pair List (compact) */}
        <div className="flex flex-col border border-outline-variant rounded-lg divide-y divide-outline-variant font-mono text-xs overflow-hidden shadow-xs">
          <div className="flex justify-between items-center px-3 py-1.5 bg-surface-container-lowest">
            <span className="text-on-surface-variant text-[11px] font-medium">Heat index</span>
            <span className="font-bold text-error" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", fontSize: "18px" }}>
              {peakTemp}°C
            </span>
          </div>
          <div className="flex justify-between items-center px-3 py-1.5 bg-surface-container-lowest">
            <span className="text-on-surface-variant text-[11px] font-medium">Minutes since break</span>
            <span className="font-bold text-on-surface" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", fontSize: "18px" }}>
              105 min
            </span>
          </div>
          <div className="flex justify-between items-center px-3 py-1.5 bg-surface-container-lowest">
            <span className="text-on-surface-variant text-[11px] font-medium">Trip minutes</span>
            <span className="font-bold text-on-surface" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", fontSize: "18px" }}>
              20 min
            </span>
          </div>
          <div className="flex justify-between items-center px-3 py-1.5 bg-surface-container-lowest">
            <span className="text-on-surface-variant text-[11px] font-medium">Demand level</span>
            <span className="font-bold text-on-surface" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", fontSize: "18px" }}>
              1 (normal)
            </span>
          </div>
          <div className="flex justify-between items-center px-3 py-1.5 bg-surface-container-lowest">
            <span className="text-on-surface-variant text-[11px] font-medium">Alert level</span>
            <span className="font-bold text-on-surface" style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: "0.05em", fontSize: "18px" }}>
              1
            </span>
          </div>
        </div>

        <a className="text-primary hover:text-[#0B4F4A] text-xs font-bold flex items-center gap-1 justify-end transition-colors pt-1" href="#">
          <span>Open in Audit Log</span>
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </a>
      </div>
    </div>
  );
}
