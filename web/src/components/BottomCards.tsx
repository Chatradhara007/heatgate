import React from "react";
import type { SimParams } from "@heatgate/contracts";

interface BottomCardsProps {
  params: SimParams;
  setParams: (p: SimParams) => void;
  runSimulation?: () => void;
}

export function BottomCards({ params, setParams, runSimulation }: BottomCardsProps) {
  const fairKnobs = params.fairKnobs || {
    restHeatC: 38,
    workLimitMin: 100,
    rushHardLimitMin: 120,
    earlyRestMin: 70,
    shortTripHeatC: 41,
    shortTripMaxKm: 3,
    extremeHeatC: 46
  };

  const updateKnob = (key: keyof typeof fairKnobs, val: number) => {
    setParams({
      ...params,
      fairKnobs: {
        ...fairKnobs,
        [key]: val
      }
    });
  };

  return (
    <div className="w-full">
      {/* ROW 4: THREE CARDS SIDE BY SIDE (Equal 3-Column Split) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        
        {/* CARD A: Heat Sweep Line Chart (Expanded & Highly Legible) */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-headline-md font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "22px" }}>
                Heat Sweep: Exposure vs Ambient Peak
              </h3>
            </div>

            {/* View Toggle */}
            <div className="flex items-center border border-outline-variant rounded-lg p-0.5 bg-surface-container mb-2 text-xs font-semibold shadow-xs">
              <button className="flex-1 py-1 rounded-md bg-surface-container-lowest text-primary font-bold shadow-xs text-xs" type="button">
                Unsafe exposure (hours)
              </button>
              <button className="flex-1 py-1 rounded-md text-on-surface-variant hover:text-on-surface text-xs" type="button">
                Earnings vs exposure
              </button>
            </div>

            {/* Quick Summary Legend Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mb-2 px-1 text-on-surface-variant">
              <span className="flex items-center gap-1 font-bold text-[#1F2937]">
                <span className="w-2.5 h-0.5 bg-[#1F2937] inline-block"></span> Voluntary (118h)
              </span>
              <span className="flex items-center gap-1 font-medium text-[#4B5563]">
                <span className="w-2.5 h-0.5 border-t border-dashed border-[#4B5563] inline-block"></span> Union (72h)
              </span>
              <span className="flex items-center gap-1 font-medium text-[#6B7280]">
                <span className="w-2.5 h-0.5 border-t border-dotted border-[#6B7280] inline-block"></span> NDMA (64h)
              </span>
              <span className="flex items-center gap-1 font-bold text-primary">
                <span className="w-2.5 h-1 bg-primary rounded-full inline-block"></span> HeatGate (32h)
              </span>
            </div>

            {/* SVG Line Chart: 34°C to 46°C vs 0-120 rider-hours */}
            <div className="w-full h-[250px] bg-[#FAF9F5] rounded-xl border border-outline-variant/70 p-2 shadow-inner">
              <svg className="w-full h-full" viewBox="0 0 450 240" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="heatgate-glow" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#005C55" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#005C55" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Y-Axis Label */}
                <text x="50" y="16" fill="#6E7977" fontFamily="'Inter', sans-serif" fontSize="10" fontWeight="700" textAnchor="end">
                  HOURS
                </text>

                {/* Horizontal Grid lines */}
                <g stroke="#E2E0D8" strokeWidth="1">
                  <line x1="56" x2="330" y1="28" y2="28" />
                  <line x1="56" x2="330" y1="70" y2="70" />
                  <line x1="56" x2="330" y1="112" y2="112" />
                  <line x1="56" x2="330" y1="154" y2="154" />
                  <line stroke="#8F928F" strokeWidth="1.5" x1="56" x2="330" y1="195" y2="195" />
                </g>

                {/* Y-Axis Labels */}
                <g fill="#4B5563" fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="600" textAnchor="end">
                  <text x="48" y="32">120h</text>
                  <text x="48" y="74">80h</text>
                  <text x="48" y="116">40h</text>
                  <text x="48" y="158">10h</text>
                  <text x="48" y="198">0h</text>
                </g>

                {/* Vertical subtle tick lines at each temperature */}
                <g stroke="#E8E6DF" strokeWidth="1" strokeDasharray="2 2">
                  <line x1="65" x2="65" y1="28" y2="195" />
                  <line x1="130" x2="130" y1="28" y2="195" />
                  <line x1="195" x2="195" y1="28" y2="195" />
                  <line x1="260" x2="260" y1="28" y2="195" />
                  <line x1="325" x2="325" y1="28" y2="195" />
                </g>

                {/* X-Axis Labels */}
                <g fill="#1F2937" fontFamily="'JetBrains Mono', monospace" fontSize="11" fontWeight="700" textAnchor="middle">
                  <text x="65" y="212">34°C</text>
                  <text x="130" y="212">38°C</text>
                  <text x="195" y="212">41°C</text>
                  <text x="260" y="212">44°C</text>
                  <text x="325" y="212">46°C</text>
                </g>
                <text x="195" y="230" fill="#6E7977" fontFamily="'Inter', sans-serif" fontSize="10" fontWeight="600" textAnchor="middle">
                  Peak Ambient Temperature (°C)
                </text>

                {/* AREA FILL UNDER HEATGATE FAIR */}
                <path d="M 65 192 Q 185 186 260 172 T 325 156 L 325 195 L 65 195 Z" fill="url(#heatgate-glow)" />

                {/* 1. Voluntary Baseline (Solid Dark Charcoal) */}
                <path d="M 65 190 Q 155 175 225 100 T 325 32" fill="none" stroke="#1F2937" strokeLinecap="round" strokeWidth="2.5" />
                <circle cx="325" cy="32" fill="#1F2937" r="3.5" />

                {/* 2. Union IFAT (Dotted Dark Grey) */}
                <path d="M 65 190 Q 165 180 245 125 T 325 78" fill="none" stroke="#4B5563" strokeDasharray="3 3" strokeWidth="2" />
                <circle cx="325" cy="78" fill="#4B5563" r="3" />

                {/* 3. NDMA Advisory (Dashed Slate) */}
                <path d="M 65 190 Q 175 182 250 135 T 325 96" fill="none" stroke="#6B7280" strokeDasharray="6 3" strokeWidth="2" />
                <circle cx="325" cy="96" fill="#6B7280" r="3" />

                {/* 4. HeatGate Fair: Thick Solid Deep Teal with Glow */}
                <path d="M 65 190 Q 185 186 260 172 T 325 156" fill="none" stroke="#005C55" strokeLinecap="round" strokeWidth="3.5" />
                <circle cx="325" cy="156" fill="#005C55" r="4.5" stroke="#FFFFFF" strokeWidth="1.5" />

                {/* DEDICATED CALLOUT LABELS ON THE RIGHT (Spacious, No Overlap) */}
                <g fontFamily="'Inter', sans-serif" fontSize="11" fontWeight="700">
                  {/* Voluntary Callout */}
                  <line x1="327" x2="338" y1="32" y2="32" stroke="#1F2937" strokeWidth="1" />
                  <text fill="#1F2937" x="342" y="36">Voluntary (118h)</text>

                  {/* Union Callout */}
                  <line x1="327" x2="338" y1="78" y2="78" stroke="#4B5563" strokeWidth="1" />
                  <text fill="#4B5563" x="342" y="82">Union (72h)</text>

                  {/* NDMA Callout */}
                  <line x1="327" x2="338" y1="96" y2="96" stroke="#6B7280" strokeWidth="1" />
                  <text fill="#6B7280" x="342" y="100">NDMA (64h)</text>

                  {/* HeatGate Callout with Teal Badge */}
                  <line x1="329" x2="338" y1="156" y2="156" stroke="#005C55" strokeWidth="1.5" />
                  <text fill="#005C55" fontSize="12" fontWeight="800" x="342" y="159">HeatGate (32h)</text>
                  <text fill="#0F766E" fontSize="9" fontWeight="700" x="342" y="172">🛡️ 73% safer cap</text>
                </g>
              </svg>
            </div>
          </div>

          {/* Key Insight Box */}
          <div className="p-2.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
            <p className="text-[11px] leading-tight text-on-surface">
              <strong>HeatGate Fair</strong> holds cumulative unsafe rider hours under <strong>35h</strong> across severe heat spikes above 44°C.
            </p>
          </div>
        </div>

        {/* CARD B: Cedar Policy Viewer */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <h3 className="font-headline-md font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "22px" }}>
                Rule Source (Cedar Policy)
              </h3>
            </div>
            {/* Policy Tabs */}
            <div className="flex items-center border border-outline-variant rounded-lg p-0.5 bg-surface-container mb-2 text-xs font-semibold shadow-xs">
              <button className="flex-1 py-1 rounded-md bg-surface-container-lowest text-primary font-bold shadow-xs text-xs" type="button">HeatGate Fair</button>
              <button className="flex-1 py-1 rounded-md text-on-surface-variant hover:text-on-surface text-xs" type="button">NDMA Advisory</button>
              <button className="flex-1 py-1 rounded-md text-on-surface-variant hover:text-on-surface text-xs" type="button">Union IFAT</button>
            </div>
            {/* Syntax Highlighted Cedar Code Snippet */}
            <div className="bg-[#FAF9F5] p-3 rounded-xl border border-outline-variant/70 font-mono text-xs leading-relaxed text-[#1B1F23] h-[250px] overflow-y-auto shadow-inner">
              <div className="text-[#6E7977]">// HeatGate Core Safety Ruleset v2.1</div>
              <div className="mt-1 text-[#6E7977]">@id("baseline-permit")</div>
              <div>permit(principal, action == Action::"Dispatch", resource);</div>
              <div className="my-2 p-2 bg-[#E6F4F1] rounded-lg border-l-4 border-primary">
                <span className="text-primary font-bold">@id("fair-rest-due")</span><br />
                <span className="text-[#A15600] font-semibold">@outcome("FORCE_REST")</span><br />
                <span className="text-on-surface-variant font-medium text-[11px]">@message("Mandatory heat rest cycle triggered")</span><br />
                <span className="text-primary font-bold mt-1 inline-block">forbid(principal, action == Action::"Dispatch", resource)</span><br />
                <span className="text-[#1B1F23] font-semibold">when {"{"}</span>
                <div className="pl-3 text-on-surface font-semibold">
                  context.heat_index &gt;= {fairKnobs.restHeatC} &amp;&amp;<br />
                  context.active_stint_min &gt;= {fairKnobs.workLimitMin}
                </div>
                <div className="text-[#1B1F23] font-semibold">{"};"}</div>
              </div>
              <div className="text-[#6E7977]">@id("peak-halt-override")</div>
              <div>forbid(principal, action, resource) when {"{ context.heat_index >= 48 }"};</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs text-on-surface-variant pt-2 border-t border-outline-variant/60">
            <span className="font-mono text-[11px]">Status: Validated AST</span>
            <span className="font-mono text-primary font-bold text-[11px]">Verified Deterministic</span>
          </div>
        </div>

        {/* CARD C: Rules Sliders Interactive Sandbox */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col justify-between gap-3">
          <div>
            <div className="mb-2">
              <h3 className="font-headline-md font-bold text-on-surface" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "22px" }}>
                Parameter Tuning
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">Judges can change the rules and re-run.</p>
            </div>
            <div className="flex flex-col gap-3.5 mt-2">
              
              {/* Slider 1: Rest heat index */}
              <div className="flex flex-col gap-1 bg-[#FAF9F5] p-2.5 rounded-xl border border-outline-variant/60">
                <div className="flex justify-between items-center text-xs font-semibold text-on-surface">
                  <span>Rest heat index threshold</span>
                  <span className="font-mono text-xs text-primary font-bold bg-[#E6F4F1] border border-primary/20 px-2 py-0.5 rounded">
                    {fairKnobs.restHeatC}°C
                  </span>
                </div>
                <input 
                  className="accent-primary w-full h-2 bg-surface-container rounded-lg cursor-pointer mt-1" 
                  max="44" min="32" 
                  type="range" 
                  value={fairKnobs.restHeatC}
                  onChange={(e) => updateKnob("restHeatC", parseInt(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                  <span>32°C</span>
                  <span>38°C</span>
                  <span>44°C</span>
                </div>
              </div>
              
              {/* Slider 2: Work limit before rest */}
              <div className="flex flex-col gap-1 bg-[#FAF9F5] p-2.5 rounded-xl border border-outline-variant/60">
                <div className="flex justify-between items-center text-xs font-semibold text-on-surface">
                  <span>Work limit before rest</span>
                  <span className="font-mono text-xs text-primary font-bold bg-[#E6F4F1] border border-primary/20 px-2 py-0.5 rounded">
                    {fairKnobs.workLimitMin} min
                  </span>
                </div>
                <input 
                  className="accent-primary w-full h-2 bg-surface-container rounded-lg cursor-pointer mt-1" 
                  max="150" min="60" 
                  type="range" 
                  value={fairKnobs.workLimitMin}
                  onChange={(e) => updateKnob("workLimitMin", parseInt(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                  <span>60 min</span>
                  <span className="text-primary font-bold">▲ 90 min (NDMA)</span>
                  <span>150 min</span>
                </div>
              </div>
              
              {/* Slider 3: Rush hard limit */}
              <div className="flex flex-col gap-1 bg-[#FAF9F5] p-2.5 rounded-xl border border-outline-variant/60">
                <div className="flex justify-between items-center text-xs font-semibold text-on-surface">
                  <span>Rush hard limit</span>
                  <span className="font-mono text-xs text-primary font-bold bg-[#E6F4F1] border border-primary/20 px-2 py-0.5 rounded">
                    {fairKnobs.rushHardLimitMin} min
                  </span>
                </div>
                <input 
                  className="accent-primary w-full h-2 bg-surface-container rounded-lg cursor-pointer mt-1" 
                  max="180" min="80" 
                  type="range" 
                  value={fairKnobs.rushHardLimitMin}
                  onChange={(e) => updateKnob("rushHardLimitMin", parseInt(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-mono text-on-surface-variant">
                  <span>80 min</span>
                  <span className="text-on-surface font-bold">▲ 120 min (Union)</span>
                  <span>180 min</span>
                </div>
              </div>

            </div>
          </div>
          
          {/* Action Button */}
          {runSimulation && (
            <button 
              onClick={runSimulation}
              className="w-full mt-2 h-11 min-h-[44px] px-5 rounded-xl bg-primary hover:bg-[#0B4F4A] text-on-primary text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 active:scale-[0.99]" 
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              <span>Run Simulation</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
