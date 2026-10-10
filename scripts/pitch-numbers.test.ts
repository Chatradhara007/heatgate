// docs/pitch-numbers.md must be exactly what npm run pitch-numbers writes now (line endings aside).
// If this fails, re-run npm run pitch-numbers and read the diff before quoting anything from it.
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { SHEET_PATH, renderPitchNumbers } from "./pitch-numbers.ts";

const lf = (s: string) => s.replace(/\r\n?/g, "\n");

test("docs/pitch-numbers.md is up to date with the simulator, the weather days and the break-even file", () => {
  expect(lf(readFileSync(SHEET_PATH, "utf8")), "docs/pitch-numbers.md is stale: run npm run pitch-numbers").toBe(lf(renderPitchNumbers()));
}, 600_000);
