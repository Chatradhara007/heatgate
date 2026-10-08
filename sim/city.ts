// The demo city: weather through the day, alert level, hubs and cooling points.
import type { AlertLevel, AlertSetting } from "@heatgate/contracts";
import { stream } from "./rng.ts";

export const CITY_KM = 10;
export const HUB_COUNT = 6;
export const COOLING_POINT_COUNT = 8;

export interface Point {
  x: number;
  y: number;
}

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

// Smooth daily curve: peak at 3 PM, 9 °C cooler at 3 AM. hour may be fractional.
export function temperatureAt(peakTempC: number, hour: number): number {
  return peakTempC - 4.5 * (1 - Math.cos((2 * Math.PI * (hour - 15)) / 24));
}

// One level for the whole day, like a daily IMD alert. auto: 1 at a 40 °C peak, 2 at 45 °C.
export function dayAlertLevel(setting: AlertSetting, peakTempC: number): AlertLevel {
  if (setting !== "auto") return setting;
  if (peakTempC >= 45) return 2;
  if (peakTempC >= 40) return 1;
  return 0;
}

// Share of on-shift riders who are delivering: < 50% quiet, 50-85% normal, > 85% rush.
export function demandLevelFor(delivering: number, onShift: number): 0 | 1 | 2 {
  const share = onShift === 0 ? 0 : delivering / onShift;
  if (share > 0.85) return 2;
  if (share >= 0.5) return 1;
  return 0;
}

export interface CityLayout {
  hubs: Point[];
  coolingPoints: Point[];
}

// Fixed seeded positions (the same city for every seed and rule set).
export function cityLayout(): CityLayout {
  const rng = stream(2024, "city");
  const point = () => ({ x: 0.5 + rng() * (CITY_KM - 1), y: 0.5 + rng() * (CITY_KM - 1) });
  return {
    hubs: Array.from({ length: HUB_COUNT }, point),
    coolingPoints: Array.from({ length: COOLING_POINT_COUNT }, (_, i) => ({ ...point(), name: `Cooling point ${i + 1}` })),
  };
}

export function nearest<T extends Point>(from: Point, points: T[]): T {
  let best = points[0];
  for (const p of points) if (distance(from, p) < distance(from, best)) best = p;
  return best;
}
