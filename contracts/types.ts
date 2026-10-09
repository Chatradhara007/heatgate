export type PolicyVersion = "no-rules" | "ndma-2025" | "union-demand" | "heatgate-fair";

// Names shown on screen. The id "no-rules" stays; the label says what it really is.
export const POLICY_LABELS: Record<PolicyVersion, string> = {
  "no-rules": "Today: voluntary measures only (nothing enforced)",
  "ndma-2025": "NDMA advisory rules",
  "union-demand": "Union demand (IFAT)",
  "heatgate-fair": "HeatGate Fair",
};

// ALLOW = give the order
// SKIP_ORDER = this order is too far for the heat; rider stays online for nearer ones
// DENY = rider paused, no orders for 15 minutes
// FORCE_REST = rider takes a cooling break (15 or 20 minutes, set by the rule)
export type Outcome = "ALLOW" | "SKIP_ORDER" | "DENY" | "FORCE_REST";

export type AlertLevel = 0 | 1 | 2; // 0 none, 1 IMD orange, 2 IMD red (assumed in the demo)

export interface DecideRequest {
  policyVersion: PolicyVersion;
  rider: {
    id: string;
    vehicle: "bike" | "cycle" | "ev";
    x: number;
    y: number;
  }; // km in the 10x10 city
  order: {
    id: string;
    zone: string;
    distanceKm: number;
    tripMinutes: number;
  };
  conditions: {
    tempC: number;
    humidityPct: number;
    hourOfDay: number;
    demandLevel: 0 | 1 | 2;
    alertLevel: AlertLevel;
  };
  riderState: {
    minutesSinceBreak: number;
    exposureMinutesToday: number;
    restMinutesRemaining: number;
  };
  simulationId?: string; // set when the simulator is calling
  dryRun?: boolean; // true = do not write to AuditLog
}

export interface Decision {
  decisionId: string; // ULID
  at: string; // ISO time (simulated time inside a simulation)
  policyVersion: PolicyVersion;
  riderId: string; // pseudonymous ID. Likely still personal data (DPDP). Never a name or phone number
  orderId: string;
  simulationId?: string;
  outcome: Outcome;
  restMinutes: number; // 0 unless FORCE_REST (15 or 20, or what is left of a running rest)
  penaltyWaived: boolean;
  heatIndexC: number; // rounded value sent to Cedar
  firedRules: string[]; // Cedar @id values: the winner first, then the others that fired
  message: string; // what the rider sees (English)
  messages?: { hi?: string; te?: string; ur?: string }; // translations, when the rule has them
  coolingPoint?: { name: string; distanceM: number }; // nearest shade + water, for FORCE_REST
  cedarContext: Record<string, number>; // exact inputs, so any decision can be replayed
}

// All money amounts are PLACEHOLDERS for the demo. Replace with numbers from rider interviews.
export interface Economics {
  payPerOrderInr: number; // default 25
  payPerKmInr: number; // default 6
  dailyTargetShare: number; // incentive target = this share of the median orders per rider in the no-rules run (same seed), default 0.9
  dailyBonusInr: number; // paid if the target is reached, default 150
  restPayPerMinuteInr: number; // paid where PayProtections.paidRest is on, default 1.5 (= ₹30 per 20-minute break)
  heatFeePerOrderInr: number; // heatgate-fair only, charged to customers when heat index >= 38, default 5
}

// Which pay protections each rule set has. These defaults are ASSUMPTIONS to verify:
// NDMA advises no penalty or pay cut; IFAT asks for paid breaks and protection from lost incentives.
export interface PayProtections {
  paidRest: boolean; // rest minutes are paid
  protectIncentive: boolean; // every 30 minutes of forced rest or pause lowers the daily target by 1 order
}

export const DEFAULT_PAY: Record<PolicyVersion, PayProtections> = {
  "no-rules": { paidRest: false, protectIncentive: false },
  "ndma-2025": { paidRest: true, protectIncentive: false },
  "union-demand": { paidRest: true, protectIncentive: true },
  "heatgate-fair": { paidRest: true, protectIncentive: true },
};

// Only for heatgate-fair
export interface FairFeatures {
  heatFee: boolean; // charge heatFeePerOrderInr to customers on hot orders. default true
  shadeWaitCountsAsRest: boolean; // default FALSE. Assumes restaurants have shade for riders, which is unverified
}

export type AlertSetting = "auto" | AlertLevel; // auto: 1 if peak >= 40 °C, 2 if peak >= 45 °C

export interface FairKnobs {
  restHeatC: number; // default 38, allowed 32-46
  workLimitMin: number; // default 100, allowed 60-120
  rushHardLimitMin: number; // default 120, allowed 90-150, must be >= workLimitMin
  earlyRestMin: number; // default 70, allowed 40-110, must be < workLimitMin
  shortTripHeatC: number; // default 41, allowed 36-48
  shortTripMaxKm: number; // default 3 (NDMA's radius), allowed 1-6
  extremeHeatC: number; // default 46, allowed 42-52
}

export interface WeatherDay {
  id: string; // e.g. "delhi-2024-xx-xx"
  city: string;
  date: string; // YYYY-MM-DD
  lat: number;
  lng: number;
  source: string; // "Open-Meteo historical weather API"
  alertLevel?: 0 | 1 | 2; // the real IMD alert if you can find it; otherwise derived from the day's peak and shown as "assumed"
  hourly: { hour: number; tempC: number; humidityPct: number }[]; // 24 entries
}

export type WeatherSource =
  | { kind: "slider" } // uses peakTempC + humidityPct
  | { kind: "replay"; weatherDayId: string };

export interface SimParams {
  seeds: number[]; // default [1,2,3,4,5]. Same seeds for every rule set
  riders: number; // default 50
  peakTempC: number; // the slider, e.g. 34-46
  humidityPct: number; // default 45
  alertLevel: AlertSetting;
  startHour: number; // default 8
  endHour: number; // default 20
  ordersPerHour: number; // default 34 (tuned with the two login waves in sim/dispatcher.ts); x1.5 at lunch (12-14) and dinner (19-21). Tune so demand is quiet ~20%, normal ~50%, rush ~30% of the day
  shiftHours: { min: number; max: number }; // default 6 and 8; riders log in in two waves, 08:00-09:00 and 15:00-18:00 (an assumption, sim/dispatcher.ts)
  multiAppPct: number; // default 40 (to confirm with riders): share of riders who keep working on another app while resting here
  feeDemandDropPctPerInr: number; // default 1: % of new orders lost per rupee of heat fee
  policyVersions: PolicyVersion[]; // usually all four
  economics: Economics;
  pay: Record<PolicyVersion, PayProtections>; // default DEFAULT_PAY
  fairFeatures: FairFeatures;
  fairKnobs?: FairKnobs;
  weather?: WeatherSource;
}

export type RiderState = "idle" | "delivering" | "resting" | "paused";

export interface Frame {
  minute: number; // minutes since startHour
  heatIndexC: number;
  demandLevel: 0 | 1 | 2;
  riders: { id: string; x: number; y: number; state: RiderState }[];
  events: { riderId: string; outcome: Outcome; rule: string }[]; // decisions in this step
}

export interface Metrics {
  // safety: the same yardstick for every rule set, whatever its own limit is
  unsafeExposureMin90: number; // outdoor minutes at heat index >= 38 beyond 90 minutes since the last rest (NDMA's limit)
  unsafeExposureMin120: number; // the same, beyond 120 minutes (the union's limit)
  restsForced: number;
  pausedRiderMinutes: number;
  // speed
  ordersTotal: number;
  ordersDelivered: number;
  avgDeliveryMinutes: number; // order created -> delivered
  p90DeliveryMinutes: number;
  ordersLate: number; // delivered after 45 minutes
  // money
  avgEarningsPerRiderInr: number; // order pay + bonus + rest pay
  minEarningsPerRiderInr: number; // the worst-off rider
  incentiveHitRatePct: number; // % of riders who reached their (adjusted) target
  restPayTotalInr: number;
  heatFeeCollectedInr: number;
  earningsPctOfNoRules: number; // avgEarningsPerRiderInr as a % of the no-rules run on the same seed
  decisions: Record<Outcome, number>;
}

export type NumericMetric = Exclude<keyof Metrics, "decisions">;

export interface SimResult {
  simulationId: string;
  params: SimParams;
  runs: Partial<Record<PolicyVersion, {
    metrics: Metrics; // mean over the seeds
    range: Record<NumericMetric, { min: number; max: number }>; // across the seeds
    frames: Frame[]; // first seed only, one per 5 sim minutes
  }>>;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
  };
}

// Added on core-api for async simulations
export type SimulationStatus = "queued" | "running" | "done" | "failed";

export interface SimulationJob {
  simulationId: string;
  status: SimulationStatus;
  createdAt: string; // ISO
  finishedAt?: string; // ISO, set when done or failed
  result?: SimResult; // only when status === "done"
  error?: ApiError["error"]; // only when status === "failed"
}

// Added on core-breakeven: npm run sim:breakeven writes sim/results/break-even.json; GET /break-even serves it.
// ALL RUPEE AMOUNTS ARE PLACEHOLDERS from interview-pending economics (docs/money-model.md).
// Break-even rest pay: the smallest economics.restPayPerMinuteInr at which a rule set's average rider earns
// at least as much as in the no-rules run on the same seed, interpolated between sweep points.
export interface BreakEvenReport {
  note: "All rupee amounts are placeholders from interview-pending economics.";
  generatedAt: string; // ISO
  params: SimParams; // default SimParams the sweep ran from; the sweep overrides ordersPerHour and economics.restPayPerMinuteInr
  restPayRatesInrPerMin: number[]; // the rest pay sweep, the same at every demand level
  levels: {
    ordersPerHour: number;
    noRulesAvgEarningsInr: { mean: number; min: number; max: number }; // across the seeds
    policies: Partial<Record<PolicyVersion, {
      breakEven:
        | {
            status: "reached";
            meanInrPerMin: number; // from the seed-mean earnings
            perSeedMinInrPerMin: number; // over the seeds that reach it within the sweep
            perSeedMaxInrPerMin: number;
            seedsNotReached: number; // seeds still below no-rules at the top of the sweep
          }
        | {
            status: "notReached"; // not reached within the sweep
            bestEarningsPctOfNoRules: number; // highest seed-mean earnings % of no-rules in the sweep
            atRestPayInrPerMin: number;
          };
      // One row per rest pay rate, for the chart. Mean over the seeds, min-max across them.
      rows: {
        restPayInrPerMin: number;
        earningsPctOfNoRules: { mean: number; min: number; max: number };
        avgEarningsInr: { mean: number; min: number; max: number };
        lowestRiderInr: { mean: number; min: number; max: number };
      }[];
    }>>;
  }[];
  stale?: boolean; // set by GET /break-even only (never in the file): params differ from the current default SimParams
}
