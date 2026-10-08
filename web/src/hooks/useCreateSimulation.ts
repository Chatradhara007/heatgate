import type { SimParams } from "@heatgate/contracts";
import * as api from "../api.ts";
import { useMutation } from "./useAsync.ts";

// Only starts a simulation (202 + simulationId). Most pages want useSimulation, which also polls.
export function useCreateSimulation() {
  return useMutation((params: SimParams, signal: AbortSignal) => api.createSimulation(params, signal));
}
