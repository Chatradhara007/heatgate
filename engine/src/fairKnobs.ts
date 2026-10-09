// The heatgate-fair rule set as a fixed template plus number knobs (docs/spec/day3-features.md, "Change
// the rule live"). Knobs only change numbers, never the structure: every value is a checked whole number
// before it is put into the text, and no client text ever reaches Cedar.
// With DEFAULT_FAIR_KNOBS, renderFairPolicy() gives exactly policies/heatgate-fair.cedar (engine/fairKnobs.test.ts).
import type { FairKnobs } from "@heatgate/contracts";

export const DEFAULT_FAIR_KNOBS: FairKnobs = {
  restHeatC: 38,
  workLimitMin: 100,
  rushHardLimitMin: 120,
  earlyRestMin: 70,
  shortTripHeatC: 41,
  shortTripMaxKm: 3,
  extremeHeatC: 46,
};

// Allowed ranges from contracts/types.ts. Whole numbers only (Cedar uses Long).
export const FAIR_KNOB_RANGES: Record<keyof FairKnobs, { min: number; max: number; unit: string }> = {
  restHeatC: { min: 32, max: 46, unit: "°C heat index" },
  workLimitMin: { min: 60, max: 120, unit: "minutes" },
  rushHardLimitMin: { min: 90, max: 150, unit: "minutes" },
  earlyRestMin: { min: 40, max: 110, unit: "minutes" },
  shortTripHeatC: { min: 36, max: 48, unit: "°C heat index" },
  shortTripMaxKm: { min: 1, max: 6, unit: "km" },
  extremeHeatC: { min: 42, max: 52, unit: "°C heat index" },
};

export const FAIR_KNOB_NAMES = Object.keys(DEFAULT_FAIR_KNOBS) as (keyof FairKnobs)[];

// Problems with a full set of knobs; an empty list means they are safe to render.
export function fairKnobErrors(knobs: FairKnobs): string[] {
  const errors: string[] = [];
  for (const name of FAIR_KNOB_NAMES) {
    const v: unknown = knobs[name];
    const { min, max } = FAIR_KNOB_RANGES[name];
    if (typeof v !== "number" || !Number.isInteger(v)) errors.push(`fairKnobs.${name} must be a whole number`);
    else if (v < min || v > max) errors.push(`fairKnobs.${name} must be between ${min} and ${max}`);
  }
  if (errors.length > 0) return errors;
  if (knobs.rushHardLimitMin < knobs.workLimitMin) errors.push("fairKnobs.rushHardLimitMin must be at least fairKnobs.workLimitMin");
  if (knobs.earlyRestMin >= knobs.workLimitMin) errors.push("fairKnobs.earlyRestMin must be less than fairKnobs.workLimitMin");
  return errors;
}

// Same knobs -> same key, whatever the field order. Used to cache rendered rule sets.
export const fairKnobsKey = (knobs: FairKnobs) => FAIR_KNOB_NAMES.map((n) => knobs[n]).join("-");

export function renderFairPolicy(knobs: FairKnobs): string {
  const errors = fairKnobErrors(knobs);
  if (errors.length > 0) throw new Error(`invalid fair knobs: ${errors.join("; ")}`);
  const k = knobs;
  return `@id("base-allow-assign")
permit (principal is HeatGate::Rider,
        action == HeatGate::Action::"AssignOrder",
        resource is HeatGate::Order);

@id("fair-rest-in-progress")
@outcome("FORCE_REST")
@message("Your paid cooling break is still running.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.restMinutesRemaining > 0 };

@id("fair-rest-early-in-lull")
@outcome("FORCE_REST")
@restMinutes("20")
@message("Orders are slow right now. Take a paid 20-minute break in the shade.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= ${k.restHeatC}
    && context.minutesSinceBreak >= ${k.earlyRestMin}
    && context.demandLevel == 0 };

@id("fair-rest-due")
@outcome("FORCE_REST")
@restMinutes("20")
@message("Paid 20-minute cooling break. Nearest shade and water below.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= ${k.restHeatC}
    && context.minutesSinceBreak + context.tripMinutes > ${k.workLimitMin}
    && context.demandLevel < 2 };

@id("fair-rest-hard-limit")
@outcome("FORCE_REST")
@restMinutes("20")
@message("Paid 20-minute cooling break. Nearest shade and water below.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= ${k.restHeatC}
    && context.minutesSinceBreak + context.tripMinutes > ${k.rushHardLimitMin} };

@id("fair-short-trips-only")
@outcome("SKIP_ORDER")
@message("This order is too far for this heat. You stay online for nearer orders.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= ${k.shortTripHeatC} && resource.distanceKm > ${k.shortTripMaxKm} };

@id("fair-extreme-heat-stop")
@outcome("DENY")
@message("Extreme heat. Deliveries paused. Your incentive target is reduced for this time.")
forbid (principal, action == HeatGate::Action::"AssignOrder", resource)
when { context.heatIndexC >= ${k.extremeHeatC} };

@id("fair-decline-no-penalty")
permit (principal, action == HeatGate::Action::"DeclineWithoutPenalty",
        resource)
when { context.heatIndexC >= 38 };
`;
}

export interface FairRuleSummary {
  id: string;
  outcome: "ALLOW" | "SKIP_ORDER" | "DENY" | "FORCE_REST" | "NO_PENALTY";
  summary: string; // plain language, for the sandbox screen
}

// One line per rule, in file order, with the knob values filled in.
export function summarizeFairPolicy(k: FairKnobs): FairRuleSummary[] {
  return [
    { id: "base-allow-assign", outcome: "ALLOW", summary: "Orders are assigned unless one of the rules below stops them." },
    { id: "fair-rest-in-progress", outcome: "FORCE_REST", summary: "A rider on a paid cooling break gets no orders until the break is over." },
    {
      id: "fair-rest-early-in-lull",
      outcome: "FORCE_REST",
      summary: `When the heat index is ${k.restHeatC} °C or more and orders are slow, a rider who has worked ${k.earlyRestMin} minutes or more since the last break gets a paid 20-minute break.`,
    },
    {
      id: "fair-rest-due",
      outcome: "FORCE_REST",
      summary: `When the heat index is ${k.restHeatC} °C or more, an order that would take a rider past ${k.workLimitMin} minutes since the last break is held and the rider gets a paid 20-minute break, except at rush hour.`,
    },
    {
      id: "fair-rest-hard-limit",
      outcome: "FORCE_REST",
      summary: `When the heat index is ${k.restHeatC} °C or more, an order that would take a rider past ${k.rushHardLimitMin} minutes since the last break is held and the rider gets a paid 20-minute break, even at rush hour.`,
    },
    {
      id: "fair-short-trips-only",
      outcome: "SKIP_ORDER",
      summary: `When the heat index is ${k.shortTripHeatC} °C or more, orders over ${k.shortTripMaxKm} km (rounded up) are skipped; the rider stays online for nearer ones.`,
    },
    {
      id: "fair-extreme-heat-stop",
      outcome: "DENY",
      summary: `When the heat index is ${k.extremeHeatC} °C or more, deliveries are paused and the incentive target is reduced for that time.`,
    },
    {
      id: "fair-decline-no-penalty",
      outcome: "NO_PENALTY",
      summary: "When the heat index is 38 °C or more, a rider can decline any order without penalty (not a knob).",
    },
  ];
}
