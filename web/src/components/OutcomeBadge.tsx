import type { Outcome } from "@heatgate/contracts";
import { OutcomePill } from "./ui.tsx";

// Kept for older imports: the outcome as a small pill in plain words.
export function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  return <OutcomePill outcome={outcome} size="sm" />;
}
