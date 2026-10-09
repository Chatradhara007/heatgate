// One-off: fetches real hourly weather from the Open-Meteo historical archive (free, no key) and saves the
// hottest days per city as sim/data/weather/<id>.json. Commit those files: the simulator never fetches.
// Run from the repo root: npm run fetch-weather
//
// One request per city covers every April-June in YEARS. Days are ranked by their peak heat index
// (engine heatIndexC: a proxy for outdoor heat stress, not a medical measure); peak temperature breaks ties.
// The top DAYS_PER_CITY days that are at least MIN_GAP_DAYS apart are saved, so they are separate heat events.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { heatIndexC } from "../engine/src/heatIndex.ts";

const CITIES = [
  { slug: "delhi", city: "Delhi", lat: 28.6139, lng: 77.209 },
  { slug: "lucknow", city: "Lucknow", lat: 26.8467, lng: 80.9462 },
  { slug: "hyderabad", city: "Hyderabad", lat: 17.385, lng: 78.4867 },
];
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const MONTHS = [4, 5, 6]; // April-June: the pre-monsoon heatwave season
const DAYS_PER_CITY = 3;
const MIN_GAP_DAYS = 3;
const SOURCE = "Open-Meteo historical weather API";
const OUT = join(import.meta.dirname, "..", "sim", "data", "weather");

interface ArchiveResponse {
  latitude: number;
  longitude: number;
  timezone: string;
  hourly: { time: string[]; temperature_2m: (number | null)[]; relative_humidity_2m: (number | null)[] };
}

interface Day {
  date: string;
  hourly: { hour: number; tempC: number; humidityPct: number }[];
  peakTempC: number;
  peakHeatIndexC: number;
}

function archiveUrl(lat: number, lng: number): string {
  const q = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: `${YEARS[0]}-01-01`,
    end_date: `${YEARS[YEARS.length - 1]}-12-31`,
    hourly: "temperature_2m,relative_humidity_2m",
    timezone: "Asia/Kolkata",
  });
  return `https://archive-api.open-meteo.com/v1/archive?${q}`;
}

// Whole days only: 24 hours, no missing values, in the chosen months.
function toDays(r: ArchiveResponse): Day[] {
  const byDate = new Map<string, Day["hourly"]>();
  r.hourly.time.forEach((time, i) => {
    const t = r.hourly.temperature_2m[i];
    const h = r.hourly.relative_humidity_2m[i];
    const date = time.slice(0, 10);
    if (!MONTHS.includes(Number(date.slice(5, 7)))) return;
    const hours = byDate.get(date) ?? [];
    byDate.set(date, hours);
    if (t !== null && h !== null) hours.push({ hour: Number(time.slice(11, 13)), tempC: t, humidityPct: h });
  });
  return [...byDate]
    .filter(([, hourly]) => hourly.length === 24)
    .map(([date, hourly]) => ({
      date,
      hourly,
      peakTempC: Math.max(...hourly.map((x) => x.tempC)),
      peakHeatIndexC: Math.max(...hourly.map((x) => heatIndexC(x.tempC, x.humidityPct))),
    }));
}

function pick(days: Day[]): Day[] {
  const ranked = [...days].sort((a, b) => b.peakHeatIndexC - a.peakHeatIndexC || b.peakTempC - a.peakTempC);
  const chosen: Day[] = [];
  const dayNo = (d: Day) => Date.parse(d.date) / 86_400_000;
  for (const d of ranked) {
    if (chosen.length === DAYS_PER_CITY) break;
    if (chosen.every((c) => Math.abs(dayNo(c) - dayNo(d)) >= MIN_GAP_DAYS)) chosen.push(d);
  }
  return chosen;
}

mkdirSync(OUT, { recursive: true });
for (const c of CITIES) {
  const url = archiveUrl(c.lat, c.lng);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${c.city}: HTTP ${res.status} from ${url}\n${await res.text()}`);
  const data = (await res.json()) as ArchiveResponse;
  const days = toDays(data);
  console.log(`${c.city}: ${days.length} whole days in months ${MONTHS.join(",")} of ${YEARS[0]}-${YEARS[YEARS.length - 1]}`);
  for (const d of pick(days)) {
    const id = `${c.slug}-${d.date}`;
    const file = {
      id,
      city: c.city,
      date: d.date,
      lat: data.latitude, // the grid cell Open-Meteo used (near the requested city centre)
      lng: data.longitude,
      source: SOURCE,
      url,
      timezone: data.timezone,
      license: "CC BY 4.0, weather data by Open-Meteo.com",
      fetchedAt: new Date().toISOString().slice(0, 10),
      hourly: d.hourly,
    };
    writeFileSync(join(OUT, `${id}.json`), JSON.stringify(file, null, 1) + "\n");
    console.log(`  ${id}: peak ${d.peakTempC.toFixed(1)} °C, peak heat index ${d.peakHeatIndexC.toFixed(1)} °C`);
  }
}
console.log(`Saved to ${OUT}. List any new file in sim/data/weather/index.ts and commit them; the simulator reads them offline.`);
