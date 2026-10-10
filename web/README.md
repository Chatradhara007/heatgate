# HeatGate web app

Vite + React + TypeScript + Tailwind. It shows the HeatGate API: the Simulator (sandbox),
Compare, Audit and Rider phone pages.

**Start with the [API guide](../docs/api-guide.md)**: every endpoint with real example requests and
responses, the simulation flow, the knobs, how to read a `SimResult`, the audit log, the honesty rules
for the UI and which page needs which endpoint.

**Before putting a number on screen or in the pitch, check the [pitch numbers sheet](../docs/pitch-numbers.md)**:
the results with their seed ranges, the claims we can and cannot make, and the caveats.

## Run it

From the repo root:

```sh
npm install                       # once, installs every workspace
npm start --workspace api         # the API on http://localhost:3001 (the api workspace has no "dev" script yet)
npm run dev --workspace web       # the web app on http://localhost:5173
```

Settings (copy `web/.env.example` to `web/.env`):

| Variable            | Default                 | Meaning                                                    |
| ------------------- | ----------------------- | ---------------------------------------------------------- |
| `VITE_API_URL`      | `http://localhost:3001` | Where the API runs                                         |
| `VITE_USE_FIXTURES` | `false`                 | `true` = no API needed; data comes from `web/fixtures/*.json` |

The header shows which one is in use ("Data: http://localhost:3001" or "Data: fixtures").

Other scripts (`--workspace web`):

- `npm run build --workspace web`: typecheck, then a production build in `web/dist/`
- `npm run typecheck --workspace web`
- `npm run fixtures --workspace web`: regenerate `web/fixtures/` from a real 1-seed, 20-rider,
  08:00–21:00 simulation plus real engine decisions. Only needed when the contracts change.

## Teammate zone

**You edit only `web/src/pages/` and `web/src/components/`.** Everything else is plumbing that
must stay in step with `contracts/types.ts` and the API; ask before changing it.

- **Data: use the hooks** from `src/hooks/index.ts`. Never call `fetch` (or import `api.ts`) in a
  page or component. `src/api.ts` is the only file that talks to the network.
  - `usePolicies()`, `useDefaults()`, `useAudit(query)`, `useGetSimulation(id)`: load on mount and
    return `{ data, loading, error, reload }`.
  - `useDefaults()` returns the default `SimParams` plus `fairKnobs`, the starting values for the knob sliders.
  - `useWeatherDays()` loads the real hot days a simulation can replay (`GET /weather-days`), for the
    Simulator's weather-day picker. Each has `id`, `city`, `date`, `peakTempC`, `peakHeatIndexC`, `source`.
  - `useDecide()`, `useCreateSimulation()`, `useRenderPolicy()`: run on demand. They return
    `{ data, loading, error, run }`. `useRenderPolicy().run(knobs)` renders the heatgate-fair rules for
    those knobs (debounce slider moves). In fixture mode only the default knobs render; any other knobs
    give the error "Rule editing needs the live API".
  - `useSimulation()`: `run(params)` starts a simulation and polls it every second (120 s timeout).
    It returns `{ data, loading, error, status, simulationId, elapsedMs, run, resume, cancel }`, and
    `status` goes `idle` → `queued` → `running` → `done` or `failed`. `resume(id)` polls a run started
    earlier; `cancel()` stops polling and goes back to `idle`.
  - The active run lives in `context/SimulationContext.tsx`. A finished run's id goes into the URL
    (`?run=<id>`) and localStorage, and is fetched again on load, so reloads and links like
    `/compare?run=<id>` show the same data.
  - `usePolicyLabels()`: the rule-set labels from `GET /policies` (`label(id)`, `short(id)`, `list`).
    Use it for every on-screen rule-set name.
    To replay a real day, pass `weather: { kind: "replay", weatherDayId: day.id }` in `params`;
    `{ kind: "slider" }` (the default) uses `peakTempC` and `humidityPct`. In fixture mode a replay returns
    the one fixture result with `data.fixtureNote` saying the weather day was ignored: show it.
  - Always handle all three states. `components/AsyncView.tsx` does loading and error for you.
- **City map.** The simulator's map has two views: "City map" (the default) and the grid
  (`components/LeafletCityMap.tsx`, Leaflet bundled from npm and loaded lazily, OpenStreetMap tiles with
  their attribution). The 10 × 10 km grid is drawn as a square centred on the run's city (the weather day's
  city; Hyderabad for the slider day). Riders come from the frames; cooling points are read from the frames
  too (`lib/cityMap.ts`) and labelled "CP 1"–"CP 8" only. The result has no hubs, so none are drawn. The map
  always carries the "Illustration: …" label. If no tile loads within 4 s (or several fail), it switches back
  to the grid and says why. The viewer's Grid / City map choice is remembered in localStorage;
  `?view=grid` or `?view=map` in the URL forces a view (handy for a demo).
- **Look: use the tokens** in `src/theme.ts` through Tailwind classes (`bg-surface`, `text-ink-muted`,
  `p-md`, `gap-lg`, `rounded-lg`, `font-display`, …). Outcome colours: `bg-outcome-allow`,
  `bg-outcome-skip-order`, `bg-outcome-deny`, `bg-outcome-force-rest` (or `outcomeColors` from
  `theme.ts` for recharts). Do not hard-code hex colours.
- **Types** come from `@heatgate/contracts` (`SimResult`, `Decision`, `Metrics`, …).
- **Money** is a placeholder (`SimParams.economics`); show it as such. Heat index is a proxy for
  outdoor heat stress, not a medical measure.
- Rider IDs are pseudonymous. Never show or ask for names or phone numbers.
- Charts: `recharts` is installed. No other new dependencies without asking.
- Each page in `src/pages/` is a placeholder that already calls its hooks. Replace the markup freely,
  keep the hooks.
