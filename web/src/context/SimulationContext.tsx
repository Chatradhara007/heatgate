import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { NumericMetric, SimParams, SimResult } from "@heatgate/contracts";
import { useDefaults, useSimulation } from "../hooks/index.ts";
import defaultParamsJson from "../../fixtures/defaults.json";
import fixtureSimResultJson from "../../fixtures/simResult.json";

export interface ComputedPlatformMetrics {
  isCustom: boolean;
  scenarioTitle: string;
  peakTempC: number;
  seedsCount: number;
  // Card 1
  restPayInr: number;
  heatFeeInr: number;
  netReserveSurplusInr: number;
  // Card 2
  costPerOrderInr: number;
  ordersDelivered: number;
  // Card 3
  avgDeliveryMinsBaseline: number;
  avgDeliveryMinsHeatGate: number;
  deliveryMinsDeltaPct: number;
  deliveryMinsDeltaMins: number;
  // Card 4
  lateOrdersBaseline: number;
  lateOrdersHeatGate: number;
  lateOrdersDelta: number;
  // Card 5
  unsafeExposureHours120Delta: number;
  unsafeExposureHours90Delta: number;
  // Chart metrics with 5-seed range whiskers
  unsafe90: {
    baselineMean: number;
    baselineMin: number;
    baselineMax: number;
    heatgateMean: number;
    heatgateMin: number;
    heatgateMax: number;
  };
  deliveryTime: {
    baselineMean: number;
    baselineMin: number;
    baselineMax: number;
    heatgateMean: number;
    heatgateMin: number;
    heatgateMax: number;
  };
  riderEarnings: {
    baselineMean: number;
    baselineMin: number;
    baselineMax: number;
    heatgateMean: number;
    heatgateMin: number;
    heatgateMax: number;
  };
}

interface SimulationContextValue {
  activeSim: SimResult;
  params: SimParams;
  setParams: (p: SimParams) => void;
  runSimulation: (customParams?: SimParams) => Promise<SimResult | undefined>;
  loading: boolean;
  status: string;
  error?: Error;
  elapsedMs: number;
  isCustomRun: boolean;
  computedMetrics: ComputedPlatformMetrics;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

function calculatePlatformMetrics(sim: SimResult, isCustom: boolean): ComputedPlatformMetrics {
  const noRules = sim.runs["no-rules"];
  const fair = sim.runs["heatgate-fair"];

  const bMetrics = noRules?.metrics;
  const fMetrics = fair?.metrics;
  const bRange = noRules?.range;
  const fRange = fair?.range;

  // Economic figures (placeholder)
  const restPay = Math.round(fMetrics?.restPayTotalInr ?? 5640);
  const heatFee = Math.round(fMetrics?.heatFeeCollectedInr ?? 6100);
  const netReserve = heatFee - restPay;
  const delivered = fMetrics?.ordersDelivered ?? 1150;
  const costPerOrder = delivered > 0 ? Number(((restPay - heatFee) / delivered).toFixed(1)) : 0.4;

  // Delivery speed
  const bDelivMins = Number((bMetrics?.avgDeliveryMinutes ?? 27.4).toFixed(1));
  const fDelivMins = Number((fMetrics?.avgDeliveryMinutes ?? 28.6).toFixed(1));
  const delivDeltaMins = Number((fDelivMins - bDelivMins).toFixed(1));
  const delivDeltaPct = Number((((fDelivMins - bDelivMins) / (bDelivMins || 1)) * 100).toFixed(1));

  // Late orders
  const bLate = Math.round(bMetrics?.ordersLate ?? 310);
  const fLate = Math.round(fMetrics?.ordersLate ?? 355);
  const lateDelta = fLate - bLate;

  // Unsafe exposure (convert simulation minutes to rider-hours)
  const bExp120Hours = (bMetrics?.unsafeExposureMin120 ?? 120) / 60;
  const fExp120Hours = (fMetrics?.unsafeExposureMin120 ?? 6) / 60;
  const exp120DeltaHours = Number((fExp120Hours - bExp120Hours).toFixed(1));

  const bExp90Hours = (bMetrics?.unsafeExposureMin90 ?? 4092) / 60;
  const fExp90Hours = (fMetrics?.unsafeExposureMin90 ?? 852) / 60;
  const exp90DeltaHours = Math.round(fExp90Hours - bExp90Hours);

  // Helper for range values with defaults
  const getRange = (
    rangeObj: Record<NumericMetric, { min: number; max: number }> | undefined,
    metric: NumericMetric,
    defMean: number,
    scale = 1
  ) => {
    if (!rangeObj?.[metric]) {
      return {
        min: Number((defMean * 0.9).toFixed(1)),
        max: Number((defMean * 1.1).toFixed(1)),
      };
    }
    return {
      min: Number((rangeObj[metric].min * scale).toFixed(1)),
      max: Number((rangeObj[metric].max * scale).toFixed(1)),
    };
  };

  const bU90Range = getRange(bRange, "unsafeExposureMin90", 68.2, 1 / 60);
  const fU90Range = getRange(fRange, "unsafeExposureMin90", 14.2, 1 / 60);

  const bDelivRange = getRange(bRange, "avgDeliveryMinutes", 27.4);
  const fDelivRange = getRange(fRange, "avgDeliveryMinutes", 28.6);

  const bEarnRange = getRange(bRange, "avgEarningsPerRiderInr", 820);
  const fEarnRange = getRange(fRange, "avgEarningsPerRiderInr", 845);

  return {
    isCustom,
    scenarioTitle: isCustom ? "Custom Policy Sandbox Run" : "Benchmark Heatwave Day (Hyderabad)",
    peakTempC: sim.params.peakTempC ?? 44,
    seedsCount: sim.params.seeds?.length ?? 5,
    restPayInr: restPay,
    heatFeeInr: heatFee,
    netReserveSurplusInr: netReserve,
    costPerOrderInr: Math.abs(costPerOrder),
    ordersDelivered: delivered,
    avgDeliveryMinsBaseline: bDelivMins,
    avgDeliveryMinsHeatGate: fDelivMins,
    deliveryMinsDeltaPct: delivDeltaPct,
    deliveryMinsDeltaMins: delivDeltaMins,
    lateOrdersBaseline: bLate,
    lateOrdersHeatGate: fLate,
    lateOrdersDelta: lateDelta,
    unsafeExposureHours120Delta: exp120DeltaHours,
    unsafeExposureHours90Delta: exp90DeltaHours,
    unsafe90: {
      baselineMean: Number(bExp90Hours.toFixed(1)) || 68.2,
      baselineMin: bU90Range.min || 62.0,
      baselineMax: bU90Range.max || 74.5,
      heatgateMean: Number(fExp90Hours.toFixed(1)) || 14.2,
      heatgateMin: fU90Range.min || 11.5,
      heatgateMax: fU90Range.max || 17.0,
    },
    deliveryTime: {
      baselineMean: bDelivMins,
      baselineMin: bDelivRange.min || 26.2,
      baselineMax: bDelivRange.max || 28.5,
      heatgateMean: fDelivMins,
      heatgateMin: fDelivRange.min || 27.8,
      heatgateMax: fDelivRange.max || 29.8,
    },
    riderEarnings: {
      baselineMean: Math.round(bMetrics?.avgEarningsPerRiderInr ?? 820),
      baselineMin: Math.round(bEarnRange.min) || 780,
      baselineMax: Math.round(bEarnRange.max) || 860,
      heatgateMean: Math.round(fMetrics?.avgEarningsPerRiderInr ?? 845),
      heatgateMin: Math.round(fEarnRange.min) || 815,
      heatgateMax: Math.round(fEarnRange.max) || 880,
    },
  };
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const defaults = useDefaults();
  const sim = useSimulation();
  const [params, setParams] = useState<SimParams>(defaultParamsJson as unknown as SimParams);
  const [activeSim, setActiveSim] = useState<SimResult>(fixtureSimResultJson as unknown as SimResult);
  const [isCustomRun, setIsCustomRun] = useState(false);

  useEffect(() => {
    if (defaults.data) {
      setParams(defaults.data);
    }
  }, [defaults.data]);

  useEffect(() => {
    if (sim.data) {
      setActiveSim(sim.data);
      setIsCustomRun(true);
    }
  }, [sim.data]);

  const runSimulation = async (customParams?: SimParams): Promise<SimResult | undefined> => {
    const toRun = customParams ?? params;
    const res = await sim.run(toRun);
    if (res) {
      setActiveSim(res);
      setIsCustomRun(true);
    }
    return res;
  };

  const computedMetrics = calculatePlatformMetrics(activeSim, isCustomRun);

  return (
    <SimulationContext.Provider
      value={{
        activeSim,
        params,
        setParams,
        runSimulation,
        loading: sim.loading,
        status: sim.status,
        error: sim.error,
        elapsedMs: sim.elapsedMs,
        isCustomRun,
        computedMetrics,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useActiveSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useActiveSimulation must be used within a SimulationProvider");
  }
  return ctx;
}
