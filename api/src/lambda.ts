// AWS Lambda entry points (template.yaml). One bundle, two functions:
// - handler (ApiFunction): the Express app from app.ts behind an HTTP API (payload v2). Tiny adapter, no
//   new dependency: the app listens on a loopback port once per container and each Lambda event is
//   forwarded to it with fetch. POST /simulations stores a queued job and invokes SimFunction
//   asynchronously (SIM_FUNCTION), because a Lambda is frozen as soon as it has answered.
// - simHandler (SimFunction): runs one simulation job and stores its status, result and audit trail.
// Both use the store picked by STORE (dynamo in template.yaml; see api/store/index.ts).
//
// esbuild bundles everything into one file, but at import time the engine reads policies/*.cedar and
// cedar-wasm reads cedar_wasm_bg.wasm from disk next to their own source files. So this file embeds
// those files (template.yaml Loader: .cedar/.cedarschema as text, .wasm as binary), writes them to /tmp
// on a cold start, points the paths there, and only then loads the app with a dynamic import.
import { mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import type { SimParams, SimulationJob } from "@heatgate/contracts";
import type { SimRunner, SimulationSubmitter } from "./simulations.ts"; // types only: erased, so not loaded early
// @ts-expect-error text loader (esbuild)
import schemaText from "../../policies/heatgate.cedarschema";
// @ts-expect-error text loader (esbuild)
import noRules from "../../policies/no-rules.cedar";
// @ts-expect-error text loader (esbuild)
import ndma2025 from "../../policies/ndma-2025.cedar";
// @ts-expect-error text loader (esbuild)
import unionDemand from "../../policies/union-demand.cedar";
// @ts-expect-error text loader (esbuild)
import heatgateFair from "../../policies/heatgate-fair.cedar";
// binary loader (esbuild); its .d.ts describes the wasm exports, not the bytes
import cedarWasm from "../../node_modules/@cedar-policy/cedar-wasm/nodejs/cedar_wasm_bg.wasm"; // not in its package exports
import breakEven from "../../sim/results/break-even.json";

// Only the fields of the API Gateway HTTP API (payload format 2.0) event and result we use.
interface HttpApiEvent {
  rawPath: string;
  rawQueryString: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded: boolean;
  requestContext: { http: { method: string } };
}

interface HttpApiResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

const ROOT = "/tmp/heatgate";
const files: Record<string, string | Uint8Array> = {
  "policies/heatgate.cedarschema": schemaText,
  "policies/no-rules.cedar": noRules,
  "policies/ndma-2025.cedar": ndma2025,
  "policies/union-demand.cedar": unionDemand,
  "policies/heatgate-fair.cedar": heatgateFair,
  "wasm/cedar_wasm_bg.wasm": cedarWasm as unknown as Uint8Array,
  "sim/results/break-even.json": JSON.stringify(breakEven),
};
for (const [path, content] of Object.entries(files)) {
  mkdirSync(join(ROOT, path, ".."), { recursive: true });
  writeFileSync(join(ROOT, path), content);
}

// engine/src/policies.ts reads join(import.meta.dirname, "..", "..", "policies"); in the bundle every
// module shares this file's import.meta. cedar-wasm is CommonJS and reads `${__dirname}/...wasm` with
// require("fs"), which do not exist in an ES module, so give it both as globals.
import.meta.dirname = join(ROOT, "api", "src");
Object.assign(globalThis, { __dirname: join(ROOT, "wasm"), require: createRequire(import.meta.url) });

const { createApp } = await import("./app.ts");
const { createStore } = await import("../store/index.ts");
const { SimulationQueue, queuedJob, runSimulationJob } = await import("./simulations.ts");
const { simulateWithAudit } = await import("@heatgate/sim");

// What ApiFunction sends to SimFunction.
export interface SimEvent {
  job: SimulationJob; // as stored, status "queued"
  params: SimParams; // already checked by validate.ts
}

const store = createStore();
// simWorker.ts is not in the bundle, so runs happen on the main thread; SimFunction does nothing else.
const runHere: SimRunner = async (params, simulationId) => simulateWithAudit(params, simulationId);

async function lambdaSubmitter(functionName: string): Promise<SimulationSubmitter> {
  const { LambdaClient, InvokeCommand } = await import("@aws-sdk/client-lambda");
  const lambda = new LambdaClient({});
  return {
    async submit(simulationId, params) {
      const job = queuedJob(simulationId);
      await store.putSimulation(job);
      const event: SimEvent = { job, params };
      try {
        // "Event": queue the call and return at once (SimFunction has retries turned off in template.yaml).
        await lambda.send(
          new InvokeCommand({ FunctionName: functionName, InvocationType: "Event", Payload: new TextEncoder().encode(JSON.stringify(event)) }),
        );
      } catch (err) {
        await store
          .putSimulation({
            ...job,
            status: "failed",
            finishedAt: new Date().toISOString(),
            error: { code: "SIMULATION_FAILED", message: "The simulation could not be started" },
          })
          .catch((e) => console.error(`could not record failure of ${simulationId}:`, e));
        throw err;
      }
      return job;
    },
  };
}

// Without SIM_FUNCTION (only sensible with STORE=memory) jobs run in this container, as before.
const simFunction = process.env.SIM_FUNCTION;
const simulations = simFunction ? await lambdaSubmitter(simFunction) : new SimulationQueue(store, runHere);
const app = createApp({ store, simulations, breakEvenPath: join(ROOT, "sim/results/break-even.json") });

const GZIP_OVER_BYTES = 1_000_000;

// Started on the first API event, so SimFunction containers never open a port.
let origin: Promise<string> | undefined;
function listen(): Promise<string> {
  const server = app.listen(0, "127.0.0.1");
  return new Promise((resolve) => server.once("listening", () => resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)));
}

export async function handler(event: HttpApiEvent): Promise<HttpApiResult> {
  origin ??= listen();
  const method = event.requestContext.http.method;
  const url = `${await origin}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`;
  let body: Buffer | undefined;
  if (event.body !== undefined && method !== "GET" && method !== "HEAD") {
    body = Buffer.from(event.body, event.isBase64Encoded ? "base64" : "utf8");
  }
  const res = await fetch(url, { method, headers: event.headers, body });
  const headers: Record<string, string> = {};
  res.headers.forEach((value, name) => {
    // fetch has already decoded the body and Lambda sets its own framing headers.
    if (!["content-length", "content-encoding", "transfer-encoding", "connection", "keep-alive"].includes(name)) {
      headers[name] = value;
    }
  });
  const text = await res.text();
  // Lambda answers at most 6 MB. A big SimResult (e.g. 10 seeds x 300 riders, about 8 MB of JSON) is
  // more, so large bodies go out gzipped (JSON shrinks about tenfold) to clients that accept it.
  const acceptsGzip = /\bgzip\b/.test(event.headers?.["accept-encoding"] ?? "");
  if (acceptsGzip && text.length > GZIP_OVER_BYTES) {
    headers["content-encoding"] = "gzip";
    return { statusCode: res.status, headers, body: gzipSync(text).toString("base64"), isBase64Encoded: true };
  }
  return { statusCode: res.status, headers, body: text, isBase64Encoded: false };
}

export async function simHandler(event: SimEvent): Promise<void> {
  await runSimulationJob(store, runHere, event.job, event.params);
}
