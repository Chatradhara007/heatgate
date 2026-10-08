# Golden tests (engine/decide.test.ts)

These feed the Cedar context directly, so they test the rules, not the heat formula. Write these tests before the engine; when they pass, the rules are right.

Columns are the Cedar context values. "Since break" is minutesSinceBreak, "Rest left" is restMinutesRemaining, "Dist km" is the order distance (rounded UP to a whole km before Cedar).

| # | Heat index | Hour | Since break | Trip min | Dist km | Rest left | Demand | Alert | ndma-2025 | union-demand | heatgate-fair |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 35 | 13 | 90 | 20 | 2 | 0 | 1 | 0 | ALLOW | ALLOW | ALLOW |
| 2 | 42 | 13 | 30 | 20 | 2 | 0 | 1 | 1 | DENY (ndma-peak-hours-pause) | ALLOW | ALLOW |
| 3 | 42 | 17 | 90 | 20 | 2 | 0 | 1 | 1 | FORCE_REST 15 (ndma-break-due) | ALLOW | FORCE_REST 20 (fair-rest-due) |
| 4 | 47 | 9 | 10 | 15 | 2 | 0 | 1 | 2 | ALLOW | ALLOW | DENY (fair-extreme-heat-stop) |
| 5 | 39 | 14 | 0 | 15 | 2 | 12 | 1 | 1 | FORCE_REST 12 (ndma-rest-in-progress) | FORCE_REST 12 (union-rest-in-progress) | FORCE_REST 12 (fair-rest-in-progress) |
| 6 | 47 | 13 | 90 | 20 | 2 | 0 | 1 | 2 | FORCE_REST 15 (ndma-break-due; rest beats deny) | ALLOW | FORCE_REST 20 (fair-rest-due; rest beats deny) |
| 7 | 42 | 13 | 90 | 20 | 2 | 0 | 2 | 1 | FORCE_REST 15 (ndma-break-due) | ALLOW | ALLOW (rest delayed in rush) |
| 8 | 42 | 13 | 110 | 20 | 2 | 0 | 2 | 1 | FORCE_REST 15 (ndma-break-due) | FORCE_REST 20 (union-rest-due) | FORCE_REST 20 (fair-rest-hard-limit) |
| 9 | 42 | 17 | 30 | 35 | 5 | 0 | 1 | 1 | SKIP_ORDER (ndma-reduced-radius) | ALLOW | SKIP_ORDER (fair-short-trips-only) |
| 10 | 39 | 16 | 75 | 10 | 1 | 0 | 0 | 0 | ALLOW | ALLOW | FORCE_REST 20 (fair-rest-early-in-lull) |
| 11 | 44 | 13 | 130 | 20 | 2 | 0 | 1 | 0 | ALLOW (no alert) | ALLOW (no alert) | FORCE_REST 20 (fair-rest-due; fair-rest-hard-limit also fired) |

no-rules returns ALLOW for every case.

Also check penaltyWaived. Case 1: false for all four rule sets (no alert, heat index below 38). Case 2: an ALLOW under union-demand or heatgate-fair gives true. no-rules is always false. NDMA and the union waive the penalty only on alert days; Fair waives it whenever the heat index is 38 or more. Also test the distance rounding: a 3.0 km order is allowed by NDMA's radius rule on an alert day, and a 3.2 km order is skipped, because the distance is rounded up to 4 before it reaches Cedar. Case 11 shows the gap in today's advisory: on a very hot day with no alert, NDMA and the union do nothing.
