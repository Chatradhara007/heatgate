# Day 3 features (build only after Day 2 works)

Stand-out features (Day 3)
Three features turn a good demo into a memorable one: judges change the rules themselves, the numbers come from a real heatwave day, and the platform's business case is on screen. Build them only on Day 3, after the core and HeatGate Fair are deployed and working.
1. Change the rule live
A judge moves a slider, such as the rush-hour hard limit from 120 minutes down to NDMA's 90, clicks Run, and sees safety, speed and earnings change in seconds. The generated Cedar code is shown next to it, with the changed numbers highlighted.
To stay safe, judges edit numbers, not free text. The numbers are filled into a template, then Cedar checks the result against the schema before anything runs, so a bad value can't crash the demo.
= workLimitMin
  earlyRestMin: number;      // default 70, allowed 40-110, must be 
policies/heatgate-fair.cedar.tmpl is the Fair rule set with {{restHeatC}}-style placeholders. The engine fills it in, validates it, and caches it by knob values.

New route POST /policies/render with body { knobs: FairKnobs } returns { text: string, valid: boolean, errors: string[] }. Out-of-range values return 400.

POST /simulations accepts fairKnobs. To keep it fast, a knob change reruns only heatgate-fair and no-rules.

Test: rendering the default knobs must give exactly the committed heatgate-fair.cedar, so the golden tests still cover it.

On screen: show only 3 sliders (rest heat, work limit, rush hard limit). Keep the rest at defaults. Mark NDMA's 90 and the union's 120 on the work-limit and hard-limit sliders.

2. Replay a real heatwave day
Instead of a made-up slider day, replay the real hourly temperature and humidity of a real hot day in a real city. Then the pitch says "on this real day, here's what each rule would have done."

scripts/fetch-weather.ts calls Open-Meteo's free historical weather API once for hourly temperature and relative humidity (timezone Asia/Kolkata) and saves sim/weather/<id>.json. Commit these files, so the demo never needs the internet.

Pick the day from the data, not from memory: fetch a whole summer (for example May–June) for 2–3 cities and choose the day with the highest peak heat index. Check the date against news reports before quoting it.

Between hours, the simulator blends the two nearest hourly values.

New route GET /weather-days returns { id, city, date }[] for a dropdown.

Use your own city too (Hyderabad), since it connects with local judges.

3. Platform view
Judges will ask "why would Swiggy or Zomato agree to this?" One small screen answers it, computed from the metrics you already have. No new backend.
Number on screen
How it's computed (heatgate-fair vs the today baseline)

Rest pay vs heat fee
restPayTotalInr next to heatFeeCollectedInr, and whether the fee covers the pay

Safety cost per order
(rest pay − heat fee) ÷ orders delivered, in ₹

Delivery time change
% change in avgDeliveryMinutes

Late orders change
change in ordersLate

Unsafe heat prevented
drop in unsafeExposureMin120 (and unsafeExposureMin90), in rider-hours

All rupee amounts are still placeholders until your rider interviews replace them. Label this on screen. The heat fee is a hypothesis: customers may order less (the simulator has a demand-drop setting), and it may stack with state welfare fees that we have not verified.
Only if Day 3 morning finishes early
Judge becomes a rider: a QR code opens a phone page for Rider #51 that checks the API every 3 seconds and shows the rest card live. (Half a day)

Tamper-proof audit log: each record stores a hash of the record before it; a "Verify" button turns red if any old record was changed. (2–3 hours)

Do not start either one after 12:00 on Day 3.
Later, or pitch only
Heat-emergency button: the rider pauses themselves with no penalty. NDMA's advisory asks for a way to do this.

WBGT as an optional trigger instead of the heat index.

Quick-commerce profile: 3 km radius and 10-minute trips with its own rest settings, because a 20-minute rest breaks a 10-minute delivery promise.

Cross-platform limit: one shared heat clock across apps, run by a regulator-level service.

Tiered log access: aggregate reports for unions, exact records only for regulators with a legal basis, and the ID key held by a trustee.

