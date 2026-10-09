// Cloud store (STORE=dynamo, see index.ts): DynamoDB for small items, a private S3 bucket for big ones.
// - Audit table: live /decide decisions. Key simulationId = "live" + decisionId (decision ids repeat across
//   simulations). The Decision itself is the `decision` attribute, so its own simulationId, if any, is kept.
// - Jobs table: status and pointers only. Queued and running jobs also carry active = "yes", which puts
//   them in the sparse index ACTIVE_INDEX (active + createdAt), so counting them reads only those. A SimResult is far over the 400 KB item limit, so it goes to
//   s3://<bucket>/results/<id>.json and the item keeps resultKey. One extra item, TRAILS_ID, lists the
//   simulations whose audit trails are kept (at most MAX_AUDITED_SIMULATIONS, oldest first).
// - Each audit trail is one object, audit/<id>/<seq>.json, written once and never changed.
// Every item has expiresAt (epoch seconds, 30 days; DynamoDB TTL deletes it) and the bucket expires
// objects after 30 days (template.yaml), for privacy. Rider IDs are pseudonymous; never names or phones.
//
// GET /audit order is the memory store's (newest written first) through one sort key, seq:
// a live decision's seq is its decisionId (ULID, time first); a trail written at time T gets
// seq = <ULID of T>:<index>, index counting up in the trail's order. The cursor is the last seq returned.
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { Decision, SimResult, SimulationJob } from "@heatgate/contracts";
import { newDecisionId } from "@heatgate/engine";
import { BadCursorError, MAX_AUDITED_SIMULATIONS, SIMULATION_STALE_MS, type AuditFilter, type Page, type Store } from "./types.ts";

export const LIVE = "live";
export const TRAILS_ID = "#audit-trails"; // not a valid simulation id (api/src/validate.ts), so never a job
export const TTL_DAYS = 30;
export const ACTIVE_INDEX = "active-jobs"; // template.yaml

const CURSOR = /^[0-9A-HJKMNP-TV-Z]{26}(:\d{6})?$/;
const expiresAt = () => Math.floor(Date.now() / 1000) + TTL_DAYS * 24 * 60 * 60;

// The few S3 calls the store needs (a Map in tests).
export interface ObjectStore {
  get(key: string): Promise<string | undefined>; // undefined if there is no such object (e.g. expired)
  put(key: string, body: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export class S3Objects implements ObjectStore {
  constructor(
    private s3: S3Client,
    private bucket: string,
  ) {}

  async get(key: string): Promise<string | undefined> {
    try {
      const res = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return await res.Body!.transformToString();
    } catch (err) {
      if ((err as { name?: string }).name === "NoSuchKey") return undefined;
      throw err;
    }
  }

  async put(key: string, body: string): Promise<void> {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: "application/json" }));
  }

  async delete(key: string): Promise<void> {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

interface Trail {
  simulationId: string;
  seq: string;
  key: string;
}

interface JobItem {
  simulationId: string;
  status: SimulationJob["status"];
  createdAt: string;
  finishedAt?: string;
  error?: SimulationJob["error"];
  resultKey?: string;
  active?: "yes"; // only while queued or running
  expiresAt: number;
}

interface Row {
  seq: string;
  decision: Decision;
}

export interface DynamoStoreOptions {
  db: Pick<DynamoDBDocumentClient, "send">;
  objects: ObjectStore;
  auditTable: string;
  jobsTable: string;
}

export class DynamoStore implements Store {
  private db: Pick<DynamoDBDocumentClient, "send">;
  private objects: ObjectStore;
  private auditTable: string;
  private jobsTable: string;
  private trailCache = new Map<string, Decision[]>(); // by object key; trail objects never change

  constructor(options: DynamoStoreOptions) {
    ({ db: this.db, objects: this.objects, auditTable: this.auditTable, jobsTable: this.jobsTable } = options);
  }

  // From the Lambda environment (template.yaml). The region comes from AWS_REGION.
  static fromEnv(env: NodeJS.ProcessEnv = process.env): DynamoStore {
    const need = (name: string) => {
      const value = env[name];
      if (!value) throw new Error(`STORE=dynamo needs the ${name} environment variable`);
      return value;
    };
    const auditTable = need("AUDIT_TABLE");
    const jobsTable = need("SIMULATIONS_TABLE");
    const bucket = need("RESULTS_BUCKET");
    return new DynamoStore({
      db: DynamoDBDocumentClient.from(new DynamoDBClient({}), { marshallOptions: { removeUndefinedValues: true } }),
      objects: new S3Objects(new S3Client({}), bucket),
      auditTable,
      jobsTable,
    });
  }

  async putDecision(decision: Decision): Promise<void> {
    await this.db.send(
      new PutCommand({
        TableName: this.auditTable,
        Item: { simulationId: LIVE, decisionId: decision.decisionId, decision, expiresAt: expiresAt() },
      }),
    );
  }

  async putSimulationDecisions(simulationId: string, decisions: Decision[]): Promise<void> {
    const seq = newDecisionId(new Date());
    const key = `audit/${simulationId}/${seq}.json`;
    await this.objects.put(key, JSON.stringify(decisions.map((d) => ({ ...d, simulationId }))));
    const dropped = await this.updateTrails((trails) => trails.filter((t) => t.simulationId !== simulationId).concat({ simulationId, seq, key }));
    // The list no longer points at these, so GET /audit no longer shows them; deleting is tidy-up.
    for (const t of dropped) await this.objects.delete(t.key).catch((err) => console.error(`could not delete ${t.key}:`, err));
  }

  async listDecisions(filter: AuditFilter, page: { limit: number; cursor?: string }): Promise<Page<Decision>> {
    const before = page.cursor;
    if (before !== undefined && !CURSOR.test(before)) throw new BadCursorError("cursor is not valid");
    const want = page.limit + 1; // one more than asked, to know whether there is a next page
    const matches = (d: Decision) =>
      (filter.riderId === undefined || d.riderId === filter.riderId) &&
      (filter.outcome === undefined || d.outcome === filter.outcome) &&
      (filter.policyVersion === undefined || d.policyVersion === filter.policyVersion) &&
      (filter.simulationId === undefined || d.simulationId === filter.simulationId);

    const rows: Row[] = [];
    for (const trail of (await this.readTrails()).trails) {
      if (filter.simulationId !== undefined && trail.simulationId !== filter.simulationId) continue;
      const decisions = await this.readTrail(trail.key);
      for (const [i, decision] of decisions.entries()) {
        const seq = `${trail.seq}:${String(i).padStart(6, "0")}`;
        if ((before === undefined || seq < before) && matches(decision)) rows.push({ seq, decision });
      }
    }

    // Live decisions, newest first. Filters are applied here, not in DynamoDB: it charges for every item
    // read either way, and this keeps the matching rules in one place.
    let liveFound = 0;
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.db.send(
        new QueryCommand({
          TableName: this.auditTable,
          KeyConditionExpression: before === undefined ? "simulationId = :live" : "simulationId = :live AND decisionId < :before",
          ExpressionAttributeValues: before === undefined ? { ":live": LIVE } : { ":live": LIVE, ":before": before },
          ScanIndexForward: false,
          ExclusiveStartKey: startKey,
          Limit: 200,
        }),
      );
      for (const item of res.Items ?? []) {
        const decision = item.decision as Decision;
        if (matches(decision)) {
          rows.push({ seq: item.decisionId as string, decision });
          liveFound++;
        }
      }
      startKey = res.LastEvaluatedKey;
    } while (startKey !== undefined && liveFound < want);

    rows.sort((a, b) => (a.seq < b.seq ? 1 : a.seq > b.seq ? -1 : 0));
    const items = rows.slice(0, page.limit).map((r) => r.decision);
    return rows.length > page.limit ? { items, nextCursor: rows[page.limit - 1].seq } : { items };
  }

  async putSimulation(job: SimulationJob): Promise<void> {
    const { result, ...rest } = job;
    const item: JobItem = { ...rest, expiresAt: expiresAt() };
    if (job.status === "queued" || job.status === "running") item.active = "yes";
    if (result !== undefined) {
      item.resultKey = `results/${job.simulationId}.json`;
      await this.objects.put(item.resultKey, JSON.stringify(result));
    }
    await this.db.send(new PutCommand({ TableName: this.jobsTable, Item: item }));
  }

  async getSimulation(simulationId: string): Promise<SimulationJob | undefined> {
    if (simulationId === TRAILS_ID) return undefined;
    const res = await this.db.send(new GetCommand({ TableName: this.jobsTable, Key: { simulationId }, ConsistentRead: true }));
    if (res.Item === undefined) return undefined;
    const { resultKey, expiresAt: _ttl, active: _active, ...job } = res.Item as JobItem;
    if (resultKey !== undefined) {
      const text = await this.objects.get(resultKey);
      if (text === undefined) return undefined; // the result has expired: treat the job as gone
      return { ...job, result: JSON.parse(text) as SimResult };
    }
    // SimFunction stops at 600 s; a Lambda that times out or crashes cannot record that itself.
    if ((job.status === "queued" || job.status === "running") && Date.now() - Date.parse(job.createdAt) > SIMULATION_STALE_MS) {
      return {
        ...job,
        status: "failed",
        error: { code: "SIMULATION_FAILED", message: "The simulation did not finish in time" },
      };
    }
    return job;
  }

  // From the index, so eventually consistent: a job started a moment ago may be missed. Fine for a guard.
  async countActiveSimulations(since: Date): Promise<number> {
    let count = 0;
    let startKey: Record<string, unknown> | undefined;
    do {
      const res = await this.db.send(
        new QueryCommand({
          TableName: this.jobsTable,
          IndexName: ACTIVE_INDEX,
          KeyConditionExpression: "#active = :yes AND createdAt > :since",
          ExpressionAttributeNames: { "#active": "active" },
          ExpressionAttributeValues: { ":yes": "yes", ":since": since.toISOString() },
          Select: "COUNT",
          ExclusiveStartKey: startKey,
        }),
      );
      count += res.Count ?? 0;
      startKey = res.LastEvaluatedKey;
    } while (startKey !== undefined);
    return count;
  }

  private async readTrails(): Promise<{ trails: Trail[]; version?: number }> {
    const res = await this.db.send(new GetCommand({ TableName: this.jobsTable, Key: { simulationId: TRAILS_ID }, ConsistentRead: true }));
    return res.Item === undefined ? { trails: [] } : { trails: res.Item.trails as Trail[], version: res.Item.version as number };
  }

  private async readTrail(key: string): Promise<Decision[]> {
    let decisions = this.trailCache.get(key);
    if (decisions === undefined) {
      const text = await this.objects.get(key);
      decisions = text === undefined ? [] : (JSON.parse(text) as Decision[]);
      if (this.trailCache.size >= MAX_AUDITED_SIMULATIONS * 2) this.trailCache.delete(this.trailCache.keys().next().value!);
      this.trailCache.set(key, decisions);
    }
    return decisions;
  }

  // Read-modify-write of the kept-trails list, safe when two simulations finish at once (optimistic
  // locking on `version`). Keeps the newest MAX_AUDITED_SIMULATIONS. Returns the trails that left the list.
  private async updateTrails(change: (trails: Trail[]) => Trail[]): Promise<Trail[]> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const { trails, version } = await this.readTrails();
      const next = change(trails).slice(-MAX_AUDITED_SIMULATIONS);
      try {
        await this.db.send(
          new PutCommand({
            TableName: this.jobsTable,
            Item: { simulationId: TRAILS_ID, trails: next, version: (version ?? 0) + 1, expiresAt: expiresAt() },
            ...(version === undefined
              ? { ConditionExpression: "attribute_not_exists(simulationId)" }
              : { ConditionExpression: "version = :version", ExpressionAttributeValues: { ":version": version } }),
          }),
        );
        const kept = new Set(next.map((t) => t.key));
        return trails.filter((t) => !kept.has(t.key));
      } catch (err) {
        if ((err as { name?: string }).name !== "ConditionalCheckFailedException") throw err;
      }
    }
    throw new Error("could not update the list of kept audit trails: too many concurrent writes");
  }
}
