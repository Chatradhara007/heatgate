# Simulator spec

Temperature through the day (sim/city.ts)
The slider sets the afternoon peak. Temperature follows a smooth curve that peaks at 3 PM and is about 9 °C cooler at 3 AM:

Humidity stays fixed at the slider value. Every minute, heat index = heatIndex(T(h), humidity).
Alert level for the day: use the setting in SimParams.alertLevel. On auto, it is 1 when the peak is 40 °C or more and 2 at 45 °C or more. The same level applies all day, like a daily IMD alert.
The city and the riders
A 10 × 10 km square. 6 restaurant hubs and 8 cooling points (shade + water), at fixed seeded positions. Cooling points are the demo's rest places. With 8 points in 100 km² the nearest one is about 1.8 km away on average, so the ride there counts as outdoor time and the rest starts on arrival.

50 riders: 70% bike (18 km/h), 20% EV (18 km/h), 10% cycle (12 km/h). Random start positions.

Shifts (assumption, not measured). Riders log in in two waves: half at a random time between 8:00 and 9:00, half between 15:00 and 18:00 (on the 5-minute frame clock). Each works shiftHours (6 to 8 hours); the second wave's shifts are cut off at the end of the day. The waves were tuned together with ordersPerHour = 34 to hit the demand mix below. Replace them with real login data when we have it.

Multi-app riders. multiAppPct of riders (picked by the seed, default 40%) keep working on another app while they rest or are paused here. For them, minutesSinceBreak and exposure keep running during the rest and are not reset when it ends, and they cannot take our orders until it ends.

Orders arrive randomly at ordersPerHour (default 34), 1.5× busier from 12-2 PM and 7-9 PM. Pickup at a hub, drop within 5 km.

tripMinutes = travel to pickup + travel to drop + 5 minutes handover.

Use a seeded random generator (for example mulberry32). Never Math.random, or the rule sets will not see the same day.

Tune on Day 1. Print the demand level on the no-rules run. Aim for about 20% quiet, 50% normal and 30% rush. With the two login waves and 34 orders an hour, a 34 °C no-rules day over 5 seeds gives 21 / 51 / 28 (single seeds range widely, rush 16-42%). With staggered shifts, 50 riders on 25-minute trips deliver roughly 70 orders an hour, so a demand of 150 an hour would be overload all day and the "quiet time" rules would never fire.

The dispatch loop (sim/dispatcher.ts), one step per simulated minute
Log in riders whose shift starts now and log out riders whose shift has ended. Set the day's alert level.

Work out the demand level: the share of on-shift riders who are delivering. Below 50% → 0 (quiet), 50–85% → 1 (normal), above 85% → 2 (rush).

Count down rests. A rider whose rest hits 0 becomes idle, and minutesSinceBreak resets to 0 (not for multi-app riders, see above).

Move delivering riders along their route. On drop-off they become idle, get paid, and their delivery time is recorded.

For each waiting order, oldest first: take the 5 nearest idle riders and call decide() for each, in order.
ALLOW → assign the order, stop.

SKIP_ORDER → rider stays idle and available. Try the next rider.

FORCE_REST → rider rides to the nearest cooling point (this ride counts as outdoor time) and rests restMinutes from arrival. Try the next rider.

DENY → rider is paused for 15 minutes, then can be asked again. Try the next rider.

Nobody allowed → the order waits until the next minute.


Add 1 to minutesSinceBreak and exposureMinutesToday for every idle or delivering rider (they wait outdoors). Paused and resting riders count as on break, except multi-app riders.

Every 5 minutes, save a Frame.

Run this loop once per rule set and seed, using the same seeds for every rule set (default 5), and compute Metrics at the end of each run. Report the mean and the min–max range. If two rule sets' ranges overlap on a metric, say there is no clear difference instead of ranking them.
Fair features and rider earnings (sim/fair.ts, sim/earnings.ts)
Earnings and pay protections apply to every rule set, so they can be compared fairly. Which protections each rule set has is set by DEFAULT_PAY in contracts/types.ts: NDMA has paid rest; the union and Fair have paid rest and incentive protection; today has neither. These defaults are assumptions to verify. Only two features are specific to heatgate-fair.
Earnings (all rule sets)
Each delivered order pays payPerOrderInr + payPerKmInr × distanceKm.

Daily target. The target is dailyTargetShare (default 0.9) times the median orders per rider in the no-rules run on the same seed, so it is reachable but not trivial. A rider who reaches it gets dailyBonusInr.

Incentive protection (where on): every 30 minutes of forced rest or pause lowers that rider's target by 1 order.

Paid rest (where on): rest minutes are paid at restPayPerMinuteInr.

Show each rule set's average earnings as a % of the "today" baseline, and the lowest-earning rider (among riders with at least 2 hours on shift, so a rider who logs in just before the day ends does not count as worst off). That answers "does safety cost riders money?"

Fair features (heatgate-fair only)
Heat fee (heatgate-fair only). Every order placed while the heat index is 38 or more adds heatFeePerOrderInr to a heat fund that pays the rest minutes. Each rupee of fee also cancels feeDemandDropPctPerInr % of new orders (default 1%), because customers may order less. The metrics show whether the fund covers the rest pay. This is a hypothesis, not a result, and it may stack with state welfare fees we have not checked.

Shade waiting counts as rest (heatgate-fair only, off by default). Idle riders wait at the nearest restaurant hub instead of the roadside, no exposure is added there, and 20 continuous minutes count as a break. This is only true if hubs really have shade for riders, which is unverified, so leave it off unless the rider interviews say otherwise. If you turn it on, say so wherever you show results.

Write each feature behind its own flag in FairFeatures, so you can switch either off. We dropped "first in line after rest": riders cannot see it, so it adds little trust.
