// Starts a simulation and polls it until it is done or failed (every 1 s, 120 s timeout).
//
//   const sim = useSimulation();
//   sim.run(params);          // starts; status goes queued -> running -> done | failed
//   sim.data                  // the SimResult once done
//   sim.cancel();             // stops polling (the server run carries on)
import { useCallback, useEffect, useRef, useState } from "react";
import type { SimParams, SimResult, SimulationStatus } from "@heatgate/contracts";
import * as api from "../api.ts";
import type { AsyncState } from "./useAsync.ts";

export interface SimulationState extends AsyncState<SimResult> {
  status: SimulationStatus | "idle";
  simulationId: string | undefined;
  elapsedMs: number; // since run() was called, updated on every poll
}

const idle: SimulationState = { data: undefined, loading: false, error: undefined, status: "idle", simulationId: undefined, elapsedMs: 0 };

export function useSimulation() {
  const [state, setState] = useState<SimulationState>(idle);
  const controllerRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const cancel = useCallback(() => {
    controllerRef.current?.abort();
    setState((s) => ({ ...s, loading: false }));
  }, []);

  const run = useCallback(async (params: SimParams): Promise<SimResult | undefined> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    const started = Date.now();
    setState({ ...idle, loading: true, status: "queued" });
    try {
      const { simulationId, status } = await api.createSimulation(params, signal);
      if (signal.aborted) return undefined;
      setState((s) => ({ ...s, simulationId, status, elapsedMs: Date.now() - started }));
      const result = await api.waitForSimulation(simulationId, {
        signal,
        onStatus: (job) => !signal.aborted && setState((s) => ({ ...s, status: job.status, elapsedMs: Date.now() - started })),
      });
      if (!signal.aborted) setState((s) => ({ ...s, data: result, loading: false, status: "done", elapsedMs: Date.now() - started }));
      return result;
    } catch (err) {
      if (!signal.aborted) {
        const error = err instanceof Error ? err : new Error(String(err));
        setState((s) => ({ ...s, loading: false, error, status: "failed", elapsedMs: Date.now() - started }));
      }
      return undefined;
    }
  }, []);

  return { ...state, run, cancel };
}
