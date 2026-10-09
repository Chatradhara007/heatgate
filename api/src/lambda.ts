// AWS Lambda entry point (template.yaml): the Express app from app.ts behind an HTTP API (payload v2).
// Tiny adapter, no new dependency: the app listens on a loopback port once per container and each
// Lambda event is forwarded to it with fetch.
//
// esbuild bundles everything into one file, but at import time the engine reads policies/*.cedar and
// cedar-wasm reads cedar_wasm_bg.wasm from disk next to their own source files. So this file embeds
// those files (template.yaml Loader: .cedar/.cedarschema as text, .wasm as binary), writes them to /tmp
// on a cold start, points the paths there, and only then loads the app with a dynamic import.
import { mkdirSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { createRequire } from "node:module";
import { join } from "node:path";
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
const { MemoryStore } = await import("../store/memory.ts");

const app = createApp({ store: new MemoryStore(), breakEvenPath: join(ROOT, "sim/results/break-even.json") });
const server = app.listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

export async function handler(event: HttpApiEvent): Promise<HttpApiResult> {
  const method = event.requestContext.http.method;
  const url = `${origin}${event.rawPath}${event.rawQueryString ? `?${event.rawQueryString}` : ""}`;
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
  return { statusCode: res.status, headers, body: await res.text(), isBase64Encoded: false };
}
