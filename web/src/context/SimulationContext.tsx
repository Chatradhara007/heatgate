// The run the pages show. A finished run's id goes into the URL (?run=<id>) and localStorage, so a reload or a
// deep link (/compare?run=<id>) fetches it again with GET /simulations/:id. The URL wins over localStorage.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import type { SimParams } from "@heatgate/contracts";
import { useDefaults, useSimulation, type WebSimResult } from "../hooks/index.ts";
import { ApiRequestError, USE_FIXTURES } from "../api.ts";

const STORAGE_KEY = "heatgate.run";

// Storage can be missing or throw (private mode, blocked site data); the run then just isn't remembered.
function readStoredRun(): string | undefined {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

function storeRun(id: string | undefined) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore: see readStoredRun
  }
}

interface SimulationContextValue {
  activeSim: WebSimResult | undefined; // undefined until a run finishes or a saved run is fetched again
  params: SimParams | undefined; // undefined until GET /defaults answers
  setParams: (p: SimParams) => void;
  defaultsLoading: boolean;
  defaultsError?: Error;
  runSimulation: (customParams?: SimParams) => Promise<WebSimResult | undefined>;
  cancel: () => void; // stops polling and clears the run state (the last finished result stays)
  loading: boolean;
  restoring: string | undefined; // id of a saved run being fetched again
  restoreError: string | undefined; // the saved run could not be loaded (gone or failed)
  status: string;
  error?: Error;
  elapsedMs: number;
}

const SimulationContext = createContext<SimulationContextValue | null>(null);

// A run is gone when the API says so (404) or the job failed; then forget it. A network error keeps the id, so
// a reload once the API is back shows the run.
function restoreFailure(id: string, err: unknown): { message: string; gone: boolean } {
  if (err instanceof ApiRequestError && err.status === 404) {
    return {
      message: `Run ${id} is no longer on the API (a local API forgets runs when it restarts; the live API keeps them 30 days). Start a new run with Run Simulation on the Policy Sandbox.`,
      gone: true,
    };
  }
  const text = err instanceof Error ? err.message : String(err);
  if (err instanceof ApiRequestError && err.status === undefined && err.code === undefined) {
    return { message: `Run ${id} could not be loaded: ${text} Reload the page once the API is running.`, gone: false };
  }
  return { message: `Run ${id} could not be loaded: ${text} Start a new run with Run Simulation on the Policy Sandbox.`, gone: true };
}

export function SimulationProvider({ children }: { children: ReactNode }) {
  const defaults = useDefaults();
  const sim = useSimulation();
  const [params, setParams] = useState<SimParams | undefined>(undefined);
  const [activeSim, setActiveSim] = useState<WebSimResult | undefined>(undefined);
  const [searchParams, setSearchParams] = useSearchParams();
  const urlRun = searchParams.get("run") ?? undefined;
  const [runId, setRunId] = useState<string | undefined>(() => urlRun ?? readStoredRun());
  const [restoring, setRestoring] = useState<string | undefined>(undefined);
  const [restoreError, setRestoreError] = useState<string | undefined>(undefined);
  const { run, resume, cancel: cancelSim } = sim;

  const setUrlRun = useCallback(
    (id: string | undefined) =>
      setSearchParams(
        (p) => {
          const next = new URLSearchParams(p);
          if (id) next.set("run", id);
          else next.delete("run");
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  // URL -> state: a link or the back button brought a different run.
  useEffect(() => {
    if (urlRun && urlRun !== runId) setRunId(urlRun);
  }, [urlRun, runId]);

  // State -> URL: keep ?run=<id> on every page, so a reload or a shared link shows the same run.
  useEffect(() => {
    if (runId && !urlRun) setUrlRun(runId);
  }, [runId, urlRun, setUrlRun]);

  // Fetch the saved run again (it may still be running: then keep polling).
  useEffect(() => {
    if (!runId || activeSim?.simulationId === runId) return;
    let pending = true;
    setRestoring(runId);
    setRestoreError(undefined);
    resume(runId).then(
      (res) => {
        pending = false;
        setRestoring(undefined);
        if (!res) return;
        setActiveSim(res);
        storeRun(runId);
      },
      (err) => {
        pending = false;
        setRestoring(undefined);
        const { message, gone } = restoreFailure(runId, err);
        setRestoreError(message);
        cancelSim(); // the failure is shown as restoreError, not as a failed new run
        if (gone) {
          storeRun(undefined);
          setRunId(undefined);
          setUrlRun(undefined);
        }
      },
    );
    return () => {
      if (pending) cancelSim();
    };
  }, [runId, activeSim?.simulationId, resume, cancelSim, setUrlRun]);

  const finish = useCallback(
    (res: WebSimResult) => {
      setActiveSim(res);
      setRunId(res.simulationId);
      setUrlRun(res.simulationId);
      storeRun(res.simulationId);
      setRestoreError(undefined);
    },
    [setUrlRun],
  );

  useEffect(() => {
    if (!defaults.data) return;
    setParams(defaults.data);
    // Fixture mode with no saved run: show the fixture run from the start, through the same api/hooks path.
    if (USE_FIXTURES && !runId) run(defaults.data).then((res) => res && finish(res));
    // Only when the defaults arrive.
  }, [defaults.data]);

  const runSimulation = async (customParams?: SimParams): Promise<WebSimResult | undefined> => {
    const toRun = customParams ?? params;
    if (!toRun) return undefined;
    setRestoreError(undefined);
    const res = await run(toRun);
    if (res) finish(res);
    return res;
  };

  const cancel = () => {
    cancelSim();
    setRestoring(undefined);
    // Cancelling a reload's fetch drops that run; otherwise keep the last finished one.
    if (runId !== activeSim?.simulationId) {
      const keep = activeSim?.simulationId;
      setRunId(keep);
      setUrlRun(keep);
      storeRun(keep);
    }
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
        cancel,
        loading: sim.loading,
        restoring,
        restoreError,
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
