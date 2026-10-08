# HeatGate

Heat-safety rules for delivery riders, written as Cedar policies and run
inside order dispatch.
Core idea: protect riders WITHOUT making safety cost them money.
Hackathon project: 3 days. Prefer simple, working code over clever code.

## Contracts (do not change without asking)
- Shared types: `contracts/types.ts`. Import from here everywhere.
- Cedar schema: `policies/heatgate.cedarschema` (context includes demandLevel
and alertLevel)
- Rule sets: `policies/no-rules.cedar` (today: voluntary measures, nothing
enforced),
`policies/ndma-2025.cedar`, `policies/union-demand.cedar`, `policies/heatgate-fair.cedar`
- `ndma-2025` and `union-demand` copy the real NDMA advisory and the IFAT demand
and trigger on `alertLevel`. Do not tweak their numbers. If one looks wrong, tell me.
- Every forbid rule has `@id`, `@outcome` (`SKIP_ORDER` | `DENY` | `FORCE_REST`) and
`@message`.
`FORCE_REST` rules also have `@restMinutes` (20 if missing). Optional:
`@messageHi`, `@messageTe`,
`@messageUr`.
- Decision logic: `AssignOrder` allowed -> `ALLOW`. Denied -> strongest outcome
among fired rules:
`FORCE_REST` > `DENY` > `SKIP_ORDER`. Ties: the first rule in policy file order
wins (message and
rest length); `firedRules` lists the winner first. Second check
`DeclineWithoutPenalty` ->
`penaltyWaived` (always true for `SKIP_ORDER`, `DENY` and `FORCE_REST`).
- Pay protections per rule set live in `DEFAULT_PAY` (`contracts/types.ts`).
Fair's two features
(heat fee, shade waiting) live in `sim/fair.ts` behind `FairFeatures` flags.
Shade waiting is
OFF by default.
- All money amounts are placeholders from `SimParams.economics`. Never hard-code rupees.
- Heat index is a proxy for outdoor heat stress. It is not a medical measure.

## Rules
- TypeScript strict mode, Node 20, npm workspaces.
- Cedar runs in-process with `@cedar-policy/cedar-wasm`. Read its README for
the exact API
of the installed version before writing calls.
- Heat index is rounded to a whole number and order distance is rounded UP to
a whole km
before they go to Cedar (Cedar uses Long).
- Randomness only through the seeded RNG in `sim/rng.ts`. Never `Math.random`.
- Every simulation runs over several seeds (default 5). Report the mean and
the range.
- Rider IDs in the audit log are pseudonymous (likely still personal data
under DPDP).
Never store names or phone numbers.
- The store has one interface (`api/store/types.ts`) with two versions: memory
and DynamoDB.
- Tests: vitest. Run `npm test` after every change and fix failures before
finishing.
- No new dependencies without saying why.

## Layout
engine/ heat index + decide()
sim/ simulator + fair features + earnings
api/ handlers + stores
web/ React app
