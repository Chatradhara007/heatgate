# Final audit before the demo

Branch `final-audit`, from `main` at 4f08ece. Run on 2026-10-11 in a cloud sandbox:
the local API (`npm start --workspace api`, in-memory store) on :3001 and the web dev server
(`VITE_API_URL=http://localhost:3001`) on :5173. Browser checks used the Playwright install already
on the machine (Chromium 1194), at 1440 × 900 and 390 × 844. Nothing was deployed and no
dependencies were added. `contracts/` and `policies/` were not touched.

Screenshots are in [`final-audit/`](final-audit/). Shots were taken after the two fixes below. The
sandbox has no access to OpenStreetMap, so `sandbox-citymap-*.png` shows the City map drawn on
**stubbed grey tiles** (the test served a blank tile). This proves the label and attribution, not the
real tiles.

**Result: 46 checks. 43 PASS, 1 FAIL (open), and 2 FAIL that are now fixed.** Three more findings (B–D) are
listed under "Open items"; they are not failed checks.

## 1. Build and tests

| # | Check | Result |
|---|---|---|
| 1.1 | `npm install` | PASS |
| 1.2 | `npm test`: 24 files, 267 tests (re-run after the fixes) | PASS |
| 1.3 | `npm run typecheck` (root, engine, sim, api) | PASS |
| 1.4 | `npm run build --workspace web` (tsc + vite) | PASS |
| 1.5 | `npm run export-messages -- --check` (13 messages, 13 not reviewed yet) | PASS |
| 1.6 | `scripts/pitch-numbers.test.ts`: docs/pitch-numbers.md is not stale | PASS |

## 2. Backend (local API)

| # | Check | Result |
|---|---|---|
| 2.1 | `npm run smoke` (its own server on :3101): every check passes | PASS |
| 2.2 | `npm run smoke -- --url http://localhost:3001` (the running API): 42 checks pass | PASS |
| 2.3 | Priority: ndma-2025 with 3 rules firing gives `FORCE_REST`, winner `ndma-break-due` listed first | PASS |
| 2.4 | Priority: DENY + SKIP gives `DENY` (`ndma-peak-hours-pause` first) | PASS |
| 2.5 | Priority: SKIP alone gives `SKIP_ORDER`, `penaltyWaived: true` | PASS |
| 2.6 | `/decide` returns the **nearest** cooling point: checked at 5 positions against `cityLayout().coolingPoints` (distance rounded to 10 m) | PASS |
| 2.7 | Audit rows for those decisions have no `coolingPoint`, `x`, `y`, `lat`, `lng`, `location`, `pos` or `position` key | PASS |
| 2.8 | fairKnobs out of range give 400 with a clear message: `workLimitMin=200` → "fairKnobs.workLimitMin must be between 60 and 120"; `restHeatC=10`; `shortTripMaxKm=2.5` → "must be a whole number" | PASS |
| 2.9 | `GET /weather-days` lists 15 days | **FAIL**: it lists **9** (see open item A) |
| 2.10 | A run id that is gone gives 404 `NOT_FOUND` | PASS |
| 2.11 | A 4th run while 3 are queued or running gives 429 `TOO_MANY_RUNNING` | PASS |

## 3. Demo flow in a browser (each at 1440 px and at 390 px; all passed at both widths)

| # | Check | Result |
|---|---|---|
| 3.1 | Policy Sandbox: Normal Day preset runs (5 seeds, 4–8 s) | PASS |
| 3.2 | Heatwave Day preset runs | PASS |
| 3.3 | Replay a real day (hyderabad-2024-05-27) runs; the picker lists the 9 days | PASS |
| 3.4 | Each of the 3 fairKnob sliders moved once: the rules re-render with no error, then re-run | PASS |
| 3.5 | City map with no tile access: falls back to the grid and says "the map tiles could not be loaded" | PASS |
| 3.6 | City map (stubbed tiles): "Illustration: positions are simulated" and the OSM attribution are shown | PASS |
| 3.7 | Grid / City map toggle goes back to the grid | PASS |
| 3.8 | Platform View: all four rule sets have tiles; 12 range bars; "≈" where ranges overlap | PASS |
| 3.9 | Page links keep `?run=` | PASS |
| 3.10 | Rider View, all 4 presets: EN/HI/TE/UR messages differ, "Draft" only on the translations | PASS |
| 3.11 | Rider View: the rest decision shows a cooling point ("Cooling point 6, 1940 m away") | PASS |
| 3.12 | Rider View: the five-phone board renders | PASS |
| 3.13 | Audit Log: rows load (20) and "Load more" adds 20 more | PASS |
| 3.14 | Audit Log: every row shows the rule that fired. Non-allowed rows show the winning rule id. Allowed rows showed a bare "—". | FAIL → **fixed** (b66116e) |
| 3.15 | Reload keeps the run | PASS |
| 3.16 | `?run=<unknown id>`: one clear error, 1 GET, no reload loop | PASS |
| 3.17 | API stopped with a page open: within 15 s the badge says "API unreachable" | PASS |
| 3.18 | API stopped, all 4 pages loaded fresh: red badge, an error on each page, 0 requests for fixtures, no result numbers | PASS |
| 3.19 | No horizontal page scroll on any page at 390 px (`scrollWidth` = viewport) | PASS |
| 3.20 | Screenshots of every page at both widths in `docs/final-audit/` | PASS |

## 4. Honesty

| # | Check | Result |
|---|---|---|
| 4.1 | Traced to the API JSON (`GET /simulations/:id`, Heatwave run): NDMA delivered **158** (138–173) = `runs["ndma-2025"].metrics.ordersDelivered` 158.4, range 138–173 | PASS |
| 4.2 | Fair unsafe min >90 **4,175** (3,587–5,362) = `unsafeExposureMin90` 4174.8 | PASS |
| 4.3 | Union earnings **113.9%** (107.4–119.7%) = `earningsPctOfNoRules` 113.95 | PASS |
| 4.4 | Rider View "Cooling point 6 · **1940 m** away", "**20 min**" rest = `POST /decide` `coolingPoint.distanceM` 1940, `restMinutes` 20 | PASS |
| 4.5 | Audit row "19:57 · rider-035 · HeatGate Fair · Allowed · **32°**" = `GET /audit?limit=20` `items[0]` (at 19:57Z, heatIndexC 32) | PASS |
| 4.6 | The 40% multi-app assumption, "₹ amounts are placeholders" and "alert level assumed" are on screen on every page. Before: no 40% on Rider View and Audit Log; on Platform View "assumed" was only behind an (i). | FAIL → **fixed** (081c5d8) |
| 4.7 | Placeholder pay is never shown as real earnings: every ₹ metric is under "placeholder pay" labels; break-even shows ranges, not a single price | PASS |
| 4.8 | None of the 6 "must NOT" claims appears in `web/`: every grep hit is a disclaimer ("not yet checked by a native speaker", "not a real IMD alert", "not evidence that riders earn more") or the `verified_user` icon name | PASS |
| 4.9 | Pitch scenario (Heatwave preset = the default day: 40 °C, 25%, alert auto, 50 riders, 34 orders/h, 5 seeds): all 20 Platform View values (delivered, unsafe >90 and >120, earnings %, lowest-earning rider, each with its range) match docs/pitch-numbers.md exactly | PASS |

## Fixes made (one commit each, re-checked)

1. **081c5d8 `web/src/Layout.tsx`**: the header banner now shows all three caveats on every page:
   "₹ amounts are placeholders · Assumes 40% of riders work another app (while resting) · Alert level
   assumed (, not a real IMD alert)". The 40 comes from the run on screen, or from `GET /defaults`,
   so it is never hard-coded. With the API down it reads "Multi-app share assumed". At 390 px it wraps
   to 3 short lines. Re-checked on all 4 pages at both widths.
2. **b66116e `web/src/pages/AuditPage.tsx`**: allowed rows say "none: allowed" in the Rule column, not
   "—". Re-checked with each outcome filter: every non-allowed row shows a rule id
   (`fair-rest-due`, `fair-short-trips-only`, …).

## Open items (not fixed)

| ID | Finding | Severity |
|---|---|---|
| A | `GET /weather-days` has **9** days, not 15. `scripts/fetch-weather.ts` picks up to 5 days per city (3 by heat index + 2 by air temperature, without duplicates) for 3 cities. After duplicates are removed, 9 are left, and all of `sim/data/weather/`, the pitch sheet and the UI agree on 9. Adding days means fetching new weather and regenerating the pitch numbers, so this is your call. If "15" is in your script or slides, change it to 9. | Should fix (wording, not code) |
| B | Audit Log at 390 px: Outcome, Rule and Heat are off to the right of the table. You have to scroll the table sideways to see them. The page itself does not scroll sideways. A card layout for phones is a bigger change. | Should fix |
| C | Only the last 5 runs keep an audit trail (`MAX_AUDITED_SIMULATIONS = 5`). After 5 more runs, an older run's "This run" filter in the Audit Log is empty. This is expected, but on stage: run the demo run last, or do not run more than 5 runs before showing the Audit Log. | Cosmetic (demo note) |
| D | Platform View at 390 px: the break-even table is wider than the card. It scrolls inside the card. The page does not scroll sideways. | Cosmetic |

Note on "Not allowed" (DENY): in the browser this filter returned 0 rows. That is correct: the 5 audited runs
were on the Hyderabad 38 °C replay day, where no DENY rule fires. DENY was checked through the API (2.4).

## Check by hand on the live site

- The real OpenStreetMap tiles load on the City map (here they were blocked and stubbed), with the
  "Illustration: positions are simulated" label and the OSM attribution showing.
- `npm run smoke -- --url <deployed ApiUrl>` passes against the deployed API.
- The deployed web app's badge says "Live API (<deployed url>)", not localhost or fixtures.
- On the deployed API: one Heatwave run takes a reasonable time with cold starts. Its Platform View
  numbers match docs/pitch-numbers.md (default day).
- A `?run=` link still opens after an API redeploy (DynamoDB keeps runs for 30 days).
- The Noto fonts for Hindi, Telugu and Urdu load. In this sandbox the font CDN was blocked, so the
  scripts used fallback fonts.
- Audit Log on the live API: rows from live `/decide` calls and from runs mix as expected. "Load more"
  works with the DynamoDB cursor.
- The 429 guard on the deployed API (template.yaml throttling plus `MAX_ACTIVE_SIMULATIONS`): try not
  to trigger it on stage.
