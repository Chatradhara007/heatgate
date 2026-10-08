import { DEFAULT_PAY, type SimParams } from "@heatgate/contracts";

// Defaults from contracts/types.ts. All money amounts are placeholders.
export function defaultSimParams(overrides: Partial<SimParams> = {}): SimParams {
  return {
    seeds: [1, 2, 3, 4, 5],
    riders: 50,
    peakTempC: 42,
    humidityPct: 45,
    alertLevel: "auto",
    startHour: 8,
    endHour: 20,
    ordersPerHour: 50,
    shiftHours: { min: 6, max: 8 },
    multiAppPct: 40,
    feeDemandDropPctPerInr: 1,
    policyVersions: ["no-rules", "ndma-2025", "union-demand", "heatgate-fair"],
    economics: {
      payPerOrderInr: 25,
      payPerKmInr: 6,
      dailyTargetShare: 0.9,
      dailyBonusInr: 150,
      restPayPerMinuteInr: 1.5,
      heatFeePerOrderInr: 5,
    },
    pay: DEFAULT_PAY,
    fairFeatures: { heatFee: true, shadeWaitCountsAsRest: false },
    ...overrides,
  };
}
