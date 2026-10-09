import React, { useEffect, useState } from "react";
import type { Decision } from "@heatgate/contracts";

export type RiderScreenState = "FORCE_REST" | "ALLOW" | "SKIP_ORDER" | "DENY";
export type Language = "EN" | "HI" | "TE";

interface RiderPhoneDeviceProps {
  initialState?: RiderScreenState;
  initialLang?: Language;
  riderId?: string;
  isInteractive?: boolean;
  decision?: Decision;
}

export function RiderPhoneDevice({
  initialState = "FORCE_REST",
  initialLang = "HI",
  riderId = "R-014",
  isInteractive = true,
  decision,
}: RiderPhoneDeviceProps) {
  const [state, setState] = useState<RiderScreenState>(initialState);
  const [lang, setLang] = useState<Language>(initialLang);
  const [checkedIn, setCheckedIn] = useState(false);
  const [orderAccepted, setOrderAccepted] = useState(false);

  useEffect(() => {
    setState(initialState);
  }, [initialState]);

  useEffect(() => {
    setLang(initialLang);
  }, [initialLang]);

  const coolingPointName = decision?.coolingPoint
    ? `${decision.coolingPoint.name} · ${decision.coolingPoint.distanceM} m`
    : "Cooling Point 3 · 420 m";
  const restMinutesVal = decision?.restMinutes ?? 20;
  const heatIndexVal = decision?.heatIndexC ?? 44;

  // Localization dictionary adhering to "Noto Sans Devanagari" & "Noto Sans Telugu"
  const textDict = {
    EN: {
      appName: "HeatGate",
      forceRestTitle: `Rest ${restMinutesVal} minutes`,
      forceRestSub: "Mandatory cooling break",
      coolingPoint: `Nearest shade and water: ${coolingPointName}`,
      directions: "Directions",
      ratingSafe: "No penalty. Your rating is safe.",
      paidRest: "Paid rest · Your daily target is reduced for this break",
      heatIndex: `Heat index ${heatIndexVal}°C`,
      atCoolingBtn: "I'm at the cooling point",
      checkedInMsg: "Check-in confirmed · Break timer running",
      nextOrderNote: "Your next order comes after the break.",
      nextOrderTitle: "Next order",
      pickup: "Pickup: Restaurant hub 2",
      distanceTime: "2.4 km · Est. 18 min",
      pay: "₹40 placeholder",
      acceptBtn: "Accept",
      acceptedMsg: "Order accepted · Heading to Restaurant hub 2",
      declineBtn: "Decline without penalty",
      skipTitle: "Order skipped for safety",
      skipBody: "This order is too far for this heat. You stay online for nearer orders.",
      skipRating: "Your rating is not affected.",
      stayOnline: "Searching for nearer order…",
      denyTitle: "Extreme heat. Deliveries are paused.",
      denyTarget: "Your incentive target is reduced for this time.",
      denyReason: `Heat index ${heatIndexVal}°C exceeds emergency safety threshold.`,
    },
    HI: {
      appName: "HeatGate",
      forceRestTitle: `${restMinutesVal} मिनट का आराम`,
      forceRestSub: `Rest ${restMinutesVal} minutes`,
      coolingPoint: `छाया और पानी: ${coolingPointName}`,
      directions: "दिशाएँ",
      ratingSafe: "कोई जुर्माना नहीं। आपकी रेटिंग सुरक्षित है।",
      paidRest: "भुगतान सहित आराम · इस ब्रेक के लिए दैनिक लक्ष्य कम किया गया है",
      heatIndex: `हीट इंडेक्स ${heatIndexVal}°C`,
      atCoolingBtn: "मैं कूलिंग पॉइंट पर हूँ",
      checkedInMsg: "चेक-इन सफल · आराम का समय शुरू",
      nextOrderNote: "ब्रेक खत्म होने के बाद अगला ऑर्डर आएगा।",
      nextOrderTitle: "अगला ऑर्डर",
      pickup: "पिकअप: रेस्टोरेंट हब 2",
      distanceTime: "2.4 किमी · अनुमानित 18 मिनट",
      pay: "₹40 placeholder",
      acceptBtn: "स्वीकार करें",
      acceptedMsg: "ऑर्डर स्वीकृत · रेस्टोरेंट हब 2 की ओर जाएं",
      declineBtn: "बिना जुर्माने के अस्वीकार करें",
      skipTitle: "गर्मी के कारण ऑर्डर छोड़ा गया",
      skipBody: "यह ऑर्डर इस भीषण गर्मी के लिए बहुत दूर है। आप पास के ऑर्डर के लिए ऑनलाइन रहें।",
      skipRating: "आपकी रेटिंग प्रभावित नहीं होगी।",
      stayOnline: "पास के ऑर्डर की खोज जारी है…",
      denyTitle: "अत्यधिक गर्मी। डिलीवरी रोकी गई।",
      denyTarget: "इस समय के लिए आपका प्रोत्साहन लक्ष्य घटा दिया गया है।",
      denyReason: `हीट इंडेक्स ${heatIndexVal}°C आपातकालीन सीमा से अधिक है।`,
    },
    TE: {
      appName: "HeatGate",
      forceRestTitle: `${restMinutesVal} నిమిషాల విశ్రాంతి`,
      forceRestSub: `Rest ${restMinutesVal} minutes`,
      coolingPoint: `నీడ మరియు నీరు: ${coolingPointName}`,
      directions: "రూట్",
      ratingSafe: "ఎలాంటి జరిమానా లేదు. మీ రేటింగ్ సురక్షితం.",
      paidRest: "వేతనంతో కూడిన విశ్రాంతి · ఈ బ్రేక్ కోసం రోజువారీ లక్ష్యం తగ్గించబడింది",
      heatIndex: `హీట్ ఇండెక్స్ ${heatIndexVal}°C`,
      atCoolingBtn: "నేను కూలింగ్ పాయింట్ వద్ద ఉన్నాను",
      checkedInMsg: "చెక్-ఇన్ పూర్తయింది · రెస్ట్ టైమర్ నడుస్తోంది",
      nextOrderNote: "విశ్రాంతి తర్వాత మీ తదుపరి ఆర్డర్ వస్తుంది.",
      nextOrderTitle: "తదుపరి ఆర్డర్",
      pickup: "పికప్: రెస్టారెంట్ హబ్ 2",
      distanceTime: "2.4 కి.మీ · సుమారు 18 నిమిషాలు",
      pay: "₹40 placeholder",
      acceptBtn: "స్వీకరించండి",
      acceptedMsg: "ఆర్డర్ స్వీకరించబడింది · రెస్టారెంట్ హబ్ 2 కి వెళ్లండి",
      declineBtn: "జరిమానా లేకుండా తిరస్కరించండి",
      skipTitle: "ఎండ తీవ్రత వల్ల ఆర్డర్ దాటవేయబడింది",
      skipBody: "ఈ ఎండకు ఈ ఆర్డర్ చాలా దూరంగా ఉంది. దగ్గరి ఆర్డర్‌ల కోసం ఆన్‌లైన్‌లో ఉండండి.",
      skipRating: "మీ రేటింగ్‌పై ఎలాంటి ప్రభావం ఉండదు.",
      stayOnline: "సమీప ఆర్డర్ కోసం వెతుకుతోంది…",
      denyTitle: "తీవ్రమైన ఎండ. డెలివరీలు నిలిపివేయబడ్డాయి.",
      denyTarget: "ఈ సమయానికి మీ ఇన్సెంటివ్ టార్గెట్ తగ్గించబడుతుంది.",
      denyReason: `హీట్ ఇండెక్స్ ${heatIndexVal}°C అత్యవసర పరిమితిని దాటింది.`,
    },
  };

  const t = textDict[lang];

  // Font family helper based on language
  const fontStyle =
    lang === "HI"
      ? { fontFamily: "'Noto Sans Devanagari', 'Inter', sans-serif" }
      : lang === "TE"
      ? { fontFamily: "'Noto Sans Telugu', 'Inter', sans-serif" }
      : { fontFamily: "'Inter', sans-serif" };

  return (
    <div className="flex flex-col items-center">
      {/* 360 x 800 Android Device Frame */}
      <div 
        className="w-[360px] h-[800px] max-h-[800px] bg-[#FAFAF7] rounded-[36px] border-[8px] border-[#2D3135] shadow-xl overflow-hidden flex flex-col relative select-none"
        style={fontStyle}
      >
        {/* Device Status Bar with Pinhole Camera */}
        <div className="h-6 bg-[#2D3135] text-[#FAFAF7] px-5 flex items-center justify-between text-[11px] font-mono shrink-0">
          <span>13:25</span>
          <div className="w-3.5 h-3.5 bg-black rounded-full border border-neutral-700 mx-auto"></div>
          <div className="flex items-center gap-1.5 text-[10px]">
            <span>4G LTE</span>
            <span className="material-symbols-outlined text-[12px]">battery_full</span>
          </div>
        </div>

        {/* Top App Strip: HeatGate + Rider ID + Language Switcher */}
        <header className="bg-[#FFFFFF] border-b border-[#E3E1DA] px-4 py-2.5 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E6F4F1] flex items-center justify-center text-[#0F766E]">
              <span className="material-symbols-outlined text-[18px]">shield</span>
            </div>
            <div>
              <span className="font-bold text-[#1B1F23] text-base tracking-tight leading-tight block">
                HeatGate
              </span>
              <span className="font-mono text-[11px] text-[#4B5563] font-semibold leading-none">
                {riderId}
              </span>
            </div>
          </div>

          {/* Large Segmented Language Switcher [EN | हिं | తె] */}
          <div 
            className="inline-flex items-center border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] p-0.5 text-sm font-semibold"
            role="tablist"
            aria-label="Language switcher"
          >
            {(["EN", "HI", "TE"] as const).map((l) => {
              const label = l === "EN" ? "EN" : l === "HI" ? "हिं" : "తె";
              const isSelected = lang === l;
              return (
                <button
                  key={l}
                  type="button"
                  onClick={() => isInteractive && setLang(l)}
                  className={`min-w-[36px] h-8 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center whitespace-nowrap ${
                    isSelected
                      ? "bg-[#0F766E] text-[#FFFFFF] shadow-xs"
                      : "text-[#4B5563] hover:text-[#1B1F23]"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </header>

        {/* Scrollable Main Phone Viewport */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col justify-between gap-3 text-[#1B1F23]">
          
          {/* ================= STATE 1 & 3 & 5: FORCE_REST ================= */}
          {state === "FORCE_REST" && (
            <>
              <div className="flex flex-col gap-3">
                {/* Hero Card: Amber Tint #FEF3C7, Amber Border, Thermometer-Pause */}
                <div className="bg-[#FEF3C7] border-2 border-[#FDE68A] rounded-2xl p-4 text-center flex flex-col items-center shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-[#FDE68A] text-[#92400E] flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-[24px]">pause_circle</span>
                  </div>

                  {/* Heading 28px */}
                  <h1 className="text-[28px] font-bold text-[#92400E] leading-tight mt-0.5">
                    {t.forceRestTitle}
                  </h1>
                  <span className="text-base font-semibold text-[#4B5563] mt-0.5">
                    {t.forceRestSub}
                  </span>

                  {/* 72px Countdown (Biggest Element on Screen) */}
                  <div 
                    className="font-mono text-[#92400E] font-bold tracking-tight my-1 tabular-nums"
                    style={{ fontSize: "72px", lineHeight: 1 }}
                  >
                    19:42
                  </div>

                  {/* Thin Amber Progress Bar */}
                  <div className="w-full bg-[#FDE68A] h-2 rounded-full overflow-hidden mt-1">
                    <div className="bg-[#D97706] h-full rounded-full w-3/4"></div>
                  </div>
                </div>

                {/* Info Rows (White Cards, 16px radius, icon on left, 20px text) */}
                <div className="flex flex-col gap-2.5">
                  {/* Row 1: Water & Directions */}
                  <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E6F4F1] text-[#0F766E] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">water_drop</span>
                      </div>
                      <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                        {t.coolingPoint}
                      </span>
                    </div>
                    <button 
                      type="button"
                      className="min-h-[48px] px-3 py-1.5 rounded-xl border-2 border-[#0F766E] text-[#0F766E] font-bold text-sm shrink-0 hover:bg-[#E6F4F1] whitespace-nowrap"
                    >
                      {t.directions}
                    </button>
                  </div>

                  {/* Row 2: No penalty / Rating safe */}
                  <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                    <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#065F46] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px]">verified_user</span>
                    </div>
                    <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                      {t.ratingSafe}
                    </span>
                  </div>

                  {/* Row 3: Paid Rest / Daily Target Reduced */}
                  <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                    <div className="w-9 h-9 rounded-xl bg-[#FEF3C7] text-[#92400E] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[24px]">account_balance_wallet</span>
                    </div>
                    <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                      {t.paidRest}
                    </span>
                  </div>

                  {/* Row 4: Heat Index 44°C */}
                  <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[24px]">device_thermostat</span>
                      </div>
                      <span className="text-[20px] font-semibold text-[#1B1F23]">
                        {t.heatIndex}
                      </span>
                    </div>
                    <span className="font-mono text-sm font-bold text-[#DC2626] bg-[#FEE2E2] px-2.5 py-1 rounded-lg border border-[#FECACA]">
                      LEVEL 2
                    </span>
                  </div>
                </div>
              </div>

              {/* Bottom: 56px Full-Width Primary Teal Button */}
              <div className="pt-2 flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => isInteractive && setCheckedIn(!checkedIn)}
                  className={`w-full h-14 min-h-[56px] rounded-2xl font-bold text-[20px] flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.99] whitespace-nowrap ${
                    checkedIn 
                      ? "bg-[#065F46] text-[#FFFFFF]" 
                      : "bg-[#0F766E] hover:bg-[#0B4F4A] text-[#FFFFFF]"
                  }`}
                >
                  <span className="material-symbols-outlined text-[22px]">
                    {checkedIn ? "task_alt" : "pin_drop"}
                  </span>
                  <span>{checkedIn ? t.checkedInMsg : t.atCoolingBtn}</span>
                </button>
                <p className="text-center text-xs text-[#4B5563] font-medium leading-none mb-1">
                  {t.nextOrderNote}
                </p>
              </div>
            </>
          )}

          {/* ================= STATE 2: ALLOW (Blue) ================= */}
          {state === "ALLOW" && (
            <>
              <div className="flex flex-col gap-3">
                {/* Hero Card: Blue Tint #EFF6FF */}
                <div className="bg-[#EFF6FF] border-2 border-[#BFDBFE] rounded-2xl p-4 flex flex-col gap-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[26px] text-[#2563EB]">check_circle</span>
                      <h2 className="text-[28px] font-bold text-[#1D4ED8] leading-tight">
                        {t.nextOrderTitle}
                      </h2>
                    </div>
                    <span className="font-mono text-xs font-bold text-[#1D4ED8] bg-[#DBEAFE] px-2 py-0.5 rounded border border-[#BFDBFE]">
                      ALLOW
                    </span>
                  </div>

                  <div className="bg-[#FFFFFF] border border-[#BFDBFE] rounded-xl p-3.5 flex flex-col gap-2 mt-1">
                    <div className="flex items-start gap-2.5">
                      <span className="material-symbols-outlined text-[#2563EB] text-[24px] mt-0.5">store</span>
                      <div>
                        <div className="text-[20px] font-bold text-[#1B1F23]">{t.pickup}</div>
                        <div className="text-base font-semibold text-[#4B5563] mt-0.5">{t.distanceTime}</div>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-[#E3E1DA] flex items-center justify-between">
                      <span className="text-base font-semibold text-[#4B5563]">Rider Earnings</span>
                      <span className="font-mono text-2xl font-bold text-[#0F766E]">{t.pay}</span>
                    </div>
                  </div>
                </div>

                {/* Safe conditions check */}
                <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-[#EFF6FF] text-[#2563EB] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">shield_check</span>
                  </div>
                  <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                    Safe distance evaluated by HeatGate Cedar policy.
                  </span>
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="pt-2 flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => isInteractive && setOrderAccepted(!orderAccepted)}
                  className="w-full h-14 min-h-[56px] rounded-2xl bg-[#2563EB] hover:bg-[#1D4ED8] text-[#FFFFFF] font-bold text-[20px] flex items-center justify-center gap-2 shadow-md active:scale-[0.99] whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[24px]">navigation</span>
                  <span>{orderAccepted ? t.acceptedMsg : t.acceptBtn}</span>
                </button>
                <button
                  type="button"
                  className="w-full h-12 min-h-[48px] text-[#4B5563] hover:text-[#1B1F23] font-bold text-base flex items-center justify-center"
                >
                  {t.declineBtn}
                </button>
              </div>
            </>
          )}

          {/* ================= STATE 3: SKIP_ORDER (Grey) ================= */}
          {state === "SKIP_ORDER" && (
            <>
              <div className="flex flex-col gap-3">
                {/* Hero Card: Grey #F3F4F6 */}
                <div className="bg-[#F3F4F6] border-2 border-[#E5E7EB] rounded-2xl p-4 text-center flex flex-col items-center shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-[#E5E7EB] text-[#4B5563] flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-[26px]">do_not_disturb_on</span>
                  </div>
                  <h2 className="text-[28px] font-bold text-[#1B1F23] leading-tight mt-0.5">
                    {t.skipTitle}
                  </h2>
                  <p className="text-[20px] font-semibold text-[#4B5563] mt-2 leading-snug">
                    {t.skipBody}
                  </p>
                </div>

                {/* Rating safe */}
                <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#065F46] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">verified</span>
                  </div>
                  <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                    {t.skipRating}
                  </span>
                </div>

                <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-[#F3F4F6] text-[#4B5563] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">explore</span>
                  </div>
                  <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                    {t.stayOnline}
                  </span>
                </div>
              </div>

              {/* Bottom Reassurance */}
              <div className="pt-2 flex flex-col gap-2 shrink-0">
                <button
                  type="button"
                  className="w-full h-14 min-h-[56px] rounded-2xl border-2 border-[#0F766E] text-[#0F766E] font-bold text-[20px] flex items-center justify-center gap-2 hover:bg-[#E6F4F1] whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-[22px]">radar</span>
                  <span>Online for short-haul orders</span>
                </button>
                <p className="text-center text-xs text-[#4B5563] font-medium leading-none mb-1">
                  HeatGate Fair rule: Trips capped at 3 km during 41°C+
                </p>
              </div>
            </>
          )}

          {/* ================= STATE 4: DENY (Red) ================= */}
          {state === "DENY" && (
            <>
              <div className="flex flex-col gap-3">
                {/* Hero Card: Red Tint #FEE2E2 */}
                <div className="bg-[#FEE2E2] border-2 border-[#FECACA] rounded-2xl p-4 text-center flex flex-col items-center shadow-xs">
                  <div className="w-10 h-10 rounded-full bg-[#FECACA] text-[#DC2626] flex items-center justify-center mb-1">
                    <span className="material-symbols-outlined text-[26px]">error</span>
                  </div>
                  <h2 className="text-[28px] font-bold text-[#991B1B] leading-tight mt-0.5">
                    {t.denyTitle}
                  </h2>
                  <p className="text-[20px] font-semibold text-[#991B1B] mt-1 leading-snug">
                    {t.denyTarget}
                  </p>

                  {/* 72px Countdown */}
                  <div 
                    className="font-mono text-[#991B1B] font-bold tracking-tight my-2 tabular-nums"
                    style={{ fontSize: "72px", lineHeight: 1 }}
                  >
                    15:00
                  </div>

                  <div className="w-full bg-[#FECACA] h-2 rounded-full overflow-hidden">
                    <div className="bg-[#DC2626] h-full rounded-full w-full"></div>
                  </div>
                </div>

                {/* Info row */}
                <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-[#FEE2E2] text-[#DC2626] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">warning</span>
                  </div>
                  <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                    {t.denyReason}
                  </span>
                </div>

                <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-2xl p-3.5 flex items-center gap-3 shadow-xs">
                  <div className="w-9 h-9 rounded-xl bg-[#ECFDF5] text-[#065F46] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[24px]">verified_user</span>
                  </div>
                  <span className="text-[20px] font-semibold text-[#1B1F23] leading-snug">
                    {t.ratingSafe}
                  </span>
                </div>
              </div>

              {/* Bottom Reassurance */}
              <div className="pt-2 flex flex-col gap-2 shrink-0">
                <div className="w-full h-14 min-h-[56px] rounded-2xl bg-[#DC2626] text-[#FFFFFF] font-bold text-[20px] flex items-center justify-center gap-2 whitespace-nowrap shadow-md">
                  <span className="material-symbols-outlined text-[24px]">pause</span>
                  <span>Safety Stop Active</span>
                </div>
                <p className="text-center text-xs text-[#4B5563] font-medium leading-none mb-1">
                  Automatic resume when ambient heat falls below 46°C.
                </p>
              </div>
            </>
          )}

        </div>

        {/* State Indicator footer badge inside phone for testing */}
        {isInteractive && (
          <div className="bg-[#FFFFFF] border-t border-[#E3E1DA] px-3 py-1.5 flex items-center justify-between text-[11px] font-mono text-[#4B5563] shrink-0">
            <span>STATE: {state}</span>
            <div className="flex gap-1">
              {(["FORCE_REST", "ALLOW", "SKIP_ORDER", "DENY"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setState(s)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    state === s ? "bg-[#0F766E] text-[#FFFFFF]" : "bg-[#FAFAF7] hover:bg-[#E3E1DA]"
                  }`}
                >
                  {s === "FORCE_REST" ? "REST" : s === "SKIP_ORDER" ? "SKIP" : s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
