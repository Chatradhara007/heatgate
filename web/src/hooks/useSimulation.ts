// Starts a simulation and polls it until it is done or failed (every 1 s, 120 s timeout).
//
//   const sim = useSimulation();
//   sim.run(params);          // starts; status goes queued -> running -> done | failed
//   sim.resume(id);           // polls a run started earlier (e.g. after a page reload)
//   sim.data                  // the SimResult once done (fixture mode: data.fixtureNote on a weather replay)
//   sim.cancel();             // stops polling and goes back to idle (the server run carries on)
import { useCallback, useEffect, useRef, useState } from "react";
import type { SimParams, SimulationStatus } from "@heatgate/contracts";
import * as api from "../api.ts";
import type { WebSimResult } from "../api.ts";
import type { AsyncState } from "./useAsync.ts";

export interface SimulationState extends AsyncState<WebSimResult> {
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
    setState(idle);
  }, []);

  // Shared by run and resume: `start` returns the id to poll (creating the run if needed).
  const track = useCallback(async (start: (signal: AbortSignal) => Promise<api.SimulationAccepted>): Promise<WebSimResult | undefined> => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const { signal } = controller;
    const started = Date.now();
    setState({ ...idle, loading: true, status: "queued" });
    try {
      const { simulationId, status } = await start(signal);
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
        throw error;
      }
      return undefined;
    }
  }, []);

  // Resolves with the result, or undefined when cancelled. Rejects when the run fails (also in state.error).
  const run = useCallback(
    (params: SimParams) => track((signal) => api.createSimulation(params, signal)).catch(() => undefined),
    [track],
  );
  // Rejects with the error (e.g. ApiRequestError status 404 when the API no longer has the run).
  const resume = useCallback(
    (simulationId: string) => track(async () => ({ simulationId, status: "queued" as const })),
    [track],
  );

  return { ...state, run, resume, cancel };
}
