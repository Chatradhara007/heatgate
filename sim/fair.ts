// The two heatgate-fair features (docs/spec/simulator.md), each behind its own FairFeatures flag.
// Rupee amounts come from SimParams.economics and are PLACEHOLDERS for the demo.
import type { PolicyVersion, SimParams } from "@heatgate/contracts";
import { stream } from "./rng.ts";

export const HEAT_FEE_MIN_HEAT_INDEX = 38; // orders placed at heat index >= 38 carry the fee
export const SHADE_BREAK_MIN = 20; // continuous minutes waiting in shade that count as a break

export const heatFeeOn = (params: SimParams, policy: PolicyVersion) =>
  policy === "heatgate-fair" && params.fairFeatures.heatFee;

// OFF by default: it assumes restaurant hubs have shade for riders, which is unverified.
export const shadeWaitOn = (params: SimParams, policy: PolicyVersion) =>
  policy === "heatgate-fair" && params.fairFeatures.shadeWaitCountsAsRest;

export interface HeatFeeResult<T> {
  orders: T[]; // the orders still placed
  cancelled: number; // hot orders customers dropped because of the fee
  heatFeeCollectedInr: number; // into the heat fund that pays rest minutes
}

// Heat fee: every order placed while the heat index is >= 38 adds heatFeePerOrderInr to the heat fund.
// Each rupee of fee also cancels feeDemandDropPctPerInr % of those orders. One draw per hot order from
// its own seeded stream, so the order stream itself, and every other rule set, sees the same day.
export function applyHeatFee<T extends { createdMin: number }>(
  orders: T[],
  heatIndexAt: (minute: number) => number,
  params: SimParams,
  policy: PolicyVersion,
  seed: number,
): HeatFeeResult<T> {
  if (!heatFeeOn(params, policy)) return { orders, cancelled: 0, heatFeeCollectedInr: 0 };
  const fee = params.economics.heatFeePerOrderInr;
  const dropChance = Math.min(1, (fee * params.feeDemandDropPctPerInr) / 100);
  const rng = stream(seed, "heat-fee");
  const kept: T[] = [];
  let cancelled = 0;
  let collected = 0;
  for (const o of orders) {
    if (heatIndexAt(o.createdMin) < HEAT_FEE_MIN_HEAT_INDEX) {
      kept.push(o);
    } else if (rng() < dropChance) {
      cancelled++;
    } else {
      kept.push(o);
      collected += fee;
    }
  }
  return { orders: kept, cancelled, heatFeeCollectedInr: collected };
}

// One minute waiting idle at a hub with shade waiting on: no exposure is added, and after
// 20 continuous minutes the rider has had a break. The caller resets shadeMinutes when the rider leaves.
export function waitInShade(r: { shadeMinutes: number; minutesSinceBreak: number }): void {
  r.shadeMinutes++;
  if (r.shadeMinutes >= SHADE_BREAK_MIN) r.minutesSinceBreak = 0;
}
