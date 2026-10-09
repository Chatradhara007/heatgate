import { useState } from "react";
import { SimParams } from "@heatgate/contracts";

interface ScenarioBarProps {
  params: SimParams;
  setParams: (params: SimParams) => void;
}

export function ScenarioBar({ params, setParams }: ScenarioBarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const isNormal = params.peakTempC === 34 && params.alertLevel === 0;
  const isHeatwave = (params.peakTempC === 44 || params.peakTempC === 40) && (params.alertLevel === "auto" || params.alertLevel === undefined);
  const isRealDay = params.peakTempC === 43 && params.alertLevel === 1;
  const isCustom = !isNormal && !isHeatwave && !isRealDay;

  return (
    <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-2xl p-3.5 lg:p-4 shadow-xs">
      {/* Top Deck: 3 Equal-Width Scenario Cards (9 cols) + Live Telemetry & Advanced Toggle (3 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        
        {/* LEFT / CENTER (8-9 Cols): 3 Identically Sized Scenario Presets */}
        <div className="lg:col-span-8 xl:col-span-9 grid grid-cols-1 sm:grid-cols-3 gap-2.5" role="radiogroup" aria-label="Simulation Scenario Selector">
          
          {/* Card 1: Normal Day */}
          <button 
            type="button"
            onClick={() => setParams({ ...params, peakTempC: 34, humidityPct: 40, alertLevel: 0 })}
            className={`w-full h-[58px] px-3.5 rounded-xl border flex items-center justify-between transition-all text-left group focus:outline-none focus:ring-2 focus:ring-primary ${
              isNormal 
                ? "border-2 border-primary bg-[#E6F4F1] shadow-xs" 
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container hover:border-outline"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isNormal ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant group-hover:bg-surface-container-high"
              }`}>
                <span className="material-symbols-outlined text-[18px]">wb_sunny</span>
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold truncate leading-tight ${isNormal ? "text-primary font-bold" : "text-on-surface font-semibold"}`}>
                  Normal Day
                </div>
                <div className="text-[11px] font-mono text-on-surface-variant truncate mt-0.5">
                  34°C · Alert 0
                </div>
              </div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full border shrink-0 ml-1.5 transition-all ${
              isNormal ? "border-primary bg-primary ring-2 ring-primary/20" : "border-outline-variant bg-transparent"
            }`} />
          </button>

          {/* Card 2: Heatwave Day */}
          <button 
            type="button"
            onClick={() => setParams({ ...params, peakTempC: 44, humidityPct: 45, alertLevel: "auto" })}
            className={`w-full h-[58px] px-3.5 rounded-xl border flex items-center justify-between transition-all text-left group focus:outline-none focus:ring-2 focus:ring-primary ${
              isHeatwave 
                ? "border-2 border-primary bg-[#E6F4F1] shadow-xs" 
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container hover:border-outline"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isHeatwave ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant group-hover:bg-surface-container-high"
              }`}>
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>local_fire_department</span>
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold truncate leading-tight ${isHeatwave ? "text-primary font-bold" : "text-on-surface font-semibold"}`}>
                  Heatwave Day
                </div>
                <div className="text-[11px] font-mono text-on-surface-variant truncate mt-0.5">
                  44°C · Alert Auto
                </div>
              </div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full border shrink-0 ml-1.5 transition-all ${
              isHeatwave ? "border-primary bg-primary ring-2 ring-primary/20" : "border-outline-variant bg-transparent"
            }`} />
          </button>

          {/* Card 3: Real Day Hyderabad */}
          <button 
            type="button"
            onClick={() => setParams({ ...params, peakTempC: 43, humidityPct: 28, alertLevel: 1 })}
            className={`w-full h-[58px] px-3.5 rounded-xl border flex items-center justify-between transition-all text-left group focus:outline-none focus:ring-2 focus:ring-primary ${
              isRealDay 
                ? "border-2 border-primary bg-[#E6F4F1] shadow-xs" 
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container hover:border-outline"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                isRealDay ? "bg-primary text-on-primary" : "bg-surface-container text-on-surface-variant group-hover:bg-surface-container-high"
              }`}>
                <span className="material-symbols-outlined text-[18px]">location_city</span>
              </div>
              <div className="min-w-0">
                <div className={`text-xs font-bold truncate leading-tight ${isRealDay ? "text-primary font-bold" : "text-on-surface font-semibold"}`}>
                  Hyderabad Replay
                </div>
                <div className="text-[11px] font-mono text-on-surface-variant truncate mt-0.5">
                  42.6°C · May 19 Actual
                </div>
              </div>
            </div>
            <div className={`w-2.5 h-2.5 rounded-full border shrink-0 ml-1.5 transition-all ${
              isRealDay ? "border-primary bg-primary ring-2 ring-primary/20" : "border-outline-variant bg-transparent"
            }`} />
          </button>

        </div>

        {/* RIGHT (3-4 Cols): Live Conditions Summary & Advanced Controls Drawer Toggle */}
        <div className="lg:col-span-4 xl:col-span-3 bg-surface-container/60 border border-outline-variant/80 rounded-xl p-2 flex items-center justify-between gap-2.5 shadow-2xs">
          
          {/* Quick Conditions Readout */}
          <div className="flex flex-col min-w-0 pl-1.5">
            <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider leading-none">
              Live Profile
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono text-xs font-bold text-on-surface bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/60 shadow-2xs">
                {params.peakTempC}°C
              </span>
              <span className="font-mono text-[11px] text-on-surface-variant bg-surface-container-lowest px-1.5 py-0.5 rounded border border-outline-variant/60 shadow-2xs">
                {params.humidityPct}%
              </span>
              {isCustom && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                  Custom
                </span>
              )}
            </div>
          </div>

          {/* Advanced Knobs Toggle Button */}
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            id="advanced-toggle" 
            className={`h-10 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs shrink-0 ${
              isOpen 
                ? "bg-primary text-on-primary border-primary shadow-sm" 
                : "border-outline-variant bg-surface-container-lowest hover:bg-surface-container text-on-surface"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Advanced</span>
            <span id="advanced-arrow" className={`material-symbols-outlined text-sm transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}>
              keyboard_arrow_down
            </span>
          </button>

        </div>

      </div>

      {/* Advanced Controls Drawer: Equal 4-Column Grid that lines up seamlessly */}
      {isOpen && (
        <div className="mt-3.5 pt-3.5 border-t border-outline-variant grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn" id="advanced-drawer">
          {/* Knob 1: Peak Temp Slider */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/70 flex flex-col gap-1.5 shadow-2xs">
            <div className="flex justify-between items-center text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              <span>Peak Temperature</span>
              <span className="font-mono text-xs text-primary font-bold bg-[#E6F4F1] border border-primary/20 px-2 py-0.5 rounded">
                {params.peakTempC}°C
              </span>
            </div>
            <input 
              className="accent-primary w-full h-2 bg-surface-container rounded-lg cursor-pointer mt-1" 
              max={46} 
              min={34} 
              type="range" 
              value={params.peakTempC}
              onChange={(e) => setParams({ ...params, peakTempC: Number(e.target.value) })}
            />
            <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
              <span>34°C (Normal)</span>
              <span>40°C</span>
              <span>46°C (Extreme)</span>
            </div>
          </div>

          {/* Knob 2: Humidity Slider */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/70 flex flex-col gap-1.5 shadow-2xs">
            <div className="flex justify-between items-center text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              <span>Humidity</span>
              <span className="font-mono text-xs text-primary font-bold bg-[#E6F4F1] border border-primary/20 px-2 py-0.5 rounded">
                {params.humidityPct}%
              </span>
            </div>
            <input 
              className="accent-primary w-full h-2 bg-surface-container rounded-lg cursor-pointer mt-1" 
              max={90} 
              min={10} 
              type="range" 
              value={params.humidityPct}
              onChange={(e) => setParams({ ...params, humidityPct: Number(e.target.value) })}
            />
            <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
              <span>10% (Dry)</span>
              <span>50%</span>
              <span>90% (Monsoon)</span>
            </div>
          </div>

          {/* Knob 3: Alert Level Segmented */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/70 flex flex-col gap-1.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Alert Level (NDMA)
            </span>
            <div className="grid grid-cols-4 bg-surface-container p-0.5 rounded-lg border border-outline-variant h-9 items-center gap-0.5 mt-0.5">
              {(["auto", 0, 1, 2] as const).map((lvl) => {
                const isSelected = params.alertLevel === lvl;
                return (
                  <button
                    key={String(lvl)}
                    type="button"
                    onClick={() => setParams({ ...params, alertLevel: lvl })}
                    className={`h-full rounded-md text-xs transition-all font-semibold ${
                      isSelected 
                        ? "bg-surface-container-lowest font-bold text-primary shadow-xs" 
                        : "hover:bg-surface-container-low text-on-surface-variant text-[11px]"
                    }`}
                  >
                    {lvl === "auto" ? "Auto" : lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Knob 4: Policy Engine Selector */}
          <div className="bg-surface-container-lowest p-3 rounded-xl border border-outline-variant/70 flex flex-col gap-1.5 shadow-2xs">
            <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider">
              Active Policy Engine
            </span>
            <div className="h-9 px-3 bg-surface-container/60 border border-outline-variant rounded-lg text-xs font-semibold text-on-surface flex items-center justify-between shadow-2xs mt-0.5">
              <span className="truncate">HeatGate Fair v2.1</span>
              <span className="w-2 h-2 rounded-full bg-primary inline-block shrink-0 ml-1"></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
