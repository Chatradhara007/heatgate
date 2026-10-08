// Spec sanity check 3. A shorter day (11:00-16:00) keeps it fast while every rule type fires.
import { expect, test } from "vitest";
import { defaultSimParams, simulate } from "../src/index.ts";

test("the same seed gives identical results twice", () => {
  const params = defaultSimParams({ seeds: [3], startHour: 11, endHour: 16, alertLevel: 1 });
  const first = simulate(params);
  expect(simulate(params)).toEqual(first);
  const fired = Object.values(first.runs).map((run) => run!.metrics.decisions);
  expect(fired.some((d) => d.FORCE_REST > 0) && fired.some((d) => d.DENY > 0) && fired.some((d) => d.SKIP_ORDER > 0)).toBe(true);
}, 60_000);
