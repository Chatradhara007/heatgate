// Async simulation jobs: queued -> running -> done | failed. One run at a time, first in first out.
import { Worker } from "node:worker_threads";
import type { Decision, SimParams, SimulationJob } from "@heatgate/contracts";
import type { SimOutput } from "@heatgate/sim";
import type { Store } from "../store/types.ts";

export type SimRunner = (params: SimParams, simulationId: string) => Promise<SimOutput>;

// Default runner: a worker thread. Workers inherit the parent's loader flags, so this works under tsx.
export const workerRunner: SimRunner = (params, simulationId) =>
  new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./simWorker.ts", import.meta.url), { workerData: { params, simulationId } });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => code !== 0 && reject(new Error(`simulation worker stopped with code ${code}`)));
  });

export class SimulationQueue {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private store: Store,
    private run: SimRunner,
  ) {}

  async submit(simulationId: string, params: SimParams): Promise<SimulationJob> {
    const job: SimulationJob = { simulationId, status: "queued", createdAt: new Date().toISOString() };
    await this.store.putSimulation(job);
    this.tail = this.tail.then(() => this.execute(job, params));
    return job;
  }

  private async execute(job: SimulationJob, params: SimParams): Promise<void> {
    try {
      await this.store.putSimulation({ ...job, status: "running" });
      const { result, audit } = await this.run(params, job.simulationId);
      // Audit trail first, so it is there as soon as the job reads "done". Newest first in GET /audit
      // means latest simulated time first; the sort is stable, so rule sets keep params order within a minute.
      const trail = Object.values(audit)
        .flatMap((decisions): Decision[] => decisions ?? [])
        .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
      await this.store.putSimulationDecisions(job.simulationId, trail);
      await this.store.putSimulation({ ...job, status: "done", finishedAt: new Date().toISOString(), result });
    } catch (err) {
      console.error(`simulation ${job.simulationId} failed:`, err);
      await this.store
        .putSimulation({
          ...job,
          status: "failed",
          finishedAt: new Date().toISOString(),
          error: { code: "SIMULATION_FAILED", message: "The simulation could not be completed" },
        })
        .catch((e) => console.error(`could not record failure of ${job.simulationId}:`, e));
    }
  }
}
