// Exports every rule @message to docs/translations/messages.csv, plus an "allow" row for "Order assigned.",
// and writes engine/src/translations.ts (what decide() reads) from the CSV.
// The English column always comes from the rules. The translations and the "reviewed" column come from a rule's
// @messageHi/@messageTe/@messageUr if it has one, otherwise they are kept from the CSV, so translators edit the
// CSV and rerun this. If a rule's English changed, its old translations are dropped (they no longer match).
// --check: exit 1 if either file is out of date, a required language has an empty translation, a translation
// has a {placeholder}, or "reviewed" is not true/false.
// --require=hindi,telugu: mark extra languages as required for this run.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import * as cedar from "@cedar-policy/cedar-wasm/nodejs";
import { ALLOW_MESSAGE, ALLOW_MESSAGE_KEY } from "../engine/src/messages.ts";

const ROOT = join(import.meta.dirname, "..");
const POLICY_DIR = join(ROOT, "policies");
const CSV_PATH = join(ROOT, "docs", "translations", "messages.csv");
const TS_PATH = join(ROOT, "engine", "src", "translations.ts");
const FILES = ["no-rules.cedar", "ndma-2025.cedar", "union-demand.cedar", "heatgate-fair.cedar"];

const LANGUAGES = { hindi: "messageHi", telugu: "messageTe", urdu: "messageUr" } as const;
type Language = keyof typeof LANGUAGES;
const CODES: Record<Language, "hi" | "te" | "ur"> = { hindi: "hi", telugu: "te", urdu: "ur" };
// Languages every message must have a translation for.
const REQUIRED_LANGUAGES: Language[] = ["hindi", "telugu", "urdu"];

const COLUMNS = ["ruleId", "policy", "outcome", "english", "hindi", "telugu", "urdu", "reviewed"] as const;
type Row = Record<(typeof COLUMNS)[number], string>;

const fmt = (errors: { message: string }[]) => errors.map((e) => e.message).join("; ");

// RFC 4180 reader for the CSV this script writes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') cell += text[++i];
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell || row.length > 0) rows.push([...row, cell]);
  return rows;
}

function readCsv(): Map<string, Partial<Row>> {
  const byKey = new Map<string, Partial<Row>>();
  if (!existsSync(CSV_PATH)) return byKey;
  const [header, ...lines] = parseCsv(readFileSync(CSV_PATH, "utf8"));
  for (const cells of lines) {
    const row = Object.fromEntries(header.map((h, i) => [h, cells[i] ?? ""])) as Partial<Row>;
    byKey.set(`${row.policy}/${row.ruleId}`, row);
  }
  return byKey;
}

const previous = readCsv();

// One row; translations from the annotations first, then the CSV (if it was made from the same English).
function row(ruleId: string, policy: string, outcome: string, english: string, a: Record<string, string> = {}): Row {
  const old = previous.get(`${policy}/${ruleId}`);
  const kept = old?.english === english ? old : undefined;
  if (old && !kept) console.log(`  ${policy}/${ruleId}: English changed, translations dropped (translate again)`);
  return {
    ruleId,
    policy,
    outcome,
    english,
    hindi: a.messageHi ?? kept?.hindi ?? "",
    telugu: a.messageTe ?? kept?.telugu ?? "",
    urdu: a.messageUr ?? kept?.urdu ?? "",
    reviewed: kept?.reviewed || "false",
  };
}

function rowsFor(file: string): Row[] {
  const text = readFileSync(join(POLICY_DIR, file), "utf8");
  const parts = cedar.policySetTextToParts(text);
  if (parts.type === "failure") throw new Error(`${file}: ${fmt(parts.errors)}`);
  const policy = file.replace(/\.cedar$/, "");
  const rows: Row[] = [];
  for (const p of parts.policies) {
    const json = cedar.policyToJson(p);
    if (json.type === "failure") throw new Error(`${file}: ${fmt(json.errors)}`);
    const a = (json.json.annotations ?? {}) as Record<string, string>;
    if (!a.message) continue;
    rows.push(row(a.id ?? "", policy, a.outcome ?? "", a.message, a));
  }
  return rows;
}

// RFC 4180: quote a field if it has a comma, quote or line break; double inner quotes.
const field = (s: string) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
const toCsv = (rows: Row[]) =>
  [COLUMNS.join(","), ...rows.map((r) => COLUMNS.map((c) => field(r[c])).join(","))].join("\n") + "\n";

// Keyed by rule id ("allow" for ALLOW). Rule ids are unique across the rule sets (checked below).
function toTs(rows: Row[]): string {
  const entries = rows
    .filter((r) => r.hindi || r.telugu || r.urdu)
    .map((r) => {
      const langs = (Object.keys(CODES) as Language[]).filter((l) => r[l]).map((l) => `    ${CODES[l]}: ${JSON.stringify(r[l])},`);
      return [`  ${JSON.stringify(r.ruleId)}: {`, `    english: ${JSON.stringify(r.english)},`, ...langs, `  },`].join("\n");
    });
  return [
    "// GENERATED by npm run export-messages from docs/translations/messages.csv. Do not edit; edit the CSV.",
    "// Machine-written translations are marked reviewed=false in the CSV and listed in docs/translations/REVIEW.md.",
    "export const TRANSLATIONS: Record<string, { english: string; hi?: string; te?: string; ur?: string }> = {",
    ...entries,
    "};",
    "",
  ].join("\n");
}

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
const rows = [row(ALLOW_MESSAGE_KEY, "all", "ALLOW", ALLOW_MESSAGE), ...FILES.flatMap(rowsFor)];
const ids = rows.map((r) => r.ruleId);
const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
if (dupes.length > 0) throw new Error(`rule ids must be unique across the rule sets: ${[...new Set(dupes)].join(", ")}`);
const csv = toCsv(rows);
const ts = toTs(rows);
const rel = (p: string) => p.slice(ROOT.length + 1);
const unreviewed = rows.filter((r) => r.reviewed !== "true").length;

if (!args.includes("--check")) {
  mkdirSync(dirname(CSV_PATH), { recursive: true });
  writeFileSync(CSV_PATH, csv);
  writeFileSync(TS_PATH, ts);
  console.log(`Wrote ${rows.length} rows to ${rel(CSV_PATH)} and ${rel(TS_PATH)} (${unreviewed} not reviewed yet)`);
  process.exit(0);
}

const lf = (text: string) => text.replace(/\r\n/g, "\n");
const problems: string[] = [];
for (const lang of parseRequired(args)) {
  for (const r of rows) {
    if (!r[lang].trim()) problems.push(`${r.policy}/${r.ruleId}: empty ${lang} translation (@${LANGUAGES[lang]} or the CSV)`);
  }
}
for (const r of rows) {
  for (const lang of Object.keys(LANGUAGES) as Language[]) {
    if (/[{}]/.test(r[lang])) problems.push(`${r.policy}/${r.ruleId}: ${lang} has a {placeholder}; messages are sent as they are`);
  }
  if (r.reviewed !== "true" && r.reviewed !== "false") problems.push(`${r.policy}/${r.ruleId}: reviewed must be true or false`);
}
for (const [path, want] of [
  [CSV_PATH, csv],
  [TS_PATH, ts],
] as const) {
  const current = existsSync(path) ? readFileSync(path, "utf8") : null;
  if (current === null) problems.push(`${rel(path)} is missing. Run npm run export-messages.`);
  // Ignore line endings: Git on Windows may check the files out with CRLF.
  else if (lf(current) !== lf(want)) problems.push(`${rel(path)} is out of date. Run npm run export-messages.`);
}

if (problems.length === 0) {
  console.log(`PASS ${rel(CSV_PATH)} (${rows.length} messages, ${unreviewed} not reviewed yet: see docs/translations/REVIEW.md)`);
  process.exit(0);
}
console.log(`FAIL ${rel(CSV_PATH)}`);
for (const p of problems) console.log(`  ${p}`);
process.exit(1);
