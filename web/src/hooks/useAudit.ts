import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// One page of the audit log. Loads again when the query changes; call reload() to refresh.
export function useAudit(query: api.AuditQuery = {}) {
  return useQuery((signal) => api.audit(query, signal), JSON.stringify(query));
}
