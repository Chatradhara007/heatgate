// Loads the four rule sets once and keeps each rule's annotations in file order.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import type { PolicyVersion } from "@heatgate/contracts";

const POLICY_DIR = join(import.meta.dirname, "..", "..", "policies");
const VERSIONS: PolicyVersion[] = ["no-rules", "ndma-2025", "union-demand", "heatgate-fair"];

export interface Rule {
  id: string;
  annotations: Record<string, string>;
}

export interface LoadedPolicySet {
  policies: Record<string, string>; // keyed by @id so Cedar reports @id values
  rules: Rule[]; // file order
}

export const schema = readFileSync(join(POLICY_DIR, "heatgate.cedarschema"), "utf8");

function load(version: PolicyVersion): LoadedPolicySet {
  const text = readFileSync(join(POLICY_DIR, `${version}.cedar`), "utf8");
  const parts = cedar.policySetTextToParts(text);
  if (parts.type === "failure") throw new Error(`${version}: ${parts.errors.map((e) => e.message).join("; ")}`);
  const policies: Record<string, string> = {};
  const rules: Rule[] = [];
  for (const policy of parts.policies) {
    const json = cedar.policyToJson(policy);
    if (json.type === "failure") throw new Error(`${version}: ${json.errors.map((e) => e.message).join("; ")}`);
    const annotations = (json.json.annotations ?? {}) as Record<string, string>;
    const id = annotations.id;
    if (!id) throw new Error(`${version}: rule without @id`);
    if (policies[id]) throw new Error(`${version}: duplicate @id ${id}`);
    policies[id] = policy;
    rules.push({ id, annotations });
  }
  return { policies, rules };
}

export const POLICY_SETS = Object.fromEntries(VERSIONS.map((v) => [v, load(v)])) as Record<
  PolicyVersion,
  LoadedPolicySet
>;

// Parse the schema and each rule set once into cedar-wasm's cache (per thread), so decide()
// does not re-parse them on every call. The cache keys are the names below.
export const SCHEMA_NAME = "heatgate";

function preparse(what: string, answer: cedar.CheckParseAnswer) {
  if (answer.type === "failure") throw new Error(`${what}: ${answer.errors.map((e) => e.message).join("; ")}`);
}

preparse("schema", cedar.preparseSchema(SCHEMA_NAME, schema));
for (const v of VERSIONS) preparse(v, cedar.preparsePolicySet(v, { staticPolicies: POLICY_SETS[v].policies }));
