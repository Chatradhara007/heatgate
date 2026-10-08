// The one store interface. Two versions: memory (memory.ts) and DynamoDB (later).
// Everything is async so a DynamoDB version can drop in without changing the handlers.
import type { Decision, Outcome, PolicyVersion, SimulationJob } from "@heatgate/contracts";

export interface AuditFilter {
  riderId?: string;
  outcome?: Outcome;
  policyVersion?: PolicyVersion;
}

export interface Page<T> {
  items: T[];
  nextCursor?: string; // opaque; pass back as `cursor` for the next page
}

export interface Store {
  // Audit log of decisions. Rider IDs are pseudonymous; never store names, phones or locations.
  putDecision(decision: Decision): Promise<void>;
  listDecisions(filter: AuditFilter, page: { limit: number; cursor?: string }): Promise<Page<Decision>>; // newest first

  // Async simulation jobs.
  putSimulation(job: SimulationJob): Promise<void>; // create or replace
  getSimulation(simulationId: string): Promise<SimulationJob | undefined>;
}

export class BadCursorError extends Error {}
