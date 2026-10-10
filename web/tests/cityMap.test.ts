import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Frame, SimParams, SimResult } from "@heatgate/contracts";
import { cityLayout, defaultSimParams, simulate } from "@heatgate/sim";
import { CITY_CENTRES, cityFor, coolingPointsFrom, kmToLatLng } from "../src/lib/cityMap.ts";

const params = (weather?: SimParams["weather"]) => ({ weather }) as SimParams;

describe("cityFor", () => {
  it("draws the slider day on Hyderabad and a replay on its own city", () => {
    expect(cityFor(params())).toBe("Hyderabad");
    expect(cityFor(params({ kind: "slider" }))).toBe("Hyderabad");
    expect(cityFor(params({ kind: "replay", weatherDayId: "delhi-2020-06-19" }))).toBe("Delhi");
    expect(cityFor(params({ kind: "replay", weatherDayId: "lucknow-2024-05-29" }))).toBe("Lucknow");
    expect(cityFor(params({ kind: "replay", weatherDayId: "hyderabad-2022-05-01" }))).toBe("Hyderabad");
    expect(cityFor(params({ kind: "replay", weatherDayId: "mumbai-2024-05-01" }))).toBeUndefined();
  });
});

describe("kmToLatLng", () => {
  it("puts the grid centre on the city centre and spans about 10 km", () => {
    const c = CITY_CENTRES.Delhi;
    expect(kmToLatLng(c, 5, 5)).toEqual([c.lat, c.lng]);
    const [north] = kmToLatLng(c, 5, 0);
    const [south] = kmToLatLng(c, 5, 10);
    expect((north - south) * 111.32).toBeCloseTo(10, 6);
    const [, west] = kmToLatLng(c, 0, 5);
    const [, east] = kmToLatLng(c, 10, 5);
    expect((east - west) * 111.32 * Math.cos((c.lat * Math.PI) / 180)).toBeCloseTo(10, 6);
    expect(north).toBeGreaterThan(south); // y grows southwards
  });
});

describe("coolingPointsFrom", () => {
  const frame = (minute: number, riders: Frame["riders"]): Frame => ({ minute, heatIndexC: 40, demandLevel: 1, riders, events: [] });
  const sim = (frames: Frame[]) => ({ runs: { "heatgate-fair": { frames } } }) as unknown as SimResult;

  it("keeps spots where a rider rests in place, labelled CP 1… from the north-west", () => {
    const frames = [0, 5, 10].map((m) =>
      frame(m, [
        { id: "rider-001", x: 8, y: 3, state: "resting" },
        { id: "rider-002", x: 2, y: 1, state: "resting" },
        { id: "rider-003", x: 1 + m / 5, y: 9, state: "resting" }, // riding to a cooling point: moves, so ignored
        { id: "rider-004", x: 5, y: 5, state: "idle" }, // idle in place: not a cooling point
      ]),
    );
    expect(coolingPointsFrom(sim(frames))).toEqual([
      { label: "CP 1", x: 2, y: 1, labelBelow: false },
      { label: "CP 2", x: 8, y: 3, labelBelow: false },
    ]);
  });

  it("drops spots seen once, keeps at most 8, and labels close neighbours downwards", () => {
    const riders = Array.from({ length: 10 }, (_, i) => ({ id: `rider-${i}`, x: i === 1 ? 0.6 : i, y: i === 1 ? 0.5 : i, state: "resting" as const }));
    // rider-9 is seen at its spot only once: dropped. The other 9 spots are seen twice: the 8 most used are kept.
    const frames = [frame(0, riders), frame(5, riders.slice(0, 9)), frame(10, riders.slice(0, 9))];
    const points = coolingPointsFrom(sim(frames));
    expect(points).toHaveLength(8);
    expect(points.every((p) => /^CP [1-8]$/.test(p.label))).toBe(true);
    expect(points.some((p) => p.x === 9)).toBe(false);
    expect(points.find((p) => p.x === 0.6)?.labelBelow).toBe(true); // under 1 km from (0, 0): label goes below
  });
});

describe("against the simulator", () => {
  it("centres each city on its weather days' grid cell", () => {
    const dir = new URL("../../sim/data/weather/", import.meta.url);
    const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const day = JSON.parse(readFileSync(new URL(f, dir), "utf8")) as { id: string; city: string; lat: number; lng: number };
      const city = cityFor(params({ kind: "replay", weatherDayId: day.id }));
      expect(city).toBe(day.city);
      expect(CITY_CENTRES[city!]).toEqual({ lat: day.lat, lng: day.lng });
    }
  });

  it("finds the simulator's 8 cooling points from the default day's frames", () => {
    const result = simulate({ ...defaultSimParams(), seeds: [1] });
    const points = coolingPointsFrom(result);
    const real = cityLayout().coolingPoints;
    expect(points).toHaveLength(real.length);
    for (const p of points) expect(real.some((r) => Math.abs(r.x - p.x) < 1e-6 && Math.abs(r.y - p.y) < 1e-6)).toBe(true);
  });
});
