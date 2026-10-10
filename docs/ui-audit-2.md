# UI audit 2: `ui-fix-2` against `docs/ui-audit.md` (10 Oct 2026)

Audited `42b0a51` (`ui-fix-2`) on branch `audit-2`. Only code change: the "Heatwave Day" preset is now
40 °C, 25 %, alert auto, the backend default day (`web/src/components/ScenarioBar.tsx:13`).

The live local API (`npm start -w api`, memory store) and `vite` were driven with Playwright in Chromium at 1440 px and
390 px. Flow: Heatwave preset, run (5 seeds, about 10 s), play the map, replay `delhi-2020-06-19`, set the work limit to
110 min (rules and Cedar re-render, rush limit follows), run again, Compare, the rider card's audit link, a FORCE_REST
row in Urdu, Load more, the rider phone (4 inputs + five phones). Then the same pages with the API stopped.

## Verdict

**Demo-ready on desktop. Not on a phone.** Every Blocker is fixed. On screen the numbers come from the API and match
`docs/pitch-numbers.md` (default day: unsafe >90 NDMA 3,825, union 4,710, Fair 4,175). Errors are visible:
API down → "API unreachable" header + messages. No console errors.

Still broken:
1. **No navigation below 768 px.** `web/src/Layout.tsx:62` is `hidden md:flex`, and there is no menu button. At 390 px
   you can only reach another page through the rider card's audit link or by typing a URL.
2. **A page reload loses the run.** Results live only in React state (`web/src/context/SimulationContext.tsx:25`). Typing
   `/compare` or refreshing shows "No results yet", so on a phone (see 1) Compare is unreachable with data.
3. **The matrix colours NDMA red whatever the numbers** (`web/src/components/PolicyComparisonMatrix.tsx:174,198,214,230,288`):
   for example NDMA's 36.1 min delivery time is red while union's 47.1 is not. That reads as "NDMA is worse",
   which is close to must-NOT claim 1. Colour by value or not at all.

## Blockers

| # | Status | Evidence |
|---|---|---|
| B1 merge / api.ts | Fixed | main's `api.ts` (`weatherDays`, `renderPolicy`, `health`, `fixtureNote` at `web/src/api.ts:93,184`). No hybrid fallback. |
| B2 build | Fixed | `npm run build -w web` and `npm run typecheck` pass. |
| B3 silent fallback | Fixed | `Layout.tsx:12-20` header from `useDataSource`. API stopped: "API unreachable (http://localhost:3001)" plus "Could not load the default settings…". |
| B4 fake heat sweep | Fixed | Gone from `BottomCards.tsx`. |
| B5 fake Cedar | Fixed | `BottomCards.tsx:59-112` = `POST /policies/render` rules with badges, plus a Cedar toggle. Checked: work limit 110 appears in the Cedar text. NDMA/union tabs dropped, with a note at l.111. |
| B6 knob ranges | Fixed | `BottomCards.tsx:15-33` uses the API ranges and keeps the cross-rules. Start values come from `/defaults` (100/120/38). Debounced render l.51-57. Errors l.81-109 block Run (l.60, 171). Marks are at their real positions (l.153). |
| B7 selected rider | Fixed | `SelectedRiderCard.tsx:19-108`: a real frame event plus its audit row (rider-011, fair-rest-due, cedarContext). No name. Link `/audit?simulationId=&rider=` works. |
| B8 audit samples | Fixed | `AuditPage.tsx:51-97`: no samples, filters from the URL, "This run (<id>)" option, real empty state l.182-195. |
| B9 compare literals | Fixed | `ComparePage.tsx:14-39,80-90`: every value and delta comes from `runs[*]`. "No clear difference" on overlap. The context has no `??` fallbacks. |
| B10 fake replay | Fixed | `ScenarioBar.tsx:60-91` picker from `/weather-days` (9 days), sends `kind: "replay"`. The "assumed, not IMD" text is at l.119-123. |
| B11 phone text | Fixed | `RiderPhoneDevice.tsx:33-90`: shows `decision.message` / `messages.{hi,te,ur}`, Urdu RTL, draft label, cooling point only when sent. |
| B12 real map | Fixed | `CitySimulation.tsx`: abstract SVG grid. No Leaflet in `index.html`, no named points. |

## Should fix

| # | Status | Evidence / what is left |
|---|---|---|
| 1 seeds | Fixed | `PolicyComparisonMatrix.tsx:67,80-89`. |
| 2 money ranges | Fixed | `PolicyComparisonMatrix.tsx:57` "₹min–₹max placeholder". `earningsPctOfNoRules` is on Compare (`ComparePage.tsx:185`), not in the matrix. |
| 3 no clear difference | Partly | On Compare (`ComparePage.tsx:37`). Not in the matrix. |
| 4 40 % note | Fixed | `PolicyComparisonMatrix.tsx:83`, `ComparePage.tsx:116-118`. |
| 5 four rule sets + break-even | Still broken | Compare is still no-rules vs Fair only (`ComparePage.tsx:14,76`), and there is no break-even view (`useBreakEven` is unused). The bar axis now comes from the data (l.201): fixed. |
| 6 unlabelled ₹ | Fixed | Every ₹ is tagged placeholder. The rider page has no ₹. |
| 7 sim flow | Partly | Errors (including 429) reach the banner (`SimulatorPage.tsx:42-46`). Still no Cancel button. `fixtureNote` is never rendered. The fixture is no longer in the bundle (341 kB JS). |
| 8 audit table | Fixed | `auditRowKey` l.85,213. Cursor "Load more" (50 → 100 checked). 300 ms debounce l.57-60. All filters sent. |
| 9 audit fallbacks | Fixed | Raw `cedarContext`. Urdu tab + draft label l.271-296. |
| 10 fake state frames | Fixed | Removed. |
| 11 rider page | Fixed | `rider-NNN` ids, `decision.penaltyWaived` (`RiderPhonePage.tsx:217`). The board makes 5 real `/decide` calls (ALLOW, DENY, FORCE_REST, DENY, FORCE_REST). |
| 12 map animation | Fixed | 200 ms/frame (`CitySimulation.tsx:12`), so a 144-frame day takes about 29 s. CSS tween l.101, up to 4 events, no fake ticker. |
| 13 dead UI | Fixed | Language switch, presenter hint and engine version string removed. |
| 14 alert label | Fixed | `ScenarioBar.tsx:160`. |
| 15 footer | Fixed | `Layout.tsx:93`. |
| 16 retyped labels | Partly | Audit and Compare use `POLICY_LABELS`. The matrix headers are still typed in (`PolicyComparisonMatrix.tsx:102-108`). |

## "Claims we must NOT make" against the on-screen text (all pages, both widths)

1. Fair safer than NDMA: not claimed in text. But see the hard-coded NDMA red (Verdict 3).
2. Fair beats union: not claimed. Compare shows only Fair vs today.
3. Single break-even rupee figure: none on screen.
4. Union earns more: the matrix shows union ₹506 vs today ₹444, tagged "placeholder" but with no earnings caveat. The
   caveat ("not evidence that riders earn more") is only on Compare.
5. Real IMD alerts: OK. Both weather notes say "assumed … not the real IMD alert". The picker lists "Lucknow 2024-05-29"
   with that note.
6. Translations checked: OK. Every hi/te/ur view carries "Draft translation, not yet checked by a native speaker".

## 390 px

The pages have no horizontal scroll (the matrix scrolls inside its own box). Problems: no navigation (Verdict 1). The top
banner still wraps into 6 lines (`Layout.tsx:25-40`). The map's clock box overlaps the "Heat index" badge
(`CitySimulation.tsx:111-124`).

## Minor

- With the API down, the simulator says "Press Run Simulation below", but there is no Run button (`params` is unset).
- The map's first frames show 2 riders (the others are not working yet). Expected, but a judge may ask.

## Run notes

`npm install` ok. `npm test`: 23 files, 261 tests pass. `npm run typecheck` and `npm run build -w web` pass, both before
and after the preset change.
