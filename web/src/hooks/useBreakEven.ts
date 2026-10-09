import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// The break-even rest pay sweep (GET /break-even). Check data.stale before quoting it.
// All rupee amounts are placeholders from interview-pending economics.
export function useBreakEven() {
  return useQuery((signal) => api.breakEven(signal), "break-even");
}
