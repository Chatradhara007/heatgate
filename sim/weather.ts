// Real weather days to replay (sim/data/weather, saved by npm run fetch-weather) and the weather at any
// minute of the simulated day: the slider's smooth curve, or a real day's hourly series.
import type { SimParams, WeatherDay } from "@heatgate/contracts";
import { heatIndexC } from "@heatgate/engine";
import { temperatureAt } from "./city.ts";
import { WEATHER_FILES } from "./data/weather/index.ts";

// A committed day: the contract's WeatherDay plus where the numbers came from.
export interface ReplayDay extends WeatherDay {
  url: string;
  timezone: string;
  license: string;
  fetchedAt: string;
}

// What GET /weather-days lists. Peaks over the 24 hourly values; heat index from engine heatIndexC
// (a proxy for outdoor heat stress, not a medical measure), to one decimal.
export interface WeatherDaySummary {
  id: string;
  city: string;
  date: string;
  peakTempC: number;
  peakHeatIndexC: number;
  source: string;
}

function check(file: string, raw: unknown): ReplayDay {
  const d = raw as ReplayDay;
  const fail = (why: string) => new Error(`sim/data/weather/${file}: ${why}`);
  for (const key of ["id", "city", "date", "source", "url"] as const) {
    if (typeof d[key] !== "string" || !d[key]) throw fail(`${key} is missing`);
  }
  if (`${d.id}.json` !== file) throw fail(`id ${d.id} does not match the file name`);
  if (!Array.isArray(d.hourly) || d.hourly.length !== 24) throw fail("hourly must have 24 entries");
  d.hourly.forEach((h, i) => {
    if (h.hour !== i || !Number.isFinite(h.tempC) || !Number.isFinite(h.humidityPct)) throw fail(`hourly[${i}] is not hour ${i} with numbers`);
  });
  return d;
}

export const WEATHER_DAYS: ReplayDay[] = Object.entries(WEATHER_FILES)
  .map(([file, raw]) => check(file, raw))
  .sort((a, b) => a.city.localeCompare(b.city) || a.date.localeCompare(b.date));

export function weatherDay(id: string): ReplayDay | undefined {
  return WEATHER_DAYS.find((d) => d.id === id);
}

export const peakTempOf = (day: WeatherDay) => Math.max(...day.hourly.map((h) => h.tempC));

export function weatherDaySummary(day: WeatherDay): WeatherDaySummary {
  const peakHi = Math.max(...day.hourly.map((h) => heatIndexC(h.tempC, h.humidityPct)));
  return {
    id: day.id,
    city: day.city,
    date: day.date,
    peakTempC: peakTempOf(day),
    peakHeatIndexC: Math.round(peakHi * 10) / 10,
    source: day.source,
  };
}

// Straight line between the two nearest hours. hour may be fractional; after 23:00 (a delivery that runs
// past midnight) it stays at the 23:00 value, since the file has no next day.
export function replayAt(day: WeatherDay, hour: number): { tempC: number; humidityPct: number } {
  const h = Math.min(Math.max(hour, 0), 23);
  const i = Math.floor(h);
  const j = Math.min(i + 1, 23);
  const f = h - i;
  const a = day.hourly[i];
  const b = day.hourly[j];
  return { tempC: a.tempC + (b.tempC - a.tempC) * f, humidityPct: a.humidityPct + (b.humidityPct - a.humidityPct) * f };
}

export interface DayWeather {
  at: (hour: number) => { tempC: number; humidityPct: number };
  peakTempC: number; // for the "auto" alert level
}

// The weather a run uses. No replay (or { kind: "slider" }): the slider curve, exactly as before.
export function dayWeather(params: SimParams): DayWeather {
  if (params.weather?.kind === "replay") {
    const day = weatherDay(params.weather.weatherDayId);
    if (!day) throw new Error(`unknown weather day: ${params.weather.weatherDayId}`);
    return { at: (hour) => replayAt(day, hour), peakTempC: peakTempOf(day) };
  }
  return { at: (hour) => ({ tempC: temperatureAt(params.peakTempC, hour), humidityPct: params.humidityPct }), peakTempC: params.peakTempC };
}
