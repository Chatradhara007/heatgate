// A 360 x 800 phone showing one real POST /decide answer: the engine's own message (English, or its Hindi,
// Telugu or Urdu draft translation), the rest length, the heat index and, only when the API sends one, the
// nearest cooling point. No text is written here that the engine did not decide.
import { useEffect, useState } from "react";
import type { DecideRequest, Decision, Outcome } from "@heatgate/contracts";

export type Language = "en" | "hi" | "te" | "ur";

const LANGS: { key: Language; label: string; font?: string }[] = [
  { key: "en", label: "EN" },
  { key: "hi", label: "हिं", font: "'Noto Sans Devanagari', 'Inter', sans-serif" },
  { key: "te", label: "తె", font: "'Noto Sans Telugu', 'Inter', sans-serif" },
  { key: "ur", label: "اردو", font: "'Noto Naskh Arabic', serif" },
];

const LOOK: Record<Outcome, { card: string; text: string; icon: string }> = {
  ALLOW: { card: "bg-[#EFF6FF] border-[#BFDBFE]", text: "text-[#1D4ED8]", icon: "check_circle" },
  SKIP_ORDER: { card: "bg-[#F3F4F6] border-[#E5E7EB]", text: "text-[#374151]", icon: "do_not_disturb_on" },
  DENY: { card: "bg-[#FEE2E2] border-[#FECACA]", text: "text-[#991B1B]", icon: "error" },
  FORCE_REST: { card: "bg-[#FEF3C7] border-[#FDE68A]", text: "text-[#92400E]", icon: "pause_circle" },
};

interface RiderPhoneDeviceProps {
  decision: Decision;
  request: DecideRequest; // the inputs that were sent, for the clock and the order details
  initialLang?: Language;
}

export function RiderPhoneDevice({ decision, request, initialLang = "en" }: RiderPhoneDeviceProps) {
  const [lang, setLang] = useState<Language>(initialLang);
  useEffect(() => setLang(initialLang), [initialLang]);

  const translated = lang === "en" ? decision.message : decision.messages?.[lang];
  const look = LOOK[decision.outcome];
  const font = LANGS.find((l) => l.key === lang)?.font;

  return (
    <div className="w-[360px] max-w-full h-[800px] bg-[#FAFAF7] rounded-[36px] border-[8px] border-[#2D3135] shadow-xl overflow-hidden flex flex-col">
      <div className="h-6 bg-[#2D3135] text-[#FAFAF7] px-5 flex items-center justify-between text-[11px] font-mono shrink-0">
        <span>{String(request.conditions.hourOfDay).padStart(2, "0")}:00</span>
        <span className="w-3.5 h-3.5 bg-black rounded-full border border-neutral-700" />
        <span className="material-symbols-outlined text-[12px]">battery_full</span>
      </div>

      <header className="bg-[#FFFFFF] border-b border-[#E3E1DA] px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
        <div>
          <span className="font-bold text-[#1B1F23] text-base block leading-tight">HeatGate</span>
          <span className="font-mono text-[11px] text-[#4B5563] font-semibold">{decision.riderId}</span>
        </div>
        <div className="inline-flex border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] p-0.5" role="tablist" aria-label="Language">
          {LANGS.map((l) => (
            <button
              key={l.key}
              type="button"
              role="tab"
              aria-selected={lang === l.key}
              onClick={() => setLang(l.key)}
              className={`min-w-[36px] h-8 px-2 rounded-lg text-xs font-bold ${lang === l.key ? "bg-[#0F766E] text-[#FFFFFF]" : "text-[#4B5563] hover:text-[#1B1F23]"}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 text-[#1B1F23]">
        <div className={`border-2 rounded-2xl p-4 text-center flex flex-col items-center gap-2 ${look.card}`}>
          <span className={`material-symbols-outlined text-[30px] ${look.text}`}>{look.icon}</span>
          <span className={`font-mono text-xs font-bold ${look.text}`}>{decision.outcome}</span>
          {decision.outcome === "FORCE_REST" && decision.restMinutes > 0 && (
            <span className={`font-mono font-bold tabular-nums ${look.text}`} style={{ fontSize: "56px", lineHeight: 1 }}>
              {decision.restMinutes} min
            </span>
          )}
          <p
            dir={lang === "ur" ? "rtl" : "ltr"}
            lang={lang}
            className={`text-[22px] font-bold leading-snug ${look.text}`}
            style={font ? { fontFamily: font } : undefined}
          >
            {translated ?? decision.message}
          </p>
          {lang !== "en" &&
            (translated ? (
              <span className="text-[11px] font-semibold text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded px-1.5 py-0.5">
                Draft translation, not yet checked by a native speaker
              </span>
            ) : (
              <span className="text-[11px] text-[#4B5563]">No translation for this message; showing English.</span>
            ))}
        </div>

        {decision.coolingPoint && (
          <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px] text-[#0F766E]">water_drop</span>
            <span className="text-[18px] font-semibold leading-snug">
              {decision.coolingPoint.name} · {decision.coolingPoint.distanceM} m
            </span>
          </div>
        )}

        {decision.outcome === "ALLOW" && (
          <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3">
            <span className="material-symbols-outlined text-[24px] text-[#2563EB]">route</span>
            <span className="text-[18px] font-semibold">
              {request.order.distanceKm} km · about {request.order.tripMinutes} min
            </span>
          </div>
        )}

        <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3">
          <span className="material-symbols-outlined text-[24px] text-[#DC2626]">device_thermostat</span>
          <span className="text-[18px] font-semibold">Heat index {decision.heatIndexC}°C</span>
        </div>

        {decision.outcome !== "ALLOW" && (
          <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3">
            <span className={`material-symbols-outlined text-[24px] ${decision.penaltyWaived ? "text-[#065F46]" : "text-[#991B1B]"}`}>
              {decision.penaltyWaived ? "verified_user" : "warning"}
            </span>
            <span className="text-[18px] font-semibold">{decision.penaltyWaived ? "Declining has no penalty" : "Penalty not waived"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
