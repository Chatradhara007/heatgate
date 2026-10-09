// The one store interface. Two versions: memory (memory.ts) and DynamoDB + S3 (dynamo.ts); index.ts picks one.
// Everything is async so a DynamoDB version can drop in without changing the handlers.
import type { Decision, Outcome, PolicyVersion, SimulationJob } from "@heatgate/contracts";

export interface AuditFilter {
  riderId?: string;
  outcome?: Outcome;
  policyVersion?: PolicyVersion;
  simulationId?: string;
}

// Simulation audit trails kept in the store. Older simulations' entries are dropped.
export const MAX_AUDITED_SIMULATIONS = 5;

// POST /simulations answers 429 TOO_MANY_RUNNING when this many jobs are already queued or running.
export const MAX_ACTIVE_SIMULATIONS = 3;
// Jobs older than this are not counted as active: a cloud run stops at 600 s, so a job still queued or
// running after this has crashed (the DynamoDB store then reports it as failed).
export const SIMULATION_STALE_MS = 15 * 60_000;

export interface Page<T> {
  items: T[];
  nextCursor?: string; // opaque; pass back as `cursor` for the next page
}

export interface Store {
  // Audit log of decisions. Rider IDs are pseudonymous; never store names, phones or locations.
  putDecision(decision: Decision): Promise<void>;
  // The audit trail of one finished simulation (every entry carries this simulationId).
  // Replaces any earlier trail for the same id, then keeps only the last MAX_AUDITED_SIMULATIONS trails.
  putSimulationDecisions(simulationId: string, decisions: Decision[]): Promise<void>;
  listDecisions(filter: AuditFilter, page: { limit: number; cursor?: string }): Promise<Page<Decision>>; // newest first

  // Async simulation jobs.
  putSimulation(job: SimulationJob): Promise<void>; // create or replace
  getSimulation(simulationId: string): Promise<SimulationJob | undefined>;
  // Jobs queued or running that were created after `since`.
  countActiveSimulations(since: Date): Promise<number>;
}

export class BadCursorError extends Error {}
