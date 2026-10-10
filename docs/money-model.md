# Money model

## All rupee amounts are placeholders

Every rupee figure the simulator produces comes from placeholder inputs, and all of them must be
replaced with numbers from rider interviews before anyone quotes a result:

- **Amounts**: pay per order (₹25), pay per km (₹6), daily bonus (₹150), rest pay per minute (₹1.5) and
  the heat fee (₹5). These are `SimParams.economics`, with defaults in `sim/params.ts`. The daily target share
  (0.9) and the demand drop per rupee of fee (1%) are placeholders as well.
- **Protections**: which rule set gets paid rest and incentive protection is set in `DEFAULT_PAY`
  (`contracts/types.ts`). These are also assumptions to verify: NDMA has paid rest, while the union and
  HeatGate Fair have paid rest and incentive protection.

The rules for how pay is computed are in `docs/spec/simulator.md` ("Fair features and rider earnings")
and `sim/earnings.ts`.

## The headline result is the break-even rest pay

Do not lead with "riders earn X% of today" at the default rates. That percentage changes with every
placeholder above. At the default ₹1.5 per minute (₹90 an hour), a forced rest pays more per hour than
delivering does, so the safer rule sets come out ahead of today almost by construction.

The number to report is the **break-even rest pay**: the smallest rest pay per minute at which a rule
set's average rider earns at least as much as today (no-rules). Below it, safety costs riders money;
at or above it, it does not. To compute it, run:

```
npm run sim:sensitivity
```

This runs the default day over 5 seeds and sweeps the rest pay rate over ₹0, 0.25, 0.5, 0.75, 1.0
and 1.5 per minute, changing nothing else. It repeats the sweep at 25, 34 (the default) and 50 orders
an hour and ends with the break-even rate for each demand level, because the more a rider earns by
delivering, the more a rest has to pay to match it. For union-demand and heatgate-fair it prints the average
earnings, earnings as a % of no-rules and the lowest-earning rider, then the break-even rate
(interpolated between sweep points, for the seed mean and for each seed). Quote the range, not just
the mean. The break-even rate is only as good as the placeholders behind it, so re-run the sweep
once the interview numbers are in.

The lowest-earning rider leaves out riders with less than 2 hours on shift in the run. Riders who log in
shortly before the day ends earn next to nothing because they barely worked, not because of the rules.
The average still counts every rider.

## Rider supply is an assumption

Rider supply is an assumption: half the riders log in 08:00–09:00 and half 15:00–18:00 (6–8 h shifts,
the second wave cut off at the end of the day), tuned with ordersPerHour = 34 so the 34 °C no-rules
demand mix is about 20 / 50 / 30 quiet / normal / rush. It is not measured; replace it with real login
data when we have it. Break-even rest pay depends on it: with the earlier pattern (logins spread evenly
over 08:00–13:00, 50 orders an hour) it came out lower for both rule sets (measured before the end-of-day
fix below, without per-seed ranges, so not comparable number for number). Today, at 34 orders an hour,
it is ₹0.64–1.17/min for union-demand and ₹0.77–1.12/min for HeatGate Fair across seeds (placeholders;
`sim/results/break-even.json` has every level). The ranges overlap: no clear difference between the two.

## The end of the day

The run stops offering orders at `endHour` (20:00). A rider who is on a delivery at that moment keeps
riding until the drop-off, is paid for that order then, and the order counts as delivered, with its
real delivery time (so it can still be late: over 45 minutes from order to drop-off). Nobody is offered
an order after 20:00, orders still waiting then stay undelivered, and riders who are idle, paused,
resting or riding to a cooling point log out at 20:00, so no rest starts after it.

Before this was fixed (October 2026), the run simply stopped at 20:00 and the orders on the road were
never paid or counted: about 20 per day for no-rules and 25 for HeatGate Fair (every second-wave rider
was on a delivery at 20:00). That made a few riders look like they had earned ₹0 and cut every rule
set's earnings by a different amount. All numbers in this file, `docs/api-guide.md` and
`sim/results/break-even.json` are from after the fix.
