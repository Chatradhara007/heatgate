// Helpers for the "City map" illustration: which city a run belongs to, how the simulator's 10 x 10 km grid
// sits on that city, and where the cooling points are. Everything except the city centres comes from the result.
import type { SimParams, SimResult } from "@heatgate/contracts";

export type CityName = "Delhi" | "Lucknow" | "Hyderabad";

// Centre of the grid = the weather grid cell of that city's weather days (sim/data/weather/*.json, Open-Meteo).
// Used only to place the illustration; the simulated city is not modelled on these streets.
export const CITY_CENTRES: Record<CityName, { lat: number; lng: number }> = {
  Delhi: { lat: 28.576448, lng: 77.18678 },
  Lucknow: { lat: 26.81898, lng: 80.93023 },
  Hyderabad: { lat: 17.398945, lng: 78.457085 },
};

const BY_ID_PREFIX: Record<string, CityName> = { delhi: "Delhi", lucknow: "Lucknow", hyderabad: "Hyderabad" };

// A replay is drawn on its own city (weather day ids start with the city: "delhi-2020-06-19");
// the slider day on Hyderabad. undefined = a weather day from a city we have no centre for.
export function cityFor(params: SimParams): CityName | undefined {
  if (params.weather?.kind !== "replay") return "Hyderabad";
  return BY_ID_PREFIX[params.weather.weatherDayId.split("-")[0].toLowerCase()];
}

export const CITY_KM = 10;
const KM_PER_DEG_LAT = 111.32;

// Sim x/y are km from the top-left corner (x east, y south). The grid's centre (5, 5) sits on the city centre.
export function kmToLatLng(centre: { lat: number; lng: number }, x: number, y: number): [number, number] {
  const lat = centre.lat + (CITY_KM / 2 - y) / KM_PER_DEG_LAT;
  const lng = centre.lng + (x - CITY_KM / 2) / (KM_PER_DEG_LAT * Math.cos((centre.lat * Math.PI) / 180));
  return [lat, lng];
}

export interface CoolingPoint {
  label: string; // "CP 1" … "CP 8": numbered on screen only, not the simulator's own numbering
  x: number;
  y: number;
  labelBelow: boolean; // put the label under the point, because another point's label sits just above it
}

const MAX_COOLING_POINTS = 8; // sim/city.ts COOLING_POINT_COUNT

// The result has no city layout, so cooling points are read from the frames: a rider who is "resting" at the
// same spot in two frames in a row is resting at a cooling point (riding there also reads as "resting", but
// then the position changes). Spots seen fewer than twice are dropped as noise; the 8 most used are kept,
// then numbered from the north-west. Only points someone rested at in this run (first seed) can appear.
export function coolingPointsFrom(sim: SimResult): CoolingPoint[] {
  const counts = new Map<string, { x: number; y: number; n: number }>();
  for (const run of Object.values(sim.runs)) {
    if (!run) continue;
    const last = new Map<string, string>();
    for (const frame of run.frames) {
      for (const r of frame.riders) {
        const key = `${r.x.toFixed(3)},${r.y.toFixed(3)}`;
        if (r.state === "resting" && last.get(r.id) === key) {
          const c = counts.get(key) ?? { x: r.x, y: r.y, n: 0 };
          c.n += 1;
          counts.set(key, c);
        }
        last.set(r.id, key);
      }
    }
  }
  return [...counts.values()]
    .filter((c) => c.n >= 2)
    .sort((a, b) => b.n - a.n)
    .slice(0, MAX_COOLING_POINTS)
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((c, i, all) => ({
      label: `CP ${i + 1}`,
      x: c.x,
      y: c.y,
      // Two points closer than ~1 km would stack their labels: the later one (further south) labels downwards.
      labelBelow: all.slice(0, i).some((o) => Math.abs(o.x - c.x) < 1 && Math.abs(o.y - c.y) < 1),
    }));
}
