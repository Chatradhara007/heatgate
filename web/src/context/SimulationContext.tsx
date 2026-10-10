import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { SimParams, SimResult } from "@heatgate/contracts";
import { useDefaults, useSimulation } from "../hooks/index.ts";
import { USE_FIXTURES } from "../api.ts";

interface SimulationContextValue {
  activeSim: SimResult | undefined; // undefined until a run finishes (fixture mode loads the fixture run at start)
  params: SimParams | undefined; // undefined until GET /defaults answers
  setParams: (p: SimParams) => void;
  defaultsLoading: boolean;
  defaultsError?: Error;
  runSimulation: (customParams?: SimParams) => Promise<SimResult | undefined>;
  loading: boolean;
  status: string;
  error?: Error;
  elapsedMs: number;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

export function SimulationProvider({ children }: { children: ReactNode }) {
  const defaults = useDefaults();
  const sim = useSimulation();
  const [params, setParams] = useState<SimParams | undefined>(undefined);
  const [activeSim, setActiveSim] = useState<SimResult | undefined>(undefined);
  const { run } = sim;

  useEffect(() => {
    if (!defaults.data) return;
    setParams(defaults.data);
    // Fixture mode: show the fixture run from the start, through the same api/hooks path as a real run.
    if (USE_FIXTURES) run(defaults.data).then((res) => res && setActiveSim(res));
  }, [defaults.data, run]);

  const runSimulation = async (customParams?: SimParams): Promise<SimResult | undefined> => {
    const toRun = customParams ?? params;
    if (!toRun) return undefined;
    const res = await sim.run(toRun);
    if (res) {
      setActiveSim(res);
    }
    return res;
  };

  return (
    <SimulationContext.Provider
      value={{
        activeSim,
        params,
        setParams,
        defaultsLoading: defaults.loading,
        defaultsError: defaults.error,
        runSimulation,
        loading: sim.loading,
        status: sim.status,
        error: sim.error,
        elapsedMs: sim.elapsedMs,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useActiveSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) {
    throw new Error("useActiveSimulation must be used within a SimulationProvider");
  }
  return ctx;
}
