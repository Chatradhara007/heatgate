// npm run pitch-numbers — writes docs/pitch-numbers.md: the numbers we may quote, built from the real results
// (the default day, every committed weather day, sim/results/break-even.json). Nothing here is typed in by hand:
// every number, and whether each claim is kept, comes from a run. scripts/pitch-numbers.test.ts fails when the
// committed sheet no longer matches what this script would write.
// ALL RUPEE AMOUNTS ARE PLACEHOLDERS from interview-pending economics.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BreakEvenReport, Decision, NumericMetric, PolicyVersion, SimParams, SimResult } from "@heatgate/contracts";
import { auditRecord } from "../engine/src/index.ts";
import { WEATHER_DAYS, dayAlertLevel, weatherDay, defaultSimParams, simulate, simulateWithAudit, weatherDaySummary, type ReplayDay } from "../sim/src/index.ts";

const ROOT = join(import.meta.dirname, "..");
export const SHEET_PATH = join(ROOT, "docs", "pitch-numbers.md");
const RULE_SETS = ["ndma-2025", "union-demand", "heatgate-fair"] as const;
const ALL: PolicyVersion[] = ["no-rules", ...RULE_SETS];

interface Scenario {
  id: string;
  title: string;
  about: string;
  alert: number;
  result: SimResult;
  command: string;
}

type Run = NonNullable<SimResult["runs"]["no-rules"]>;
const run = (s: Scenario, p: PolicyVersion): Run => s.result.runs[p]!;
const mean = (s: Scenario, p: PolicyVersion, k: NumericMetric) => run(s, p).metrics[k];
const fmt = (m: number, min: number, max: number, digits = 0) => `${m.toFixed(digits)} (${min.toFixed(digits)}–${max.toFixed(digits)})`;
const cell = (s: Scenario, p: PolicyVersion, k: NumericMetric, digits = 0) => fmt(run(s, p).metrics[k], run(s, p).range[k].min, run(s, p).range[k].max, digits);
const pct = (part: number, whole: number) => `${((100 * part) / whole).toFixed(0)}%`;
const overlaps = (s: Scenario, a: PolicyVersion, b: PolicyVersion, k: NumericMetric) =>
  run(s, a).range[k].min <= run(s, b).range[k].max && run(s, b).range[k].min <= run(s, a).range[k].max;

function scenarios(params: SimParams): { list: Scenario[]; audit: Partial<Record<PolicyVersion, Decision[]>> } {
  const { result, audit } = simulateWithAudit(params);
  const list: Scenario[] = [
    {
      id: "default",
      title: `Default day: ${params.peakTempC} °C peak, ${params.humidityPct}% humidity`,
      about: `Slider day, alert level ${dayAlertLevel(params.alertLevel, params.peakTempC)} (assumed from peak temperature).`,
      alert: dayAlertLevel(params.alertLevel, params.peakTempC),
      result,
      command: "npm run sim:full",
    },
  ];
  for (const day of WEATHER_DAYS) list.push(weatherScenario(params, day));
  return { list, audit };
}

function weatherScenario(base: SimParams, day: ReplayDay): Scenario {
  const s = weatherDaySummary(day);
  const hours = day.hourly.slice(base.startHour, base.endHour + 1);
  const alert = dayAlertLevel(base.alertLevel, s.peakTempC);
  const rh = hours.map((h) => h.humidityPct);
  return {
    id: day.id,
    title: `${day.city}, ${day.date} (real weather)`,
    about:
      `Peak air temperature ${s.peakTempC} °C, peak heat index ${s.peakHeatIndexC} °C, humidity ${Math.min(...rh)}–${Math.max(...rh)}% ` +
      `(${base.startHour}:00–${base.endHour}:00). Alert level ${alert} (assumed from peak temperature, not the real IMD alert). ` +
      `${day.source}, grid cell ${day.lat}, ${day.lng}.`,
    alert,
    result: simulate(defaultSimParams({ weather: { kind: "replay", weatherDayId: day.id } }), `weather-${day.id}`),
    command: "npm run sim:weather",
  };
}

function table(s: Scenario): string[] {
  const rows = ALL.map(
    (p) =>
      `| ${p} | ${cell(s, p, "ordersDelivered")} | ${cell(s, p, "unsafeExposureMin90")} | ${cell(s, p, "unsafeExposureMin120")} | ` +
      `${cell(s, p, "earningsPctOfNoRules", 1)} | ${cell(s, p, "minEarningsPerRiderInr")} |`,
  );
  return [
    `### ${s.title}`,
    "",
    s.about,
    "",
    "| Rule set | Delivered orders | Unsafe min >90 | Unsafe min >120 | Earnings, % of no-rules | Lowest-earning rider, ₹ (placeholder) |",
    "|---|---|---|---|---|---|",
    ...rows,
    "",
  ];
}

interface Claim {
  text: string;
  numbers: string[];
  command: string;
  supported: boolean;
}

function halvingClaim(list: Scenario[]): Claim {
  const alertDays = list.filter((s) => s.alert >= 1);
  const ratios = (p: PolicyVersion) =>
    alertDays.flatMap((s) => (["unsafeExposureMin90", "unsafeExposureMin120"] as const).map((k) => mean(s, p, k) / mean(s, "no-rules", k)));
  const d = list[0];
  const lines = RULE_SETS.map((p) => {
    const r = ratios(p);
    return `${p} ${pct(Math.min(...r), 1)}–${pct(Math.max(...r), 1)}`;
  });
  const all = RULE_SETS.flatMap(ratios);
  return {
    text: "When the heat alert fires, each of the three rule sets roughly halves riders' unsafe heat minutes compared with today.",
    numbers: [
      `Default day, unsafe min >120: no-rules ${cell(d, "no-rules", "unsafeExposureMin120")}, ` +
        RULE_SETS.map((p) => `${p} ${cell(d, p, "unsafeExposureMin120")}`).join(", ") + ".",
      `Default day, unsafe min >90: no-rules ${cell(d, "no-rules", "unsafeExposureMin90")}, ` +
        RULE_SETS.map((p) => `${p} ${cell(d, p, "unsafeExposureMin90")}`).join(", ") + ".",
      `Over ${alertDays.length} alert days (the default day and ${alertDays.length - 1} real weather days with alert level ≥ 1), each rule set's mean unsafe minutes, ` +
        `on both measures, are this share of no-rules': ${lines.join(", ")}.`,
    ],
    command: "npm run sim:full; npm run sim:weather",
    supported: d.alert >= 1 && all.every((r) => r >= 0.35 && r <= 0.65),
  };
}

const HUMID_DAY = "hyderabad-2024-05-27";

function humidClaim(list: Scenario[]): Claim {
  const s = list.find((x) => x.id === HUMID_DAY);
  if (!s) return { text: `Humid-day claim (${HUMID_DAY})`, numbers: [`${HUMID_DAY} is not a committed weather day.`], command: "npm run sim:weather", supported: false };
  const k = "unsafeExposureMin120";
  const nr = mean(s, "no-rules", k);
  const silent = (["ndma-2025", "union-demand"] as const).every(
    (p) => mean(s, p, k) === nr && mean(s, p, "unsafeExposureMin90") === mean(s, "no-rules", "unsafeExposureMin90"),
  );
  const fair = mean(s, "heatgate-fair", k);
  const d = run(s, "heatgate-fair").metrics.decisions;
  return {
    text:
      "Heat-index rules protect riders on humid days where temperature-based alerts stay silent: " +
      `on ${s.id.slice(-10)} in Hyderabad (peak air temperature ${weatherDaySummary(weatherDay(HUMID_DAY)!).peakTempC} °C) heatgate-fair cut unsafe minutes by about ${pct(nr - fair, nr)}, while NDMA and union rules never fired.`,
    numbers: [
      s.about,
      `Unsafe min >120: no-rules ${cell(s, "no-rules", k)}, ndma-2025 ${cell(s, "ndma-2025", k)}, union-demand ${cell(s, "union-demand", k)}, heatgate-fair ${cell(s, "heatgate-fair", k)}.`,
      `Unsafe min >90: no-rules ${cell(s, "no-rules", "unsafeExposureMin90")}, heatgate-fair ${cell(s, "heatgate-fair", "unsafeExposureMin90")}.`,
      `heatgate-fair decisions (mean per day): ${d.FORCE_REST.toFixed(0)} FORCE_REST, ${d.DENY.toFixed(0)} DENY, ${d.SKIP_ORDER.toFixed(0)} SKIP_ORDER; ` +
        `delivered ${cell(s, "heatgate-fair", "ordersDelivered")} vs no-rules ${cell(s, "no-rules", "ordersDelivered")}.`,
    ],
    command: "npm run sim:weather",
    supported: s.alert === 0 && silent && fair <= 0.6 * nr,
  };
}

// Keys that would place a rider: coordinates, positions, or a named point plus distance.
const LOCATION_KEY = /^(x|y|lat|lng|lon|latitude|longitude|pos|position|location|coolingPoint|hub|drop)$/i;
function keysMatching(value: unknown, re: RegExp, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => keysMatching(v, re, `${path}[${i}]`));
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([k, v]) => [...(re.test(k) ? [`${path}.${k}`] : []), ...keysMatching(v, re, `${path}.${k}`)]);
  return [];
}

function auditClaim(audit: Partial<Record<PolicyVersion, Decision[]>>): Claim {
  const decisions = Object.values(audit).flat();
  const logged = decisions.map(auditRecord);
  const withMessage = logged.filter((d) => typeof d.message === "string" && d.message.length > 0).length;
  const translated = logged.filter((d) => d.messages?.hi && d.messages?.te && d.messages?.ur).length;
  const shownCooling = decisions.filter((d) => d.coolingPoint).length;
  const leaks = logged.flatMap((d) => keysMatching(d, LOCATION_KEY));
  const pseudonymous = logged.every((d) => /^rider-\d+$/.test(d.riderId));
  const personal = logged.flatMap((d) => keysMatching(d, /name|phone|mobile|email/i));
  return {
    text: "The audit trail records what each rider was told, but never where they were.",
    numbers: [
      `${logged.length} audit records from the default day (first seed of each rule set; every non-ALLOW decision plus 1 in 20 ALLOWs).`,
      `${withMessage} of ${logged.length} carry the English message the rider saw; ${translated} also carry the Hindi, Telugu and Urdu text.`,
      `${shownCooling} decisions showed the rider a nearest cooling point; after auditRecord (engine/src/messages.ts, what both stores write) ` +
        `${leaks.length} records hold a location field (checked: x, y, lat, lng, pos, location, coolingPoint, hub, drop).`,
      `Rider IDs are pseudonymous (rider-NNN) in ${pseudonymous ? "all" : "NOT all"} records; ${personal.length} records hold a name, phone or email field.`,
    ],
    command: "npm run pitch-numbers",
    supported: logged.length > 0 && withMessage === logged.length && leaks.length === 0 && pseudonymous && personal.length === 0,
  };
}

const LABEL: Partial<Record<NumericMetric, string>> = {
  unsafeExposureMin120: "unsafe min >120",
  unsafeExposureMin90: "unsafe min >90",
  earningsPctOfNoRules: "earnings % of no-rules",
  ordersDelivered: "delivered",
};

function mustNot(list: Scenario[], params: SimParams, be: BreakEvenReport): { text: string; reason: string }[] {
  const d = list[0];
  const vsNdma = (k: NumericMetric) => {
    const diff = (s: Scenario) => mean(s, "heatgate-fair", k) - mean(s, "ndma-2025", k);
    const lower = list.filter((s) => diff(s) < 0);
    return {
      more: list.filter((s) => diff(s) > 0).length,
      same: list.filter((s) => diff(s) === 0).length,
      lower: lower.length,
      lowerOnAlertDays: lower.filter((s) => s.alert >= 1).length,
    };
  };
  const n90 = vsNdma("unsafeExposureMin90");
  const n120 = vsNdma("unsafeExposureMin120");
  const fairVsUnion = (["unsafeExposureMin120", "unsafeExposureMin90", "earningsPctOfNoRules", "ordersDelivered"] as const).map(
    (k) =>
      `${LABEL[k]} union-demand ${cell(d, "union-demand", k, k === "earningsPctOfNoRules" ? 1 : 0)} vs heatgate-fair ${cell(d, "heatgate-fair", k, k === "earningsPctOfNoRules" ? 1 : 0)}` +
      (overlaps(d, "union-demand", "heatgate-fair", k) ? " (ranges overlap)" : ""),
  );
  const ahead = (a: PolicyVersion, b: PolicyVersion) =>
    list.filter((s) => mean(s, a, "unsafeExposureMin120") < mean(s, b, "unsafeExposureMin120") && mean(s, a, "earningsPctOfNoRules") > mean(s, b, "earningsPctOfNoRules")).length;
  const fairAhead = ahead("heatgate-fair", "union-demand");
  const unionAhead = ahead("union-demand", "heatgate-fair");
  const beCells = be.levels.flatMap((l) =>
    Object.entries(l.policies).map(([p, r]) => {
      const b = r!.breakEven;
      return b.status === "reached"
        ? `${l.ordersPerHour} orders/h ${p}: ₹${fmt(b.meanInrPerMin, b.perSeedMinInrPerMin, b.perSeedMaxInrPerMin, 2)}/min` + (b.seedsNotReached ? `, ${b.seedsNotReached} seeds not reached` : "")
        : `${l.ordersPerHour} orders/h ${p}: not reached (best ${b.bestEarningsPctOfNoRules.toFixed(1)}% of no-rules at ₹${b.atRestPayInrPerMin}/min)`;
    }),
  );
  const at = (opH: number) => be.levels.find((l) => l.ordersPerHour === opH);
  const unionNoPay = at(params.ordersPerHour)?.policies["union-demand"]?.rows.find((r) => r.restPayInrPerMin === 0)?.earningsPctOfNoRules;
  const e = params.economics;
  const csv = readFileSync(join(ROOT, "docs", "translations", "messages.csv"), "utf8").trim().split(/\r?\n/).slice(1);
  const unreviewed = csv.filter((line) => line.trim().endsWith(",false")).length;
  return [
    {
      text: "heatgate-fair is safer than NDMA across the board.",
      reason:
        `Across ${list.length} scenarios, heatgate-fair has more / the same / fewer unsafe minutes than ndma-2025 in ${n90.more} / ${n90.same} / ${n90.lower} ` +
        `on the >90 measure and ${n120.more} / ${n120.same} / ${n120.lower} on the >120 measure ` +
        `(default day >90: ndma-2025 ${cell(d, "ndma-2025", "unsafeExposureMin90")} vs heatgate-fair ${cell(d, "heatgate-fair", "unsafeExposureMin90")}). ` +
        `Of the scenarios where Fair is lower, ${n90.lowerOnAlertDays} (>90) and ${n120.lowerOnAlertDays} (>120) are alert days; the rest are days when the NDMA rules never fire.`,
    },
    {
      text: "heatgate-fair beats union-demand.",
      reason:
        `Default day: ${fairVsUnion.join("; ")}. ` +
        `Fewer unsafe minutes >120 AND higher earnings: heatgate-fair in ${fairAhead} of ${list.length} scenarios, union-demand in ${unionAhead}.`,
    },
    {
      text: "Any single rupee figure for break-even.",
      reason:
        `Break-even rest pay (₹/min, mean and per-seed range, sim/results/break-even.json) moves with order volume and seed: ${beCells.join("; ")}. ` +
        "Every rupee input is a placeholder, so these are shapes, not prices.",
    },
    {
      text: "Union riders earn more than today (as a fact).",
      reason:
        `Union's earnings of ${cell(d, "union-demand", "earningsPctOfNoRules", 1)} % of no-rules on the default day rests on placeholder pay: ₹${e.payPerOrderInr}/order, ₹${e.payPerKmInr}/km, ` +
        `₹${e.restPayPerMinuteInr}/min rest pay, ₹${e.dailyBonusInr} bonus with incentive protection.` +
        (unionNoPay ? ` With no rest pay the same rule set earns ${fmt(unionNoPay.mean, unionNoPay.min, unionNoPay.max, 1)} % of no-rules (${params.ordersPerHour} orders/h).` : ""),
    },
    {
      text: "Anything about real IMD alerts (for example \"NDMA rules fired on 29 May 2024 in Lucknow\").",
      reason: `The alert level is assumed: alertLevel "${params.alertLevel}" sets level 1 at a peak of 40 °C and level 2 at 45 °C (sim/city.ts dayAlertLevel). It is not the IMD alert issued for that day.`,
    },
    {
      text: "The Hindi, Telugu and Urdu messages are checked.",
      reason: `${unreviewed} of ${csv.length} rows in docs/translations/messages.csv are reviewed=false: machine-written drafts until a native speaker reviews them (docs/translations/REVIEW.md).`,
    },
  ];
}

function caveats(params: SimParams): string[] {
  const e = params.economics;
  return [
    `${params.multiAppPct}% of riders keep working on another app while resting here (an assumption to confirm with riders). Their breaks do not cool them, so this sets a floor on unsafe minutes that no rule set can remove.`,
    `All rupee amounts are placeholders until rider interviews: ₹${e.payPerOrderInr}/order, ₹${e.payPerKmInr}/km, ₹${e.dailyBonusInr} daily bonus, ₹${e.restPayPerMinuteInr}/min rest pay, ₹${e.heatFeePerOrderInr} heat fee.`,
    "Weather days are reanalysis data on a grid of about 25 km (Open-Meteo historical API). They read a few degrees below station peaks, so check each date against news reports before quoting it.",
    "The model has no demand response to heat: customers order the same on a 46 °C day as on a 34 °C day (only heatgate-fair's heat fee removes some orders).",
    "Idle riders do not move toward hubs (only with shade waiting, which is off by default).",
    "Heat index is a proxy for outdoor heat stress, not a medical measure. Unsafe minutes are rider-minutes (all riders, one day) outdoors at heat index ≥ 38 °C beyond 90 or 120 minutes since the last rest.",
  ];
}

export function renderPitchNumbers(): string {
  const params = defaultSimParams();
  const be = JSON.parse(readFileSync(join(ROOT, "sim", "results", "break-even.json"), "utf8")) as BreakEvenReport;
  const { list, audit } = scenarios(params);
  const claims = [halvingClaim(list), humidClaim(list), auditClaim(audit)];
  const kept = claims.filter((c) => c.supported);
  const dropped = claims.filter((c) => !c.supported);
  const claimBlock = (c: Claim, i: number) => [`${i + 1}. **${c.text}**`, ...c.numbers.map((n) => `   - ${n}`), `   - Reproduce: \`${c.command}\``, ""];
  const out = [
    "# Pitch numbers: what we can and cannot say",
    "",
    "Generated by `npm run pitch-numbers` (scripts/pitch-numbers.ts). Do not edit by hand: a test fails when this file",
    "no longer matches what the script would write. Re-run it after any change to the simulator, the weather days or",
    "`npm run sim:breakeven`.",
    "",
    `Every number is the **mean (min–max) over seeds ${params.seeds.join(", ")}**. Default parameters: ${params.riders} riders, ` +
      `${params.startHour}:00–${params.endHour}:00, ${params.ordersPerHour} orders/hour, alert "${params.alertLevel}". ` +
      "Rupee amounts are placeholders.",
    "",
    "## Results per scenario",
    "",
    "Unsafe min = rider-minutes outdoors at heat index ≥ 38 °C beyond 90 / 120 minutes since the last rest (all riders, one day).",
    "",
    ...list.flatMap(table),
    "## Claims we can make",
    "",
    ...kept.flatMap(claimBlock),
    ...(dropped.length
      ? ["## Claims the numbers no longer support (do not use)", "", ...dropped.flatMap(claimBlock)]
      : []),
    "## Claims we must NOT make",
    "",
    ...mustNot(list, params, be).flatMap((m, i) => [`${i + 1}. **${m.text}**`, `   - Why not: ${m.reason}`, ""]),
    "## Caveats to say out loud",
    "",
    ...caveats(params).map((c) => `- ${c}`),
    "",
  ];
  return out.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const start = Date.now();
  writeFileSync(SHEET_PATH, renderPitchNumbers());
  console.log(`wrote ${fileURLToPath(pathToFileURL(SHEET_PATH))} (${((Date.now() - start) / 1000).toFixed(1)} s)`);
}
