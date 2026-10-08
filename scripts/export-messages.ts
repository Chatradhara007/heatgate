// Exports every rule @message (and its translations) to docs/translations/messages.csv.
// --check: exit 1 if the CSV is out of date or a required language has an empty translation.
// --require=hindi,telugu: mark extra languages as required for this run.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as cedar from "@cedar-policy/cedar-wasm/nodejs";

const ROOT = join(import.meta.dirname, "..");
const POLICY_DIR = join(ROOT, "policies");
const CSV_PATH = join(ROOT, "docs", "translations", "messages.csv");
const FILES = ["no-rules.cedar", "ndma-2025.cedar", "union-demand.cedar", "heatgate-fair.cedar"];

const LANGUAGES = { hindi: "messageHi", telugu: "messageTe", urdu: "messageUr" } as const;
type Language = keyof typeof LANGUAGES;
// Languages every rule must have a translation for. None yet: no rule has translations today.
const REQUIRED_LANGUAGES: Language[] = [];

const COLUMNS = ["ruleId", "policy", "outcome", "english", "hindi", "telugu", "urdu"] as const;
type Row = Record<(typeof COLUMNS)[number], string>;

const fmt = (errors: { message: string }[]) => errors.map((e) => e.message).join("; ");

function rowsFor(file: string): Row[] {
  const text = readFileSync(join(POLICY_DIR, file), "utf8");
  const parts = cedar.policySetTextToParts(text);
  if (parts.type === "failure") throw new Error(`${file}: ${fmt(parts.errors)}`);
  const policy = file.replace(/\.cedar$/, "");
  const rows: Row[] = [];
  for (const p of parts.policies) {
    const json = cedar.policyToJson(p);
    if (json.type === "failure") throw new Error(`${file}: ${fmt(json.errors)}`);
    const a = json.json.annotations ?? {};
    if (!a.message) continue;
    rows.push({
      ruleId: a.id ?? "",
      policy,
      outcome: a.outcome ?? "",
      english: a.message,
      hindi: a.messageHi ?? "",
      telugu: a.messageTe ?? "",
      urdu: a.messageUr ?? "",
    });
  }
  return rows;
}

// RFC 4180: quote a field if it has a comma, quote or line break; double inner quotes.
const field = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const toCsv = (rows: Row[]) =>
  [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => field(r[c])).join(","))].join("\n") + "\n";

function parseRequired(args: string[]): Language[] {
  const required = new Set<Language>(REQUIRED_LANGUAGES);
  for (const arg of args) {
    if (!arg.startsWith("--require=")) continue;
    for (const name of arg.slice("--require=".length).split(",").filter(Boolean)) {
      if (!(name in LANGUAGES)) throw new Error(`unknown language "${name}" (use ${Object.keys(LANGUAGES).join(", ")})`);
      required.add(name as Language);
    }
  }
  return [...required];
}

const args = process.argv.slice(2);
const rows = FILES.flatMap(rowsFor);
const csv = toCsv(rows);
const rel = CSV_PATH.slice(ROOT.length + 1);

if (!args.includes("--check")) {
  mkdirSync(dirname(CSV_PATH), { recursive: true });
  writeFileSync(CSV_PATH, csv);
  console.log(`Wrote ${rows.length} rows to ${rel}`);
  process.exit(0);
}

const problems: string[] = [];
for (const lang of parseRequired(args)) {
  for (const r of rows) {
    if (!r[lang].trim()) problems.push(`${r.policy}/${r.ruleId}: empty ${lang} translation (@${LANGUAGES[lang]})`);
  }
}
const current = existsSync(CSV_PATH) ? readFileSync(CSV_PATH, "utf8") : null;
if (current === null) problems.push(`${rel} is missing. Run npm run export-messages.`);
else if (current !== csv) problems.push(`${rel} is out of date. Run npm run export-messages.`);

if (problems.length === 0) {
  console.log(`PASS ${rel} (${rows.length} rules)`);
  process.exit(0);
}
console.log(`FAIL ${rel}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(1);
