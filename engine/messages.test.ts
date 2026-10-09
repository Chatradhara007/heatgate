// Every message a rider can see has a Hindi, Telugu and Urdu version, with nothing left to fill in.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import type { Decision, Outcome } from "@heatgate/contracts";
import { ALLOW_MESSAGE, DEFAULT_FAIR_KNOBS, auditRecord, messagesFor, nearestCoolingPoint } from "./src/index.ts";
import { POLICY_SETS, fairPolicySet } from "./src/policies.ts";

const LANGS = ["hi", "te", "ur"] as const;

// [rule id, outcome, English] for every rule with a message, plus the ALLOW message.
const messages: [string, Outcome, string][] = [
  ["allow", "ALLOW", ALLOW_MESSAGE],
  ...Object.values(POLICY_SETS).flatMap((set) =>
    set.rules.filter((r) => r.annotations.message).map((r) => [r.id, r.annotations.outcome as Outcome, r.annotations.message] as [string, Outcome, string]),
  ),
];

describe("translations", () => {
  test("cover every outcome", () => {
    expect(new Set(messages.map(([, outcome]) => outcome))).toEqual(new Set(["ALLOW", "SKIP_ORDER", "DENY", "FORCE_REST"]));
    expect(messages).toHaveLength(13);
  });

  for (const [id, outcome, english] of messages) {
    test(`${id} (${outcome}) in every language, no placeholders`, () => {
      const m = messagesFor(id, english);
      for (const lang of LANGS) expect(m?.[lang], lang).toMatch(/\S/);
      for (const text of [english, ...Object.values(m ?? {})]) expect(text).not.toMatch(/[{}]/);
    });
  }

  test("heatgate-fair rendered from other knobs keeps its translations (the words do not change)", () => {
    const { set } = fairPolicySet({ ...DEFAULT_FAIR_KNOBS, workLimitMin: 90, restHeatC: 36 });
    for (const r of set.rules.filter((r) => r.annotations.message)) {
      for (const lang of LANGS) expect(messagesFor(r.id, r.annotations.message)?.[lang]).toMatch(/\S/);
    }
  });

  test("a translation made from other English words is not used", () => {
    expect(messagesFor("fair-rest-due", "Some new wording.")).toBeUndefined();
  });

  test("a rule's own @messageHi wins over the table", () => {
    expect(messagesFor("fair-rest-due", "Paid 20-minute cooling break. Nearest shade and water below.", { messageHi: "X" })?.hi).toBe("X");
  });
});

describe("docs/translations", () => {
  const ROOT = join(import.meta.dirname, "..");

  test("messages.csv and engine/src/translations.ts are up to date (npm run export-messages -- --check)", () => {
    const run = spawnSync(join(ROOT, "node_modules", ".bin", "tsx"), ["scripts/export-messages.ts", "--check"], { cwd: ROOT, encoding: "utf8" });
    expect(run.stdout).toMatch(/^PASS/);
    expect(run.status).toBe(0);
  }, 30_000);

  test("every row not reviewed yet is listed in REVIEW.md", () => {
    const csv = readFileSync(join(ROOT, "docs", "translations", "messages.csv"), "utf8").trim().split("\n");
    const review = readFileSync(join(ROOT, "docs", "translations", "REVIEW.md"), "utf8");
    const unreviewed = csv.slice(1).filter((line) => line.endsWith(",false")).map((line) => line.split(",")[0]);
    expect(unreviewed.length).toBeGreaterThan(0); // machine-written today: nothing is checked yet
    for (const id of unreviewed) expect(review).toContain(`\`${id}\``);
  });
});

describe("cooling point", () => {
  const points = [
    { name: "A", x: 0, y: 0 },
    { name: "B", x: 4, y: 3 },
  ];
  test("the nearest one, distance in metres rounded to 10 m", () => {
    expect(nearestCoolingPoint({ id: "r", vehicle: "bike", x: 4, y: 0 }, points)).toEqual({ name: "B", distanceM: 3000 });
    expect(nearestCoolingPoint({ id: "r", vehicle: "bike", x: 0.1234, y: 0 }, points)).toEqual({ name: "A", distanceM: 120 });
  });

  test("auditRecord drops the cooling point and keeps the rest", () => {
    const d = { decisionId: "x", messages: { hi: "h" }, coolingPoint: { name: "A", distanceM: 10 } } as unknown as Decision;
    expect(auditRecord(d)).toEqual({ decisionId: "x", messages: { hi: "h" } });
    expect(d.coolingPoint).toBeDefined(); // the original is unchanged
  });
});
