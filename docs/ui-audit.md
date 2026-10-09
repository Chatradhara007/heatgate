# UI audit: `ui-implementation` (teammate UI) against `main` (9 Oct 2026)

Audited commit `b323ff2` (branch `ui-implementation`). The UI ran against `main`'s API (`3c5d2c0`) from a separate
clean checkout. **Merging `main` into `audit-ui` was not done.** It conflicts in `web/src/api.ts` (see B1), and this
session was not allowed to edit code. So `audit-ui` = `ui-implementation` + this report. Screenshots:
`docs/ui-audit/` (`live-*` = real local API, `fixtures-*` = `VITE_USE_FIXTURES=true`, `deadapi-*` = API unreachable).

## Verdict

1. **No, the UI does not match the backend.** About half of what is on screen is hard-coded: the heat-sweep chart,
   the Cedar viewer, the selected-rider card, the audit sample rows, the Compare deltas, the phone texts and
   the cooling points. Only the comparison matrix, the map frames, `/decide` and `/audit` are wired, and some of those badly.
2. **Not demo-ready.** `npm run build --workspace web` fails (5 tsc errors), so `deploy:web` cannot ship it. Merging main
   conflicts. Several screens make claims that `docs/pitch-numbers.md` forbids.
3. Risk 1: **made-up numbers shown as results.** "HeatGate (32h) vs NDMA (64h) vs Union (72h), 73% safer", "−79.2%" and
   "+₹25 / rider (+3.0%)" (the real figure is −30%), plus ranges invented as ±10% of the mean.
4. Risk 2: **silent fallback to fixtures.** When the API is down or errors, every call quietly returns fixture data and a
   simulation "succeeds", with no error shown. The header always says "Hybrid", even when the API is live.
5. Risk 3: **privacy and rule violations.** A real-looking name ("R-014 · Rahul K."), the abstract city drawn onto a
   real Hyderabad street map with invented named cooling points, and cooling-point locations in the audit view.
   There is no Urdu, no "draft translation" label and no 40% multi-app note.

## Blockers (the demo would break or mislead)

| # | Where | What is wrong | Exact fix | Time | Owner |
|---|---|---|---|---|---|
| B1 | `web/src/api.ts` (merge with main) | `git merge origin/main` conflicts in `createSimulation`/`getSimulation`. HEAD wraps every call in a try/catch fixture fallback; main added `fixtureCreateSimulation`/`fixtureSimulation`, `renderPolicy`, `weatherDays`, `health` and `Defaults`. Without the merge the UI has no `/weather-days`, `/policies/render`, `useRenderPolicy`, `useWeatherDays` or `fixtureNote`. | Merge main, take **main's** `api.ts` whole, and delete the hybrid fallback (see B3). | 30 min | FRONTEND |
| B2 | `web/src/theme.ts:92,146-148`, `web/tailwind.config.ts:37` | `tsc` fails: duplicate keys `surface`, `sm`, `md`, `lg` (overwritten by the spread), and a `readonly` tuple passed to tailwind `fontSize`. `npm run build -w web` exits 1, so `npm run deploy:web` fails. (`vite build` on its own works.) | Remove the duplicate literal keys, or put the spread first. Drop `as const` on `fontSizes`, or type it as `Record<string, [string, {...}]>`. | 15 min | FRONTEND |
| B3 | `web/src/api.ts:121-131` and every `catch` that calls `logHybridFallback`; `web/src/Layout.tsx:17-18` | Any API error (500, 400, 429 `TOO_MANY_RUNNING`, network) returns fixtures as if they were live. With the API down, "Run Simulation" ends with fixture results and no error (`deadapi-desktop-simulator-after-run.png`). `isBackendConnected` is a module `let`, not React state, so the header shows "Backend: Hybrid (Local Fallback Ready)" even when live (`live-desktop-simulator.png`). | Remove the fallback: errors must reach `error` in the hooks. Fixtures only when `VITE_USE_FIXTURES=true`. Header: "Live: <API_URL>" or "Fixture data", from `USE_FIXTURES` plus a `health()` call in a hook. | 45 min | FRONTEND |
| B4 | `web/src/components/BottomCards.tsx:56-175` | The "Heat Sweep" chart is a hand-drawn SVG with invented values: Voluntary 118h, Union 72h, NDMA 64h, HeatGate 32h, "73% safer cap", "holds … under 35h". That is claims 1 and 2 of "must NOT make" (Fair safer than NDMA, Fair beats union) shown as data. | Delete the card. If you want a sweep later it needs real runs at several `peakTempC` values. Until then, use that slot for the knob-rendered rules (B6). | 10 min | FRONTEND |
| B5 | `web/src/components/BottomCards.tsx:178-216` | The "Rule Source (Cedar Policy)" panel is fake Cedar (`Action::"Dispatch"`, `context.heat_index`, `peak-halt-override >= 48`), with tabs that do nothing and "Validated AST · Verified Deterministic". Judges reading Cedar will see that it is not our policy. | Show `POST /policies/render` → `rules[]` with outcome badges, and `text` behind a "Show the Cedar code" toggle (api-guide §4). Use `useRenderPolicy` after the merge. For NDMA/union, show the real file text or drop those tabs. | 1.5 h | FRONTEND |
| B6 | `web/src/components/BottomCards.tsx:11-19,240,262,284` | The knob sliders use wrong ranges: restHeatC 32–44 (real 32–46), workLimitMin 60–**150** (real 60–120), rushHardLimitMin **80–180** (real 90–150). Defaults are hard-coded instead of `GET /defaults` → `fairKnobs`. The cross-rules are not enforced. An out-of-range value gives a 400 on Run, and that 400 is then hidden by B3. The 90/120 markers are centred text, not at their real slider positions. | `min/max/step=1` from the api-guide §4 table. Start values from `defaults.fairKnobs`. Raise `rushHardLimitMin` when `workLimitMin` passes it, and keep `earlyRestMin < workLimitMin`. Debounced render; show the API 400 message next to the slider. | 1 h | FRONTEND |
| B7 | `web/src/components/SelectedRiderCard.tsx:28-129` | The whole card is static: "R-014 · **Rahul K.**" (a real-looking name, against the CLAUDE.md DPDP rule), 18:42 countdown, "Heat index ≥ 42°C … exceeds 90 minutes" (Fair is 38 °C / 100 min). "Heat index" shows `params.peakTempC`, which is air temperature. "Cooling Point 3, 420 m · Begumpet Bus Shelter Hub". "Open in Audit Log" is `href="#"`. | Drive it from a real frame event (`frames[i].events` with outcome ≠ ALLOW) plus `GET /audit?simulationId=&rider=` for the message and `cedarContext`. No name, no avatar initials, no cooling-point name (the audit has none). Link to `/audit?simulationId=…&rider=…`. | 2 h | FRONTEND |
| B8 | `web/src/pages/AuditPage.tsx:46-393,450-456,524` | Default filters are rider `R-014` + FORCE_REST + Fair. Real ids are `rider-NNN`, so live `/audit` returns 0 rows and the page falls back to 10 invented `SAMPLE_DECISIONS`, even after a real run (`live-desktop-audit-after-run.png`). The samples show "Cooling Point 3, 420 m", but the audit log never has a cooling point (api-guide §6). The "Simulation" dropdown lists made-up runs ("2024-05-24 Peak Heatwave (Hyderabad)", l.471) that send no `simulationId`. | Delete `SAMPLE_DECISIONS` and the fallback. Default filters: none, plus `simulationId` = the active run when one exists. Simulation options: "This run (<id>)" and "All". Show a real empty state when 0 rows. | 1 h | FRONTEND |
| B9 | `web/src/pages/ComparePage.tsx:47,89-90,161,187-190,231,354`; `web/src/context/SimulationContext.tsx:83-170` | Hard-coded "−79.2%" (the actual result is −62.6%), "+₹25 / rider (+3.0%)" while the bars show ₹714 → ₹499, and a "Fee covers the pay" badge plus "+-₹1,940 net surplus" while the fee is lower than the pay. "₹12.5 = 1250 paise" (uses `Math.abs`). "almost completely eliminated". The context invents fallbacks (`?? 5640`, `?? 820`, ranges = mean ±10% at l.118, `\|\| 68.2`), so a metric of 0 shows a made-up number. | Compute every delta from `runs[*].metrics` and `range`; no literals. Delete all `??`/`\|\|` numeric fallbacks: show "—". Badge text from the sign. Drop "almost completely eliminated". | 1.5 h | FRONTEND |
| B10 | `web/src/components/ScenarioBar.tsx:88-106` | "Hyderabad Replay · 42.6°C · May 19 Actual" is not a replay. It sets slider weather 43 °C/28% with **alertLevel 1** forced, which reads as a real IMD alert (must-NOT claim 5). No such day exists in `/weather-days`. | Replace it with a picker from `useWeatherDays()` that sends `weather: { kind: "replay", weatherDayId }`, labelled "alert level assumed from peak temperature, not the real IMD alert". | 1 h | FRONTEND |
| B11 | `web/src/components/RiderPhoneDevice.tsx:35-124` | The phone ignores `decision.message`/`messages` and renders its own invented EN/HI/TE strings. No Urdu, no "draft translation" label. It promises things the engine does not ("Your rating is safe", "daily target is reduced"). When `/decide` has no `coolingPoint` it falls back to "Cooling Point 3 · 420 m", and coolingPoint is only filled in for FORCE_REST. | Title and body = `decision.message` / `decision.messages.{hi,te,ur}` with an EN/हिं/తె/اردو switch (Urdu `dir="rtl"`) and a "Draft translation, not reviewed by a native speaker" tag. Show the cooling point only if `decision.coolingPoint` is set. | 1.5 h | FRONTEND |
| B12 | `web/src/components/CitySimulation.tsx:23-32,66-156,207` | The abstract 10 × 10 km city is projected onto real Begumpet streets (OSM tiles), with 8 invented named cooling points ("Secunderabad Clock Tower", "Water refill + shade mister"). It looks like real rider tracking at real places (api-guide §5: "Treat it as an abstract city, not a real map"). Leaflet comes from unpkg at runtime: here the CDN was blocked and the map rendered **empty** on the default "Real Map" tab (`live-desktop-simulator.png`). | Make "Sim Grid" the only view. Remove Leaflet, the `<script>` in `index.html`, `COOLING_POINTS` names and lat/lng. Show cooling points only where the sim defines them (positions from `sim/`, unnamed). | 45 min | FRONTEND |

## Should fix

1. **Ranges / seeds.** `PolicyComparisonMatrix.tsx:82` hard-codes "n=5 seeds". The initial result is the 1-seed
   fixture (`range` min = max), so "5,673–5,673" is shown as a range. Use `params.seeds.length` and say "1 seed" when it is 1. FRONTEND.
2. **Money ranges missing.** `PolicyComparisonMatrix.tsx:57` replaces the min–max with "[placeholder]" for ₹ rows, but
   `minEarningsPerRiderInr` must show its range. Show `₹x (min–max), placeholder`. `earningsPctOfNoRules` is not shown anywhere. FRONTEND.
3. **"No clear difference"** is never shown. Compare `range` overlaps per metric (api-guide §5) in the matrix and on Compare. FRONTEND.
4. **40% multi-app note is missing** everywhere. Add "Assumes {params.multiAppPct}% of riders work another app
   during breaks (to confirm with riders)" under the unsafe-minutes rows (`PolicyComparisonMatrix.tsx` safety section)
   and on Compare card 5. FRONTEND.
5. **Compare page is two rule sets, not four**, and has no break-even (`useBreakEven` is never used). Add the four-column
   view and a break-even chart: per demand level, mean (min–max) ₹/min, "placeholder pay", the "not reached" cases, and
   the `stale` warning. No single rupee figure. Also: Unsafe bars clip at `maxAxisValue: 80` h (baseline is 94.5 h);
   compute the axis from the data. FRONTEND.
6. **Unlabelled rupee amounts.** `RiderPhonePage.tsx:246` "₹1.5/min" and `Matrix` cell values (labelled only by a grey
   "[placeholder]" tag) are OK-ish. "+₹25" and the Compare card values are the worst; label them all "placeholder", and read ₹1.5 from `params.economics`. FRONTEND.
7. **Simulation flow.** Polling, the timeout and unmount-abort are fine (`useSimulation`, 1 s polls, 6.3 s local run,
   progress banner "running, N s"). Missing: no Cancel button, no 429 message (B3 swallows it), and `fixtureNote` is not shown
   (needs B1). The 1.2 MB fixture `simResult.json` is statically imported (`SimulationContext.tsx:5`), so it is always in
   the main bundle (1.16 MB JS) and shown at start as if live. Start empty, or label it "example run (fixture)". FRONTEND.
8. **Audit table.** `key={row.id}` (`AuditPage.tsx:916`) uses `decisionId`, which repeats across runs: use `auditRowKey`.
   There is no cursor paging ("Load more" with `nextCursor`). Several outcomes are filtered client-side only (one is sent).
   The rider input queries on every keystroke (add a 300 ms debounce). `auditError` is never shown. FRONTEND.
9. **Audit fallbacks invent data.** `mapDecisionToAudit` (`AuditPage.tsx:402-443`) fills a missing `cedarContext`
   with 44 °C / 105 min / 13 h and a missing message with generic text. Show "—". No Urdu tab and no "draft" label (l.1033-1068). FRONTEND.
10. **Fake state frames on the live page.** "Preview State" toggle and "State Variants (Specification Frames)"
    (`AuditPage.tsx:625-673,1280-1383`) render design-spec mockups, including a fake "STATUS 503". Remove them; wire
    the real `loading`/`error`/empty states. FRONTEND.
11. **Rider page.** The rider picker uses ids that don't exist (`R-014`, `RiderPhonePage.tsx:43,99-102`; use
    `rider-NNN`). "Penalty waived: YES (Safe)" is hard-coded (l.239): read `decision.penaltyWaived`. The board mode ignores the API
    entirely. The "latency" chip times the fallback. The `/decide` requests are fine (`dryRun: true`). FRONTEND.
12. **Map animation.** 1 frame per second at 1x (`CitySimulation.tsx:61`) means the 144-frame day takes 2.4 min. "1 sec = 1 min"
    (l.289) is wrong: 1 frame = 5 sim minutes. No tweening. Only `events[0]` is shown. When there are no events the ticker shows a
    fake "R-014 FORCE_REST … Cooling Point 3 assigned (420m)" (l.380-385). FRONTEND.
13. **Dead UI.** Header language switch EN/हिं/తె does nothing (`Layout.tsx:66-76`). "P presenter · 1-6 scenes" hint has no
    handler. "Earnings vs exposure" toggle, the Cedar tabs and "Active Policy Engine: HeatGate Fair v2.1" are inert. FRONTEND.
14. **Alert-level control** (`ScenarioBar.tsx` Knob 3) lets judges force alert 1/2. Label it "assumed, not IMD". FRONTEND.
15. **Footer** "Heat thresholds are placeholders pending expert review" is wrong for NDMA/union (they copy real documents).
    Say "HeatGate Fair thresholds…". "Institutional Research Sandbox · v0.9.4" is invented. FRONTEND.
16. **No-rules label**: `PolicyComparisonMatrix.tsx` header says "Today: Voluntary Measures (nothing enforced)". Use
    `POLICY_LABELS` / `usePolicies()` rather than retyping labels (also in `AuditPage.tsx:395-400`). FRONTEND.

## Nice to have

- Phone width (390 px): the top disclaimer banner wraps into a 6-line column (`live-phone-simulator.png`). The matrix
  needs a horizontal scroll with no hint. FRONTEND.
- Many 10–11 px texts (`text-[10px]`, `text-[11px]`) and grey-on-cream (`#6E7977` on `#FAF9F5`) are too small for a projector. Use 14 px minimum on demo screens. FRONTEND.
- Accessibility: outcome is shown by colour plus text (good). The language and scenario buttons lack `aria-pressed`/`aria-checked`. The map SVG
  has no text alternative. Sliders have no `aria-label`/`<label>`. No dark mode (fine). FRONTEND.
- Dead code: `PolicySandbox_code.html`, the two PDFs and `designs/*.png` at the repo root (2.5 MB). `recharts` is a dependency but is never
  imported. `usePolicies`, `useBreakEven`, `useGetSimulation`, `useCreateSimulation` are unused. Four copies of the outcome-badge styles
  (`OutcomeBadge.tsx` exists but is unused). FRONTEND.
- Tests: no tests for the hooks or the pages. `web/tests` only exists on main. `web/scripts/make-fixtures.ts` is not in
  `web/tsconfig.json` `include`, so tsc never checks it. Add one render test per page with fixtures. EITHER.
- Leaflet from a CDN (`index.html:14-15`) is an undeclared runtime dependency (CLAUDE.md: say why). Moot if B12 is fixed. FRONTEND.

## Feature status

| Item | Status | Evidence |
|---|---|---|
| Simulator: controls | Partial | Temp/humidity/alert sliders work. Scenario cards set params. No seeds or riders control. |
| Simulator: run + progress | Done | `POST /simulations` then 1 s polls, banner "Running Simulation (running, 1 s)", 6.3 s local (`live-desktop-simulator-running.png`). |
| Simulator: live map / animation | Partial | Plays `frames`, but on a real Hyderabad map (blank when the CDN is blocked). Wrong speed label, no tween (B12, S12). |
| Simulator: results, all four rule sets | Partial | The matrix shows four columns from `runs`. Hard-coded "n=5", no overlap, no 40% note. |
| Simulator: weather picker | Missing | Fake "Hyderabad Replay" (B10). No `/weather-days` call. |
| Simulator: rule knobs | Partial | Three sliders, wrong ranges, no `/defaults` knobs, no `/policies/render` (B5, B6). |
| Compare: four rule sets side by side | Missing | Baseline vs Fair only (`ComparePage.tsx:29-94`). |
| Compare: ranges | Partial | Whiskers from `range`, but hard-coded deltas (B9). |
| Compare: break-even chart, no single figure | Missing | `useBreakEven` is unused. |
| Audit: filters | Partial | rider/outcome/policy sent. simulationId only for "Active Run". Defaults hide all real rows (B8). |
| Audit: paging | Missing | No `nextCursor` handling. |
| Audit: expandable row (rule + messages HI/TE/UR/EN) | Partial | Side panel with winner, rules and inputs. No Urdu, no draft label, invented fallbacks. |
| RiderPhonePage | Partial | 360 × 800 frame, language switch, calls `/decide`, but shows its own text, not `decision.messages` (B11). |
| Presenter mode | Missing | Only the header hint "P presenter · 1-6 scenes". No key handler. |
| Error / loading states | Partial | Simulator has both. Others are hidden by the B3 fallback. Audit states are fake frames. |
| Empty states | Missing | Audit shows samples instead of empty. Matrix/map empty states never appear (fixture preloaded). |
| 3-minute demo without typing | Missing | No scripted scenes or presenter flow. |

## Who should fix what

- **FRONTEND:** B1–B12, Should fix 1–16, all Nice to have except tests.
- **BACKEND:** none required. Optional: give `/decide` a `coolingPoint` only on FORCE_REST (already true, confirm in
  the api-guide example), and expose the sim's cooling-point positions (e.g. in `GET /defaults`) if the map should draw them.
- **EITHER:** hook/page tests, and a small CI step that runs `npm run build -w web` so B2 cannot happen again.

## Deploy readiness

- `VITE_API_URL` must be the stack's `ApiUrl` output (HTTPS API Gateway URL, no trailing slash needed, `api.ts`
  strips it). `scripts/deploy-web.ts` (main) sets it and `VITE_USE_FIXTURES=false`, builds, then `aws s3 sync web/dist`: the
  right folder. An HTTP S3 page calling an HTTPS API is not mixed content: fine. Fonts and CDN are HTTPS: fine.
- Deep links: `template.yaml` `WebBucket` has `IndexDocument` and `ErrorDocument: index.html`, so `/audit` and refresh load the app
  (with HTTP status 404, which browsers ignore; no problem for the demo). No page needs anything S3 can't serve.
- Blocked today by B2 (build fails) and B1 (`deploy-web.ts` only exists on main).
- With B3 unfixed, a wrong `VITE_API_URL` on the live site would look like it works (fixtures). Fix B3 before deploying.

## Run notes

- `npm install`: ok. `npm test`: 12 files, 101 tests pass (none cover web pages or hooks on this branch).
- `npm run build --workspace web`: **fails** (B2). `tsc -p web/tsconfig.json`: the same 5 errors.
- Console: no React errors. The only failures were unpkg Leaflet (blocked by this sandbox's network: the venue may
  block it too) and StrictMode-aborted duplicate requests (harmless).
- Pages make no direct `fetch`/axios calls. No hard-coded API URL or port outside `api.ts`. No secrets or AWS URL in `web/`.
- First paint about 1 s locally. The simulator opens on the fixture result with an empty map (CDN) and a wall of placeholders.
  A judge sees "Backend: Hybrid (Local Fallback Ready)" and "Rahul K." first.

## Questions for you

1. Merge strategy for B1: OK to take main's `api.ts` whole and drop the "hybrid fallback" (my recommendation), or do you want an
   explicit, labelled "offline demo" switch?
2. Should the real-map view go entirely (my recommendation), or stay with a large "illustrative, not real places" label and unnamed points?
3. Keep the "Normal / Heatwave" preset cards? If yes, which `peakTempC`/humidity should "Heatwave" be: 44/45 (current) or the 40/25 default day the pitch sheet uses?
4. Is presenter mode in scope for the teammate before the demo, or will you drive the demo by hand from the three pages?
