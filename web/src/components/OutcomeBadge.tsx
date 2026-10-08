import type { Outcome } from "@heatgate/contracts";
import { outcomeBgClass, outcomeLabels } from "../theme.ts";

export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return (
    <span className={`inline-block rounded-sm px-xs text-xs font-semibold text-white ${outcomeBgClass[outcome]}`}>
      {outcomeLabels[outcome]}
    </span>
  );
}
