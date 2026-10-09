import { DEFAULT_PAY, type SimParams } from "@heatgate/contracts";

// Defaults from contracts/types.ts. All money amounts are placeholders.
export function defaultSimParams(overrides: Partial<SimParams> = {}): SimParams {
  return {
    seeds: [1, 2, 3, 4, 5],
    riders: 50,
    // Proposed demo day, NOT the contract's humidity default of 45%: at 45% the heat index passes
    // heatgate-fair's extreme-heat stop (46) all afternoon from a 40 °C peak, so Fair delivers almost nothing.
    peakTempC: 40,
    humidityPct: 25,
    alertLevel: "auto",
    startHour: 8,
    endHour: 20,
    // Tuned on a 34 °C no-rules day (5 seeds) together with the two login waves in sim/dispatcher.ts
    // (an assumption): 34 gives 21 / 51 / 28 quiet / normal / rush against the 20 / 50 / 30 target.
    ordersPerHour: 34,
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
