// Runs one simulation off the main thread, so the API keeps answering while it works.
import { parentPort, workerData } from "node:worker_threads";
import type { SimParams } from "@heatgate/contracts";
import { simulate } from "@heatgate/sim";

const { params, simulationId } = workerData as { params: SimParams; simulationId: string };
parentPort!.postMessage(simulate(params, simulationId));
