import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// The four rule sets and their labels.
export function usePolicies() {
  return useQuery((signal) => api.policies(signal), "policies");
}
