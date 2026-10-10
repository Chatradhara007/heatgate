import type { PolicyVersion } from "@heatgate/contracts";
import { ScenarioBar } from "../components/ScenarioBar.tsx";
import { CitySimulation } from "../components/CitySimulation.tsx";
import { SelectedRiderCard } from "../components/SelectedRiderCard.tsx";
import { PolicyComparisonMatrix } from "../components/PolicyComparisonMatrix.tsx";
import { BottomCards } from "../components/BottomCards.tsx";
import { useActiveSimulation } from "../context/SimulationContext.tsx";

export function SimulatorPage() {
  const { activeSim, params, setParams, defaultsLoading, defaultsError, runSimulation, loading, status, error, elapsedMs } =
    useActiveSimulation();
  const policy: PolicyVersion = "heatgate-fair";

  const handleRun = () => {
    if (params) runSimulation(params);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 lg:px-6 flex flex-col w-full gap-5 lg:gap-6">
      {defaultsLoading && !params && (
        <div className="text-center py-2 px-4 text-on-surface-variant text-xs font-bold rounded-xl border border-outline-variant">
          Loading the default settings from the API…
        </div>
      )}

      {defaultsError && (
        <div role="alert" className="text-center py-2 px-4 text-error text-xs font-bold border border-error/30 bg-error/10 rounded-xl">
          Could not load the default settings: {defaultsError.message}
        </div>
      )}

      {/* ROW 1: SCENARIO BAR */}
      {params && <ScenarioBar params={params} setParams={setParams} />}

      {loading && (
        <div className="text-center py-2 px-4 text-primary text-xs font-bold bg-primary/5 rounded-xl border border-primary/20 flex items-center justify-center gap-2">
          <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
          Running Simulation ({status}, {Math.round(elapsedMs / 1000)} s)…
        </div>
      )}

      {error && (
        <div role="alert" className="text-center py-2 px-4 text-error text-xs font-bold border border-error/30 bg-error/10 rounded-xl">
          Simulation failed: {error.message}
        </div>
      )}

      {/* ROW 2: CITY SIMULATION & SELECTED RIDER */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <CitySimulation sim={activeSim} policy={policy} />
        <SelectedRiderCard sim={activeSim} policy={policy} />
      </div>

      {/* ROW 3: POLICY COMPARISON MATRIX */}
      <PolicyComparisonMatrix sim={activeSim} />

      {/* ROW 4: BOTTOM CARDS */}
      {params && (
        <BottomCards 
          params={params} 
          setParams={setParams} 
          runSimulation={handleRun} 
        />
      )}
    </div>
  );
}
