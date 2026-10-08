import type { DecideRequest } from "@heatgate/contracts";
import * as api from "../api.ts";
import { useMutation } from "./useAsync.ts";

// One decision on demand: const { data, loading, error, run } = useDecide(); run(request).
export function useDecide() {
  return useMutation((req: DecideRequest, signal: AbortSignal) => api.decide(req, signal));
}
