// In-memory store: for local runs, tests and the smoke script. Data is lost on restart.
import type { Decision, SimulationJob } from "@heatgate/contracts";
import { BadCursorError, MAX_AUDITED_SIMULATIONS, type AuditFilter, type Page, type Store } from "./types.ts";

export class MemoryStore implements Store {
  private decisions: Decision[] = []; // oldest first
  private simulations = new Map<string, SimulationJob>();
  private auditedSimulations: string[] = []; // oldest first

  async putDecision(decision: Decision): Promise<void> {
    this.decisions.push(structuredClone(decision));
  }

  async putSimulationDecisions(simulationId: string, decisions: Decision[]): Promise<void> {
    this.auditedSimulations = this.auditedSimulations.filter((id) => id !== simulationId).concat(simulationId);
    const dropped = new Set([simulationId]);
    while (this.auditedSimulations.length > MAX_AUDITED_SIMULATIONS) dropped.add(this.auditedSimulations.shift()!);
    this.decisions = this.decisions.filter((d) => d.simulationId === undefined || !dropped.has(d.simulationId));
    for (const d of decisions) this.decisions.push(structuredClone({ ...d, simulationId }));
  }

  async listDecisions(filter: AuditFilter, page: { limit: number; cursor?: string }): Promise<Page<Decision>> {
    // Cursor = number of matching items already returned.
    const offset = page.cursor === undefined ? 0 : Number(page.cursor);
    if (!Number.isInteger(offset) || offset < 0) throw new BadCursorError("cursor is not valid");
    const matching = this.decisions
      .filter(
        (d) =>
          (filter.riderId === undefined || d.riderId === filter.riderId) &&
          (filter.outcome === undefined || d.outcome === filter.outcome) &&
          (filter.policyVersion === undefined || d.policyVersion === filter.policyVersion) &&
          (filter.simulationId === undefined || d.simulationId === filter.simulationId),
      )
      .reverse();
    const items = matching.slice(offset, offset + page.limit).map((d) => structuredClone(d));
    const next = offset + items.length;
    return next < matching.length ? { items, nextCursor: String(next) } : { items };
  }

  async putSimulation(job: SimulationJob): Promise<void> {
    this.simulations.set(job.simulationId, structuredClone(job));
  }

  async getSimulation(simulationId: string): Promise<SimulationJob | undefined> {
    const job = this.simulations.get(simulationId);
    return job && structuredClone(job);
  }

  async countActiveSimulations(since: Date): Promise<number> {
    let count = 0;
    for (const job of this.simulations.values()) {
      if ((job.status === "queued" || job.status === "running") && Date.parse(job.createdAt) > since.getTime()) count++;
    }
    return count;
  }
}
