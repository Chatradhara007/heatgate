// PLACEHOLDER (teammate zone): what a rider sees on their phone when dispatch decides.
// Data: usePolicies (selector), useDecide (one decision per tap; logged to the audit log).
import { useState } from "react";
import type { DecideRequest, PolicyVersion } from "@heatgate/contracts";
import { AsyncView } from "../components/AsyncView.tsx";
import { OutcomeBadge } from "../components/OutcomeBadge.tsx";
import { useDecide, usePolicies } from "../hooks/index.ts";

// A hot afternoon, break overdue. Rider ID is pseudonymous: never a name or phone number.
const sampleRequest = (policyVersion: PolicyVersion): DecideRequest => ({
  policyVersion,
  rider: { id: "rider-014", vehicle: "bike", x: 2, y: 3 },
  order: { id: `order-${Date.now()}`, zone: "Z2", distanceKm: 3.4, tripMinutes: 20 },
  conditions: { tempC: 42, humidityPct: 30, hourOfDay: 14, demandLevel: 2, alertLevel: 1 },
  riderState: { minutesSinceBreak: 80, exposureMinutesToday: 200, restMinutesRemaining: 0 },
});

export function RiderPhonePage() {
  const policies = usePolicies();
  const decision = useDecide();
  const [policy, setPolicy] = useState<PolicyVersion>("ndma-2025");

  return (
    <div className="mx-auto max-w-sm space-y-md rounded-lg border border-border bg-panel p-md">
      <h1 className="font-display text-xl font-bold">Rider phone</h1>
      <AsyncView state={policies} label="rule sets">
        {(list) => (
          <select
            value={policy}
            onChange={(e) => setPolicy(e.target.value as PolicyVersion)}
            className="w-full rounded-md border border-border p-xs text-sm"
          >
            {list.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        )}
      </AsyncView>
      <button
        type="button"
        disabled={decision.loading}
        onClick={() => decision.run(sampleRequest(policy))}
        className="w-full rounded-md bg-brand px-md py-sm text-sm font-semibold text-white disabled:opacity-50"
      >
        {decision.loading ? "Asking dispatch…" : "Ask for an order (42 °C, 14:00)"}
      </button>
      {decision.error && (
        <p role="alert" className="text-sm text-danger">
          {decision.error.message}
        </p>
      )}
      {decision.data && (
        <div className="space-y-xs text-sm">
          <OutcomeBadge outcome={decision.data.outcome} />
          <p>{decision.data.message}</p>
          {decision.data.restMinutes > 0 && <p>Rest: {decision.data.restMinutes} minutes</p>}
          {decision.data.penaltyWaived && <p>No penalty for this.</p>}
          <p className="text-xs text-ink-muted">Heat index {decision.data.heatIndexC} °C · rules: {decision.data.firedRules.join(", ") || "none"}</p>
        </div>
      )}
    </div>
  );
}
