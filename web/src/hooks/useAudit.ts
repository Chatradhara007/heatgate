import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// One page of the audit log. Loads again when the query changes; call reload() to refresh.
// Pass query.simulationId to see one simulation's decisions. Key rows with auditRowKey(),
// never decisionId alone: decision ids repeat across simulations.
// enabled = false skips the call (e.g. until there is a simulation to ask about).
export function useAudit(query: api.AuditQuery = {}, enabled = true) {
  return useQuery((signal) => api.audit(query, signal), JSON.stringify(query), enabled);
}
