# HeatGate

> **"Safety that doesn't cost the rider a rupee of their day."**

HeatGate turns heat-safety rules for delivery riders into code that runs inside the order dispatch system. Every time an order is about to be assigned, HeatGate checks the rider's heat exposure against an active Cedar policy rule set and returns `ALLOW`, `SKIP_ORDER`, `DENY`, or forces a cooling break (`FORCE_REST`, 15 or 20 minutes depending on the rule set) with zero rating penalty. Every dispatch decision is logged to an auditable, pseudonymous trace that regulators, platforms, and unions can inspect.

---

## Important Disclaimer

> **Caution:** All heat thresholds (e.g. 38°C, 41°C, 46°C, IMD Orange/Red alerts) and financial amounts (e.g. ₹25/order, ₹6/km, ₹1.5/min rest pay, ₹5 heat fee) in this project are **placeholders for demonstration purposes**. Before presenting numbers as "safe" or "unsafe", they must be reviewed against IMD/NDMA heat guidance and verified with health and labour experts. In production, all thresholds and economic parameters are fully configurable.

---

## The Four Policy Rule Sets

1. **`no-rules` ("Today: voluntary measures only (nothing enforced)")**
   - Baseline representation of today's voluntary platform measures (coolers, rest spots) with no dispatch enforcement. Declining an order counts against rider metrics.
2. **`ndma-2025` ("NDMA advisory rules")**
   - Modeled on the July 2025 NDMA advisory: triggers on IMD Orange/Red alerts (`alertLevel >= 1`).
   - Halts mandatory assignments 11 AM–4 PM (`ndma-peak-hours-pause`).
   - Enforces a 15-minute cooling break per 90 minutes of logged-in work (`ndma-break-due`).
   - Caps order radius to 3 km (`ndma-reduced-radius`).
   - Rating penalties are waived for declining orders during alerts.
3. **`union-demand` ("Union demand (IFAT)")**
   - Modeled on IFAT union demands: triggered on heatwave days (`alertLevel >= 1`).
   - Enforces a paid 20-minute cooling break per 2 hours (120 minutes) of work (`union-rest-due`).
   - No extreme-heat cutoff (matching the exact text of the union demand).
   - Rating penalties waived during alerts.
4. **`heatgate-fair` ("HeatGate Fair")**
   - Directly checks local heat index (°C) without waiting for a regional alert declaration.
   - **Rest early during lulls:** Takes 20-minute paid breaks when orders are slow (demand level 0) and minutes worked ≥ 70 min.
   - **Soft steps first:** Skips long-distance orders (> 3 km) at high heat (≥ 41°C) while keeping riders online for nearby deliveries.
   - **Hard limit protection:** Allows delaying breaks during rushes up to 120 minutes max.
   - **Full halt only at extreme heat:** Denies dispatches at extreme heat (≥ 46°C) while protecting daily bonus targets.
   - **Paid rest fund:** Rest pay is funded by an optional small heat fee on orders placed during high heat (≥ 38°C).

---

## Repository Layout

```text
heatgate/
├── CLAUDE.md                # Development instructions and rules
├── contracts/
│   ├── package.json         # Contracts workspace package
│   └── types.ts             # Shared TypeScript types, data contracts & default pay configs
├── policies/
│   ├── heatgate.cedarschema # Cedar schema for Rider, Order, and HeatContext
│   ├── no-rules.cedar       # Baseline: today (voluntary measures)
│   ├── ndma-2025.cedar       # Rule set A: NDMA advisory (alert-triggered, 15m/90m, 3km)
│   ├── union-demand.cedar   # Rule set B: Union demand (alert-triggered, 20m/120m)
│   └── heatgate-fair.cedar  # Rule set C: HeatGate Fair (lull breaks, 3km cap, fee-funded)
├── engine/                  # Core policy evaluator & NOAA heat index calculator
├── sim/                     # City, riders, orders, and dispatch simulator
├── api/                     # Local Express & AWS Lambda API handlers
├── web/                     # React + Vite + Tailwind dashboard
└── template.yaml            # AWS SAM infrastructure definition
```

---

## How to Run Locally

```bash
# 1. Install dependencies across workspaces
npm install

# 2. Validate Cedar policies against schema
npm run check-policies

# 3. Run unit and golden tests
npm test

# 4. Start the local API server
npm run dev:api

# 5. Start the frontend web application
npm run dev:web
```

---

## License

[MIT](LICENSE)
