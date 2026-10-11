// Audit log: logged decisions from GET /audit, newest first, with the filters sent to the API and cursor paging.
// Only what the log holds is shown. The log never keeps a rider's position or the cooling point.
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { Decision, Outcome, PolicyVersion } from "@heatgate/contracts";
import { POLICY_LABELS } from "@heatgate/contracts";
import { auditRowKey, useAudit } from "../hooks/index.ts";
import type { AuditQuery } from "../hooks/index.ts";
import { useActiveSimulation } from "../context/SimulationContext.tsx";
import { usePolicyLabels } from "../hooks/index.ts";
import { DecisionInputs, InfoTip, OUTCOME_WORDS, OutcomePill, heatColor } from "../components/ui.tsx";

const OUTCOMES: Outcome[] = ["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"];
const POLICIES = Object.keys(POLICY_LABELS) as PolicyVersion[];
const PAGE_SIZE = 20;
const RIDER_DEBOUNCE_MS = 300;

type Lang = "en" | "hi" | "te" | "ur";
const LANGS: { key: Lang; label: string }[] = [
  { key: "en", label: "English" },
  { key: "hi", label: "हिं" },
  { key: "te", label: "తె" },
  { key: "ur", label: "اردو" },
];

// Simulation rows carry simulated time (2026-05-20); live /decide rows carry real time.
const timeOf = (d: Decision) => d.at.slice(11, 16);

const selectCls =
  "h-[48px] border border-[#E3E1DA] rounded-xl bg-[#FAFAF7] px-3 text-xs font-semibold text-[#1B1F23] focus:outline-none focus:ring-1 focus:ring-[#0F766E]";

export function AuditPage() {
  const { activeSim } = useActiveSimulation();
  const labels = usePolicyLabels();
  const [searchParams] = useSearchParams();

  const [riderInput, setRiderInput] = useState(searchParams.get("rider") ?? "");
  const [rider, setRider] = useState(riderInput);
  const [outcome, setOutcome] = useState<Outcome | "">("");
  const [policy, setPolicy] = useState<PolicyVersion | "">("");
  const [simulationId, setSimulationId] = useState(searchParams.get("simulationId") ?? "");

  useEffect(() => {
    const t = setTimeout(() => setRider(riderInput.trim()), RIDER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [riderInput]);

  const filters: AuditQuery = {
    rider: rider || undefined,
    outcome: outcome || undefined,
    policy: policy || undefined,
    simulationId: simulationId || undefined,
    limit: PAGE_SIZE,
  };
  const filtersKey = JSON.stringify(filters);

  // Pages accumulate until the filters change. The cursor goes back with the same filters (api-guide §6).
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [rows, setRows] = useState<Decision[]>([]);
  useEffect(() => {
    setCursor(undefined);
    setRows([]);
  }, [filtersKey]);

  const page = useAudit({ ...filters, cursor });
  useEffect(() => {
    if (!page.data) return;
    const items = page.data.items;
    setRows((prev) => {
      if (!cursor) return items;
      const seen = new Set(prev.map(auditRowKey));
      return [...prev, ...items.filter((d) => !seen.has(auditRowKey(d)))];
    });
    // Only new data appends: cursor is read here, not watched.
  }, [page.data]);

  const [selectedKey, setSelectedKey] = useState<string | undefined>(undefined);
  const selected = rows.find((d) => auditRowKey(d) === selectedKey) ?? rows[0];
  const [lang, setLang] = useState<Lang>("en");

  const simOptions: { value: string; label: string }[] = [{ value: "", label: "All decisions" }];
  if (activeSim) simOptions.push({ value: activeSim.simulationId, label: `This run (${activeSim.simulationId})` });
  if (simulationId && simulationId !== activeSim?.simulationId) simOptions.push({ value: simulationId, label: `Run ${simulationId}` });

  const resetFilters = () => {
    setRiderInput("");
    setRider("");
    setOutcome("");
    setPolicy("");
    setSimulationId("");
  };

  const message = selected ? (lang === "en" ? selected.message : selected.messages?.[lang]) : undefined;

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-6 pb-12">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-[#1B1F23]">Audit Log</h1>
          <p className="text-sm text-[#4B5563] mt-0.5">Every dispatch decision and the rule behind it.</p>
        </div>
        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#E3E1DA] bg-[#FFFFFF] text-[#4B5563] text-xs font-semibold">
          <span className="material-symbols-outlined text-[18px] text-[#0F766E]" style={{ fontVariationSettings: "'FILL' 1" }}>
            verified_user
          </span>
          Pseudonymous IDs · no positions stored
          <InfoTip label="About privacy">
            Rider IDs are pseudonymous but likely still personal data under India's DPDP Act, 2023. The log never keeps a rider's position or
            the cooling point. All riders here are simulated.
          </InfoTip>
        </span>
      </header>

      {/* Filters: every one is sent to GET /audit */}
      <div className="w-full bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] p-4 shadow-xs grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_2fr_auto] gap-3 items-center">
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Rider ID</span>
          <input
            type="text"
            value={riderInput}
            onChange={(e) => setRiderInput(e.target.value)}
            placeholder="e.g. rider-014"
            className={`${selectCls} font-mono`}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Outcome</span>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome | "")} className={selectCls}>
            <option value="">All outcomes</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_WORDS[o]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Rule set</span>
          <select value={policy} onChange={(e) => setPolicy(e.target.value as PolicyVersion | "")} className={selectCls}>
            <option value="">All rule sets</option>
            {POLICIES.map((p) => (
              <option key={p} value={p}>
                {POLICY_LABELS[p]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">Simulation</span>
          <select value={simulationId} onChange={(e) => setSimulationId(e.target.value)} className={selectCls}>
            {simOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={resetFilters} className="self-end h-[48px] px-3 text-xs font-bold text-[#0F766E] hover:underline">
          Reset filters
        </button>
      </div>

      {page.error ? (
        <div role="alert" className="w-full bg-[#FFFFFF] border border-[#FECACA] rounded-[12px] p-6 flex flex-col items-center gap-2 text-center">
          <span className="material-symbols-outlined text-3xl text-[#DC2626]">sync_problem</span>
          <p className="text-sm font-bold text-[#991B1B]">Could not load decisions</p>
          <p className="text-xs text-[#4B5563] max-w-[520px]">{page.error.message}</p>
          <button type="button" onClick={page.reload} className="mt-1 px-3 py-1.5 rounded-lg bg-[#DC2626] text-white text-xs font-bold hover:bg-[#B91C1C]">
            Retry
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div className="w-full bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] p-8 text-center text-sm text-[#4B5563]">
          {page.loading ? (
            "Loading decisions…"
          ) : (
            <>
              <p className="font-bold text-[#1B1F23] inline-flex items-center gap-1">
                No decisions match these filters.
                <InfoTip>
                  The log holds live /decide calls and the trails of the last 5 simulation runs (first seed only). Rider IDs look like rider-014.
                </InfoTip>
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="w-full flex flex-col lg:flex-row gap-6 items-start">
          <section className="w-full lg:w-[62%] bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] shadow-xs overflow-hidden flex flex-col shrink-0">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#E3E1DA] bg-[#FAFAF7] text-xs font-bold text-[#4B5563] uppercase tracking-wider">
                    <th className="py-3 px-2.5">Time</th>
                    <th className="py-3 px-2.5">Rider</th>
                    <th className="py-3 px-2.5">Rule set</th>
                    <th className="py-3 px-2.5">Outcome</th>
                    <th className="py-3 px-2.5">Rule</th>
                    <th className="py-3 px-2.5">Heat</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E3E1DA]">
                  {rows.map((d) => {
                    const key = auditRowKey(d);
                    const isSelected = selected && key === auditRowKey(selected);
                    return (
                      <tr
                        key={key}
                        onClick={() => setSelectedKey(key)}
                        tabIndex={0}
                        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setSelectedKey(key)}
                        aria-selected={isSelected}
                        className={`h-[52px] cursor-pointer text-sm ${isSelected ? "bg-[#E6F4F1] border-l-4 border-l-[#0F766E]" : "bg-white hover:bg-[#F8FAFC]"}`}
                      >
                        <td className="py-2 px-2.5 font-mono whitespace-nowrap" title={d.simulationId ? "Simulated time" : "Live"}>
                          {timeOf(d)}
                          {!d.simulationId && <span className="ml-1 text-[10px] font-bold text-primary">live</span>}
                        </td>
                        <td className="py-2 px-2.5 font-mono font-semibold whitespace-nowrap">{d.riderId}</td>
                        <td className="py-2 px-2.5 whitespace-nowrap">{labels.short(d.policyVersion)}</td>
                        <td className="py-2 px-2.5 whitespace-nowrap">
                          <OutcomePill outcome={d.outcome} size="sm" />
                        </td>
                        <td className="py-2 px-2.5 font-mono text-xs whitespace-nowrap">{d.firedRules[0] ?? "—"}</td>
                        <td className="py-2 px-2.5 font-mono font-bold whitespace-nowrap" style={{ color: heatColor(d.heatIndexC) }}>
                          {d.heatIndexC}°
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-[#FAFAF7] border-t border-[#E3E1DA] flex items-center justify-between gap-3">
              <span className="text-sm text-[#4B5563]">
                {rows.length} shown{page.data?.nextCursor ? "" : " (all)"}
              </span>
              {page.data?.nextCursor && (
                <button
                  type="button"
                  disabled={page.loading}
                  onClick={() => setCursor(page.data?.nextCursor)}
                  className="h-10 px-4 rounded-lg border border-[#E3E1DA] bg-white text-sm font-bold text-[#1B1F23] hover:bg-[#FAFAF7] disabled:opacity-50"
                >
                  {page.loading ? "Loading…" : "Load more"}
                </button>
              )}
            </div>
          </section>

          {selected && (
            <aside className="w-full lg:flex-1 bg-[#FFFFFF] border border-[#E3E1DA] rounded-[12px] shadow-xs p-5 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <OutcomePill outcome={selected.outcome} size="lg" />
                <span className="text-xs font-semibold text-[#0F766E] bg-[#E6F4F1] px-2 py-0.5 rounded">{labels.short(selected.policyVersion)}</span>
              </div>
              <span className="font-mono text-xs text-[#4B5563] flex items-center gap-1">
                {selected.riderId} · {selected.at.slice(0, 16).replace("T", " ")} {selected.simulationId ? "(sim)" : "(live)"}
                {selected.simulationId && <InfoTip label="Simulation run">Run {selected.simulationId}. Times inside a simulation are simulated.</InfoTip>}
              </span>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">Rider saw</span>
                  <div className="inline-flex border border-[#E3E1DA] rounded-lg bg-[#FAFAF7] p-0.5 gap-0.5" role="tablist" aria-label="Language">
                    {LANGS.map((l) => (
                      <button
                        key={l.key}
                        type="button"
                        role="tab"
                        aria-selected={lang === l.key}
                        onClick={() => setLang(l.key)}
                        className={`px-2.5 py-1 rounded text-xs ${lang === l.key ? "bg-[#0F766E] text-white font-bold" : "text-[#4B5563] hover:text-[#1B1F23]"}`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div
                  dir={lang === "ur" ? "rtl" : "ltr"}
                  lang={lang}
                  className="p-3.5 rounded-xl bg-[#FAFAF7] border border-[#E3E1DA] text-lg font-semibold text-[#1B1F23] leading-snug"
                  style={lang === "ur" ? { fontFamily: "'Noto Naskh Arabic', serif" } : undefined}
                >
                  {message ?? <span className="text-sm font-normal text-[#4B5563]">No translation logged.</span>}
                </div>
                {lang !== "en" && (
                  <span className="self-start text-[10px] font-bold uppercase tracking-wider text-[#92400E] bg-[#FFFBEB] border border-[#FDE68A] rounded px-1.5 py-0.5" title="Machine-written, not yet checked by a native speaker">
                    Draft · not checked
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">Rules that fired</span>
                {selected.firedRules.length === 0 ? (
                  <span className="text-xs text-[#4B5563]">None: allowed.</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5 font-mono text-xs">
                    {selected.firedRules.map((r, i) => (
                      <span key={r} className={`px-2 py-1 rounded-lg border ${i === 0 ? "bg-[#E6F4F1] border-[#0F766E]/40 font-bold" : "bg-[#FAFAF7] border-[#E3E1DA] text-[#4B5563]"}`} title={i === 0 ? "Winner" : "Also fired"}>
                        {i === 0 && "★ "}
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs font-bold">
                {selected.restMinutes > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E]">
                    <span className="material-symbols-outlined text-[15px]">timer</span>
                    {selected.restMinutes} min rest
                    {selected.outcome === "FORCE_REST" && (
                      <InfoTip>The rider was sent to the nearest cooling point. The log does not keep which one.</InfoTip>
                    )}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${selected.penaltyWaived ? "bg-[#ECFDF5] border-[#A7F3D0] text-[#065F46]" : "bg-[#FAFAF7] border-[#E3E1DA] text-[#4B5563]"}`}
                >
                  <span className="material-symbols-outlined text-[15px]">{selected.penaltyWaived ? "verified_user" : "gavel"}</span>
                  {selected.penaltyWaived ? "No penalty" : "Penalty not waived"}
                </span>
              </div>

              <DecisionInputs ctx={selected.cedarContext} />

              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(JSON.stringify(selected, null, 2))}
                className="w-full h-10 rounded-xl border border-[#E3E1DA] bg-white hover:bg-[#FAFAF7] text-xs font-bold text-[#1B1F23] flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">content_copy</span>
                Copy as JSON
              </button>
            </aside>
          )}
        </div>
      )}

    </div>
  );
}
