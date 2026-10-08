import type { SimulationJob } from "@heatgate/contracts";
import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// One look at a simulation job (no polling). Pass undefined to skip.
export function useGetSimulation(simulationId: string | undefined) {
  return useQuery<SimulationJob | undefined>(
    (signal) => (simulationId ? api.getSimulation(simulationId, signal) : Promise.resolve(undefined)),
    simulationId ?? "",
  );
}
