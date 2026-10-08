// ===================================================================================================
// MONEY MODEL: READ BEFORE QUOTING ANY RUPEE FIGURE (see docs/money-model.md)
//
// Every rupee amount is a PLACEHOLDER. The amounts (pay per order and per km, bonus, rest pay per minute,
// heat fee) live in SimParams.economics, with defaults in sim/params.ts. Which rule set gets paid rest and
// incentive protection is DEFAULT_PAY in contracts/types.ts, which is an assumption too. All of them
// must be replaced with numbers from rider interviews. Never hard-code rupees here.
//
// The headline result is the BREAK-EVEN REST PAY (npm run sim:sensitivity): the smallest rest pay per
// minute at which a rule set's riders earn at least as much as today (no-rules). It is NOT the earnings
// percentage at the default rate. That percentage moves with every placeholder, and at the default
// ₹1.5/min a rest pays more per hour than delivering does.
// ===================================================================================================
//
// Rider earnings, the daily target and the pay protections (docs/spec/simulator.md,
// "Fair features and rider earnings"). These apply to every rule set so they can be compared.
import type { Economics, PayProtections } from "@heatgate/contracts";

export const PROTECTED_MIN_PER_ORDER = 30; // every 30 min of forced rest or pause lowers the target by 1 order

// What one rider did in one simulated day.
export interface RiderTally {
  id: string; // pseudonymous
  ordersDelivered: number;
  orderPayInr: number; // sum of orderPayInr() over the delivered orders
  restMinutes: number; // minutes spent in a forced rest (from arrival at the cooling point)
  restOrPauseMinutes: number; // restMinutes plus minutes paused by DENY
}

export interface RiderEarnings {
  target: number; // after incentive protection
  hitTarget: boolean;
  bonusInr: number;
  restPayInr: number;
  totalInr: number; // order pay + bonus + rest pay
}

export interface EarningsSummary {
  avgEarningsPerRiderInr: number;
  minEarningsPerRiderInr: number;
  incentiveHitRatePct: number;
  restPayTotalInr: number;
}

// Each delivered order pays payPerOrderInr + payPerKmInr x distanceKm (pickup hub to drop).
export function orderPayInr(distanceKm: number, econ: Economics): number {
  return econ.payPerOrderInr + econ.payPerKmInr * distanceKm;
}

export function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

// dailyTargetShare x the median orders per rider in the no-rules run on the same seed.
// Not rounded: a rider reaches 9.9 by delivering 10.
export function dailyTarget(noRulesOrdersPerRider: number[], econ: Economics): number {
  return econ.dailyTargetShare * median(noRulesOrdersPerRider);
}

// Incentive protection: every full 30 minutes of forced rest or pause lowers the target by 1 order.
export function adjustedTarget(target: number, restOrPauseMinutes: number, pay: PayProtections): number {
  if (!pay.protectIncentive) return target;
  return Math.max(0, target - Math.floor(restOrPauseMinutes / PROTECTED_MIN_PER_ORDER));
}

export function riderEarnings(t: RiderTally, target: number, econ: Economics, pay: PayProtections): RiderEarnings {
  const own = adjustedTarget(target, t.restOrPauseMinutes, pay);
  const hitTarget = t.ordersDelivered >= own;
  const bonusInr = hitTarget ? econ.dailyBonusInr : 0;
  const restPayInr = pay.paidRest ? t.restMinutes * econ.restPayPerMinuteInr : 0;
  return { target: own, hitTarget, bonusInr, restPayInr, totalInr: t.orderPayInr + bonusInr + restPayInr };
}

// The money fields of Metrics (heatFeeCollectedInr comes from sim/fair.ts). Every rider counts,
// including those who delivered nothing.
export function earningsSummary(tallies: RiderTally[], target: number, econ: Economics, pay: PayProtections): EarningsSummary {
  if (tallies.length === 0) return { avgEarningsPerRiderInr: 0, minEarningsPerRiderInr: 0, incentiveHitRatePct: 0, restPayTotalInr: 0 };
  const each = tallies.map((t) => riderEarnings(t, target, econ, pay));
  const totals = each.map((e) => e.totalInr);
  return {
    avgEarningsPerRiderInr: totals.reduce((a, b) => a + b, 0) / totals.length,
    minEarningsPerRiderInr: Math.min(...totals),
    incentiveHitRatePct: (100 * each.filter((e) => e.hitTarget).length) / each.length,
    restPayTotalInr: each.reduce((a, e) => a + e.restPayInr, 0),
  };
}

// Average earnings as a % of the no-rules ("today") baseline on the same seed.
export function pctOfBaseline(avgEarningsInr: number, baselineAvgEarningsInr: number): number {
  return baselineAvgEarningsInr === 0 ? 0 : (100 * avgEarningsInr) / baselineAvgEarningsInr;
}
