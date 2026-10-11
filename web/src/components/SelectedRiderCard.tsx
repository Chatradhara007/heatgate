// One real decision from the run: the first non-ALLOW event in the frames (a FORCE_REST if there is one),
// with what the audit log kept for it (message, inputs). No names, no cooling point (the log has none).
import { Link } from "react-router-dom";
import type { Decision, Outcome, PolicyVersion, SimResult } from "@heatgate/contracts";
import { useAudit } from "../hooks/index.ts";
import { DecisionInputs, InfoTip, OutcomePill } from "./ui.tsx";

interface SelectedRiderCardProps {
  sim: SimResult | undefined;
  policy: PolicyVersion;
}

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
        No rule fired in this run's first seed.
      </div>
    );
  }

  // Rows are newest first; the event is the rider's first of its kind, so take the oldest match.
  const row: Decision | undefined = [...(audit.data?.items ?? [])].reverse().find((d) => (d.firedRules[0] ?? "") === event.rule);
  const auditLink = `/audit?simulationId=${encodeURIComponent(sim.simulationId)}&rider=${encodeURIComponent(event.riderId)}`;

  return (
    <div className="lg:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 lg:p-5 shadow-xs flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant flex items-center gap-1">
          One decision
          <InfoTip label="About this decision">
            The first rule that stopped an order in this run's first seed (a forced rest if there is one), with what the audit log kept for
            it. Winning rule: <span className="font-mono">{event.rule}</span>.
          </InfoTip>
        </span>
        <span className="font-mono text-xs text-on-surface-variant">
          {event.riderId} · {clock(sim.params.startHour, event.minute)}
        </span>
      </div>
      <span className="self-start">
        <OutcomePill outcome={event.outcome} size="lg" />
      </span>

      {audit.error ? (
        <p role="alert" className="text-xs text-error">
          Could not load the audit entry: {audit.error.message}
        </p>
      ) : audit.loading ? (
        <p className="text-xs text-on-surface-variant">Loading what the rider was told…</p>
      ) : !row ? (
        <p className="text-xs text-on-surface-variant flex items-center gap-1">
          No audit entry for this decision.
          <InfoTip>The log keeps the trails of the last 5 runs only, and fixture mode has no trail for this run.</InfoTip>
        </p>
      ) : (
        <>
          <p className="text-lg font-semibold leading-snug text-on-surface">“{row.message}”</p>
          <div className="flex flex-wrap gap-1.5">
            {row.restMinutes > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-bold">
                <span className="material-symbols-outlined text-[15px]">timer</span>
                {row.restMinutes} min rest
              </span>
            )}
            {row.penaltyWaived && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-xs font-bold">
                <span className="material-symbols-outlined text-[15px]">verified_user</span>
                No penalty
              </span>
            )}
          </div>
          <DecisionInputs ctx={row.cedarContext} />
        </>
      )}

      <Link to={auditLink} className="mt-auto text-primary hover:text-[#0B4F4A] text-xs font-bold flex items-center gap-1 justify-end">
        <span>Open in Audit Log</span>
        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
      </Link>
    </div>
  );
}
