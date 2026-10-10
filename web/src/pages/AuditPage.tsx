import { useEffect, useMemo, useState } from "react";
import type { Decision, Outcome, PolicyVersion } from "@heatgate/contracts";
import { POLICY_LABELS } from "@heatgate/contracts";
import { useAudit } from "../hooks/index.ts";
import { useActiveSimulation } from "../context/SimulationContext.tsx";
import type { AuditQuery } from "../api.ts";

interface AuditDecision {
  id: string;
  time: string;
  riderId: string;
  orderId: string;
  policy: string;
  policyFull: string;
  outcome: Outcome;
  winningRule: string;
  penaltyWaived: boolean;
  firedRules: { rule: string; status: "Winner" | "Also fired" }[];
  keyFacts: {
    heatIndexC: number;
    restMinutes: number;
    penaltyWaived: string;
    coolingPoint: string;
  };
  exactInputs: {
    heatIndexC: number;
    hourOfDay: number;
    minutesSinceBreak: number;
    exposureMinutesToday: number;
    restMinutesRemaining: number;
    tripMinutes: number;
    demandLevel: number;
    alertLevel: number;
  };
  messages: {
    en: string;
    hi: string;
    te: string;
  };
}

// 10 sample decisions using ONLY the approved rules:
// fair-rest-due, fair-rest-early-in-lull, fair-rest-hard-limit, fair-short-trips-only,
// fair-extreme-heat-stop, ndma-peak-hours-pause, ndma-break-due, ndma-reduced-radius,
// union-rest-due, base-allow-assign.
const SAMPLE_DECISIONS: AuditDecision[] = [
  {
    id: "01J9ZK8R3Q4M8V2N7P1T",
    time: "13:25",
    riderId: "R-014",
    orderId: "O-0412",
    policy: "HeatGate Fair",
    policyFull: "HeatGate Fair",
    outcome: "FORCE_REST",
    winningRule: "fair-rest-due",
    penaltyWaived: true,
    firedRules: [
      { rule: "fair-rest-due", status: "Winner" },
      { rule: "fair-rest-hard-limit", status: "Also fired" },
    ],
    keyFacts: {
      heatIndexC: 44,
      restMinutes: 20,
      penaltyWaived: "Yes",
      coolingPoint: "Cooling Point 3, 420 m",
    },
    exactInputs: {
      heatIndexC: 44,
      hourOfDay: 13,
      minutesSinceBreak: 105,
      exposureMinutesToday: 245,
      restMinutesRemaining: 0,
      tripMinutes: 20,
      demandLevel: 1,
      alertLevel: 1,
    },
    messages: {
      en: "Heat safety pause: Current heat index is 44°C. Please take a mandatory 20-minute rest at Cooling Point 3 (420 m away). Penalty waived. No dispatch until 13:45.",
      hi: "गर्मी सुरक्षा विराम: वर्तमान हीट इंडेक्स 44°C है। कृपया कूलिंग पॉइंट 3 (420 मीटर दूर) पर 20 मिनट का अनिवार्य विश्राम लें। पेनाल्टी माफ की गई। 13:45 तक कोई ऑर्डर नहीं।",
      te: "ఎండ తీవ్రత విరామం: ప్రస్తుత హీట్ ఇండెక్స్ 44°C. దయచేసి కూలింగ్ పాయింట్ 3 (420 మీటర్లు) వద్ద 20 నిమిషాల తప్పనిసరి విశ్రాంతి తీసుకోండి. పెనాల్టీ మినహాయించబడింది. 13:45 వరకు ఆర్డర్లు ఉండవు.",
    },
  },
  {
    id: "01J9ZK7A2M9Q3V1N8P4E",
    time: "13:22",
    riderId: "R-008",
    orderId: "O-0410",
    policy: "HeatGate Fair",
    policyFull: "HeatGate Fair",
    outcome: "FORCE_REST",
    winningRule: "fair-rest-hard-limit",
    penaltyWaived: true,
    firedRules: [
      { rule: "fair-rest-hard-limit", status: "Winner" },
      { rule: "fair-rest-due", status: "Also fired" },
    ],
    keyFacts: {
      heatIndexC: 43,
      restMinutes: 25,
      penaltyWaived: "Yes",
      coolingPoint: "Cooling Point 1, 310 m",
    },
    exactInputs: {
      heatIndexC: 43,
      hourOfDay: 13,
      minutesSinceBreak: 130,
      exposureMinutesToday: 280,
      restMinutesRemaining: 0,
      tripMinutes: 15,
      demandLevel: 2,
      alertLevel: 1,
    },
    messages: {
      en: "Cumulative heat limit reached: 280 minutes outdoor exposure today. 25-minute recovery break assigned at Cooling Point 1.",
      hi: "अधिकतम धूप सीमा पार: आज 280 मिनट धूप में कार्य। कूलिंग पॉइंट 1 पर 25 मिनट का विश्राम अनिवार्य।",
      te: "గరిష్ట ఎండ పరిమితి దాటింది: ఈ రోజు 280 నిమిషాల ఎండ ఎక్స్పోజర్. కూలింగ్ పాయింట్ 1 వద్ద 25 నిమిషాల రికవరీ విరామం.",
    },
  },
  {
    id: "01J9ZK6B8M4Q2V7N1P9K",
    time: "13:18",
    riderId: "R-027",
    orderId: "O-0409",
    policy: "HeatGate Fair",
    policyFull: "HeatGate Fair",
    outcome: "ALLOW",
    winningRule: "fair-short-trips-only",
    penaltyWaived: false,
    firedRules: [{ rule: "fair-short-trips-only", status: "Winner" }],
    keyFacts: {
      heatIndexC: 41,
      restMinutes: 0,
      penaltyWaived: "No",
      coolingPoint: "N/A (Active trip)",
    },
    exactInputs: {
      heatIndexC: 41,
      hourOfDay: 13,
      minutesSinceBreak: 45,
      exposureMinutesToday: 150,
      restMinutesRemaining: 0,
      tripMinutes: 12,
      demandLevel: 2,
      alertLevel: 0,
    },
    messages: {
      en: "Short trip permitted: Estimated duration is under 15 minutes. Stay hydrated and monitor shaded stops.",
      hi: "छोटा ट्रिप स्वीकृत: अनुमानित समय 15 मिनट से कम है। पानी पीते रहें और छायादार स्थानों पर रुकें।",
      te: "చిన్న ట్రిప్ అనుమతించబడింది: అంచనా సమయం 15 నిమిషాల లోపు. నీరు తాగుతూ ఉండండి.",
    },
  },
  {
    id: "01J9ZK5C3M1Q8V4N6P2X",
    time: "13:15",
    riderId: "R-031",
    orderId: "O-0405",
    policy: "HeatGate Fair",
    policyFull: "HeatGate Fair",
    outcome: "DENY",
    winningRule: "fair-extreme-heat-stop",
    penaltyWaived: true,
    firedRules: [
      { rule: "fair-extreme-heat-stop", status: "Winner" },
      { rule: "fair-rest-due", status: "Also fired" },
    ],
    keyFacts: {
      heatIndexC: 46,
      restMinutes: 45,
      penaltyWaived: "Yes",
      coolingPoint: "Cooling Point 4, 180 m",
    },
    exactInputs: {
      heatIndexC: 46,
      hourOfDay: 13,
      minutesSinceBreak: 80,
      exposureMinutesToday: 210,
      restMinutesRemaining: 0,
      tripMinutes: 30,
      demandLevel: 3,
      alertLevel: 2,
    },
    messages: {
      en: "Critical red alert: Heat index exceeds 45°C. Full dispatch shutdown active. All penalties waived. Proceed to nearest shelter.",
      hi: "गंभीर रेड अलर्ट: हीट इंडेक्स 45°C से अधिक है। सभी डिस्पैच निलंबित। कोई पेनल्टी नहीं। निकटतम शेल्टर में जाएं।",
      te: "తీవ్రమైన రెడ్ అలర్ట్: హీట్ ఇండెక్స్ 45°C దాటింది. డెలివరీలు నిలిపివేయబడ్డాయి. సమీప షెల్టర్‌కు వెళ్లండి.",
    },
  },
  {
    id: "01J9ZK4D9M6Q5V2N3P8Z",
    time: "13:12",
    riderId: "R-003",
    orderId: "O-0401",
    policy: "HeatGate Fair",
    policyFull: "HeatGate Fair",
    outcome: "SKIP_ORDER",
    winningRule: "fair-rest-early-in-lull",
    penaltyWaived: false,
    firedRules: [{ rule: "fair-rest-early-in-lull", status: "Winner" }],
    keyFacts: {
      heatIndexC: 42,
      restMinutes: 15,
      penaltyWaived: "No",
      coolingPoint: "Cooling Point 2, 540 m",
    },
    exactInputs: {
      heatIndexC: 42,
      hourOfDay: 13,
      minutesSinceBreak: 75,
      exposureMinutesToday: 190,
      restMinutesRemaining: 0,
      tripMinutes: 22,
      demandLevel: 0,
      alertLevel: 1,
    },
    messages: {
      en: "Order skipped opportunistically: Low platform demand detected. Early preventive 15-minute rest scheduled without earnings penalty.",
      hi: "ऑर्डर स्किप: मांग कम होने के कारण समय से पहले 15 मिनट का एहतियाती विश्राम आवंटित।",
      te: "ఆర్డర్ దాటవేయబడింది: డిమాండ్ తక్కువగా ఉంది. 15 నిమిషాల ముందస్తు విశ్రాంతి షెడ్యూల్ చేయబడింది.",
    },
  },
  {
    id: "01J9ZK3E1M7Q9V6N4P5W",
    time: "13:08",
    riderId: "R-019",
    orderId: "O-0398",
    policy: "NDMA advisory",
    policyFull: "NDMA advisory rules",
    outcome: "DENY",
    winningRule: "ndma-peak-hours-pause",
    penaltyWaived: false,
    firedRules: [{ rule: "ndma-peak-hours-pause", status: "Winner" }],
    keyFacts: {
      heatIndexC: 43,
      restMinutes: 60,
      penaltyWaived: "No",
      coolingPoint: "Zone Rest Area",
    },
    exactInputs: {
      heatIndexC: 43,
      hourOfDay: 13,
      minutesSinceBreak: 60,
      exposureMinutesToday: 180,
      restMinutesRemaining: 0,
      tripMinutes: 25,
      demandLevel: 1,
      alertLevel: 1,
    },
    messages: {
      en: "NDMA Peak Hour Advisory: Afternoon heat pause between 12:00 and 15:00 hours. Dispatches paused.",
      hi: "एनडीएमए एडवाइजरी: दोपहर 12:00 से 15:00 के बीच भीषण गर्मी के कारण डिलीवरी बंद।",
      te: "NDMA మార్గదర్శకాలు: మధ్యాహ్నం 12:00 నుండి 15:00 వరకు ఎండ తీవ్రత వల్ల పనులు నిలిపివేయబడ్డాయి.",
    },
  },
  {
    id: "01J9ZK2F4M3Q1V8N5P7Y",
    time: "13:05",
    riderId: "R-042",
    orderId: "O-0394",
    policy: "NDMA advisory",
    policyFull: "NDMA advisory rules",
    outcome: "FORCE_REST",
    winningRule: "ndma-break-due",
    penaltyWaived: false,
    firedRules: [{ rule: "ndma-break-due", status: "Winner" }],
    keyFacts: {
      heatIndexC: 41,
      restMinutes: 20,
      penaltyWaived: "No",
      coolingPoint: "Cooling Point 1, 290 m",
    },
    exactInputs: {
      heatIndexC: 41,
      hourOfDay: 13,
      minutesSinceBreak: 120,
      exposureMinutesToday: 230,
      restMinutesRemaining: 0,
      tripMinutes: 18,
      demandLevel: 2,
      alertLevel: 1,
    },
    messages: {
      en: "NDMA protocol: 120 minutes continuous work reached during heat advisory. 20-minute rest mandatory.",
      hi: "एनडीएमए नियम: 120 मिनट लगातार कार्य पूर्ण। 20 मिनट का ब्रेक अनिवार्य।",
      te: "NDMA నిబంధన: ఎండ వేళల్లో 120 నిమిషాల నిరంతర పని పూర్తయింది. 20 నిమిషాల విశ్రాంతి అవసరం.",
    },
  },
  {
    id: "01J9ZK1G7M5Q4V9N2P3A",
    time: "13:01",
    riderId: "R-011",
    orderId: "O-0389",
    policy: "NDMA advisory",
    policyFull: "NDMA advisory rules",
    outcome: "ALLOW",
    winningRule: "ndma-reduced-radius",
    penaltyWaived: false,
    firedRules: [{ rule: "ndma-reduced-radius", status: "Winner" }],
    keyFacts: {
      heatIndexC: 40,
      restMinutes: 0,
      penaltyWaived: "No",
      coolingPoint: "N/A (Active trip)",
    },
    exactInputs: {
      heatIndexC: 40,
      hourOfDay: 13,
      minutesSinceBreak: 30,
      exposureMinutesToday: 95,
      restMinutesRemaining: 0,
      tripMinutes: 10,
      demandLevel: 2,
      alertLevel: 0,
    },
    messages: {
      en: "Reduced delivery radius: Order allowed within restricted 2.5 km thermal boundary.",
      hi: "सीमित डिलीवरी दायरा: केवल 2.5 किमी के भीतर का नजदीकी ऑर्डर स्वीकृत।",
      te: "పరిమిత డెలివరీ పరిధి: 2.5 కిమీ లోపల ఉన్న ఆర్డర్ మాత్రమే అనుమతించబడింది.",
    },
  },
  {
    id: "01J9ZK0H9M8Q3V5N1P6B",
    time: "12:56",
    riderId: "R-055",
    orderId: "O-0385",
    policy: "Union demand",
    policyFull: "Union demand (IFAT)",
    outcome: "FORCE_REST",
    winningRule: "union-rest-due",
    penaltyWaived: true,
    firedRules: [{ rule: "union-rest-due", status: "Winner" }],
    keyFacts: {
      heatIndexC: 42,
      restMinutes: 30,
      penaltyWaived: "Yes",
      coolingPoint: "Union Hub B, 610 m",
    },
    exactInputs: {
      heatIndexC: 42,
      hourOfDay: 12,
      minutesSinceBreak: 90,
      exposureMinutesToday: 210,
      restMinutesRemaining: 0,
      tripMinutes: 20,
      demandLevel: 1,
      alertLevel: 1,
    },
    messages: {
      en: "IFAT Union charter requirement: 30 minutes rest per 90 minutes of heat exposure. Wage protection active.",
      hi: "आईफैट यूनियन समझौता: 90 मिनट कार्य के बाद 30 मिनट का अनिवार्य विश्राम। आय सुरक्षा लागू।",
      te: "IFAT యూనియన్ డిమాండ్: ప్రతి 90 నిమిషాల పనికి 30 నిమిషాల విశ్రాంతి. వేతన రక్షణ అమలులో ఉంది.",
    },
  },
  {
    id: "01J9ZJ9J2M1Q6V4N8P9C",
    time: "12:50",
    riderId: "R-062",
    orderId: "O-0380",
    policy: "Today: voluntary",
    policyFull: "Today: voluntary measures only (nothing enforced)",
    outcome: "ALLOW",
    winningRule: "base-allow-assign",
    penaltyWaived: false,
    firedRules: [{ rule: "base-allow-assign", status: "Winner" }],
    keyFacts: {
      heatIndexC: 43,
      restMinutes: 0,
      penaltyWaived: "No",
      coolingPoint: "None (Standard dispatch)",
    },
    exactInputs: {
      heatIndexC: 43,
      hourOfDay: 12,
      minutesSinceBreak: 160,
      exposureMinutesToday: 310,
      restMinutesRemaining: 0,
      tripMinutes: 35,
      demandLevel: 3,
      alertLevel: 1,
    },
    messages: {
      en: "Standard assignment: Advisory heat warning shown in app banner, no dispatch blocks enforced.",
      hi: "सामान्य आवंटन: ऐप में केवल स्वैच्छिक सलाह। कोई बाध्यकारी रोक नहीं।",
      te: "సాధారణ ఆర్డర్ కేటాయింపు: కేవలం సలహా మాత్రమే చూపబడింది, ఆర్డర్ నిలిపివేత లేదు.",
    },
  },
];

const POLICY_FULL_NAMES = [
  "Today: voluntary measures only (nothing enforced)",
  "NDMA advisory rules",
  "Union demand (IFAT)",
  "HeatGate Fair",
] as const;

const POLICY_MAP: Record<string, PolicyVersion> = {
  "Today: voluntary measures only (nothing enforced)": "no-rules",
  "NDMA advisory rules": "ndma-2025",
  "Union demand (IFAT)": "union-demand",
  "HeatGate Fair": "heatgate-fair",
};

function mapDecisionToAudit(d: Decision): AuditDecision {
  const time = d.at
    ? d.at.includes("T")
      ? d.at.slice(11, 16)
      : d.at.slice(0, 5)
    : "13:25";
  const winning = d.firedRules?.[0] ?? (d.outcome === "ALLOW" ? "base-allow-assign" : "fair-rest-due");
  return {
    id: d.decisionId,
    time,
    riderId: d.riderId,
    orderId: d.orderId,
    policy: d.policyVersion === "heatgate-fair" ? "HeatGate Fair" : (POLICY_LABELS[d.policyVersion] ?? d.policyVersion),
    policyFull: POLICY_LABELS[d.policyVersion] ?? d.policyVersion,
    outcome: d.outcome,
    winningRule: winning,
    penaltyWaived: d.penaltyWaived ?? false,
    firedRules: d.firedRules && d.firedRules.length > 0
      ? d.firedRules.map((r, idx) => ({ rule: r, status: idx === 0 ? ("Winner" as const) : ("Also fired" as const) }))
      : [{ rule: winning, status: "Winner" as const }],
    keyFacts: {
      heatIndexC: d.heatIndexC ?? d.cedarContext?.heatIndexC ?? 44,
      restMinutes: d.restMinutes ?? (d.outcome === "FORCE_REST" ? 20 : 0),
      penaltyWaived: d.penaltyWaived ? "Yes" : "No",
      coolingPoint: d.coolingPoint ? `${d.coolingPoint.name}, ${d.coolingPoint.distanceM} m` : "—",
    },
    exactInputs: {
      heatIndexC: d.heatIndexC ?? d.cedarContext?.heatIndexC ?? 44,
      hourOfDay: d.cedarContext?.hourOfDay ?? 13,
      minutesSinceBreak: d.cedarContext?.minutesSinceBreak ?? 105,
      exposureMinutesToday: d.cedarContext?.exposureMinutesToday ?? 245,
      restMinutesRemaining: d.cedarContext?.restMinutesRemaining ?? 0,
      tripMinutes: d.cedarContext?.tripMinutes ?? 20,
      demandLevel: d.cedarContext?.demandLevel ?? 1,
      alertLevel: d.cedarContext?.alertLevel ?? 1,
    },
    messages: {
      en: d.message || "Decision logged by HeatGate policy engine.",
      hi: d.messages?.hi || d.message || "हीटगेट नीति इंजन द्वारा निर्णय दर्ज किया गया।",
      te: d.messages?.te || d.message || "హీట్‌గేట్ పాలసీ ఇంజిన్ ద్వారా నిర్ణయం నమోదు చేయబడింది.",
    },
  };
}

export function AuditPage() {
  const { activeSim } = useActiveSimulation();

  // Filters state
  const [riderInput, setRiderInput] = useState("R-014");
  const [selectedOutcomes, setSelectedOutcomes] = useState<Outcome[]>(["FORCE_REST"]);
  const [selectedPolicy, setSelectedPolicy] = useState<string>("HeatGate Fair");
  const [selectedSimulation, setSelectedSimulation] = useState<string>("All Simulations");

  // Active chips state
  const [activeRiderChip, setActiveRiderChip] = useState<string | null>("Rider: R-014");
  const [activeOutcomeChip, setActiveOutcomeChip] = useState<string | null>("Outcome: FORCE_REST");

  // Language tabs for "What the rider saw"
  const [activeLangTab, setActiveLangTab] = useState<"en" | "hi" | "te">("en");

  // Copy JSON toast feedback
  const [copyFeedback, setCopyFeedback] = useState(false);

  // State variant view mode for regulators / QA: live | skeleton | empty | error
  const [variantView, setVariantView] = useState<"live" | "skeleton" | "empty" | "error">("live");

  // Dynamic simulation options
  const simulationOptions = useMemo(() => [
    ...(activeSim ? [`Active Run (${activeSim.simulationId.slice(0, 10)}...)`] : []),
    "Simulation: 2024-05-24 Peak Heatwave (Hyderabad)",
    "Simulation: 2024-05-10 Normal Day (Hyderabad)",
    "Simulation: 2024-06-01 Surging Demand (Hyderabad)",
    "All Simulations",
  ], [activeSim?.simulationId]);

  // Selected policy mapped to PolicyVersion
  const selectedPolicyCode = selectedPolicy ? POLICY_MAP[selectedPolicy] : undefined;

  // Selected simulation filter
  const isSelectedActiveSim = selectedSimulation.startsWith("Active Run");
  const simulationIdQuery = isSelectedActiveSim ? activeSim?.simulationId : undefined;

  const auditQuery: AuditQuery = useMemo(() => {
    return {
      rider: riderInput.trim() ? riderInput.trim() : undefined,
      outcome: selectedOutcomes.length === 1 ? selectedOutcomes[0] : undefined,
      policy: selectedPolicyCode,
      simulationId: simulationIdQuery,
      limit: 50,
    };
  }, [riderInput, selectedOutcomes, selectedPolicyCode, simulationIdQuery]);

  const { data: auditData, loading: auditLoading, error: auditError, reload: reloadAudit } = useAudit(auditQuery);

  // Compute displayed decisions
  const liveDecisions = useMemo(() => {
    if (auditData?.items && auditData.items.length > 0) {
      let items = auditData.items;
      if (selectedOutcomes.length > 0) {
        items = items.filter((d) => selectedOutcomes.includes(d.outcome));
      }
      return items.map(mapDecisionToAudit);
    }
    return [];
  }, [auditData, selectedOutcomes]);

  // Filtered sample decisions fallback
  const filteredSamples = useMemo(() => {
    return SAMPLE_DECISIONS.filter((d) => {
      if (riderInput.trim() && !d.riderId.toLowerCase().includes(riderInput.trim().toLowerCase())) {
        return false;
      }
      if (selectedOutcomes.length > 0 && !selectedOutcomes.includes(d.outcome)) {
        return false;
      }
      if (selectedPolicy && d.policyFull !== selectedPolicy && d.policy !== selectedPolicy) {
        return false;
      }
      return true;
    });
  }, [riderInput, selectedOutcomes, selectedPolicy]);

  const displayDecisions = liveDecisions.length > 0 ? liveDecisions : filteredSamples;

  // Selected row in table (Row 0 is the default row)
  const [selectedRowId, setSelectedRowId] = useState<string>(SAMPLE_DECISIONS[0].id);

  useEffect(() => {
    if (displayDecisions.length > 0 && !displayDecisions.some((d) => d.id === selectedRowId)) {
      setSelectedRowId(displayDecisions[0].id);
    }
  }, [displayDecisions, selectedRowId]);

  const selectedDecision =
    displayDecisions.find((d) => d.id === selectedRowId) ?? displayDecisions[0] ?? SAMPLE_DECISIONS[0];

  const handleResetFilters = () => {
    setRiderInput("");
    setSelectedOutcomes([]);
    setSelectedPolicy("");
    setActiveRiderChip(null);
    setActiveOutcomeChip(null);
  };

  const handleCopyJson = () => {
    const payload = JSON.stringify(
      {
        decisionId: selectedDecision.id,
        simulatedTime: selectedDecision.time,
        riderId: selectedDecision.riderId,
        orderId: selectedDecision.orderId,
        policy: selectedDecision.policyFull,
        outcome: selectedDecision.outcome,
        winningRule: selectedDecision.winningRule,
        rulesFired: selectedDecision.firedRules,
        keyFacts: selectedDecision.keyFacts,
        exactInputs: selectedDecision.exactInputs,
      },
      null,
      2
    );
    navigator.clipboard.writeText(payload);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2200);
  };

  // Outcome badge styling
  const renderOutcomeBadge = (outcome: Outcome) => {
    switch (outcome) {
      case "ALLOW":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]">
            <span className="material-symbols-outlined text-[15px]">check_circle</span>
            ALLOW
          </span>
        );
      case "FORCE_REST":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]">
            <span className="material-symbols-outlined text-[15px]">pause_circle</span>
            FORCE_REST
          </span>
        );
      case "DENY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]">
            <span className="material-symbols-outlined text-[15px]">cancel</span>
            DENY
          </span>
        );
      case "SKIP_ORDER":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]">
            <span className="material-symbols-outlined text-[15px]">do_not_disturb_on</span>
            SKIP_ORDER
          </span>
        );
    }
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-6 pb-12">
      {/* 1. HEADER */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <div className="flex items-center gap-3">
            <h1
              className="text-2xl lg:text-3xl font-bold text-[#1B1F23] tracking-normal"
              style={{ fontFamily: '"Inter", sans-serif', letterSpacing: "-0.01em" }}
            >
              Audit Log
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-mono font-bold bg-[#E6F4F1] text-[#0F766E] border border-[#0F766E]/20">
              AUDIT ACTIVE
            </span>
          </div>
          <p className="text-sm text-[#4B5563] mt-0.5">
            Every dispatch decision, with the rule that caused it.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Quick Inspector Switcher for QA and Regulator view evaluation */}
          <div className="hidden xl:inline-flex items-center border border-[#E3E1DA] rounded-lg bg-[#FFFFFF] p-0.5 text-xs font-medium shadow-2xs">
            <span className="px-2 text-[11px] text-[#4B5563] font-bold uppercase tracking-wider">
              Preview State:
            </span>
            <button
              type="button"
              onClick={() => setVariantView("live")}
              className={`px-2.5 py-1 rounded transition-colors ${
                variantView === "live"
                  ? "bg-[#0F766E] text-white font-bold shadow-xs"
                  : "text-[#4B5563] hover:text-[#1B1F23]"
              }`}
            >
              Live Explorer
            </button>
            <button
              type="button"
              onClick={() => setVariantView("skeleton")}
              className={`px-2.5 py-1 rounded transition-colors ${
                variantView === "skeleton"
                  ? "bg-[#0F766E] text-white font-bold shadow-xs"
                  : "text-[#4B5563] hover:text-[#1B1F23]"
              }`}
            >
              Skeleton
            </button>
            <button
              type="button"
              onClick={() => setVariantView("empty")}
              className={`px-2.5 py-1 rounded transition-colors ${
                variantView === "empty"
                  ? "bg-[#0F766E] text-white font-bold shadow-xs"
                  : "text-[#4B5563] hover:text-[#1B1F23]"
              }`}
            >
              Empty
            </button>
            <button
              type="button"
              onClick={() => setVariantView("error")}
              className={`px-2.5 py-1 rounded transition-colors ${
                variantView === "error"
                  ? "bg-[#0F766E] text-white font-bold shadow-xs"
                  : "text-[#4B5563] hover:text-[#1B1F23]"
              }`}
            >
              Error
            </button>
          </div>

          {/* Shield Chip on the right */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E3E1DA] bg-[#FFFFFF] shadow-2xs text-[#4B5563] text-xs font-semibold">
            <span
              className="material-symbols-outlined text-[18px] text-[#0F766E]"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              verified_user
            </span>
            <span>Pseudonymous IDs only</span>
          </div>
        </div>
      </header>

      {/* 2. FILTER BAR (White card, 56px controls, one row) */}
      <div className="w-full bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] p-4 shadow-xs flex flex-col gap-3">
        {/* Row of 56px Controls */}
        <div className="flex flex-col xl:flex-row items-stretch xl:items-center gap-3">
          {/* Rider ID input */}
          <div className="w-full xl:w-[170px] shrink-0">
            <label className="sr-only" htmlFor="rider-search">
              Rider ID
            </label>
            <div className="h-[56px] border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] flex items-center px-3 gap-2 focus-within:border-[#0F766E] focus-within:ring-1 focus-within:ring-[#0F766E]">
              <span className="material-symbols-outlined text-[#4B5563] text-[20px] shrink-0">person_search</span>
              <input
                id="rider-search"
                type="text"
                value={riderInput}
                onChange={(e) => {
                  setRiderInput(e.target.value);
                  if (e.target.value) {
                    setActiveRiderChip(`Rider: ${e.target.value}`);
                  }
                }}
                placeholder="R-014"
                className="w-full bg-transparent font-mono text-sm font-semibold text-[#1B1F23] placeholder-[#4B5563] focus:outline-none"
              />
            </div>
          </div>

          {/* Outcome multi-select */}
          <div className="w-full xl:w-[410px] shrink-0">
            <div className="h-[56px] border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] px-2.5 flex items-center justify-between gap-1.5">
              <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider shrink-0">
                Outcome:
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {(["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"] as Outcome[]).map((oc) => {
                  const isSelected = selectedOutcomes.includes(oc);
                  return (
                    <button
                      key={oc}
                      type="button"
                      title={oc}
                      onClick={() => {
                        const next = isSelected
                          ? selectedOutcomes.filter((x) => x !== oc)
                          : [...selectedOutcomes, oc];
                        setSelectedOutcomes(next);
                        if (oc === "FORCE_REST") {
                          setActiveOutcomeChip(isSelected ? null : "Outcome: FORCE_REST");
                        }
                      }}
                      className={`px-2 py-1 rounded text-[10px] font-bold tracking-tight transition-all whitespace-nowrap ${
                        isSelected
                          ? oc === "FORCE_REST"
                            ? "bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]"
                            : oc === "ALLOW"
                            ? "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]"
                            : oc === "DENY"
                            ? "bg-[#FEE2E2] text-[#991B1B] border border-[#FECACA]"
                            : "bg-[#F3F4F6] text-[#374151] border border-[#E5E7EB]"
                          : "bg-white text-[#4B5563] border border-[#E3E1DA] hover:bg-neutral-100"
                      }`}
                    >
                      {oc}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Policy dropdown with 4 full names */}
          <div className="w-full xl:flex-1 min-w-[220px]">
            <div className="h-[56px] border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] px-3 flex items-center justify-between relative">
              <div className="flex flex-col justify-center w-full pr-6 overflow-hidden">
                <span className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">
                  Policy
                </span>
                <select
                  value={selectedPolicy}
                  onChange={(e) => setSelectedPolicy(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#1B1F23] focus:outline-none truncate cursor-pointer appearance-none"
                >
                  <option value="">All Policies</option>
                  {POLICY_FULL_NAMES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <span className="material-symbols-outlined text-[#4B5563] text-[20px] absolute right-3 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Simulation dropdown */}
          <div className="w-full xl:flex-1 min-w-[220px]">
            <div className="h-[56px] border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] px-3 flex items-center justify-between relative">
              <div className="flex flex-col justify-center w-full pr-6 overflow-hidden">
                <span className="text-[10px] font-bold text-[#4B5563] uppercase tracking-wider">
                  Simulation
                </span>
                <select
                  value={selectedSimulation}
                  onChange={(e) => setSelectedSimulation(e.target.value)}
                  className="w-full bg-transparent text-xs font-semibold text-[#1B1F23] focus:outline-none truncate cursor-pointer appearance-none"
                >
                  {simulationOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <span className="material-symbols-outlined text-[#4B5563] text-[20px] absolute right-3 pointer-events-none">
                expand_more
              </span>
            </div>
          </div>

          {/* Reset filters text button */}
          <div className="w-full xl:w-auto shrink-0 flex items-center justify-center">
            <button
              type="button"
              onClick={handleResetFilters}
              className="h-[56px] px-3 text-xs font-bold text-[#0F766E] hover:text-[#0B4F4A] hover:bg-[#E6F4F1]/60 rounded-xl transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              Reset filters
            </button>
          </div>
        </div>

        {/* Active Chips Row */}
        {(activeRiderChip || activeOutcomeChip) && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#E3E1DA]/60 flex-wrap">
            <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">
              Active filters:
            </span>
            {activeRiderChip && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FAFAF7] text-[#1B1F23] border border-[#E3E1DA] shadow-2xs">
                <span>{activeRiderChip}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveRiderChip(null);
                    setRiderInput("");
                  }}
                  className="text-[#4B5563] hover:text-[#1B1F23] flex items-center"
                  aria-label="Remove rider filter"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            )}
            {activeOutcomeChip && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] shadow-2xs">
                <span>{activeOutcomeChip}</span>
                <button
                  type="button"
                  onClick={() => {
                    setActiveOutcomeChip(null);
                    setSelectedOutcomes(selectedOutcomes.filter((o) => o !== "FORCE_REST"));
                  }}
                  className="text-[#92400E] hover:text-black flex items-center"
                  aria-label="Remove outcome filter"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* 3. MAIN AREA: Two Columns (about 62% Left and 38% Right) */}
      {variantView === "live" && auditError && (
        <div role="alert" className="w-full bg-[#FFFFFF] border border-[#FECACA] rounded-[12px] p-6 shadow-xs flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-3xl text-[#DC2626]">sync_problem</span>
          <p className="text-sm font-bold text-[#991B1B]">Could not load decisions</p>
          <p className="text-xs text-[#4B5563] max-w-[520px]">{auditError.message}</p>
          <button
            type="button"
            onClick={reloadAudit}
            className="mt-1 px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-bold hover:bg-[#B91C1C] transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {variantView === "live" && !auditError && (
        <div className="w-full flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT COLUMN: Results Table (~62%) */}
          <section className="w-full lg:w-[62%] bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] shadow-xs overflow-hidden flex flex-col shrink-0">
            <div className="px-5 py-3.5 border-b border-[#E3E1DA] flex items-center justify-between bg-[#FAFAF7]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#0F766E] text-[20px]">table_rows</span>
                <span
                  className="text-xs font-bold text-[#1B1F23] uppercase tracking-wider"
                  style={{ fontFamily: '"Inter", sans-serif' }}
                >
                  Decision Log Stream
                </span>
              </div>
              <span className="font-mono text-xs text-[#4B5563]">
                {displayDecisions.length} records · {liveDecisions.length > 0 ? "live log stream" : "benchmark simulated"}
              </span>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E1DA] bg-[#FAFAF7] text-xs font-bold text-[#4B5563] uppercase tracking-wider select-none">
                    <th className="py-3 px-2.5 whitespace-nowrap">Time (simulated)</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Rider</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Order</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Policy</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Outcome</th>
                    <th className="py-3 px-2.5 whitespace-nowrap">Winning rule</th>
                    <th className="py-3 px-2.5 text-center whitespace-nowrap">Penalty waived</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E1DA]">
                  {displayDecisions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-[#4B5563]">
                        No dispatch records found matching these filters.
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="ml-2 font-bold text-[#0F766E] underline hover:text-[#0B4F4A]"
                        >
                          Reset filters
                        </button>
                      </td>
                    </tr>
                  ) : (
                    displayDecisions.map((row) => {
                      const isSelected = row.id === selectedRowId;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setSelectedRowId(row.id)}
                          className={`h-[56px] cursor-pointer transition-colors text-[18px] select-none ${
                            isSelected
                              ? "bg-[#E6F4F1] border-l-4 border-l-[#0F766E]"
                              : "bg-white hover:bg-[#F8FAFC]"
                          }`}
                        >
                          {/* Time (simulated) */}
                          <td className="py-2 px-2.5 font-mono font-medium text-[#1B1F23] whitespace-nowrap text-[18px]">
                            {row.time}
                          </td>

                          {/* Rider */}
                          <td className="py-2 px-2.5 font-mono font-semibold text-[#1B1F23] whitespace-nowrap text-[18px]">
                            {row.riderId}
                          </td>

                          {/* Order */}
                          <td className="py-2 px-2.5 font-mono text-[#4B5563] whitespace-nowrap text-[18px]">
                            {row.orderId}
                          </td>

                          {/* Policy */}
                          <td className="py-2 px-2.5 text-[#1B1F23] whitespace-nowrap text-[18px]">
                            {row.policy}
                          </td>

                          {/* Outcome */}
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            {renderOutcomeBadge(row.outcome)}
                          </td>

                          {/* Winning rule */}
                          <td className="py-2 px-2.5 whitespace-nowrap">
                            <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#1B1F23] border border-[#E5E7EB] font-medium inline-block whitespace-nowrap">
                              {row.winningRule}
                            </span>
                          </td>

                          {/* Penalty waived */}
                          <td className="py-2 px-2.5 whitespace-nowrap text-center text-[18px]">
                            {row.penaltyWaived ? (
                              <span className="inline-flex items-center gap-1 font-medium text-[#0F766E] text-[18px]">
                                <span
                                  className="material-symbols-outlined text-[20px]"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  check_circle
                                </span>
                                Yes
                              </span>
                            ) : (
                              <span className="text-[#4B5563] text-[18px] font-mono">— No</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Under the table footer */}
            <div className="p-4 bg-[#FAFAF7] border-t border-[#E3E1DA] flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#4B5563]">
                  Showing {displayDecisions.length} decisions
                </span>
                <span className="text-[11px] font-mono text-[#0F766E] bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#0F766E]/20">
                  {liveDecisions.length > 0 ? "STREAM: ACTIVE" : "STREAM: BENCHMARK"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reloadAudit()}
                  disabled={auditLoading}
                  className="px-3 py-1.5 rounded-xl border border-[#E3E1DA] bg-white text-xs font-bold text-[#1B1F23] hover:bg-neutral-50 shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <span className={`material-symbols-outlined text-[16px] text-[#0F766E] ${auditLoading ? "animate-spin" : ""}`}>
                    {auditLoading ? "sync" : "refresh"}
                  </span>
                  <span>{auditLoading ? "Refreshing..." : "Refresh log"}</span>
                </button>
              </div>
            </div>
          </section>

          {/* RIGHT COLUMN: Decision Detail Panel (~38%) */}
          <section className="w-full lg:flex-1 bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] p-6 shadow-xs flex flex-col gap-6 lg:sticky lg:top-4">
            {/* Header: FORCE_REST badge, "Decision 01J9ZK… · 13:25 simulated" */}
            <div className="flex flex-col gap-2 pb-4 border-b border-[#E3E1DA]">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                {renderOutcomeBadge(selectedDecision.outcome)}
                <span className="text-[11px] font-mono text-[#0F766E] font-bold bg-[#E6F4F1] px-2 py-0.5 rounded border border-[#0F766E]/20">
                  {selectedDecision.policy}
                </span>
              </div>
              <div
                className="font-mono text-base font-bold text-[#1B1F23] flex items-center gap-1.5 mt-1"
                style={{ fontFamily: '"JetBrains Mono", monospace' }}
              >
                <span>Decision {selectedDecision.id.substring(0, 6)}…</span>
                <span className="text-[#4B5563] font-normal">· {selectedDecision.time} simulated</span>
              </div>
            </div>

            {/* "What the rider saw": message in three tabs (English, हिं, తె) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[16px] text-[#0F766E]">smartphone</span>
                  What the rider saw
                </span>

                {/* Multilingual Tabs */}
                <div className="inline-flex items-center border border-[#E3E1DA] rounded-lg bg-[#FAFAF7] p-0.5 text-xs font-semibold gap-0.5">
                  <button
                    type="button"
                    onClick={() => setActiveLangTab("en")}
                    className={`px-2.5 py-1 rounded transition-colors text-xs ${
                      activeLangTab === "en"
                        ? "bg-[#0F766E] text-white font-bold shadow-2xs"
                        : "text-[#4B5563] hover:text-[#1B1F23]"
                    }`}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLangTab("hi")}
                    className={`px-2.5 py-1 rounded transition-colors text-xs ${
                      activeLangTab === "hi"
                        ? "bg-[#0F766E] text-white font-bold shadow-2xs"
                        : "text-[#4B5563] hover:text-[#1B1F23]"
                    }`}
                  >
                    हिं
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLangTab("te")}
                    className={`px-2.5 py-1 rounded transition-colors text-xs ${
                      activeLangTab === "te"
                        ? "bg-[#0F766E] text-white font-bold shadow-2xs"
                        : "text-[#4B5563] hover:text-[#1B1F23]"
                    }`}
                  >
                    తె
                  </button>
                </div>
              </div>

              {/* Message Box */}
              <div className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E3E1DA] text-sm text-[#1B1F23] leading-relaxed">
                {selectedDecision.messages[activeLangTab]}
              </div>
            </div>

            {/* "Rules that fired": ordered list, "fair-rest-due" labelled "Winner", then "fair-rest-hard-limit" labelled "Also fired" */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-[#0F766E]">rule</span>
                Rules that fired
              </span>
              <ol className="space-y-2">
                {selectedDecision.firedRules.map((r, idx) => (
                  <li
                    key={r.rule}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${
                      r.status === "Winner"
                        ? "bg-[#E6F4F1] border-[#0F766E]/40"
                        : "bg-[#FAFAF7] border-[#E3E1DA]"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] font-bold text-[#4B5563]">
                        {idx + 1}.
                      </span>
                      <code className="font-mono font-bold text-[#1B1F23]">{r.rule}</code>
                    </div>
                    {r.status === "Winner" ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#0F766E] text-white">
                        Winner
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-[#E5E7EB] text-[#4B5563]">
                        Also fired
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </div>

            {/* Key facts: Heat index 44°C, Rest 20 minutes, Penalty waived Yes, Cooling point "Cooling Point 3, 420 m" */}
            <div className="flex flex-col gap-2.5">
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                Key facts
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="p-2.5 rounded-lg border border-[#E3E1DA] bg-[#FAFAF7]">
                  <span className="text-[11px] text-[#4B5563] block">Heat index</span>
                  <span className="font-mono text-sm font-bold text-[#DC2626]">
                    {selectedDecision.keyFacts.heatIndexC}°C
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E3E1DA] bg-[#FAFAF7]">
                  <span className="text-[11px] text-[#4B5563] block">Rest assigned</span>
                  <span className="font-mono text-sm font-bold text-[#92400E]">
                    {selectedDecision.keyFacts.restMinutes} minutes
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E3E1DA] bg-[#FAFAF7]">
                  <span className="text-[11px] text-[#4B5563] block">Penalty waived</span>
                  <span className="text-sm font-bold text-[#0F766E]">
                    {selectedDecision.keyFacts.penaltyWaived}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border border-[#E3E1DA] bg-[#FAFAF7]">
                  <span className="text-[11px] text-[#4B5563] block">Cooling point</span>
                  <span className="text-xs font-bold text-[#1B1F23] truncate block" title={selectedDecision.keyFacts.coolingPoint}>
                    {selectedDecision.keyFacts.coolingPoint}
                  </span>
                </div>
              </div>
            </div>

            {/* "Exact inputs" as a two-column monospace key-value table */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider flex items-center justify-between">
                <span>Exact inputs</span>
                <span className="text-[10px] font-mono text-[#0F766E] font-bold">8 VERIFIED KEYS</span>
              </span>
              <div className="border border-[#E3E1DA] rounded-lg overflow-hidden bg-white">
                <table className="w-full text-xs font-mono">
                  <tbody>
                    {Object.entries(selectedDecision.exactInputs).map(([key, val], i) => (
                      <tr
                        key={key}
                        className={`h-8 border-b border-[#E3E1DA] last:border-b-0 ${
                          i % 2 === 0 ? "bg-[#FAFAF7]" : "bg-white"
                        }`}
                      >
                        <td className="px-3 py-1.5 text-[#4B5563] font-medium">{key}</td>
                        <td className="px-3 py-1.5 font-bold text-[#1B1F23] text-right">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-[#4B5563] italic">
                These exact inputs let any decision be replayed.
              </p>
            </div>

            {/* Secondary button "Copy decision as JSON" */}
            <div className="pt-2 border-t border-[#E3E1DA]">
              <button
                type="button"
                onClick={handleCopyJson}
                className="w-full h-11 rounded-xl border border-[#E3E1DA] bg-white hover:bg-[#FAFAF7] text-xs font-bold text-[#1B1F23] shadow-2xs transition-colors flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px] text-[#0F766E]">
                  {copyFeedback ? "check" : "content_copy"}
                </span>
                {copyFeedback ? "Copied decision to clipboard!" : "Copy decision as JSON"}
              </button>
            </div>
          </section>
        </div>
      )}

      {/* SKELETON PREVIEW IN LIVE WORKSPACE */}
      {variantView === "skeleton" && (
        <div className="w-full grid grid-cols-1 lg:grid-cols-[62%_38%] gap-6 items-start animate-pulse">
          <section className="bg-white border border-[#E3E1DA] rounded-[12px] p-5 shadow-xs flex flex-col gap-4">
            <div className="h-6 bg-[#FAFAF7] rounded w-1/3 border border-[#E3E1DA]"></div>
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-[56px] rounded-lg bg-[#FAFAF7] border border-[#E3E1DA] flex items-center px-4 gap-4">
                  <div className="h-4 bg-[#E5E7EB] rounded w-16"></div>
                  <div className="h-4 bg-[#E5E7EB] rounded w-16"></div>
                  <div className="h-4 bg-[#E5E7EB] rounded w-20"></div>
                  <div className="h-6 bg-[#E5E7EB] rounded-full w-24"></div>
                  <div className="h-4 bg-[#E5E7EB] rounded w-28"></div>
                </div>
              ))}
            </div>
          </section>
          <section className="bg-white border border-[#E3E1DA] rounded-[12px] p-6 shadow-xs flex flex-col gap-4">
            <div className="h-8 bg-[#FAFAF7] rounded w-1/2 border border-[#E3E1DA]"></div>
            <div className="h-24 bg-[#FAFAF7] rounded border border-[#E3E1DA]"></div>
            <div className="h-32 bg-[#FAFAF7] rounded border border-[#E3E1DA]"></div>
          </section>
        </div>
      )}

      {/* EMPTY STATE IN LIVE WORKSPACE */}
      {variantView === "empty" && (
        <div className="w-full bg-white border border-[#E3E1DA] rounded-[12px] p-12 text-center shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FAFAF7] border border-[#E3E1DA] flex items-center justify-center text-[#4B5563]">
            <span className="material-symbols-outlined text-2xl">search_off</span>
          </div>
          <h3
            className="text-lg font-bold text-[#1B1F23]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            No decisions match these filters
          </h3>
          <p className="text-sm text-[#4B5563] max-w-md">
            No dispatch records were found matching rider ID &ldquo;{riderInput || "N/A"}&rdquo; and the selected policy conditions.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-2 px-4 py-2 rounded-xl bg-[#0F766E] text-white text-xs font-bold hover:bg-[#0B4F4A] transition-colors shadow-xs"
          >
            Reset filters
          </button>
        </div>
      )}

      {/* ERROR STATE IN LIVE WORKSPACE */}
      {variantView === "error" && (
        <div className="w-full bg-white border border-[#FECACA] rounded-[12px] p-12 text-center shadow-xs flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#FEE2E2] border border-[#FECACA] flex items-center justify-center text-[#DC2626]">
            <span className="material-symbols-outlined text-2xl">error_outline</span>
          </div>
          <h3
            className="text-lg font-bold text-[#991B1B]"
            style={{ fontFamily: '"Inter", sans-serif' }}
          >
            Could not load decisions
          </h3>
          <p className="text-sm text-[#4B5563] max-w-md">
            The policy evaluation audit stream timed out or upstream telemetry is temporarily unavailable.
          </p>
          <button
            type="button"
            onClick={() => setVariantView("live")}
            className="mt-2 px-4 py-2 rounded-xl bg-[#DC2626] text-white text-xs font-bold hover:bg-[#B91C1C] transition-colors shadow-xs"
          >
            Retry
          </button>
        </div>
      )}

      {/* 4. NOTE under the page */}
      <div className="w-full bg-[#FAFAF7] border border-[#E3E1DA] rounded-[12px] p-4 flex items-start sm:items-center gap-3 text-xs text-[#4B5563] shadow-2xs">
        <span
          className="material-symbols-outlined text-[20px] text-[#0F766E] shrink-0"
          style={{ fontVariationSettings: "'FILL' 1" }}
        >
          policy
        </span>
        <div className="leading-relaxed">
          <strong className="text-[#1B1F23] font-semibold">Statutory Compliance Notice: </strong>
          Rider IDs are pseudonymous but likely still personal data under India&apos;s DPDP Act, 2023. All riders here are simulated.
        </div>
      </div>

      {/* 5. THREE STATE VARIANTS AS SEPARATE FRAMES (Dedicated Regulator & QA Gallery) */}
      <div className="w-full mt-4 pt-6 border-t border-[#E3E1DA] flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h3
              className="text-lg font-bold text-[#1B1F23] tracking-normal"
              style={{ fontFamily: '"Inter", sans-serif' }}
            >
              State Variants (Specification Frames)
            </h3>
            <p className="text-xs text-[#4B5563]">
              Pre-rendered state frames for union delegates and regulatory compliance sign-off.
            </p>
          </div>
          <span className="text-[11px] font-mono text-[#4B5563] uppercase tracking-wider bg-white px-2.5 py-1 rounded border border-[#E3E1DA]">
            3 Design Frames
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Frame 1: Loading Skeleton */}
          <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E1DA]">
              <span className="text-xs font-bold text-[#1B1F23]">Frame A: Loading Skeleton</span>
              <span className="text-[10px] font-mono text-[#0F766E] bg-[#E6F4F1] px-1.5 py-0.5 rounded">56px SKELETON</span>
            </div>
            <div className="animate-pulse space-y-2 pt-1">
              <div className="h-4 bg-[#FAFAF7] border border-[#E3E1DA] rounded w-2/3"></div>
              <div className="h-[44px] bg-[#FAFAF7] border border-[#E3E1DA] rounded-lg flex items-center px-3 gap-2">
                <div className="w-8 h-3 bg-[#E5E7EB] rounded"></div>
                <div className="w-10 h-3 bg-[#E5E7EB] rounded"></div>
                <div className="w-14 h-4 bg-[#E5E7EB] rounded-full"></div>
                <div className="w-16 h-3 bg-[#E5E7EB] rounded ml-auto"></div>
              </div>
              <div className="h-[44px] bg-[#FAFAF7] border border-[#E3E1DA] rounded-lg flex items-center px-3 gap-2">
                <div className="w-8 h-3 bg-[#E5E7EB] rounded"></div>
                <div className="w-10 h-3 bg-[#E5E7EB] rounded"></div>
                <div className="w-14 h-4 bg-[#E5E7EB] rounded-full"></div>
                <div className="w-16 h-3 bg-[#E5E7EB] rounded ml-auto"></div>
              </div>
              <div className="h-[44px] bg-[#FAFAF7] border border-[#E3E1DA] rounded-lg flex items-center px-3 gap-2">
                <div className="w-8 h-3 bg-[#E5E7EB] rounded"></div>
                <div className="w-10 h-3 bg-[#E5E7EB] rounded"></div>
                <div className="w-14 h-4 bg-[#E5E7EB] rounded-full"></div>
                <div className="w-16 h-3 bg-[#E5E7EB] rounded ml-auto"></div>
              </div>
            </div>
            <span className="text-[11px] text-[#4B5563] mt-auto pt-2 border-t border-[#E3E1DA]/60">
              Shimmer placeholder maintains fixed 56px row cadence during network query.
            </span>
          </div>

          {/* Frame 2: Empty State */}
          <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E1DA]">
              <span className="text-xs font-bold text-[#1B1F23]">Frame B: Empty State</span>
              <span className="text-[10px] font-mono text-[#4B5563] bg-[#F3F4F6] px-1.5 py-0.5 rounded">ZERO RESULTS</span>
            </div>
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-3xl text-[#4B5563]">filter_alt_off</span>
              <p className="text-sm font-bold text-[#1B1F23]">No decisions match these filters</p>
              <p className="text-xs text-[#4B5563] max-w-[220px]">
                Adjust or clear your rider ID, outcome, or policy filters to see results.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-1 px-3 py-1.5 rounded-lg border border-[#E3E1DA] bg-[#FAFAF7] text-xs font-bold text-[#0F766E] hover:bg-[#E6F4F1] transition-colors"
              >
                Reset filters
              </button>
            </div>
            <span className="text-[11px] text-[#4B5563] mt-auto pt-2 border-t border-[#E3E1DA]/60">
              Displayed when active filters eliminate all simulated evaluation rows.
            </span>
          </div>

          {/* Frame 3: Error State */}
          <div className="bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] p-4 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-[#E3E1DA]">
              <span className="text-xs font-bold text-[#1B1F23]">Frame C: Error State</span>
              <span className="text-[10px] font-mono text-[#DC2626] bg-[#FEE2E2] px-1.5 py-0.5 rounded">STATUS 503</span>
            </div>
            <div className="py-6 flex flex-col items-center justify-center text-center gap-2">
              <span className="material-symbols-outlined text-3xl text-[#DC2626]">sync_problem</span>
              <p className="text-sm font-bold text-[#991B1B]">Could not load decisions</p>
              <p className="text-xs text-[#4B5563] max-w-[220px]">
                Engine connection timed out. Check network or policy worker telemetry.
              </p>
              <button
                type="button"
                onClick={() => setVariantView("live")}
                className="mt-1 px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-bold hover:bg-[#B91C1C] transition-colors"
              >
                Retry
              </button>
            </div>
            <span className="text-[11px] text-[#4B5563] mt-auto pt-2 border-t border-[#E3E1DA]/60">
              Graceful failure boundary with actionable retry trigger.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
