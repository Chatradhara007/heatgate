// Picks the store from STORE: "memory" (default, local runs) or "dynamo" (the cloud, template.yaml).
import { DynamoStore } from "./dynamo.ts";
import { MemoryStore } from "./memory.ts";
import type { Store } from "./types.ts";

export function createStore(env: NodeJS.ProcessEnv = process.env): Store {
  const kind = env.STORE ?? "memory";
  if (kind === "memory") return new MemoryStore();
  if (kind === "dynamo") return DynamoStore.fromEnv(env);
  throw new Error(`STORE must be "memory" or "dynamo", not "${kind}"`);
}
