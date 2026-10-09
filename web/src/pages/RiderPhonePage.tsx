import { useEffect, useState } from "react";
import type { DecideRequest, Decision } from "@heatgate/contracts";
import { useDecide } from "../hooks/index.ts";
import { isBackendConnected } from "../api.ts";
import { RiderPhoneDevice, type RiderScreenState } from "../components/RiderPhoneDevice.tsx";

const MOCK_DECIDE_REQUESTS: Record<RiderScreenState, (riderId: string) => DecideRequest> = {
  FORCE_REST: (id) => ({
    policyVersion: "heatgate-fair",
    rider: { id, vehicle: "bike", x: 4.2, y: 5.1 },
    order: { id: "order-live-1", zone: "Zone-Banjara", distanceKm: 2.8, tripMinutes: 16 },
    conditions: { tempC: 44, humidityPct: 35, hourOfDay: 13, demandLevel: 1, alertLevel: 1 },
    riderState: { minutesSinceBreak: 105, exposureMinutesToday: 245, restMinutesRemaining: 0 },
    dryRun: true,
  }),
  ALLOW: (id) => ({
    policyVersion: "heatgate-fair",
    rider: { id, vehicle: "bike", x: 2.1, y: 3.4 },
    order: { id: "order-live-2", zone: "Zone-Jubilee", distanceKm: 2.4, tripMinutes: 18 },
    conditions: { tempC: 34, humidityPct: 40, hourOfDay: 10, demandLevel: 1, alertLevel: 0 },
    riderState: { minutesSinceBreak: 25, exposureMinutesToday: 60, restMinutesRemaining: 0 },
    dryRun: true,
  }),
  SKIP_ORDER: (id) => ({
    policyVersion: "heatgate-fair",
    rider: { id, vehicle: "bike", x: 5.5, y: 6.2 },
    order: { id: "order-live-3", zone: "Zone-Hitec", distanceKm: 4.8, tripMinutes: 28 },
    conditions: { tempC: 42, humidityPct: 32, hourOfDay: 14, demandLevel: 2, alertLevel: 1 },
    riderState: { minutesSinceBreak: 45, exposureMinutesToday: 130, restMinutesRemaining: 0 },
    dryRun: true,
  }),
  DENY: (id) => ({
    policyVersion: "heatgate-fair",
    rider: { id, vehicle: "bike", x: 1.5, y: 2.8 },
    order: { id: "order-live-4", zone: "Zone-Secunderabad", distanceKm: 3.0, tripMinutes: 20 },
    conditions: { tempC: 47, humidityPct: 28, hourOfDay: 14, demandLevel: 1, alertLevel: 2 },
    riderState: { minutesSinceBreak: 60, exposureMinutesToday: 180, restMinutesRemaining: 0 },
    dryRun: true,
  }),
};

export function RiderPhonePage() {
  const [selectedRider, setSelectedRider] = useState("R-014");
  const [viewMode, setViewMode] = useState<"single" | "board">("single");
  const [singleState, setSingleState] = useState<RiderScreenState>("FORCE_REST");
  const [liveDecision, setLiveDecision] = useState<Decision | undefined>(undefined);
  const [evalLatency, setEvalLatency] = useState<number>(14);

  const decideMutation = useDecide();

  useEffect(() => {
    let active = true;
    const start = performance.now();
    const req = MOCK_DECIDE_REQUESTS[singleState](selectedRider);
    decideMutation.run(req).then((res) => {
      if (active && res) {
        setLiveDecision(res);
        setEvalLatency(Math.max(6, Math.round(performance.now() - start)));
      }
    }).catch(() => {
      // Handled by hybrid fallback inside decideMutation
    });
    return () => {
      active = false;
    };
  }, [singleState, selectedRider]);

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-5">
      {/* Top Controls Toolbar: Rider Picker & View Mode Switcher */}
      <div className="w-full bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Title & Rider Picker */}
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 
              className="text-2xl font-bold text-[#1B1F23] tracking-wide" 
              style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "26px" }}
            >
              Rider Phone View
            </h1>
            <p className="text-xs text-[#4B5563] mt-0.5">
              High-contrast, icon-first interface optimized for outdoor sunlight on low-cost devices.
            </p>
          </div>

          <div className="h-8 w-px bg-[#E3E1DA] hidden md:block"></div>

          {/* Rider Picker Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
              Rider:
            </span>
            <div className="relative">
              <select
                value={selectedRider}
                onChange={(e) => setSelectedRider(e.target.value)}
                className="h-10 pl-3 pr-8 rounded-xl border border-[#E3E1DA] bg-[#FAFAF7] font-mono text-xs font-bold text-[#1B1F23] appearance-none focus:outline-none focus:ring-2 focus:ring-[#0F766E] shadow-2xs cursor-pointer"
              >
                <option value="R-014">R-014 (Active Delivery)</option>
                <option value="R-008">R-008 (Break Overdue)</option>
                <option value="R-022">R-022 (Resting at CP 3)</option>
                <option value="R-035">R-035 (High Exposure)</option>
              </select>
              <span className="material-symbols-outlined text-base text-[#4B5563] absolute right-2.5 top-2.5 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>
        </div>

        {/* Right: View Mode Segmented Switcher */}
        <div className="inline-flex items-center border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] p-1 text-xs font-bold gap-1 self-start sm:self-auto shadow-2xs">
          <button
            type="button"
            onClick={() => setViewMode("single")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === "single"
                ? "bg-[#0F766E] text-[#FFFFFF] shadow-xs font-bold"
                : "text-[#4B5563] hover:text-[#1B1F23]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">smartphone</span>
            <span>Single Phone (Interactive)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
              viewMode === "board"
                ? "bg-[#0F766E] text-[#FFFFFF] shadow-xs font-bold"
                : "text-[#4B5563] hover:text-[#1B1F23]"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">view_carousel</span>
            <span>5-State Board (360×800)</span>
          </button>
        </div>
      </div>

      {/* ================= VIEW 1: SINGLE INTERACTIVE PHONE ================= */}
      {viewMode === "single" && (
        <div className="flex flex-col items-center justify-center py-4 w-full">
          {/* Quick State Simulator Bar */}
          <div className="mb-4 flex flex-wrap items-center justify-center gap-2 bg-[#FFFFFF] border border-[#E3E1DA] p-1.5 rounded-2xl shadow-xs">
            <span className="text-xs font-bold text-[#4B5563] px-2 uppercase tracking-wider">
              Simulate Dispatch Outcome:
            </span>
            <button
              type="button"
              onClick={() => setSingleState("FORCE_REST")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                singleState === "FORCE_REST"
                  ? "bg-[#FEF3C7] text-[#92400E] border-2 border-[#FDE68A] shadow-xs"
                  : "bg-[#FAFAF7] text-[#4B5563] hover:bg-[#E3E1DA]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">pause_circle</span>
              <span>FORCE_REST (Main)</span>
            </button>
            <button
              type="button"
              onClick={() => setSingleState("ALLOW")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                singleState === "ALLOW"
                  ? "bg-[#EFF6FF] text-[#1D4ED8] border-2 border-[#BFDBFE] shadow-xs"
                  : "bg-[#FAFAF7] text-[#4B5563] hover:bg-[#E3E1DA]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">check_circle</span>
              <span>ALLOW (Order)</span>
            </button>
            <button
              type="button"
              onClick={() => setSingleState("SKIP_ORDER")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                singleState === "SKIP_ORDER"
                  ? "bg-[#F3F4F6] text-[#374151] border-2 border-[#E5E7EB] shadow-xs"
                  : "bg-[#FAFAF7] text-[#4B5563] hover:bg-[#E3E1DA]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">do_not_disturb_on</span>
              <span>SKIP_ORDER (Nearby Only)</span>
            </button>
            <button
              type="button"
              onClick={() => setSingleState("DENY")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                singleState === "DENY"
                  ? "bg-[#FEE2E2] text-[#991B1B] border-2 border-[#FECACA] shadow-xs"
                  : "bg-[#FAFAF7] text-[#4B5563] hover:bg-[#E3E1DA]"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">error</span>
              <span>DENY (Peak Heat Pause)</span>
            </button>
          </div>

          {/* Centered Phone Device Frame */}
          <div className="relative">
            <RiderPhoneDevice
              initialState={singleState}
              initialLang="HI"
              riderId={selectedRider}
              decision={liveDecision}
              isInteractive={true}
            />
          </div>

          {/* Caption required by spec */}
          <p className="text-center text-sm font-semibold text-[#4B5563] mt-4">
            This is all the rider sees.
          </p>

          {/* Live Engine Telemetry & Compliance Inspector Card */}
          <div className="w-full max-w-[620px] mt-4 bg-white border border-[#E3E1DA] rounded-2xl p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#E3E1DA] pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0F766E] text-base">rule</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#1B1F23]">
                  Live Cedar Engine Telemetry
                </span>
              </div>
              <span className="font-mono text-[11px] text-[#0F766E] bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#0F766E]/20">
                {evalLatency} ms · {isBackendConnected ? "LIVE BACKEND" : "HYBRID LOCAL"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="bg-[#FAFAF7] border border-[#E3E1DA] rounded-xl p-2.5">
                <span className="text-[10px] text-[#4B5563] font-bold uppercase block">Winning Rule</span>
                <span className="font-mono font-bold text-[#1B1F23] truncate block" title={liveDecision?.firedRules?.[0] ?? "fair-rest-due"}>
                  {liveDecision?.firedRules?.[0] ?? (singleState === "ALLOW" ? "base-allow-assign" : "fair-rest-due")}
                </span>
              </div>
              <div className="bg-[#FAFAF7] border border-[#E3E1DA] rounded-xl p-2.5">
                <span className="text-[10px] text-[#4B5563] font-bold uppercase block">Penalty Waived</span>
                <span className="font-bold text-[#0F766E] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">verified</span>
                  YES (Safe)
                </span>
              </div>
              <div className="bg-[#FAFAF7] border border-[#E3E1DA] rounded-xl p-2.5">
                <span className="text-[10px] text-[#4B5563] font-bold uppercase block">Paid Rest</span>
                <span className="font-bold text-[#92400E] flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">account_balance_wallet</span>
                  ₹1.5/min
                </span>
              </div>
              <div className="bg-[#FAFAF7] border border-[#E3E1DA] rounded-xl p-2.5">
                <span className="text-[10px] text-[#4B5563] font-bold uppercase block">DPDP Privacy</span>
                <span className="font-mono font-bold text-[#0F766E] truncate block">
                  {selectedRider} (No GPS)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= VIEW 2: 5-STATE BOARD (SIDE BY SIDE 360 x 800) ================= */}
      {viewMode === "board" && (
        <div className="w-full flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs text-[#4B5563] px-2 font-semibold">
            <span>5 Canonical Dispatch States evaluated by HeatGate Cedar Engine · 360 × 800 px Android Viewport</span>
            <span className="font-mono">Scroll horizontally to compare all 5 states →</span>
          </div>

          {/* Horizontal Scrolling Board with 5 Phones */}
          <div className="w-full overflow-x-auto pb-6 pt-2 scrollbar-thin">
            <div className="inline-flex gap-8 items-start min-w-max px-2">
              
              {/* STATE 1: ALLOW (Blue) */}
              <div className="flex flex-col items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1D4ED8] text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>1. ALLOW (Order Given)</span>
                </div>
                <RiderPhoneDevice
                  initialState="ALLOW"
                  initialLang="EN"
                  riderId={selectedRider}
                  isInteractive={false}
                />
                <span className="text-xs text-[#4B5563] font-medium max-w-[340px] text-center">
                  Cool conditions or safe stint time. Order details, pickup hub, and earnings shown.
                </span>
              </div>

              {/* STATE 2: SKIP_ORDER (Grey) */}
              <div className="flex flex-col items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-[#F3F4F6] border border-[#E5E7EB] text-[#374151] text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">do_not_disturb_on</span>
                  <span>2. SKIP_ORDER (Too Far)</span>
                </div>
                <RiderPhoneDevice
                  initialState="SKIP_ORDER"
                  initialLang="EN"
                  riderId={selectedRider}
                  isInteractive={false}
                />
                <span className="text-xs text-[#4B5563] font-medium max-w-[340px] text-center">
                  Order distance exceeds 3 km heat threshold. Rider stays online without rating penalty.
                </span>
              </div>

              {/* STATE 3: FORCE_REST (Amber - Hindi Main State) */}
              <div className="flex flex-col items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                  <span>3. FORCE_REST (हिन्दी · Main State)</span>
                </div>
                <RiderPhoneDevice
                  initialState="FORCE_REST"
                  initialLang="HI"
                  riderId={selectedRider}
                  isInteractive={false}
                />
                <span className="text-xs text-[#4B5563] font-medium max-w-[340px] text-center">
                  Continuous heat stint &gt; 90 min at 42°C+. 20 min mandatory paid cooling break triggered.
                </span>
              </div>

              {/* STATE 4: DENY (Red Tint) */}
              <div className="flex flex-col items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-[#FEE2E2] border border-[#FECACA] text-[#991B1B] text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>4. DENY (Extreme Heat Pause)</span>
                </div>
                <RiderPhoneDevice
                  initialState="DENY"
                  initialLang="EN"
                  riderId={selectedRider}
                  isInteractive={false}
                />
                <span className="text-xs text-[#4B5563] font-medium max-w-[340px] text-center">
                  Ambient heat index exceeds 46°C emergency threshold. All dispatch halted across zone.
                </span>
              </div>

              {/* STATE 5: FORCE_REST in Telugu (Noto Sans Telugu) */}
              <div className="flex flex-col items-center gap-2">
                <div className="px-3 py-1 rounded-full bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-bold flex items-center gap-1.5 shadow-xs">
                  <span className="material-symbols-outlined text-[16px]">pause_circle</span>
                  <span>5. FORCE_REST (తెలుగు · Telugu)</span>
                </div>
                <RiderPhoneDevice
                  initialState="FORCE_REST"
                  initialLang="TE"
                  riderId={selectedRider}
                  isInteractive={false}
                />
                <span className="text-xs text-[#4B5563] font-medium max-w-[340px] text-center">
                  Telugu language verification proving layout holds cleanly with longer script lengths.
                </span>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
