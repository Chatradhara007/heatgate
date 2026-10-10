// One real decision from the run: the first non-ALLOW event in the frames (a FORCE_REST if there is one),
// with what the audit log kept for it (message, inputs). No names, no cooling point (the log has none).
import { Link } from "react-router-dom";
import type { Decision, Outcome, PolicyVersion, SimResult } from "@heatgate/contracts";
import { useAudit } from "../hooks/index.ts";

interface SelectedRiderCardProps {
  sim: SimResult | undefined;
  policy: PolicyVersion;
}

const BADGE: Record<Outcome, string> = {
  ALLOW: "bg-[#EFF6FF] text-[#1D4ED8] border-[#BFDBFE]",
  SKIP_ORDER: "bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]",
  DENY: "bg-[#FEE2E2] text-[#991B1B] border-[#FECACA]",
  FORCE_REST: "bg-[#FEF3C7] text-[#92400E] border-[#FDE68A]",
};

function pickEvent(sim: SimResult, policy: PolicyVersion) {
  const frames = sim.runs[policy]?.frames ?? [];
  let first: { minute: number; riderId: string; outcome: Outcome; rule: string } | undefined;
  for (const f of frames) {
    for (const e of f.events) {
      if (e.outcome === "ALLOW") continue;
      if (e.outcome === "FORCE_REST") return { minute: f.minute, ...e };
      first ??= { minute: f.minute, ...e };
    }
  }
  return first;
}

const clock = (startHour: number, minute: number) => {
  const t = startHour * 60 + minute;
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
};

export function SelectedRiderCard({ sim, policy }: SelectedRiderCardProps) {
  const event = sim ? pickEvent(sim, policy) : undefined;
  const audit = useAudit(
    sim && event ? { simulationId: sim.simulationId, rider: event.riderId, policy, outcome: event.outcome, limit: 200 } : {},
    !!(sim && event),
  );

  if (!sim) return <div className="lg:col-span-4" />;
  if (!event) {
    return (
      <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 text-xs text-on-surface-variant">
        No rule fired for any rider in this run's first seed.
      </div>
    );
  }

  // Rows are newest first; the event is the rider's first of its kind, so take the oldest match.
  const row: Decision | undefined = [...(audit.data?.items ?? [])].reverse().find((d) => (d.firedRules[0] ?? "") === event.rule);
  const auditLink = `/audit?simulationId=${encodeURIComponent(sim.simulationId)}&rider=${encodeURIComponent(event.riderId)}`;

  return (
    <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl p-4 lg:p-5 shadow-xs flex flex-col gap-3">
      <div className="flex items-center justify-between pb-2 border-b border-outline-variant/60">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">One decision from this run</span>
        <span className={`h-7 px-2 rounded border text-[10px] font-bold flex items-center ${BADGE[event.outcome]}`}>{event.outcome}</span>
      </div>
      <div className="font-mono text-sm text-on-surface">
        <span className="font-bold">{event.riderId}</span> · {clock(sim.params.startHour, event.minute)} (simulated, first seed)
      </div>
      <div className="font-mono text-[11px] text-primary font-bold">Winning rule: {event.rule}</div>

      {audit.error ? (
        <p role="alert" className="text-xs text-error">
          Could not load the audit entry: {audit.error.message}
        </p>
      ) : audit.loading ? (
        <p className="text-xs text-on-surface-variant">Loading what the rider was told…</p>
      ) : !row ? (
        <p className="text-xs text-on-surface-variant">
          No audit entry for this decision. The log keeps the trails of the last 5 runs only, and fixture mode has no trail for this run.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">What the rider saw (English)</span>
            <p className="text-sm text-on-surface bg-surface-container-low p-2.5 rounded-lg border border-outline-variant">{row.message}</p>
          </div>
          <dl className="flex flex-col border border-outline-variant rounded-lg divide-y divide-outline-variant font-mono text-xs overflow-hidden">
            <div className="flex justify-between px-3 py-1.5">
              <dt className="text-on-surface-variant">Rest assigned</dt>
              <dd className="font-bold">{row.restMinutes} min</dd>
            </div>
            <div className="flex justify-between px-3 py-1.5">
              <dt className="text-on-surface-variant">Penalty waived</dt>
              <dd className="font-bold">{row.penaltyWaived ? "Yes" : "No"}</dd>
            </div>
            {Object.entries(row.cedarContext).map(([k, v]) => (
              <div key={k} className="flex justify-between px-3 py-1.5">
                <dt className="text-on-surface-variant">{k}</dt>
                <dd className="font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <Link to={auditLink} className="text-primary hover:text-[#0B4F4A] text-xs font-bold flex items-center gap-1 justify-end pt-1">
        <span>Open this rider in the Audit Log</span>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </Link>
    </div>
  );
}
