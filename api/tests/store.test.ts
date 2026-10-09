// The DynamoDB + S3 store against in-memory fakes of DynamoDB and S3, and side by side with MemoryStore:
// both must answer GET /audit the same way. The fakes only understand the calls dynamo.ts makes.
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { describe, expect, test } from "vitest";
import type { Decision, Outcome, SimResult } from "@heatgate/contracts";
import { newDecisionId } from "@heatgate/engine";
import { ACTIVE_INDEX, DynamoStore, LIVE, TRAILS_ID, type ObjectStore } from "../store/dynamo.ts";
import { createStore } from "../store/index.ts";
import { MemoryStore } from "../store/memory.ts";
import { BadCursorError, MAX_AUDITED_SIMULATIONS, SIMULATION_STALE_MS, type AuditFilter, type Store } from "../store/types.ts";

type Item = Record<string, any>;

class FakeDb {
  tables = new Map<string, Map<string, Item>>();

  table(name: string): Map<string, Item> {
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }

  async send(command: unknown): Promise<any> {
    await Promise.resolve(); // let concurrent callers interleave, like real network calls
    if (command instanceof PutCommand) {
      const { TableName, Item, ConditionExpression, ExpressionAttributeValues } = command.input;
      const table = this.table(TableName!);
      const key = `${Item!.simulationId}|${Item!.decisionId ?? ""}`;
      const old = table.get(key);
      const ok =
        ConditionExpression === undefined ||
        (ConditionExpression === "attribute_not_exists(simulationId)" && old === undefined) ||
        (ConditionExpression === "version = :version" && old?.version === ExpressionAttributeValues![":version"]);
      if (!ok) throw Object.assign(new Error("condition failed"), { name: "ConditionalCheckFailedException" });
      table.set(key, structuredClone(Item!));
      return {};
    }
    if (command instanceof GetCommand) {
      const { TableName, Key } = command.input;
      const item = this.table(TableName!).get(`${Key!.simulationId}|${Key!.decisionId ?? ""}`);
      return { Item: item && structuredClone(item) };
    }
    if (command instanceof QueryCommand && command.input.IndexName !== undefined) {
      // The sparse active-jobs index: only items that have `active`.
      const { TableName, IndexName, KeyConditionExpression, ExpressionAttributeNames, ExpressionAttributeValues: v, Select } = command.input;
      expect([IndexName, KeyConditionExpression, ExpressionAttributeNames, Select]).toEqual([
        ACTIVE_INDEX,
        "#active = :yes AND createdAt > :since",
        { "#active": "active" },
        "COUNT",
      ]);
      const count = [...this.table(TableName!).values()].filter((i) => i.active === v![":yes"] && i.createdAt > v![":since"]).length;
      return { Count: count };
    }
    if (command instanceof QueryCommand) {
      const { TableName, KeyConditionExpression, ExpressionAttributeValues: v, ScanIndexForward, ExclusiveStartKey, Limit } = command.input;
      expect(KeyConditionExpression).toMatch(/^simulationId = :live( AND decisionId < :before)?$/);
      expect(ScanIndexForward).toBe(false);
      const after = ExclusiveStartKey?.decisionId as string | undefined;
      const items = [...this.table(TableName!).values()]
        .filter((i) => i.simulationId === v![":live"] && (v![":before"] === undefined || i.decisionId < v![":before"]))
        .filter((i) => after === undefined || i.decisionId < after)
        .sort((a, b) => (a.decisionId < b.decisionId ? 1 : -1));
      const page = items.slice(0, Limit);
      const more = items.length > page.length;
      return { Items: structuredClone(page), LastEvaluatedKey: more ? { simulationId: v![":live"], decisionId: page.at(-1)!.decisionId } : undefined };
    }
    throw new Error(`fake does not know ${(command as object).constructor.name}`);
  }
}

class FakeObjects implements ObjectStore {
  objects = new Map<string, string>();
  async get(key: string) {
    return this.objects.get(key);
  }
  async put(key: string, body: string) {
    this.objects.set(key, body);
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
}

function dynamo() {
  const db = new FakeDb();
  const objects = new FakeObjects();
  const store = new DynamoStore({ db, objects, auditTable: "audit", jobsTable: "jobs" });
  return { store, db, objects };
}

const decision = (simulationId: string | undefined, riderId: string, minute: number, outcome: Outcome = "ALLOW"): Decision => ({
  decisionId: simulationId === undefined ? newDecisionId(new Date()) : `${simulationId}-${riderId}-${minute}`,
  at: new Date(Date.UTC(2026, 4, 20, 0, minute)).toISOString(),
  policyVersion: minute % 2 ? "ndma-2025" : "no-rules",
  riderId,
  orderId: `order-${minute}`,
  ...(simulationId !== undefined && { simulationId }),
  outcome,
  restMinutes: 0,
  penaltyWaived: outcome !== "ALLOW",
  heatIndexC: 40,
  firedRules: [],
  message: "",
  cedarContext: {},
});

// The same writes in the same order, interleaving live decisions and simulation trails.
async function fill(store: Store) {
  await store.putDecision(decision(undefined, "R-001", 1));
  await store.putSimulationDecisions("sim-a", [decision("sim-a", "rider-001", 600, "FORCE_REST"), decision("sim-a", "rider-002", 601)]);
  await store.putDecision(decision(undefined, "R-002", 2, "DENY"));
  await store.putDecision(decision(undefined, "R-003", 3));
  await store.putSimulationDecisions("sim-b", [decision("sim-b", "rider-001", 700), decision("sim-b", "rider-003", 701, "SKIP_ORDER")]);
  await store.putSimulationDecisions("sim-a", [decision("sim-a", "rider-009", 900, "FORCE_REST")]); // replaces sim-a's trail
  await store.putDecision(decision(undefined, "R-001", 4, "FORCE_REST"));
}

const ids = (items: Decision[]) => items.map((d) => `${d.simulationId ?? ""}:${d.riderId}:${d.orderId}`);

async function allPages(store: Store, filter: AuditFilter, limit: number) {
  const out: Decision[] = [];
  let cursor: string | undefined;
  do {
    const page = await store.listDecisions(filter, { limit, cursor });
    expect(page.items.length).toBeLessThanOrEqual(limit);
    out.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor !== undefined);
  return out;
}

const filters: AuditFilter[] = [
  {},
  { riderId: "R-001" },
  { riderId: "rider-001" },
  { outcome: "FORCE_REST" },
  { policyVersion: "no-rules" },
  { simulationId: "sim-a" },
  { simulationId: "sim-b" },
  { simulationId: "sim-b", riderId: "rider-003", outcome: "SKIP_ORDER" },
  { simulationId: "sim-unknown" },
];

describe("DynamoStore answers GET /audit like MemoryStore", () => {
  test.each(filters)("filter %o, every page size", async (filter) => {
    const memory = new MemoryStore();
    const { store } = dynamo();
    await fill(memory);
    await fill(store);
    const expected = ids((await memory.listDecisions(filter, { limit: 200 })).items);
    expect(ids((await store.listDecisions(filter, { limit: 200 })).items)).toEqual(expected);
    for (const limit of [1, 2, 3]) expect(ids(await allPages(store, filter, limit))).toEqual(expected);
  });

  test("the unfiltered log: newest write first, trails in latest simulated time first", async () => {
    const { store } = dynamo();
    await fill(store);
    expect(ids((await store.listDecisions({}, { limit: 200 })).items)).toEqual([
      ":R-001:order-4",
      "sim-a:rider-009:order-900",
      "sim-b:rider-003:order-701",
      "sim-b:rider-001:order-700",
      ":R-003:order-3",
      ":R-002:order-2",
      ":R-001:order-1",
    ]);
  });

  test("live decisions over several DynamoDB pages, filtered", async () => {
    const memory = new MemoryStore();
    const { store } = dynamo();
    for (let i = 0; i < 450; i++) {
      const d = decision(undefined, `R-${i % 7}`, i, i % 5 === 0 ? "DENY" : "ALLOW");
      await memory.putDecision(d);
      await store.putDecision(d);
    }
    for (const filter of [{}, { outcome: "DENY" as const }, { riderId: "R-3" }]) {
      const expected = ids((await memory.listDecisions(filter, { limit: 200 })).items);
      const got = await store.listDecisions(filter, { limit: 200 });
      expect(ids(got.items)).toEqual(expected);
      expect(ids(await allPages(store, filter, 37))).toEqual(ids(await allPages(memory, filter, 37)));
    }
  });

  test("a cursor that is not ours -> BadCursorError", async () => {
    const { store } = dynamo();
    await expect(store.listDecisions({}, { limit: 1, cursor: "12" })).rejects.toBeInstanceOf(BadCursorError);
    await expect(store.listDecisions({}, { limit: 1, cursor: "x".repeat(26) })).rejects.toBeInstanceOf(BadCursorError);
  });
});

describe("DynamoStore storage", () => {
  test("live decisions: key simulationId=live + decisionId, a 30-day expiresAt, the decision kept whole", async () => {
    const { store, db } = dynamo();
    const d = { ...decision(undefined, "R-001", 1), simulationId: "sim-x" };
    await store.putDecision(d);
    const [item] = db.table("audit").values();
    expect(item).toMatchObject({ simulationId: LIVE, decisionId: d.decisionId, decision: d });
    const days = (item.expiresAt - Date.now() / 1000) / 86400;
    expect(days).toBeGreaterThan(29.9);
    expect(days).toBeLessThanOrEqual(30);
  });

  test("only the last 5 trails are kept; replaced and dropped trail objects are deleted", async () => {
    const { store, db, objects } = dynamo();
    const sims = Array.from({ length: MAX_AUDITED_SIMULATIONS + 2 }, (_, i) => `sim-${i}`);
    for (const id of sims) await store.putSimulationDecisions(id, [decision(id, "rider-001", 600), decision(id, "rider-002", 601)]);
    for (const [i, id] of sims.entries()) {
      expect((await store.listDecisions({ simulationId: id }, { limit: 200 })).items).toHaveLength(i < 2 ? 0 : 2);
    }
    await store.putSimulationDecisions("sim-2", [decision("sim-2", "rider-009", 900)]);
    expect((await store.listDecisions({ simulationId: "sim-2" }, { limit: 200 })).items.map((d) => d.riderId)).toEqual(["rider-009"]);
    expect([...objects.objects.keys()].filter((k) => k.startsWith("audit/"))).toHaveLength(MAX_AUDITED_SIMULATIONS);
    const list = db.table("jobs").get(`${TRAILS_ID}|`)!;
    expect(list.trails.map((t: { simulationId: string }) => t.simulationId)).toEqual(["sim-3", "sim-4", "sim-5", "sim-6", "sim-2"]);
    expect(list.expiresAt).toBeGreaterThan(Date.now() / 1000);
  });

  test("two simulations finishing at once both keep their trails", async () => {
    const { store } = dynamo();
    await Promise.all(["sim-p", "sim-q", "sim-r"].map((id) => store.putSimulationDecisions(id, [decision(id, "rider-001", 600)])));
    for (const id of ["sim-p", "sim-q", "sim-r"]) expect((await store.listDecisions({ simulationId: id }, { limit: 10 })).items).toHaveLength(1);
  });

  test("jobs: status and a pointer in DynamoDB, the result in S3, read back whole", async () => {
    const { store, db, objects } = dynamo();
    const result = { simulationId: "sim-1", params: {} as SimResult["params"], runs: {} } satisfies SimResult;
    const job = { simulationId: "sim-1", status: "done" as const, createdAt: "2026-10-09T00:00:00.000Z", finishedAt: "2026-10-09T00:01:00.000Z" };
    await store.putSimulation({ ...job, result });
    const item = db.table("jobs").get("sim-1|")!;
    expect(item).toMatchObject({ ...job, resultKey: "results/sim-1.json", expiresAt: expect.any(Number) });
    expect(item.result).toBeUndefined();
    expect(JSON.parse(objects.objects.get("results/sim-1.json")!)).toEqual(result);
    expect(await store.getSimulation("sim-1")).toEqual({ ...job, result });
    objects.objects.delete("results/sim-1.json"); // expired by the bucket lifecycle
    expect(await store.getSimulation("sim-1")).toBeUndefined();
    expect(await store.getSimulation("sim-nope")).toBeUndefined();
  });

  test("a job stuck in queued or running past the limit reads as failed; the trails list is not a job", async () => {
    const { store } = dynamo();
    const old = new Date(Date.now() - SIMULATION_STALE_MS - 1000).toISOString();
    await store.putSimulation({ simulationId: "sim-old", status: "running", createdAt: old });
    await store.putSimulation({ simulationId: "sim-new", status: "queued", createdAt: new Date().toISOString() });
    expect(await store.getSimulation("sim-old")).toMatchObject({ status: "failed", error: { code: "SIMULATION_FAILED" } });
    expect(await store.getSimulation("sim-new")).toMatchObject({ status: "queued" });
    await store.putSimulationDecisions("sim-new", []);
    expect(await store.getSimulation(TRAILS_ID)).toBeUndefined();
  });
});

test.each([
  ["memory", () => new MemoryStore()],
  ["dynamo", () => dynamo().store],
] as const)("%s store counts queued and running jobs created after a time", async (_name, make) => {
  const store: Store = make();
  const now = Date.now();
  const at = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();
  await store.putSimulation({ simulationId: "sim-q", status: "queued", createdAt: at(1) });
  await store.putSimulation({ simulationId: "sim-r", status: "running", createdAt: at(2) });
  await store.putSimulation({ simulationId: "sim-old", status: "running", createdAt: at(20) }); // stuck: not counted
  await store.putSimulation({ simulationId: "sim-f", status: "failed", createdAt: at(1), finishedAt: at(0) });
  await store.putSimulation({ simulationId: "sim-d", status: "running", createdAt: at(3) });
  await store.putSimulation({ simulationId: "sim-d", status: "done", createdAt: at(3), finishedAt: at(0), result: { simulationId: "sim-d", params: {} as SimResult["params"], runs: {} } });
  expect(await store.countActiveSimulations(new Date(now - SIMULATION_STALE_MS))).toBe(2);
  expect(await store.countActiveSimulations(new Date(now - 90_000))).toBe(1);
});

test("dynamo: only queued and running job items carry the active flag", async () => {
  const { store, db } = dynamo();
  await store.putSimulation({ simulationId: "sim-1", status: "queued", createdAt: new Date().toISOString() });
  expect(db.table("jobs").get("sim-1|")!.active).toBe("yes");
  await store.putSimulation({ simulationId: "sim-1", status: "failed", createdAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
  expect(db.table("jobs").get("sim-1|")!.active).toBeUndefined();
  expect(await store.getSimulation("sim-1")).not.toHaveProperty("active");
});

test("createStore: memory by default, dynamo needs its environment, anything else is refused", () => {
  expect(createStore({})).toBeInstanceOf(MemoryStore);
  expect(() => createStore({ STORE: "dynamo" })).toThrow(/AUDIT_TABLE/);
  expect(createStore({ STORE: "dynamo", AUDIT_TABLE: "a", SIMULATIONS_TABLE: "s", RESULTS_BUCKET: "b", AWS_REGION: "ap-south-1" })).toBeInstanceOf(
    DynamoStore,
  );
  expect(() => createStore({ STORE: "postgres" })).toThrow(/memory/);
});
