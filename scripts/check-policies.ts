// Validates the Cedar rule sets against the schema and the annotation contract in CLAUDE.md.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { checkPolicyText, checkSchemaText } from "../engine/src/checkPolicy.ts";

const POLICY_DIR = join(import.meta.dirname, "..", "policies");
const FILES = ["no-rules.cedar", "ndma-2025.cedar", "union-demand.cedar", "heatgate-fair.cedar"];

const schema = readFileSync(join(POLICY_DIR, "heatgate.cedarschema"), "utf8");
const schemaErrors = checkSchemaText(schema);
if (schemaErrors.length > 0) {
  console.log(`FAIL heatgate.cedarschema\n  ${schemaErrors.join("\n  ")}`);
  process.exit(1);
}
console.log("PASS heatgate.cedarschema");

let failed = false;
for (const file of FILES) {
  const errors = checkPolicyText(readFileSync(join(POLICY_DIR, file), "utf8"), schema);
  if (errors.length === 0) console.log(`PASS ${file}`);
  else {
    failed = true;
    console.log(`FAIL ${file}`);
    for (const e of errors) console.log(`  ${e}`);
  }
}
process.exit(failed ? 1 : 0);
