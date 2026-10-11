// A phone showing one real POST /decide answer as a notification: the outcome in plain words, the engine's own
// message (English, or its Hindi, Telugu or Urdu draft translation), the rest length, the cooling point (only when
// the API sends one) and the heat index. No text is written here that the engine did not decide.
import { useEffect, useState } from "react";
import type { DecideRequest, Decision } from "@heatgate/contracts";
import { HeatChip, OutcomePill } from "./ui.tsx";

export type Language = "en" | "hi" | "te" | "ur";

const LANGS: { key: Language; label: string; font?: string }[] = [
  { key: "en", label: "EN" },
  { key: "hi", label: "हिं", font: "'Noto Sans Devanagari', 'Inter', sans-serif" },
  { key: "te", label: "తె", font: "'Noto Sans Telugu', 'Inter', sans-serif" },
  { key: "ur", label: "اردو", font: "'Noto Naskh Arabic', serif" },
];

interface RiderPhoneDeviceProps {
  decision: Decision;
  request: DecideRequest; // the inputs that were sent, for the clock and the order details
  initialLang?: Language;
}

export function RiderPhoneDevice({ decision, request, initialLang = "en" }: RiderPhoneDeviceProps) {
  const [lang, setLang] = useState<Language>(initialLang);
  useEffect(() => setLang(initialLang), [initialLang]);

  const translated = lang === "en" ? decision.message : decision.messages?.[lang];
  const font = LANGS.find((l) => l.key === lang)?.font;
  const clock = `${String(request.conditions.hourOfDay).padStart(2, "0")}:00`;

  return (
    <div
      className="w-[360px] max-w-full min-h-[620px] rounded-[40px] border-[8px] border-[#2D3135] shadow-xl overflow-hidden flex flex-col"
      style={{ background: "linear-gradient(180deg,#0B4F4A 0%,#1B1F23 100%)" }}
    >
      <div className="h-7 px-6 flex items-center justify-between text-[11px] font-mono text-white/80 shrink-0">
        <span className="w-8" />
        <span className="w-3.5 h-3.5 bg-black rounded-full" />
        <span className="material-symbols-outlined text-[13px]">battery_full</span>
      </div>
      <div className="text-center text-white/90 font-light text-[56px] leading-none mt-4 mb-5 tabular-nums" aria-hidden="true">
        {clock}
      </div>

      <div className="px-3 flex flex-col gap-2.5 pb-6">
        {/* The notification */}
        <div className="bg-white/95 rounded-3xl p-4 flex flex-col gap-3 text-[#1B1F23] shadow-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] text-[#4B5563]">
              <span className="w-5 h-5 rounded-md bg-[#0F766E] flex items-center justify-center">
                <span className="material-symbols-outlined text-[14px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>
                  local_fire_department
                </span>
              </span>
              <span className="font-bold text-[#1B1F23]">HeatGate</span>
            </span>
            <span className="font-mono text-[11px] text-[#4B5563]">{decision.riderId}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <OutcomePill outcome={decision.outcome} size="lg" />
            {decision.outcome === "FORCE_REST" && decision.restMinutes > 0 && (
              <span className="font-bold text-[28px] leading-none text-[#92400E] tabular-nums">{decision.restMinutes} min</span>
            )}
          </div>

          <p dir={lang === "ur" ? "rtl" : "ltr"} lang={lang} className="text-[22px] font-bold leading-snug" style={font ? { fontFamily: font } : undefined}>
            {translated ?? decision.message}
          </p>

          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] p-0.5" role="tablist" aria-label="Language">
              {LANGS.map((l) => (
                <button
                  key={l.key}
                  type="button"
                  role="tab"
                  aria-selected={lang === l.key}
                  onClick={() => setLang(l.key)}
                  className={`min-w-[40px] h-8 px-2 rounded-lg text-xs font-bold ${lang === l.key ? "bg-[#0F766E] text-[#FFFFFF]" : "text-[#4B5563] hover:text-[#1B1F23]"}`}
                >
                  {l.label}
                </button>
              ))}
            </div>
            {lang !== "en" &&
              (translated ? (
                <span
                  className="whitespace-nowrap text-[10px] font-bold uppercase tracking-wider text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded px-1.5 py-0.5"
                  title="Machine-written, not yet checked by a native speaker"
                >
                  Draft
                </span>
              ) : (
                <span className="text-[11px] text-[#4B5563]">No translation</span>
              ))}
          </div>
        </div>

        {decision.coolingPoint && (
          <div className="bg-white/95 rounded-3xl p-4 flex items-center gap-3 text-[#1B1F23]">
            <span className="w-11 h-11 rounded-2xl bg-[#E6F4F1] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[26px] text-[#0F766E]">water_drop</span>
            </span>
            <span className="flex flex-col">
              <span className="text-[17px] font-bold leading-tight">{decision.coolingPoint.name}</span>
              <span className="text-sm text-[#4B5563]">{decision.coolingPoint.distanceM} m away</span>
            </span>
          </div>
        )}

        {decision.outcome === "ALLOW" && (
          <div className="bg-white/95 rounded-3xl p-4 flex items-center gap-3 text-[#1B1F23]">
            <span className="material-symbols-outlined text-[26px] text-[#2563EB]">route</span>
            <span className="text-[17px] font-semibold">
              {request.order.distanceKm} km · about {request.order.tripMinutes} min
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5 justify-center pt-1">
          <HeatChip c={decision.heatIndexC} />
          {decision.outcome !== "ALLOW" && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-bold bg-white ${decision.penaltyWaived ? "border-[#A7F3D0] text-[#065F46]" : "border-[#FECACA] text-[#991B1B]"}`}
            >
              <span className="material-symbols-outlined text-[14px]">{decision.penaltyWaived ? "verified_user" : "warning"}</span>
              {decision.penaltyWaived ? "No penalty" : "Penalty not waived"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
