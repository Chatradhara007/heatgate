import { POLICY_LABELS, type PolicyVersion } from "@heatgate/contracts";
import * as api from "../api.ts";
import { useQuery } from "./useAsync.ts";

// The four rule sets and their labels.
export function usePolicies() {
  return useQuery((signal) => api.policies(signal), "policies");
}

const FALLBACK = (Object.keys(POLICY_LABELS) as PolicyVersion[]).map((id) => ({ id, label: POLICY_LABELS[id] }));

// The labels from GET /policies, in the API's order. Until it answers (or if it fails) the shared contract
// labels stand in; they are the same text the API serves. `short` is the label before any ":" ("Today").
export function usePolicyLabels() {
  const { data } = usePolicies();
  const list = (data ?? FALLBACK).map((p) => ({ ...p, short: p.label.split(":")[0].trim() }));
  const byId = Object.fromEntries(list.map((p) => [p.id, p])) as Partial<Record<PolicyVersion, (typeof list)[number]>>;
  return {
    list,
    label: (id: PolicyVersion) => byId[id]?.label ?? id,
    short: (id: PolicyVersion) => byId[id]?.short ?? id,
  };
}
