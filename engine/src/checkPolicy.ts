// Validates one Cedar rule set against the schema and the annotation contract in CLAUDE.md.
// Used by scripts/check-policies.ts (the committed files) and POST /policies/render (the knob template).
import * as cedar from "@cedar-policy/cedar-wasm/nodejs";

const OUTCOMES = ["SKIP_ORDER", "DENY", "FORCE_REST"];

const fmt = (errors: { message: string }[]) => errors.map((e) => e.message).join("; ");

// Returns the problems found; an empty list means the text is valid.
export function checkPolicyText(text: string, schema: string): string[] {
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

export function checkSchemaText(schema: string): string[] {
  const answer = cedar.checkParseSchema(schema);
  return answer.type === "failure" ? [fmt(answer.errors)] : [];
}
