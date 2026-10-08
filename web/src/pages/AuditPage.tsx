// PLACEHOLDER (teammate zone): the audit log of decisions. Rider IDs are pseudonymous.
// Data: useAudit (filters: rider, outcome, policy).
import { useState } from "react";
import type { Outcome } from "@heatgate/contracts";
import { AsyncView } from "../components/AsyncView.tsx";
import { OutcomeBadge } from "../components/OutcomeBadge.tsx";
import { useAudit } from "../hooks/index.ts";

const OUTCOMES: Outcome[] = ["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"];

export function AuditPage() {
  const [outcome, setOutcome] = useState<Outcome | undefined>(undefined);
  const audit = useAudit({ outcome, limit: 50 });

  return (
    <div className="space-y-md">
      <div className="flex items-center gap-md">
        <h1 className="font-display text-xl font-bold">Audit log</h1>
        <select
          value={outcome ?? ""}
          onChange={(e) => setOutcome((e.target.value || undefined) as Outcome | undefined)}
          className="rounded-md border border-border p-xs text-sm"
        >
          <option value="">All outcomes</option>
          {OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <button type="button" onClick={audit.reload} className="text-sm text-brand underline">
          Refresh
        </button>
      </div>
      <AsyncView state={audit} label="audit log">
        {(page) =>
          page.items.length === 0 ? (
            <p className="text-sm text-ink-muted">No decisions logged yet. Decisions from the Rider phone page appear here.</p>
          ) : (
            <ul className="space-y-xs text-sm">
              {page.items.map((d) => (
                <li key={d.decisionId} className="flex flex-wrap items-center gap-sm rounded-md bg-panel p-xs">
                  <OutcomeBadge outcome={d.outcome} />
                  <span className="font-mono text-xs">{d.riderId}</span>
                  <span className="text-ink-muted">{d.policyVersion}</span>
                  <span>{d.message}</span>
                </li>
              ))}
            </ul>
          )
        }
      </AsyncView>
    </div>
  );
}
