// Loads the four rule sets once and keeps each rule's annotations in file order.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import type { FairKnobs, PolicyVersion } from "@heatgate/contracts";
import { checkPolicyText } from "./checkPolicy.ts";
import { fairKnobsKey, renderFairPolicy } from "./fairKnobs.ts";

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
  return parse(version, readFileSync(join(POLICY_DIR, `${version}.cedar`), "utf8"));
}

function parse(version: string, text: string): LoadedPolicySet {
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

// heatgate-fair rendered from knobs (engine/src/fairKnobs.ts), validated against the schema with the same
// checks as scripts/check-policies.ts, then parsed into this thread's cedar-wasm cache once per knob set.
export interface FairPolicySet {
  id: string; // cedar-wasm cache name
  set: LoadedPolicySet;
}

const fairSets = new Map<string, FairPolicySet>();
const MAX_FAIR_SETS = 50; // a handful of slider positions per demo; keeps a long-lived server bounded

export function fairPolicySet(knobs: FairKnobs): FairPolicySet {
  const key = fairKnobsKey(knobs);
  const cached = fairSets.get(key);
  if (cached) return cached;
  const text = renderFairPolicy(knobs);
  const errors = checkPolicyText(text, schema);
  if (errors.length > 0) throw new Error(`heatgate-fair (${key}): ${errors.join("; ")}`);
  const id = `heatgate-fair#${key}`;
  const set = parse(id, text);
  preparse(id, cedar.preparsePolicySet(id, { staticPolicies: set.policies }));
  if (fairSets.size >= MAX_FAIR_SETS) fairSets.clear();
  const entry = { id, set };
  fairSets.set(key, entry);
  return entry;
}
