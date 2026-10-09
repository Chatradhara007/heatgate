import type { FairKnobs } from "@heatgate/contracts";
import * as api from "../api.ts";
import { useMutation } from "./useAsync.ts";

// The heatgate-fair rules for a set of knobs, on demand: const { data, loading, error, run } = useRenderPolicy();
// run({ workLimitMin: 90, rushHardLimitMin: 90 }). Missing knobs take their default. Debounce slider moves.
// In fixture mode only the default knobs work; anything else fails with "Rule editing needs the live API".
export function useRenderPolicy() {
  return useMutation((knobs: Partial<FairKnobs>, signal: AbortSignal) => api.renderPolicy(knobs, signal));
}
