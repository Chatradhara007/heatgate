// Rider phone: what a rider sees for one decision. Every phone here is a real POST /decide answer (dryRun, so
// nothing is logged) for an example set of inputs. The engine decides the outcome; the labels show what it decided.
import { useEffect, useState } from "react";
import type { DecideRequest } from "@heatgate/contracts";
import { useDataSource, useDecide } from "../hooks/index.ts";
import { RiderPhoneDevice, type Language } from "../components/RiderPhoneDevice.tsx";
import { DecisionInputs, InfoTip } from "../components/ui.tsx";

// Example inputs (not results). Labels describe the inputs only.
type ScenarioKey = "cool" | "longTrip" | "breakDue" | "extreme";
const SCENARIOS: Record<ScenarioKey, { label: string; build: (riderId: string) => DecideRequest }> = {
  cool: {
    label: "34°C, short trip",
    build: (id) => ({
      policyVersion: "heatgate-fair",
      rider: { id, vehicle: "bike", x: 2.1, y: 3.4 },
      order: { id: "order-example-1", zone: "example", distanceKm: 2.4, tripMinutes: 18 },
      conditions: { tempC: 34, humidityPct: 40, hourOfDay: 10, demandLevel: 1, alertLevel: 0 },
      riderState: { minutesSinceBreak: 25, exposureMinutesToday: 60, restMinutesRemaining: 0 },
      dryRun: true,
    }),
  },
  longTrip: {
    label: "42°C, long trip",
    build: (id) => ({
      policyVersion: "heatgate-fair",
      rider: { id, vehicle: "bike", x: 5.5, y: 6.2 },
      order: { id: "order-example-2", zone: "example", distanceKm: 4.8, tripMinutes: 28 },
      conditions: { tempC: 42, humidityPct: 32, hourOfDay: 14, demandLevel: 2, alertLevel: 1 },
      riderState: { minutesSinceBreak: 45, exposureMinutesToday: 130, restMinutesRemaining: 0 },
      dryRun: true,
    }),
  },
  breakDue: {
    label: "44°C, 105 min working",
    build: (id) => ({
      policyVersion: "heatgate-fair",
      rider: { id, vehicle: "bike", x: 4.2, y: 5.1 },
      order: { id: "order-example-3", zone: "example", distanceKm: 2.8, tripMinutes: 16 },
      conditions: { tempC: 44, humidityPct: 35, hourOfDay: 13, demandLevel: 1, alertLevel: 1 },
      riderState: { minutesSinceBreak: 105, exposureMinutesToday: 245, restMinutesRemaining: 0 },
      dryRun: true,
    }),
  },
  extreme: {
    label: "47°C",
    build: (id) => ({
      policyVersion: "heatgate-fair",
      rider: { id, vehicle: "bike", x: 1.5, y: 2.8 },
      order: { id: "order-example-4", zone: "example", distanceKm: 3.0, tripMinutes: 20 },
      conditions: { tempC: 47, humidityPct: 28, hourOfDay: 14, demandLevel: 1, alertLevel: 2 },
      riderState: { minutesSinceBreak: 60, exposureMinutesToday: 180, restMinutesRemaining: 0 },
      dryRun: true,
    }),
  },
};

const RIDERS = ["rider-014", "rider-008", "rider-022", "rider-035"]; // pseudonymous example ids

const BOARD: { scenario: ScenarioKey; lang: Language }[] = [
  { scenario: "cool", lang: "en" },
  { scenario: "longTrip", lang: "en" },
  { scenario: "breakDue", lang: "hi" },
  { scenario: "extreme", lang: "en" },
  { scenario: "breakDue", lang: "te" },
];

function inputsLine(r: DecideRequest) {
  const c = r.conditions;
  return `${c.tempC}°C · ${r.riderState.minutesSinceBreak} min since break · ${r.order.distanceKm} km`;
}

// One phone driven by its own POST /decide call.
function DecidedPhone({ request, lang, showInputs }: { request: DecideRequest; lang: Language; showInputs?: boolean }) {
  const decide = useDecide();
  const { run } = decide;
  const requestKey = JSON.stringify(request);
  useEffect(() => {
    run(request);
    // requestKey stands in for request, which is rebuilt on every render.
  }, [requestKey, run]);

  return (
    <div className="flex flex-col items-center gap-2 max-w-[360px]">
      {decide.error ? (
        <div role="alert" className="w-[360px] max-w-full rounded-2xl border border-[#FECACA] bg-[#FEE2E2] p-4 text-center">
          <p className="text-sm font-bold text-[#991B1B]">Could not get a decision from the API</p>
          <p className="mt-1 text-xs text-[#4B5563]">{decide.error.message}</p>
        </div>
      ) : !decide.data ? (
        <p className="text-sm text-[#4B5563] w-[360px] text-center">Asking the policy engine…</p>
      ) : (
        <RiderPhoneDevice decision={decide.data} request={request} initialLang={lang} />
      )}
      {showInputs && <span className="text-xs text-[#4B5563] text-center">{inputsLine(request)}</span>}
    </div>
  );
}

export function RiderPhonePage() {
  const [selectedRider, setSelectedRider] = useState(RIDERS[0]);
  const [viewMode, setViewMode] = useState<"single" | "board">("single");
  const [scenario, setScenario] = useState<ScenarioKey>("breakDue");
  const { source } = useDataSource();

  const request = SCENARIOS[scenario].build(selectedRider);
  const singleDecide = useDecide();
  const { run } = singleDecide;
  const [latencyMs, setLatencyMs] = useState<number | undefined>(undefined);
  const requestKey = JSON.stringify(request);
  useEffect(() => {
    let active = true;
    const start = performance.now();
    setLatencyMs(undefined);
    run(request).then((res) => active && res && setLatencyMs(Math.round(performance.now() - start)));
    return () => {
      active = false;
    };
    // requestKey stands in for request, which is rebuilt on every render.
  }, [requestKey, run]);
  const decision = singleDecide.data;

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-5">
      <div className="w-full bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <h1 className="text-[#1B1F23] flex items-center gap-1" style={{ fontFamily: '"Bebas Neue", sans-serif', letterSpacing: "0.04em", fontSize: "26px" }}>
              Rider Phone View
              <InfoTip label="About these phones">
                Each phone is a real POST /decide answer from the HeatGate Fair rules (dry run: nothing is logged). The inputs are examples, not
                results. Translations are machine-written drafts, not yet checked by a native speaker.
              </InfoTip>
            </h1>
          </div>
          <label className="flex items-center gap-2">
            <select
              aria-label="Rider"
              value={selectedRider}
              onChange={(e) => setSelectedRider(e.target.value)}
              className="h-10 px-3 rounded-xl border border-[#E3E1DA] bg-[#FAFAF7] font-mono text-xs font-bold text-[#1B1F23]"
            >
              {RIDERS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="inline-flex border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] p-1 text-xs font-bold gap-1" role="tablist" aria-label="View">
          {(["single", "board"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={viewMode === m}
              onClick={() => setViewMode(m)}
              className={`px-3 py-1.5 rounded-lg ${viewMode === m ? "bg-[#0F766E] text-[#FFFFFF]" : "text-[#4B5563] hover:text-[#1B1F23]"}`}
            >
              {m === "single" ? "One phone" : "Five phones"}
            </button>
          ))}
        </div>
      </div>

      {source === "fixtures" && (
        <p className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-xs text-[#92400E]">
          Fixture mode: stored decisions, not these inputs. Use the live API to see the engine decide.
        </p>
      )}

      {viewMode === "single" && (
        <div className="flex flex-col items-center gap-4 py-2 w-full">
          <div className="flex flex-wrap items-center justify-center gap-2 bg-[#FFFFFF] border border-[#E3E1DA] p-1.5 rounded-2xl" role="radiogroup" aria-label="Example inputs">
            {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={scenario === k}
                onClick={() => setScenario(k)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold ${scenario === k ? "bg-[#E6F4F1] text-[#0F766E] border-2 border-[#0F766E]" : "bg-[#FAFAF7] text-[#4B5563] hover:bg-[#E3E1DA]"}`}
              >
                {SCENARIOS[k].label}
              </button>
            ))}
          </div>

          {singleDecide.error ? (
            <div role="alert" className="w-full max-w-[620px] rounded-2xl border border-[#FECACA] bg-[#FEE2E2] p-4 text-center">
              <p className="text-sm font-bold text-[#991B1B]">Could not get a decision from the API</p>
              <p className="mt-1 text-xs text-[#4B5563]">{singleDecide.error.message}</p>
            </div>
          ) : !decision ? (
            <p className="text-sm text-[#4B5563]">Asking the policy engine…</p>
          ) : (
            <div className="flex flex-col md:flex-row items-center md:items-start justify-center gap-6 w-full">
              <RiderPhoneDevice decision={decision} request={request} initialLang="hi" />
              <div className="w-full max-w-[360px] bg-white border border-[#E3E1DA] rounded-2xl p-4 flex flex-col gap-4">
                <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">Inputs</span>
                <DecisionInputs ctx={decision.cedarContext} />
                <div className="flex flex-wrap gap-x-4 gap-y-1 pt-3 border-t border-[#E3E1DA] text-xs text-[#4B5563]">
                  <span className="inline-flex items-center gap-1" title="Winning rule">
                    <span className="material-symbols-outlined text-[15px]">gavel</span>
                    <span className="font-mono font-bold text-[#1B1F23]">{decision.firedRules[0] ?? "none"}</span>
                  </span>
                  <span className="inline-flex items-center gap-1" title="Round trip to the API">
                    <span className="material-symbols-outlined text-[15px]">bolt</span>
                    <span className="font-mono font-bold text-[#1B1F23]">{latencyMs !== undefined ? `${latencyMs} ms` : "—"}</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {viewMode === "board" && (
        <div className="w-full overflow-x-auto pb-6 pt-2">
          <div className="inline-flex gap-8 items-start min-w-max px-2">
            {BOARD.map((b, i) => (
              <DecidedPhone key={i} request={SCENARIOS[b.scenario].build(selectedRider)} lang={b.lang} showInputs />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
