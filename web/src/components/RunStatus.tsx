// The run's state, shared by the pages that show a SimResult: running (with Cancel), a saved run being
// fetched again, a saved run that is gone, a failed run, and the fixture note.
import { useActiveSimulation } from "../context/SimulationContext.tsx";

export function RunStatus() {
  const { activeSim, loading, restoring, restoreError, status, error, elapsedMs, cancel } = useActiveSimulation();
  return (
    <>
      {loading && (
        <div className="py-2 px-4 text-primary text-xs font-bold bg-primary/5 rounded-xl border border-primary/20 flex flex-wrap items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
          <span>
            {restoring ? `Loading saved run ${restoring}…` : `Running simulation (${status}, ${Math.round(elapsedMs / 1000)} s)…`}
          </span>
          <button
            type="button"
            onClick={cancel}
            className="ml-1 min-h-[32px] px-3 rounded-lg border border-primary/40 bg-surface-container-lowest text-primary hover:bg-primary/10"
          >
            {restoring ? "Stop" : "Cancel"}
          </button>
        </div>
      )}

      {restoreError && (
        <div role="alert" className="py-2 px-4 text-on-surface text-xs border border-outline-variant bg-surface-container-low rounded-xl text-center">
          {restoreError}
        </div>
      )}

      {error && (
        <div role="alert" className="text-center py-2 px-4 text-error text-xs font-bold border border-error/30 bg-error/10 rounded-xl">
          Simulation failed: {error.message}
        </div>
      )}

      {activeSim?.fixtureNote && (
        <div role="note" className="py-2 px-4 text-xs border border-amber-400/60 bg-amber-50 text-on-surface rounded-xl text-center">
          {activeSim.fixtureNote}
        </div>
      )}
    </>
  );
}
