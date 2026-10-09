# HeatGate API guide for web developers

This guide is for someone building the HeatGate website who has never seen this repo. It covers
every endpoint, the simulation flow, the rule knobs, how to read a simulation result, the audit log,
the honesty rules the UI must follow, and what each page needs.

All example responses below were captured by running the API (locally on 9 October 2026, with a few
checks against the live API). Long ones are shortened with `…`.

Types come from `contracts/types.ts` (import them as `@heatgate/contracts`). In the web app, pages
never call `fetch`: they use the hooks in `web/src/hooks/`, which call the functions in
`web/src/api.ts`. The examples show the `api.ts` function so you can see what each hook does under the
hood. See [`web/README.md`](../web/README.md) for the hooks.

Contents

1. [Running locally](#1-running-locally)
2. [Endpoints](#2-endpoints)
3. [The simulation flow](#3-the-simulation-flow)
4. [The knobs (HeatGate Fair sandbox)](#4-the-knobs-heatgate-fair-sandbox)
5. [How to read a SimResult](#5-how-to-read-a-simresult)
6. [The audit log](#6-the-audit-log)
7. [Honesty rules for the UI](#7-honesty-rules-for-the-ui)
8. [What the demo needs](#8-what-the-demo-needs)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Running locally

You need Node 20. From the repo root:

```sh
npm install                       # once, installs every workspace
npm start --workspace api         # the API on http://localhost:3001
npm run dev --workspace web       # the website on http://localhost:5173
```

- The API listens on port **3001** (set `PORT` to change it). It prints
  `HeatGate API listening on http://localhost:3001`.
- Locally the API keeps everything **in memory**. Restarting it empties the audit log and forgets all
  simulations.
- The website (Vite) runs on port **5173**.

Website settings. Copy `web/.env.example` to `web/.env`:

| Variable            | Default                 | Meaning                                                                 |
| ------------------- | ----------------------- | ----------------------------------------------------------------------- |
| `VITE_API_URL`      | `http://localhost:3001` | Where the API runs. A trailing `/` is removed.                          |
| `VITE_USE_FIXTURES` | `false`                 | `true` = never call the API; data comes from `web/fixtures/*.json`.     |

The header of the website shows which one is in use ("Data: http://localhost:3001" or "Data: fixtures").
Restart `npm run dev` after changing `.env`.

**The live API** (AWS, ap-south-1):

```
https://p3wu8i2uka.execute-api.ap-south-1.amazonaws.com
```

To point a local website at it:

```sh
# web/.env
VITE_API_URL=https://p3wu8i2uka.execute-api.ap-south-1.amazonaws.com
VITE_USE_FIXTURES=false
```

The live API behaves like the local one, with three differences: it is throttled (10 requests a
second, bursts of 20, shared by everyone), simulations take longer (section 3), and data is kept for
about 30 days. Do not deploy anything from this guide; deploying is in [`docs/deploy.md`](deploy.md).

Quick check that an API is up:

```sh
curl http://localhost:3001/health
# {"status":"ok"}
```

To check every route at once: `npm run smoke` (starts its own server on port 3101), or
`npm run smoke -- --url <ApiUrl>` against a deployed API.

---

## 2. Endpoints

| Method | Path                | What it does                                                   |
| ------ | ------------------- | -------------------------------------------------------------- |
| GET    | `/health`           | Is the API up?                                                 |
| GET    | `/policies`         | The four rule sets with their on-screen labels                 |
| GET    | `/defaults`         | Default simulation settings and default knobs (slider starts)  |
| GET    | `/break-even`       | The pre-computed break-even rest pay report                    |
| GET    | `/weather-days`     | Real hot days a simulation can replay                          |
| GET    | `/audit`            | Logged decisions, filtered and paged                           |
| GET    | `/simulations/:id`  | A simulation job and, when done, its result                    |
| POST   | `/decide`           | One dispatch decision (logged unless `dryRun`)                 |
| POST   | `/policies/render`  | HeatGate Fair rules rendered from knobs (nothing is run)       |
| POST   | `/simulations`      | Start a simulation (answers 202, then you poll)                |

### Errors (all endpoints)

Every error from the API has the same shape:

```json
{ "error": { "code": "INVALID_REQUEST", "message": "riders must be between 1 and 300" } }
```

| HTTP | `code`              | When                                                                      |
| ---- | ------------------- | ------------------------------------------------------------------------- |
| 400  | `INVALID_REQUEST`   | A field is missing, the wrong type, out of range, or unknown              |
| 400  | `INVALID_JSON`      | The body is not valid JSON                                                |
| 400  | `INVALID_POLICY`    | Knobs render rules that fail the Cedar schema check (should not happen)   |
| 404  | `NOT_FOUND`         | Unknown route, unknown simulation id, or no break-even file               |
| 413  | `TOO_LARGE`         | Body over 100 KB                                                          |
| 429  | `TOO_MANY_RUNNING`  | 3 simulations are already queued or running                               |
| 500  | `INTERNAL` / `INVALID_RESULTS` | A bug, or a broken break-even file                             |

One exception: on the **live** API, if you send too many requests per second, API Gateway answers
`429` with its own body `{"message":"Too Many Requests"}` (no `error` object). `api.ts` handles both:
it throws an `ApiRequestError` with `status`, `code` (when the API sent one) and a readable `message`.

Unknown route example (real):

```sh
curl http://localhost:3001/nope
# 404 {"error":{"code":"NOT_FOUND","message":"No route for GET /nope"}}
```

---

### GET /health

**Purpose:** check that the API is running. No parameters.

```sh
curl http://localhost:3001/health
```

```ts
import { health } from "./api";            // no hook; any other call failing with
const { status } = await health();          // "Could not reach the HeatGate API at … Is it running?" tells you the same
// In fixture mode health() answers { status: "ok" } without the network.
```

Response (200):

```json
{"status":"ok"}
```

Errors: none from the API. If nothing answers, the API is not running (section 9).

---

### GET /policies

**Purpose:** the four rule sets with the label to show on screen. Use the label, not the id, in the UI.
The id `no-rules` means "today": voluntary measures only, nothing enforced.

```sh
curl http://localhost:3001/policies
```

```ts
import { policies } from "./api";          // hook: usePolicies()
const list = await policies();
```

Response (200, real):

```json
[
  { "id": "no-rules",      "label": "Today: voluntary measures only (nothing enforced)" },
  { "id": "ndma-2025",     "label": "NDMA advisory rules" },
  { "id": "union-demand",  "label": "Union demand (IFAT)" },
  { "id": "heatgate-fair", "label": "HeatGate Fair" }
]
```

Errors: none.

---

### GET /defaults

**Purpose:** the default simulation settings (`SimParams`) plus the default HeatGate Fair knobs.
Use it as the starting value of every slider. Sending these values back to `POST /simulations` gives
exactly the same result as sending nothing.

```sh
curl http://localhost:3001/defaults
```

```ts
import { defaults } from "./api";          // hook: useDefaults()
const params = await defaults();          // type Defaults = SimParams & { fairKnobs: FairKnobs }
```

Response (200, real):

```json
{
  "seeds": [1, 2, 3, 4, 5],
  "riders": 50,
  "peakTempC": 40,
  "humidityPct": 25,
  "alertLevel": "auto",
  "startHour": 8,
  "endHour": 20,
  "ordersPerHour": 34,
  "shiftHours": { "min": 6, "max": 8 },
  "multiAppPct": 40,
  "feeDemandDropPctPerInr": 1,
  "policyVersions": ["no-rules", "ndma-2025", "union-demand", "heatgate-fair"],
  "economics": {
    "payPerOrderInr": 25,
    "payPerKmInr": 6,
    "dailyTargetShare": 0.9,
    "dailyBonusInr": 150,
    "restPayPerMinuteInr": 1.5,
    "heatFeePerOrderInr": 5
  },
  "pay": {
    "no-rules":      { "paidRest": false, "protectIncentive": false },
    "ndma-2025":     { "paidRest": true,  "protectIncentive": false },
    "union-demand":  { "paidRest": true,  "protectIncentive": true },
    "heatgate-fair": { "paidRest": true,  "protectIncentive": true }
  },
  "fairFeatures": { "heatFee": true, "shadeWaitCountsAsRest": false },
  "fairKnobs": {
    "restHeatC": 38, "workLimitMin": 100, "rushHardLimitMin": 120, "earlyRestMin": 70,
    "shortTripHeatC": 41, "shortTripMaxKm": 3, "extremeHeatC": 46
  }
}
```

Note: the default humidity is **25 %** and the default peak is **40 °C**.

In fixture mode (`VITE_USE_FIXTURES=true`), `web/fixtures/defaults.json` has the same `fairKnobs`.

Errors: none.

---

### GET /break-even

**Purpose:** the pre-computed **break-even rest pay**: the smallest rest pay per minute at which a rule
set's average rider earns at least as much as today (no-rules). This is the headline money result
([`docs/money-model.md`](money-model.md)). It comes from a committed file
(`sim/results/break-even.json`, made by `npm run sim:breakeven`); the API does not run anything.

It covers `union-demand` and `heatgate-fair`, at three demand levels (25, 34 and 50 orders an hour),
over 5 seeds, sweeping rest pay over ₹0, 0.25, 0.5, 0.75, 1 and 1.5 per minute.

```sh
curl http://localhost:3001/break-even
```

```ts
import { breakEven } from "./api";         // hook: useBreakEven()
const report = await breakEven();
```

Response (200, real, shortened: one level, one rule set, two of six rows):

```json
{
  "note": "All rupee amounts are placeholders from interview-pending economics.",
  "generatedAt": "2026-10-09T09:25:22.690Z",
  "params": { "seeds": [1, 2, 3, 4, 5], "riders": 50, "peakTempC": 40, "…": "…" },
  "restPayRatesInrPerMin": [0, 0.25, 0.5, 0.75, 1, 1.5],
  "levels": [
    {
      "ordersPerHour": 34,
      "noRulesAvgEarningsInr": { "mean": 444.42, "min": 420.66, "max": 466.19 },
      "policies": {
        "union-demand": {
          "breakEven": {
            "status": "reached",
            "meanInrPerMin": 0.962,
            "perSeedMinInrPerMin": 0.645,
            "perSeedMaxInrPerMin": 1.173,
            "seedsNotReached": 0
          },
          "rows": [
            {
              "restPayInrPerMin": 0,
              "earningsPctOfNoRules": { "mean": 75.43, "min": 68.54, "max": 85.14 },
              "avgEarningsInr":       { "mean": 334.67, "min": 305.27, "max": 358.14 },
              "lowestRiderInr":       { "mean": 90.61, "min": 66.30, "max": 113.97 }
            },
            "…",
            {
              "restPayInrPerMin": 1.5,
              "earningsPctOfNoRules": { "mean": 113.95, "min": 107.36, "max": 119.71 },
              "avgEarningsInr":       { "mean": 505.85, "min": 500.50, "max": 519.71 },
              "lowestRiderInr":       { "mean": 146.47, "min": 133.93, "max": 162.26 }
            }
          ]
        },
        "heatgate-fair": { "…": "…" }
      }
    }
  ],
  "stale": false
}
```

The real break-even values in the file today (placeholders, quote as ranges):

| Orders / hour | union-demand                         | heatgate-fair                        |
| ------------- | ------------------------------------ | ------------------------------------ |
| 25            | reached: ₹0.25–0.55 per min (mean 0.38) | reached: ₹0.29–0.72 per min (mean 0.48) |
| 34 (default)  | reached: ₹0.64–1.17 per min (mean 0.96) | reached: ₹0.77–1.12 per min (mean 0.94) |
| 50            | not reached: best 90 % of today at ₹1.5 | not reached: best 91 % of today at ₹1.5 |

The per-seed ranges overlap at every demand level, so there is no clear difference between the two
rule sets' break-even rest pay.

How to show it:

- `breakEven.status === "reached"`: show the **range** `perSeedMinInrPerMin`–`perSeedMaxInrPerMin`
  (the mean can be shown next to it, never alone). If `seedsNotReached > 0`, say that some seeds
  never reached it within the sweep.
- `breakEven.status === "notReached"`: say "not reached within the sweep (best:
  `bestEarningsPctOfNoRules` % of today at ₹`atRestPayInrPerMin`/min)".
- `rows` are for a chart: x = `restPayInrPerMin`, y = `earningsPctOfNoRules.mean` with a min–max band,
  and a line at 100 % (= today).
- `stale: true` means the file was made with settings that differ from today's defaults. Show a
  warning ("re-run npm run sim:breakeven before quoting").
- Always show `note`.

Errors:

| HTTP | code              | When                                                        |
| ---- | ----------------- | ----------------------------------------------------------- |
| 404  | `NOT_FOUND`       | `No break-even results yet: run npm run sim:breakeven`      |
| 500  | `INVALID_RESULTS` | The file is not valid JSON                                  |

---

### GET /weather-days

**Purpose:** the real hot days a simulation can replay instead of the slider day. Each is the real
hourly temperature and humidity of one city on one day, from the Open-Meteo historical weather API
(saved once by `npm run fetch-weather` and committed in `sim/data/weather/`; the API and the simulator
never fetch weather). Per city (Delhi, Lucknow, Hyderabad, April-June 2020-2025) there are the 3 days with the
highest peak heat index and the 2 days with the highest peak air temperature (the well-known hot days),
15 days in all. `peakTempC` and `peakHeatIndexC` are the highest of the 24 hourly values. The
heat index is a proxy for outdoor heat stress, not a medical measure.

```sh
curl http://localhost:3001/weather-days
```

```ts
import { weatherDays } from "./api";       // hook: useWeatherDays()
const days = await weatherDays();          // WeatherDaySummary[], for the Simulator's weather-day picker
// In fixture mode weatherDays() returns web/fixtures/weatherDays.json without the network.
```

`WeatherDaySummary` is a web type in `api.ts` (a copy of the one in `sim/weather.ts`, because the web app
only depends on contracts).

Response (200, real, first 3 of 15):

```json
[
  { "id": "delhi-2020-06-19", "city": "Delhi", "date": "2020-06-19", "peakTempC": 40.3, "peakHeatIndexC": 47.3, "source": "Open-Meteo historical weather API" },
  { "id": "delhi-2024-05-26", "city": "Delhi", "date": "2024-05-26", "peakTempC": 46, "peakHeatIndexC": 43.2, "source": "Open-Meteo historical weather API" },
  { "id": "delhi-2024-05-31", "city": "Delhi", "date": "2024-05-31", "peakTempC": 45.9, "peakHeatIndexC": 41.5, "source": "Open-Meteo historical weather API" }
]
```

To replay one, send its id to `POST /simulations`:

```sh
curl -X POST http://localhost:3001/simulations \
  -H 'content-type: application/json' \
  -d '{"seeds":[1],"weather":{"kind":"replay","weatherDayId":"lucknow-2024-05-29"}}'
# 202 {"simulationId":"sim-01M4G3MZ3X0000000000000001","status":"queued"}
```

With a weather day, the simulator reads that day's hourly series (a straight line between hours) and
ignores `peakTempC` and `humidityPct`. `alertLevel: "auto"` uses the day's highest hourly temperature
(1 at 40 °C, 2 at 45 °C): an assumed level, not the real IMD alert for that day. Everything else is
the same. In the web app: `useSimulation().run({ ...params, weather: { kind: "replay", weatherDayId: day.id } })`
(`SimParams.weather` is typed as `WeatherSource` in contracts). An unknown id is a `400`:

```json
{ "error": { "code": "INVALID_REQUEST", "message": "weather.weatherDayId: no weather day \"delhi-2024-06-19\" (see GET /weather-days)" } }
```

---

### POST /decide

**Purpose:** one dispatch decision: "should this rider get this order now, under this rule set?"
Used by the Rider phone page. The decision is written to the audit log unless `dryRun` is `true`.

Body (`DecideRequest`). All fields required except the last two:

| Field                                 | Type                    | Limits                                                    |
| ------------------------------------- | ----------------------- | --------------------------------------------------------- |
| `policyVersion`                       | string                  | `no-rules`, `ndma-2025`, `union-demand`, `heatgate-fair`  |
| `rider.id`                            | string                  | pseudonymous: letters, dash, digits, e.g. `R-014`, `rider-014` (max 20 chars). Names and phone numbers are refused. |
| `rider.vehicle`                       | string                  | `bike`, `cycle`, `ev`                                     |
| `rider.x`, `rider.y`                  | number (km)             | 0–10 (the 10 × 10 km city). Used only to find the nearest cooling point; never stored. |
| `order.id`, `order.zone`              | string                  | 1–64 characters                                           |
| `order.distanceKm`                    | number                  | 0–100 (rounded **up** to a whole km before Cedar)         |
| `order.tripMinutes`                   | number                  | 0–600                                                     |
| `conditions.tempC`                    | number (°C)             | −20 to 60                                                 |
| `conditions.humidityPct`              | number                  | 0–100                                                     |
| `conditions.hourOfDay`                | number                  | 0–23                                                      |
| `conditions.demandLevel`              | 0, 1, 2                 | 0 quiet, 1 normal, 2 rush                                 |
| `conditions.alertLevel`               | 0, 1, 2                 | 0 none, 1 IMD orange, 2 IMD red                           |
| `riderState.minutesSinceBreak`        | number                  | 0–1440                                                    |
| `riderState.exposureMinutesToday`     | number                  | 0–1440                                                    |
| `riderState.restMinutesRemaining`     | number                  | 0–1440                                                    |
| `simulationId` (optional)             | string                  | 1–64 characters                                           |
| `dryRun` (optional)                   | boolean                 | `true` = do not log                                       |

The API computes the heat index from `tempC` and `humidityPct` and rounds it to a whole number.

```sh
curl -X POST http://localhost:3001/decide \
  -H 'content-type: application/json' \
  -d '{
    "policyVersion": "ndma-2025",
    "rider": { "id": "R-015", "vehicle": "bike", "x": 2, "y": 3 },
    "order": { "id": "order-2", "zone": "Z2", "distanceKm": 3.4, "tripMinutes": 20 },
    "conditions": { "tempC": 42, "humidityPct": 30, "hourOfDay": 14, "demandLevel": 2, "alertLevel": 1 },
    "riderState": { "minutesSinceBreak": 80, "exposureMinutesToday": 200, "restMinutesRemaining": 0 }
  }'
```

```ts
import { decide } from "./api";            // hook: useDecide() -> run(req)
const decision = await decide({
  policyVersion: "ndma-2025",
  rider: { id: "R-015", vehicle: "bike", x: 2, y: 3 },
  order: { id: "order-2", zone: "Z2", distanceKm: 3.4, tripMinutes: 20 },
  conditions: { tempC: 42, humidityPct: 30, hourOfDay: 14, demandLevel: 2, alertLevel: 1 },
  riderState: { minutesSinceBreak: 80, exposureMinutesToday: 200, restMinutesRemaining: 0 },
});
```

Response (200, real): three NDMA rules fired; the strongest outcome (`FORCE_REST`) wins and its rule is
listed first. The rider at (2, 3) km is sent to the nearest cooling point.

```json
{
  "decisionId": "01M4G0RJM50000000000000001",
  "at": "2026-10-09T09:43:58.853Z",
  "policyVersion": "ndma-2025",
  "riderId": "R-015",
  "orderId": "order-2",
  "outcome": "FORCE_REST",
  "restMinutes": 15,
  "penaltyWaived": true,
  "heatIndexC": 47,
  "firedRules": ["ndma-break-due", "ndma-peak-hours-pause", "ndma-reduced-radius"],
  "message": "Heat alert: 15-minute cooling break after 90 minutes of work. No penalty and no pay cut.",
  "messages": {
    "hi": "गर्मी की चेतावनी: 90 मिनट काम के बाद 15 मिनट का आराम ब्रेक। कोई जुर्माना नहीं, पैसे नहीं कटेंगे।",
    "te": "వేడి హెచ్చరిక: 90 నిమిషాల పని తర్వాత 15 నిమిషాల విశ్రాంతి బ్రేక్. జరిమానా లేదు, డబ్బు కోత లేదు.",
    "ur": "گرمی کی وارننگ: 90 منٹ کام کے بعد 15 منٹ کا آرام کا وقفہ۔ کوئی جرمانہ نہیں، پیسے نہیں کٹیں گے۔"
  },
  "coolingPoint": { "name": "Cooling point 5", "distanceM": 890 },
  "cedarContext": {
    "heatIndexC": 47, "hourOfDay": 14, "minutesSinceBreak": 80, "exposureMinutesToday": 200,
    "restMinutesRemaining": 0, "tripMinutes": 20, "demandLevel": 2, "alertLevel": 1, "distanceKm": 4
  }
}
```

Two more real examples, shortened:

```json
// no-rules on a cool morning
{ "outcome": "ALLOW", "restMinutes": 0, "penaltyWaived": false, "heatIndexC": 29,
  "firedRules": [], "message": "Order assigned.",
  "messages": { "hi": "ऑर्डर मिल गया।", "te": "ఆర్డర్ మీకు ఇవ్వబడింది.", "ur": "آرڈر مل گیا۔" }, "…": "…" }

// heatgate-fair, 40 °C at 35 % humidity, a 4.1 km order (rounded up to 5)
{ "outcome": "DENY", "restMinutes": 0, "penaltyWaived": true, "heatIndexC": 46,
  "firedRules": ["fair-extreme-heat-stop", "fair-short-trips-only"],
  "message": "Extreme heat. Deliveries paused. Your incentive target is reduced for this time.",
  "messages": { "hi": "बहुत ज़्यादा गर्मी। डिलीवरी रुकी है। …", "te": "తీవ్రమైన వేడి. …", "ur": "شدید گرمی۔ …" }, "…": "…" }
```

What the outcomes mean (show these words to riders):

| `outcome`    | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `ALLOW`      | The order is given to the rider.                                          |
| `SKIP_ORDER` | This order is too far for the heat; the rider stays online for nearer ones. |
| `DENY`       | The rider is paused: no orders for 15 minutes.                            |
| `FORCE_REST` | The rider takes a cooling break of `restMinutes` (15 or 20).              |

`penaltyWaived: true` means declining costs the rider nothing (rating, acceptance rate).
**What the rider is told.** These fields only describe the decision; they never change it.

- `message`: the English text. Always there.
- `messages`: the same text in Hindi (`hi`), Telugu (`te`) and Urdu (`ur`). Every decision has all three today,
  ALLOW included ("Order assigned."). The text is complete: there are no `{placeholders}` to fill in.
  Show Urdu right-to-left (`dir="rtl"`). **The translations are machine-written and not yet checked by a
  native speaker** (`reviewed=false` in `docs/translations/messages.csv`, list in
  `docs/translations/REVIEW.md`); label them "draft translation" on screen until they are reviewed. Still
  treat `messages` and each language as optional: a rule with new English words has no translation until
  someone adds one.
- `coolingPoint`: only on `FORCE_REST`. `name` is the nearest of the city's 8 cooling points (the same
  ones the simulator sends resting riders to, "Cooling point 1" to "Cooling point 8") and `distanceM` is the
  straight-line distance from `rider.x`, `rider.y` in metres, rounded to 10 m. The messages that say
  "Nearest shade and water below" mean this card: show it under the message.

**`coolingPoint` is in the `/decide` response only, never in the audit log.** A distance to a known,
fixed point would say where the rider was, and the log never stores a rider location; `GET /audit` rows
carry `message` and `messages` but no `coolingPoint`. The rider's `x`, `y` are not in either.

Translations live in `docs/translations/messages.csv`. To add or fix one, edit the CSV and run
`npm run export-messages` (it regenerates `engine/src/translations.ts`; `npm run export-messages -- --check`
fails if either file is out of date or a translation is missing).

Errors (real messages):

| HTTP | code              | Example message                                                          |
| ---- | ----------------- | ------------------------------------------------------------------------ |
| 400  | `INVALID_REQUEST` | `rider must be an object` (a missing object)                             |
| 400  | `INVALID_REQUEST` | `rider.id must be a pseudonymous ID like "R-014" (never a name or phone number)` |
| 400  | `INVALID_REQUEST` | `conditions.tempC must be between -20 and 60`                            |
| 400  | `INVALID_REQUEST` | `policyVersion must be one of "no-rules", "ndma-2025", "union-demand", "heatgate-fair"` |
| 400  | `INVALID_REQUEST` | `body must be an object` (sent without `content-type: application/json`) |
| 400  | `INVALID_JSON`    | `Request body is not valid JSON`                                          |

---

### POST /policies/render

**Purpose:** show the HeatGate Fair rules for a set of knob values, before running anything. Returns
the Cedar text, whether it passes the schema check, and one plain-language line per rule. Nothing is
logged or run. Details in section 4.

Body: `{ "knobs": { … } }`. Every knob is optional; missing ones take their default. Only the seven
knob names are accepted, whole numbers only, in the ranges of section 4. Any other field is refused (you
cannot send Cedar text).

```sh
curl -X POST http://localhost:3001/policies/render \
  -H 'content-type: application/json' \
  -d '{"knobs":{"workLimitMin":90,"rushHardLimitMin":90}}'
```

```ts
import { renderPolicy } from "./api";      // hook: useRenderPolicy() -> run(knobs)
const rendered = await renderPolicy({ workLimitMin: 90, rushHardLimitMin: 90 }); // RenderedPolicy
// Fixture mode (VITE_USE_FIXTURES=true) renders the default knobs only (web/fixtures/renderPolicy.json).
// Any other knobs fail with "Rule editing needs the live API: fixture mode only has the default knobs."
```

Response (200, real, `text` shortened):

```json
{
  "knobs": {
    "restHeatC": 38, "workLimitMin": 90, "rushHardLimitMin": 90, "earlyRestMin": 70,
    "shortTripHeatC": 41, "shortTripMaxKm": 3, "extremeHeatC": 46
  },
  "text": "@id(\"base-allow-assign\")\npermit (principal is HeatGate::Rider,\n …\n@id(\"fair-rest-due\")\n@outcome(\"FORCE_REST\")\n@restMinutes(\"20\")\n@message(\"Paid 20-minute cooling break. Nearest shade and water below.\")\nforbid (principal, action == HeatGate::Action::\"AssignOrder\", resource)\nwhen { context.heatIndexC >= 38\n    && context.minutesSinceBreak + context.tripMinutes > 90\n    && context.demandLevel < 2 };\n …",
  "valid": true,
  "errors": [],
  "rules": [
    { "id": "base-allow-assign", "outcome": "ALLOW",
      "summary": "Orders are assigned unless one of the rules below stops them." },
    { "id": "fair-rest-in-progress", "outcome": "FORCE_REST",
      "summary": "A rider on a paid cooling break gets no orders until the break is over." },
    { "id": "fair-rest-early-in-lull", "outcome": "FORCE_REST",
      "summary": "When the heat index is 38 °C or more and orders are slow, a rider who has worked 70 minutes or more since the last break gets a paid 20-minute break." },
    { "id": "fair-rest-due", "outcome": "FORCE_REST",
      "summary": "When the heat index is 38 °C or more, an order that would take a rider past 90 minutes since the last break is held and the rider gets a paid 20-minute break, except at rush hour." },
    { "id": "fair-rest-hard-limit", "outcome": "FORCE_REST",
      "summary": "When the heat index is 38 °C or more, an order that would take a rider past 90 minutes since the last break is held and the rider gets a paid 20-minute break, even at rush hour." },
    { "id": "fair-short-trips-only", "outcome": "SKIP_ORDER",
      "summary": "When the heat index is 41 °C or more, orders over 3 km (rounded up) are skipped; the rider stays online for nearer ones." },
    { "id": "fair-extreme-heat-stop", "outcome": "DENY",
      "summary": "When the heat index is 46 °C or more, deliveries are paused and the incentive target is reduced for that time." },
    { "id": "fair-decline-no-penalty", "outcome": "NO_PENALTY",
      "summary": "When the heat index is 38 °C or more, a rider can decline any order without penalty (not a knob)." }
  ]
}
```

`rules[].outcome` can be `NO_PENALTY`, which is not one of the four decision outcomes; give it its own
neutral style.

Errors (real messages):

| HTTP | code              | Example message                                          |
| ---- | ----------------- | -------------------------------------------------------- |
| 400  | `INVALID_REQUEST` | `knobs.restHeatC must be between 32 and 46`              |
| 400  | `INVALID_REQUEST` | `knobs.restHeatC must be a whole number` (sent 38.5)     |
| 400  | `INVALID_REQUEST` | `knobs.rushHardLimitMin must be at least knobs.workLimitMin` |
| 400  | `INVALID_REQUEST` | `knobs.earlyRestMin must be less than knobs.workLimitMin` |
| 400  | `INVALID_REQUEST` | `unknown field: knobs.foo`                               |
| 400  | `INVALID_REQUEST` | `unknown field: text`                                    |

---

### POST /simulations

**Purpose:** start a simulated day for every chosen rule set, over several seeds. The API answers
**202** at once with an id; you then poll `GET /simulations/:id` (section 3).

Body: any part of `SimParams`. Missing fields take the defaults from `GET /defaults`. Nested objects
(`economics`, `pay`, `fairFeatures`, `shiftHours`, `fairKnobs`) are merged field by field, so you can
send only what changed. An empty body (`{}`) runs the default day.

| Field                      | Type                       | Limits / notes                                                       |
| -------------------------- | -------------------------- | -------------------------------------------------------------------- |
| `seeds`                    | number[]                   | 1–10 whole numbers (0 to 2³¹−1). Default `[1,2,3,4,5]`. More seeds = slower. |
| `riders`                   | number                     | whole, 1–300. Default 50                                             |
| `peakTempC`                | number (°C)                | 20–55. Afternoon peak (3 PM). Default 40                              |
| `humidityPct`              | number                     | 0–100. Default 25                                                     |
| `alertLevel`               | `"auto"`, 0, 1, 2          | `auto`: 1 if peak ≥ 40 °C, 2 if peak ≥ 45 °C. Default `auto`          |
| `startHour`, `endHour`     | number                     | whole; start 0–23, end 1–24, start before end. Default 8 and 20       |
| `ordersPerHour`            | number                     | 0–500. Default 34                                                     |
| `shiftHours.min`, `.max`   | number                     | 1–16, min ≤ max. Default 6 and 8                                      |
| `multiAppPct`              | number                     | 0–100. Default 40 (an assumption, see section 7)                     |
| `feeDemandDropPctPerInr`   | number                     | 0–100. Default 1                                                      |
| `policyVersions`           | string[]                   | non-empty; duplicates removed. Default all four                       |
| `economics.*`              | number                     | 0–100000 each; only the six known fields                              |
| `pay.<policy>.paidRest`, `.protectIncentive` | boolean  | per rule set                                                          |
| `fairFeatures.heatFee`, `.shadeWaitCountsAsRest` | boolean | defaults `true`, `false`                                         |
| `fairKnobs.*`              | whole numbers              | section 4                                                             |
| `weather`                  | object                     | `{"kind":"slider"}` (the default: `peakTempC` + `humidityPct`) or `{"kind":"replay","weatherDayId":"<id from GET /weather-days>"}` |

Unknown fields are refused. Changing `fairKnobs` changes only the `heatgate-fair` run; all chosen rule
sets are still run.

```sh
curl -X POST http://localhost:3001/simulations \
  -H 'content-type: application/json' \
  -d '{"seeds":[1],"peakTempC":44,"fairKnobs":{"rushHardLimitMin":90,"workLimitMin":90}}'
```

```ts
import { createSimulation, waitForSimulation } from "./api";
// hook: useSimulation() -> run(params) does both and polls for you
const { simulationId } = await createSimulation({ ...defaultsFromApi, peakTempC: 44 });
const result = await waitForSimulation(simulationId, { onStatus: (job) => console.log(job.status) });
```

`createSimulation` is typed to take a full `SimParams`; the easy way is to spread the `/defaults`
response and change what the sliders changed. To replay a real day, add
`weather: { kind: "replay", weatherDayId }` with an id from `weatherDays()`; `{ kind: "slider" }` (or no
`weather`) uses the sliders.

Fixture mode (`VITE_USE_FIXTURES=true`) has one simulation result and returns it for every request. For a
replay it still returns that result (its `params` are the fixture's slider day), and the result carries
`fixtureNote`: "Fixture mode ignores the weather day: this is the fixture's slider-day result, not a replay
of `<id>`. Run against the live API to replay a real day." Show `fixtureNote` whenever it is set. An unknown
`weatherDayId` fails with the same `400 INVALID_REQUEST` message as the API.

Response (**202**, real):

```json
{ "simulationId": "sim-01M4FT3N5F0000000000000006", "status": "queued" }
```

Errors (real messages):

| HTTP | code               | Example message                                                             |
| ---- | ------------------ | --------------------------------------------------------------------------- |
| 400  | `INVALID_REQUEST`  | `startHour must be before endHour`                                          |
| 400  | `INVALID_REQUEST`  | `seeds must be a list of 1-10 numbers`                                      |
| 400  | `INVALID_REQUEST`  | `riders must be between 1 and 300`                                          |
| 400  | `INVALID_REQUEST`  | `policyVersions must be a non-empty list`                                   |
| 400  | `INVALID_REQUEST`  | `fairKnobs.workLimitMin must be between 60 and 120`                         |
| 400  | `INVALID_REQUEST`  | `unknown field: color`, `unknown field: economics.tipInr`                   |
| 400  | `INVALID_REQUEST`  | `weather.weatherDayId: no weather day "delhi-2024-06-19" (see GET /weather-days)` |
| 400  | `INVALID_REQUEST`  | `weather.kind must be one of "slider", "replay"`                            |
| 429  | `TOO_MANY_RUNNING` | `3 simulations are already queued or running; try again when one has finished` |

---

### GET /simulations/:id

**Purpose:** the state of a simulation job. While it runs you get the status; when it is done you also
get the full `SimResult` (section 5).

```sh
curl http://localhost:3001/simulations/sim-01M4FT3N5F0000000000000006
```

```ts
import { getSimulation } from "./api";     // hook: useGetSimulation(id)
const job = await getSimulation("sim-01M4FT3N5F0000000000000006");
```

Response while waiting (200, real):

```json
{ "simulationId": "sim-01M4FT4DCG0000000000000009", "status": "queued", "createdAt": "2026-10-09T07:48:06.672Z" }
```

Response when done (200, real, `result` shortened; the full body is about **1.5 MB**):

```json
{
  "simulationId": "sim-01M4FT3N5F0000000000000006",
  "status": "done",
  "createdAt": "2026-10-09T07:47:41.871Z",
  "finishedAt": "2026-10-09T07:47:49.122Z",
  "result": {
    "simulationId": "sim-01M4FT3N5F0000000000000006",
    "params": { "seeds": [1, 2, 3, 4, 5], "…": "…" },
    "runs": {
      "no-rules":      { "metrics": { "…": "…" }, "range": { "…": "…" }, "frames": [ "…144 frames…" ] },
      "ndma-2025":     { "…": "…" },
      "union-demand":  { "…": "…" },
      "heatgate-fair": { "…": "…" }
    }
  }
}
```

Response when failed:

```json
{ "simulationId": "…", "status": "failed", "createdAt": "…", "finishedAt": "…",
  "error": { "code": "SIMULATION_FAILED", "message": "The simulation could not be completed" } }
```

(On the live API, a job stuck for over 15 minutes reads as failed with the message
`The simulation did not finish in time`; see section 3.)

Errors:

| HTTP | code        | Example message                                   |
| ---- | ----------- | ------------------------------------------------- |
| 404  | `NOT_FOUND` | `No simulation with id sim-does-not-exist`        |

A 404 also happens locally after the API restarts (memory is wiped), and on the live API after 30 days.

---

### GET /audit

**Purpose:** the audit log: every logged decision, newest first, one page at a time. Details in
section 6.

Query parameters (all optional, each at most once):

| Param          | Type   | Limits                                                     |
| -------------- | ------ | ---------------------------------------------------------- |
| `rider`        | string | pseudonymous id like `R-014` or `rider-014`                |
| `outcome`      | string | `ALLOW`, `SKIP_ORDER`, `DENY`, `FORCE_REST`                |
| `policy`       | string | one of the four rule set ids                               |
| `simulationId` | string | letters, digits and dashes                                 |
| `limit`        | number | whole, 1–200. Default 50                                   |
| `cursor`       | string | the `nextCursor` of the previous page                      |

```sh
curl 'http://localhost:3001/audit?outcome=FORCE_REST&limit=1'
```

```ts
import { audit } from "./api";             // hook: useAudit(query)
const page = await audit({ outcome: "FORCE_REST", limit: 1 });
const next = page.nextCursor ? await audit({ outcome: "FORCE_REST", limit: 1, cursor: page.nextCursor }) : undefined;
```

Response (200, real, one row from a simulation):

```json
{
  "items": [
    {
      "decisionId": "01KS3FGMX000000000000004BW",
      "at": "2026-05-20T19:59:00.000Z",
      "policyVersion": "union-demand",
      "riderId": "rider-033",
      "orderId": "order-427",
      "simulationId": "sim-01M4FT3K270000000000000005",
      "outcome": "FORCE_REST",
      "restMinutes": 20,
      "penaltyWaived": true,
      "heatIndexC": 36,
      "firedRules": ["union-rest-due"],
      "message": "Heatwave day: paid 20-minute cooling break after 2 hours of work. Nearest shade and water below. No penalty.",
      "messages": {
        "hi": "लू का दिन: 2 घंटे काम के बाद पैसे सहित 20 मिनट का आराम ब्रेक। पास की छाँव और पानी नीचे देखें। कोई जुर्माना नहीं।",
        "te": "వడగాల్పుల రోజు: 2 గంటల పని తర్వాత జీతంతో 20 నిమిషాల విశ్రాంతి బ్రేక్. దగ్గరి నీడ, నీళ్లు కింద చూడండి. జరిమానా లేదు.",
        "ur": "لُو کا دن: 2 گھنٹے کام کے بعد پیسوں کے ساتھ 20 منٹ کا آرام کا وقفہ۔ قریب ترین سایہ اور پانی نیچے دیکھیں۔ کوئی جرمانہ نہیں۔"
      },
      "cedarContext": {
        "heatIndexC": 36, "hourOfDay": 19, "minutesSinceBreak": 209, "exposureMinutesToday": 209,
        "restMinutesRemaining": 0, "tripMinutes": 52, "demandLevel": 0, "alertLevel": 1, "distanceKm": 4
      }
    }
  ],
  "nextCursor": "1"
}
```

No `nextCursor` means this is the last page. Audit rows never have `coolingPoint` (see POST /decide).

Errors (real messages):

| HTTP | code              | Example message                                                   |
| ---- | ----------------- | ----------------------------------------------------------------- |
| 400  | `INVALID_REQUEST` | `outcome must be one of ALLOW, SKIP_ORDER, DENY, FORCE_REST`      |
| 400  | `INVALID_REQUEST` | `policy must be one of no-rules, ndma-2025, union-demand, heatgate-fair` |
| 400  | `INVALID_REQUEST` | `limit must be a whole number from 1 to 200`                      |
| 400  | `INVALID_REQUEST` | `cursor is not valid`                                             |
| 400  | `INVALID_REQUEST` | `rider must be a pseudonymous ID like "R-014" (never a name or phone number)` |
| 400  | `INVALID_REQUEST` | `rider must be given once` (`?rider=R-1&rider=R-2`)               |
| 400  | `INVALID_REQUEST` | `simulationId must be letters, digits and dashes`                 |

---

## 3. The simulation flow

```
POST /simulations ──202──> { simulationId, status: "queued" }
        │
        ▼  poll every 1–2 s
GET /simulations/:id ──> queued ──> running ──> done   (result is in the body)
                                          └──> failed (error is in the body)
```

1. `POST /simulations` with the settings. It answers **202** with `simulationId` and `status: "queued"`.
2. Poll `GET /simulations/:id` every **1–2 seconds**. `api.ts` polls every 1 s (`POLL_INTERVAL_MS`)
   and gives up after 120 s (`SIMULATION_TIMEOUT_MS`). The `useSimulation()` hook does all of this and
   exposes `status`, `elapsedMs` and `cancel()`.
3. Statuses: `queued` (waiting its turn) → `running` → `done` (read `result`) or `failed` (read `error`).
   A fast run can go from `queued` to `done` between two polls, so do not expect to see every status.
4. Show a progress state with the elapsed time while waiting. Keep the previous result on screen until
   the new one is done.

**How long a run takes** (measured 9 October 2026, default settings: 50 riders, 08:00–20:00, all four
rule sets; polling every 0.2 s locally and 1 s live):

| Where                    | 1 seed (`"seeds":[1]`) | 5 seeds (default) |
| ------------------------ | ---------------------- | ----------------- |
| Local (`npm start`)      | 1.8–2.1 s              | 7.4 s             |
| Live API                 | 9.2 s (first run, may include a cold start) | 14.4 s |

The live and local results were identical for the same settings. More riders, more hours or more seeds
take longer. For a quick "drag a slider, see it change" demo, send `"seeds":[1]` and say on screen that
it is one seed; use the default 5 seeds for any number you present.

The result is about 1.5 MB whatever the number of seeds (the frames, which are always one seed, are most
of it). Fetch it once when the status is `done`; don't keep polling after that.

**Limits (429):**

- **`TOO_MANY_RUNNING`**: if 3 simulations are already queued or running, `POST /simulations` answers
  429 with the usual error body. Locally, jobs run one at a time, first in, first out, so the 2nd and
  3rd show `queued` while the 1st runs. Wait for one to finish and try again. Real output when posting
  4 at once:

  ```
  {"simulationId":"sim-01M4FT4DC10000000000000007","status":"queued"} HTTP202
  {"simulationId":"sim-01M4FT4DC90000000000000008","status":"queued"} HTTP202
  {"simulationId":"sim-01M4FT4DCG0000000000000009","status":"queued"} HTTP202
  {"error":{"code":"TOO_MANY_RUNNING","message":"3 simulations are already queued or running; try again when one has finished"}} HTTP429
  ```

  The check is not exact: two requests at the same instant can both get through.
- **Live API throttle**: 10 requests per second, bursts of 20, shared by everyone. Past that you get
  429 `{"message":"Too Many Requests"}`. Polling once a second from a few browsers is fine; a tight loop
  is not.

**Stuck-job rule:** a job created more than **15 minutes** ago that is still `queued` or `running` no
longer counts toward the limit of 3. On the **live API** it also reads as `failed`
(`SIMULATION_FAILED`, "The simulation did not finish in time"): that only happens if the cloud worker
crashed or hit its 600 s limit, which it cannot record itself. Locally a job is never rewritten this
way; restart the API if one seems stuck (section 9). In practice the web app stops waiting after 120 s
anyway.

---

## 4. The knobs (HeatGate Fair sandbox)

Knobs let a judge change the **numbers** in the HeatGate Fair rules (never the rules themselves) and see
the effect. They apply only to `heatgate-fair`; the other three rule sets copy real documents and are
never changed.

| Knob                | Default | Range   | Unit           | What it controls                                                        |
| ------------------- | ------- | ------- | -------------- | ----------------------------------------------------------------------- |
| `restHeatC`         | 38      | 32–46   | °C heat index  | Heat index from which the rest rules apply                              |
| `workLimitMin`      | 100     | 60–120  | minutes        | Minutes since the last break before a paid break (outside rush hour)    |
| `rushHardLimitMin`  | 120     | 90–150  | minutes        | The same limit at rush hour; never later than this. Must be ≥ `workLimitMin` |
| `earlyRestMin`      | 70      | 40–110  | minutes        | Minutes worked after which a slow period triggers an early break. Must be < `workLimitMin` |
| `shortTripHeatC`    | 41      | 36–48   | °C heat index  | Heat index from which long orders are skipped                           |
| `shortTripMaxKm`    | 3       | 1–6     | km             | What counts as a long order (NDMA's radius is 3)                       |
| `extremeHeatC`      | 46      | 42–52   | °C heat index  | Heat index from which all deliveries pause                              |

All knobs are **whole numbers**. A decimal is refused.

**Slider-to-API mapping.** Each slider is one knob; the slider value goes into the request as-is.

- On screen show only **3 sliders**: rest heat (`restHeatC`), work limit (`workLimitMin`) and rush
  hard limit (`rushHardLimitMin`). Leave the rest at the defaults (docs/spec/day3-features.md).
- Set each slider's `min`, `max` and `step={1}` from the table, and its start value from
  `GET /defaults` → `fairKnobs`.
- Mark **NDMA's 90** and the **union's 120** on the work-limit and hard-limit sliders.
- Keep the cross-rules in the UI so the user can't build a refused set: when `workLimitMin` goes above
  `rushHardLimitMin`, raise `rushHardLimitMin` to match (or block the move); keep
  `earlyRestMin < workLimitMin` (at the default 70 this means work limit ≥ 71).
- Send only the knobs: `{ "knobs": { "workLimitMin": 90, "rushHardLimitMin": 90 } }` to render, and
  `{ …params, "fairKnobs": { "workLimitMin": 90, "rushHardLimitMin": 90 } }` to simulate. Missing
  knobs take their default.

Suggested flow:

1. On slider change (debounced, e.g. 300 ms): `POST /policies/render` with the knobs. Show the rules.
2. On "Run": `POST /simulations` with the same knobs as `fairKnobs`, then poll.
3. Compare the `heatgate-fair` run against the others; the other runs do not change with the knobs.

**Showing the rendered rules.**

- `rules[]` is the friendly version: one sentence per rule in file order, with the current numbers
  filled in. Show this by default, with an outcome badge per rule (`NO_PENALTY` needs its own style).
- `text` is the real Cedar code. Show it in a monospace block (`white-space: pre`), for example behind a
  "Show the Cedar code" toggle. To highlight what changed, compare it line by line with the text
  rendered from the defaults (render `{ "knobs": {} }` once at start) and highlight the lines that
  differ.
- `valid` / `errors`: if `valid` is false, show the errors and disable "Run". With knobs in range this
  does not happen, because the API refuses out-of-range values first with a 400; show that 400 message
  next to the slider.
- The last rule ("decline without penalty") always uses 38 °C; it is not a knob.

---

## 5. How to read a SimResult

```ts
interface SimResult {
  simulationId: string;
  params: SimParams;            // the full settings the run used (defaults filled in)
  runs: {                       // one entry per rule set in params.policyVersions
    [policy]: {
      metrics: Metrics;         // the MEAN over the seeds
      range: { [metric]: { min, max } };  // lowest and highest seed
      frames: Frame[];          // first seed only, one every 5 simulated minutes
    }
  }
}
```

`result.params.fairKnobs` is only present if you sent `fairKnobs`.

### Metrics, in plain words

Real numbers below are the default run (5 seeds), `no-rules` → `heatgate-fair`, mean (range).

Safety (the same yardstick for every rule set, whatever its own rule is):

| Metric                 | One sentence                                                                 | Example |
| ---------------------- | ---------------------------------------------------------------------------- | ------- |
| `unsafeExposureMin90`  | Total rider-minutes outdoors at heat index ≥ 38 after 90 minutes without a break (NDMA's limit). | 8762 (8282–9154) → 4175 (3587–5362) |
| `unsafeExposureMin120` | The same, after 120 minutes without a break (the union's limit).             | 8209 → 3734 |
| `restsForced`          | How many cooling breaks the rules ordered.                                   | 0 → 256 |
| `pausedRiderMinutes`   | Total rider-minutes riders were paused (DENY) and could not work.            | 0 → 0 |

Speed:

| Metric               | One sentence                                                                       | Example |
| -------------------- | ---------------------------------------------------------------------------------- | ------- |
| `ordersTotal`        | Orders customers placed (orders lost to the heat fee are not counted).              | 452.8 → 435.8 |
| `ordersDelivered`    | Orders that reached the customer (a delivery under way at the end of the day finishes and counts). | 450.6 → 331 |
| `avgDeliveryMinutes` | Average minutes from order placed to delivered.                                    | 27.7 → 41.7 |
| `p90DeliveryMinutes` | 9 in 10 delivered orders arrived within this many minutes.                          | 40.4 → 62.6 |
| `ordersLate`         | Orders delivered after 45 minutes, plus orders nobody took within 30 minutes.       | 27.6 → 234.6 |

Money (all placeholders, section 7):

| Metric                   | One sentence                                                                 | Example |
| ------------------------ | ---------------------------------------------------------------------------- | ------- |
| `avgEarningsPerRiderInr` | What the average rider earned that day: order pay + bonus + rest pay.        | ₹444 → ₹498 |
| `minEarningsPerRiderInr` | What the lowest-earning rider earned (see below).                            | ₹91 (48–131) → ₹144 (108–163) |
| `incentiveHitRatePct`    | The % of riders who reached their daily bonus target.                        | 55.2 → 61.2 |
| `restPayTotalInr`        | The total paid for rest minutes across all riders.                           | ₹0 → ₹7217 |
| `heatFeeCollectedInr`    | The total heat fee customers paid (HeatGate Fair only).                      | ₹0 → ₹1442 |
| `earningsPctOfNoRules`   | The average rider's earnings as a % of today's (no-rules) on the same seed.  | 100 → 112.1 (107.3–119.1) |
| `decisions`              | How many times each outcome was decided (one order can be asked of several riders, so this is bigger than the order count). | `{ "ALLOW": 331, "SKIP_ORDER": 539.2, "DENY": 0, "FORCE_REST": 256 }` |

Metrics are means over seeds, so counts can have decimals (e.g. 452.8 orders). Round for display.

**`earningsPctOfNoRules`.** 100 means "earns the same as today", above 100 more, below 100 less.
`no-rules` is always exactly 100. It is computed per seed then averaged, and `range` gives the lowest and
highest seed. At the default placeholder rest pay (₹1.5/min) a rest pays more per hour than delivering,
so the safer rule sets come out above 100 almost by construction. Do not lead with it; lead with the
break-even rest pay (`GET /break-even`) instead (docs/money-model.md).

**The "lowest-earning rider" (`minEarningsPerRiderInr`).** The earnings of the single worst-paid rider
in the day, among riders who were on shift at least **2 hours**. Short-shift riders are left out because
someone who logs in just before the day ends earns little for that reason, not because of the rules.
The average still counts every rider. It answers "did the rules leave anyone badly off?" Show it as a
range across seeds; it moves a lot from seed to seed (no-rules: ₹48–131).

### Ranges across seeds

Each seed is a different random day (different riders, orders and positions); every rule set sees the
same days. `metrics` is the mean, `range[metric]` the lowest and highest seed. Show both, e.g.
"4175 (3587–5362)". **If two rule sets' ranges overlap on a metric, say "no clear difference"** instead
of ranking them. With a single seed, `min === max === mean`; say "1 seed" on screen.

### Frames: animating riders on the map

`frames` is one seed (the first) only, one frame every 5 simulated minutes from `startHour`. The default
day (08:00–20:00) has 144 frames, minutes 0 to 715.
No orders are offered after `endHour`, but a rider on a delivery at that moment finishes it (and is paid
for it) after the last frame: those drop-offs count in the metrics, not in the frames.

```json
{
  "minute": 300,                    // minutes since startHour (300 = 13:00 with startHour 8)
  "heatIndexC": 40,
  "demandLevel": 0,                 // 0 quiet, 1 normal, 2 rush
  "riders": [
    { "id": "rider-001", "x": 5.93, "y": 8.02, "state": "resting" },
    { "id": "rider-002", "x": 8.01, "y": 3.38, "state": "resting" }
  ],
  "events": [
    { "riderId": "rider-011", "outcome": "ALLOW", "rule": "" },
    { "riderId": "rider-019", "outcome": "FORCE_REST", "rule": "fair-rest-due" }
  ]
}
```

- **Map:** the city is 10 × 10 km; `x` and `y` are km from 0 to 10. Scale to your map size
  (`px = x / 10 * width`). Treat it as an abstract city, not a real map.
- **Riders come and go.** A frame lists only riders on shift at that moment (2 at 08:00, at most 25 at
  once in the default day, out of 50). Key riders by `id`: add a dot when an id appears, remove it when
  it disappears.
- **Animation:** play frames in order (e.g. 1 frame per 100–200 ms) and tween each rider from its
  position in this frame to the next one. Show the clock as `startHour + minute / 60`.
- **State colour:** `idle`, `delivering`, `resting`, `paused` (`RiderState`). Resting riders sit at a
  cooling point.
- **`events`** are the decisions made since the previous frame. `rule` is the winning rule id, or `""`
  for `ALLOW`. Use them for flashes on the map or a ticker ("rider-019: cooling break (fair-rest-due)").
- `heatIndexC` and `demandLevel` per frame make a good heat / demand strip under the map.
- Rider ids in frames match the audit log: `GET /audit?simulationId=<id>&rider=rider-019`.

---

## 6. The audit log

The audit log holds:

- **Live decisions** from `POST /decide` (without `dryRun`). These have no `simulationId` and `at` is the
  real time.
- **Simulation trails**: when a simulation finishes, part of its decisions are added, tagged with its
  `simulationId`. Only the **first seed**, and per rule set every non-ALLOW decision plus 1 in 20 ALLOWs,
  at most 3000 per rule set (a default run adds about 4000 rows). `at` is **simulated** time on
  2026-05-20, not when you ran it. Only the last **5** simulations' trails are kept; older ones are
  dropped.

**Filters.** `rider`, `outcome`, `policy` and `simulationId` can be combined; each narrows the list.
For a "this run" view always pass `simulationId`. For the live Rider phone history, filter by `rider`.

**Paging.** Pages come newest first, `limit` rows each (default 50, max 200). If the response has
`nextCursor`, pass it back as `cursor` with the **same filters** to get the next page. Treat the cursor
as an opaque string (it is a number locally and a different key in the cloud). No `nextCursor` = last
page. A "Load more" button that appends pages is the simplest UI.

```ts
let cursor: string | undefined;
do {
  const page = await audit({ simulationId, limit: 200, cursor });
  rows.push(...page.items);
  cursor = page.nextCursor;
} while (cursor);
```

Do not re-sort mixed live and simulation rows by `at`: simulation rows carry simulated time.

**`auditRowKey`.** Use `auditRowKey(decision)` (exported from `web/src/hooks`) as the React `key`:

```ts
import { auditRowKey } from "../hooks";
rows.map((d) => <AuditRow key={auditRowKey(d)} decision={d} />);
```

It returns `` `${simulationId ?? ""}:${decisionId}` ``.

**Why decision ids repeat across simulations.** A simulation's decision ids are built from the
simulated clock (always 2026-05-20) plus a counter that starts again for every run. Two runs with the
same settings therefore produce the same ids: for example, two default runs both start their trail with
`01KS3FGMX00000000000000T0P`. A `decisionId` alone is only unique within one simulation; the pair
(`simulationId`, `decisionId`) is unique, which is what `auditRowKey` uses.

**Showing a row.** Show time, rider id, rule set label, outcome badge, the first fired rule, the message
(with a language switch for `messages`, marked as draft translations) and the heat index. Simulation
rows carry the same `messages` the rider would have seen. A FORCE_REST row can say "sent to the nearest
cooling point", but not which one: the log does not keep it. `cedarContext` holds the exact rounded inputs, so a "details" panel can show why the
decision was made. Never show or ask for names or phone numbers; rider ids are pseudonymous, and that is
probably still personal data under DPDP, so don't make them look like real people.

---

## 7. Honesty rules for the UI

These are not optional. Judges and riders will read the numbers.

1. **Every rupee amount is a placeholder.** Pay per order (₹25), per km (₹6), the bonus (₹150), rest pay
   (₹1.5/min) and the heat fee (₹5) are not from rider interviews yet. Label every screen with money on
   it, e.g. "₹ amounts are placeholders until rider interviews". `GET /break-even` gives you the exact
   `note` text.
2. **Never show a single rupee figure for break-even.** Show the range across seeds
   ("₹0.77–1.12 per minute, placeholder pay") and the demand level it is for. If it was not reached, say
   so. Show `stale` warnings.
3. **Show ranges across seeds, not a single number.** Mean plus min–max for every metric. If ranges
   overlap, say "no clear difference". If the run used 1 seed, say so.
4. **The 40 % multi-app assumption must be visible next to the safety numbers.** The simulator assumes
   `multiAppPct` = 40 % of riders keep working on another app while they rest or are paused here, so
   their heat exposure keeps counting. It is not measured. Show it near `unsafeExposureMin90/120`, e.g.
   "Assumes 40 % of riders work another app during breaks (to confirm with riders)", using the value
   from `result.params.multiAppPct`.
5. Also say, where relevant:
   - Heat index is a proxy for outdoor heat stress, **not a medical measure**.
   - The alert level is **assumed** from the peak temperature (`alertLevel: "auto"`), not a real IMD alert.
   - Rider login times are an assumption (two waves, 08:00–09:00 and 15:00–18:00).
   - The heat fee is a hypothesis: customers may order less (`feeDemandDropPctPerInr`).
   - If `fairFeatures.shadeWaitCountsAsRest` is on, say so wherever results are shown (it assumes
     restaurants have shade for riders, which is unverified).
   - Call `no-rules` by its label, "Today: voluntary measures only (nothing enforced)".

---

## 8. What the demo needs

| Page / mode         | Route (web)  | Endpoints                                                                 | Hooks                                         |
| ------------------- | ------------ | ------------------------------------------------------------------------- | --------------------------------------------- |
| **Simulator** (sandbox) | `/simulator` | `GET /defaults` (slider starts), `GET /policies` (labels), `POST /policies/render` (knobs), `POST /simulations` + `GET /simulations/:id` (run), `GET /weather-days` (weather-day picker) | `useDefaults`, `usePolicies`, `useRenderPolicy`, `useSimulation`, `useWeatherDays` |
| **Compare**         | `/compare`   | `GET /policies`, `POST /simulations` + `GET /simulations/:id` (or a finished id), `GET /break-even` (headline money result) | `usePolicies`, `useSimulation` / `useGetSimulation`, `useBreakEven` |
| **Audit**           | `/audit`     | `GET /audit` (filters + cursor), `GET /policies` (labels)                 | `useAudit`, `usePolicies`, `auditRowKey`      |
| **Rider phone**     | `/rider`     | `POST /decide` (one decision for the shown rider), `GET /audit?rider=…` (their recent decisions), `GET /policies` | `useDecide`, `useAudit`, `usePolicies` |
| **Presenter mode**  | not built yet | Everything above, read-only: a finished `GET /simulations/:id` (map + numbers), `GET /break-even`, `GET /audit?simulationId=…`. Start the run before the talk so nothing waits on stage. | as above |

Demo-day checklist:

- [ ] `GET /health` answers on the API you will use (live URL or localhost).
- [ ] `GET /break-even` answers 200 with `stale: false`.
- [ ] One default 5-seed simulation finished; note its `simulationId` as a backup.
- [ ] `VITE_USE_FIXTURES=true` build ready as a fallback if the network fails.
- [ ] Placeholder labels, seed ranges and the 40 % multi-app note are visible (section 7).
- [ ] Nobody else is hammering the live API (shared 10 requests/second limit and 3 running simulations).

---

## 9. Troubleshooting

**"Could not reach the HeatGate API at http://localhost:3001. Is it running?"**
The API is not running, or `VITE_API_URL` points elsewhere. Start it with `npm start --workspace api`
and check `curl http://localhost:3001/health`. If you changed `web/.env`, restart `npm run dev`. To work
without any API, set `VITE_USE_FIXTURES=true`.

**CORS error in the browser console.**
The API allows every origin (`Access-Control-Allow-Origin: *`) and the `content-type` header, for `GET`,
`POST` and `OPTIONS`, both locally and live. If you still see a CORS error:
- the request probably never reached the API (wrong `VITE_API_URL`, a typo, `http` vs `https`, or a
  trailing path like `/api`), or the API is down. A failed request often shows up as "CORS" in the
  browser even though the real problem is that nothing answered;
- only send `content-type: application/json` as a custom header (other headers are not allowed live).
Check with `curl -i <url>/health`.

**429.**
- Body `{"error":{"code":"TOO_MANY_RUNNING",…}}`: 3 simulations are queued or running. Wait for one to
  finish (poll it), then try again. Don't auto-retry in a loop; show "busy, try again in a moment".
- Body `{"message":"Too Many Requests"}` (live only): more than 10 requests a second across everyone.
  Slow down polling (1–2 s), debounce sliders, and don't fire requests on every render.

**A job stuck as `queued`.**
Locally, jobs run one at a time, so `queued` usually just means another job is running; it should start
when that one finishes (a default run takes about 7 s). If it never moves, the API process probably
crashed or was restarted (memory is wiped, so you then get 404); restart the API and run again. On the
live API, a job older than 15 minutes reads as `failed`. The web app gives up after 120 s with
"did not finish within 120 seconds".

**`404 NOT_FOUND` for a simulation id that worked before.**
The local API restarted (memory store), or the live result is older than 30 days. Run it again.

**`404` from `GET /break-even`.**
The results file is missing. Run `npm run sim:breakeven` at the repo root (and redeploy for the live API).

**`400` from a request.**
Read `error.message`: it names the field and the allowed range. Unknown fields are refused on purpose
(including a misspelt one).
