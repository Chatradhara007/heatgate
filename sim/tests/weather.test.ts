// Real weather replay: the committed files, interpolation, determinism, and the default day left as it was.
import { createHash } from "node:crypto";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { WeatherDay } from "@heatgate/contracts";
import { WEATHER_DAYS, dayWeather, defaultSimParams, replayAt, simulate, weatherDay, weatherDaySummary } from "../src/index.ts";
import { WEATHER_FILES } from "../data/weather/index.ts";

const sha = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");

describe("committed weather days", () => {
  const files = readdirSync(join(import.meta.dirname, "..", "data", "weather")).filter((f) => f.endsWith(".json"));

  test("every file is listed in sim/data/weather/index.ts", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    expect(Object.keys(WEATHER_FILES).sort()).toEqual(files.sort());
  });

  for (const day of WEATHER_DAYS) {
    test(`${day.id}: source info and 24 plausible hourly values`, () => {
      expect(day.source).toBe("Open-Meteo historical weather API");
      expect(day.url).toMatch(/^https:\/\/archive-api\.open-meteo\.com\/v1\/archive\?/);
      expect(day.url).toContain("timezone=Asia%2FKolkata");
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.id).toBe(`${day.city.toLowerCase()}-${day.date}`);
      expect(Math.abs(day.lat - 23)).toBeLessThan(10); // India
      expect(Math.abs(day.lng - 80)).toBeLessThan(10);
      expect(day.hourly.map((h) => h.hour)).toEqual([...Array(24).keys()]);
      for (const h of day.hourly) {
        expect(h.tempC).toBeGreaterThan(10);
        expect(h.tempC).toBeLessThan(52);
        expect(h.humidityPct).toBeGreaterThanOrEqual(0);
        expect(h.humidityPct).toBeLessThanOrEqual(100);
      }
      // A hot day: the afternoon is warmer than the early morning, and no hour jumps by more than 8 °C.
      expect(Math.max(...day.hourly.slice(11, 18).map((h) => h.tempC))).toBeGreaterThan(Math.min(...day.hourly.slice(3, 7).map((h) => h.tempC)));
      for (let i = 1; i < 24; i++) expect(Math.abs(day.hourly[i].tempC - day.hourly[i - 1].tempC)).toBeLessThan(8);
    });
  }
});

describe("interpolation", () => {
  const day = {
    hourly: Array.from({ length: 24 }, (_, hour) => ({ hour, tempC: 30 + hour, humidityPct: 60 - 2 * hour })),
  } as WeatherDay;

  test("on the hour: the file's value", () => {
    expect(replayAt(day, 14)).toEqual({ tempC: 44, humidityPct: 32 });
  });

  test("between hours: a straight line", () => {
    expect(replayAt(day, 14.25)).toEqual({ tempC: 44.25, humidityPct: 31.5 });
    expect(replayAt(day, 9 + 40 / 60).tempC).toBeCloseTo(39 + 40 / 60, 10);
  });

  test("after 23:00 it stays at the 23:00 value", () => {
    expect(replayAt(day, 23.5)).toEqual(replayAt(day, 23));
    expect(replayAt(day, 24.2)).toEqual(replayAt(day, 23));
  });

  test("a run with a weather day reads the series; the alert level uses the day's hourly peak", () => {
    const real = WEATHER_DAYS[0];
    const w = dayWeather(defaultSimParams({ weather: { kind: "replay", weatherDayId: real.id } }));
    expect(w.at(13)).toEqual({ tempC: real.hourly[13].tempC, humidityPct: real.hourly[13].humidityPct });
    expect(w.peakTempC).toBe(Math.max(...real.hourly.map((h) => h.tempC)));
  });

  test("summary: peaks over the hourly values", () => {
    const s = weatherDaySummary({ ...day, id: "x", city: "X", date: "2024-01-01", lat: 0, lng: 0, source: "s" });
    expect(s).toMatchObject({ id: "x", city: "X", date: "2024-01-01", peakTempC: 53, source: "s" });
  });
});

describe("simulation", () => {
  // sha256 of JSON.stringify(simulate(defaultSimParams())) before weather replay existed.
  test("no weather day: results and hash exactly as before", () => {
    const plain = simulate(defaultSimParams());
    expect(sha(plain)).toBe("ded968a6fbdf364f5603e8395f0426d09144e1f76a4aa247af9828550a0ce5d7");
    // { kind: "slider" } is the same day; only the echoed params differ.
    expect(simulate(defaultSimParams({ weather: { kind: "slider" } })).runs).toEqual(plain.runs);
  }, 120_000);

  test("with a weather day: deterministic, and different from the slider day", () => {
    const params = defaultSimParams({ seeds: [3], startHour: 11, endHour: 16, weather: { kind: "replay", weatherDayId: "lucknow-2024-05-29" } });
    const first = simulate(params);
    expect(simulate(params)).toEqual(first);
    expect(sha(first.runs)).not.toBe(sha(simulate(defaultSimParams({ seeds: [3], startHour: 11, endHour: 16 })).runs));
  }, 60_000);

  test("an unknown weather day is refused", () => {
    expect(weatherDay("atlantis-2024-01-01")).toBeUndefined();
    expect(() => simulate(defaultSimParams({ seeds: [1], startHour: 11, endHour: 12, weather: { kind: "replay", weatherDayId: "atlantis-2024-01-01" } }))).toThrow(
      /unknown weather day/,
    );
  });
});
