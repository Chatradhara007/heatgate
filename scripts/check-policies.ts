// Validates the Cedar rule sets against the schema and the annotation contract in CLAUDE.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as cedar from "@cedar-policy/cedar-wasm/nodejs";

const POLICY_DIR = join(import.meta.dirname, "..", "policies");
const FILES = ["no-rules.cedar", "ndma-2025.cedar", "union-demand.cedar", "heatgate-fair.cedar"];
const OUTCOMES = ["SKIP_ORDER", "DENY", "FORCE_REST"];

const fmt = (errors: { message: string }[]) => errors.map((e) => e.message).join("; ");

function checkFile(file: string, schema: string): string[] {
  const text = readFileSync(join(POLICY_DIR, file), "utf8");
  const parsed = cedar.checkParsePolicySet({ staticPolicies: text });
  if (parsed.type === "failure") return [`parse error: ${fmt(parsed.errors)}`];

  const errors: string[] = [];
  const validation = cedar.validate({ schema, policies: { staticPolicies: text } });
  if (validation.type === "failure") {
    errors.push(`validation call failed: ${fmt(validation.errors)}`);
  } else {
    for (const v of validation.validationErrors) errors.push(`validation (${v.policyId}): ${v.error.message}`);
  }

  const parts = cedar.policySetTextToParts(text);
  if (parts.type === "failure") return [...errors, `split error: ${fmt(parts.errors)}`];

  const seen = new Set<string>();
  parts.policies.forEach((policy, i) => {
    const json = cedar.policyToJson(policy);
    if (json.type === "failure") return errors.push(`policy #${i + 1}: ${fmt(json.errors)}`);
    const a = json.json.annotations ?? {};
    const id = a.id;
    const label = id ? `rule "${id}"` : `policy #${i + 1}`;
    if (id) {
      if (seen.has(id)) errors.push(`duplicate @id "${id}"`);
      seen.add(id);
    }
    if (json.json.effect !== "forbid") return;
    if (!id) errors.push(`${label}: missing @id`);
    if (!a.outcome) errors.push(`${label}: missing @outcome`);
    else if (!OUTCOMES.includes(a.outcome)) errors.push(`${label}: bad @outcome "${a.outcome}"`);
    if (!a.message) errors.push(`${label}: missing @message`);
    if (a.outcome === "FORCE_REST" && !id?.endsWith("-rest-in-progress") && !a.restMinutes) {
      errors.push(`${label}: FORCE_REST rule missing @restMinutes`);
    }
  });
  return errors;
}

const schema = readFileSync(join(POLICY_DIR, "heatgate.cedarschema"), "utf8");
const schemaCheck = cedar.checkParseSchema(schema);
if (schemaCheck.type === "failure") {
  console.log(`FAIL heatgate.cedarschema\n  ${fmt(schemaCheck.errors)}`);
  process.exit(1);
}
console.log("PASS heatgate.cedarschema");

let failed = false;
for (const file of FILES) {
  const errors = checkFile(file, schema);
  if (errors.length === 0) console.log(`PASS ${file}`);
  else {
    failed = true;
    console.log(`FAIL ${file}`);
    for (const e of errors) console.log(`  ${e}`);
  }
}
process.exit(failed ? 1 : 0);
