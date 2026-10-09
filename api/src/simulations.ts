// Async simulation jobs: queued -> running -> done | failed.
// Locally: SimulationQueue runs them in this process, one at a time, first in first out.
// In the cloud: lambdaSubmitter (api/src/lambda.ts) hands each job to SimFunction, which calls runSimulationJob.
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

// Starts a job and returns it as queued. The run itself happens later, elsewhere.
export interface SimulationSubmitter {
  submit(simulationId: string, params: SimParams): Promise<SimulationJob>;
}

export const queuedJob = (simulationId: string): SimulationJob => ({ simulationId, status: "queued", createdAt: new Date().toISOString() });

export class SimulationQueue implements SimulationSubmitter {
  private tail: Promise<void> = Promise.resolve();

  constructor(
    private store: Store,
    private run: SimRunner,
  ) {}

  async submit(simulationId: string, params: SimParams): Promise<SimulationJob> {
    const job = queuedJob(simulationId);
    await this.store.putSimulation(job);
    this.tail = this.tail.then(() => runSimulationJob(this.store, this.run, job, params));
    return job;
  }
}

// running, then the audit trail, then done (with the result) or failed. Never throws.
export async function runSimulationJob(store: Store, run: SimRunner, job: SimulationJob, params: SimParams): Promise<void> {
  try {
    await store.putSimulation({ ...job, status: "running" });
    const { result, audit } = await run(params, job.simulationId);
    // Audit trail first, so it is there as soon as the job reads "done". Newest first in GET /audit
    // means latest simulated time first; the sort is stable, so rule sets keep params order within a minute.
    const trail = Object.values(audit)
      .flatMap((decisions): Decision[] => decisions ?? [])
      .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
    await store.putSimulationDecisions(job.simulationId, trail);
    await store.putSimulation({ ...job, status: "done", finishedAt: new Date().toISOString(), result });
  } catch (err) {
    console.error(`simulation ${job.simulationId} failed:`, err);
    await store
      .putSimulation({
        ...job,
        status: "failed",
        finishedAt: new Date().toISOString(),
        error: { code: "SIMULATION_FAILED", message: "The simulation could not be completed" },
      })
      .catch((e) => console.error(`could not record failure of ${job.simulationId}:`, e));
  }
}
