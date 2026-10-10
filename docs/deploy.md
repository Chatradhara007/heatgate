# Deploy to AWS (SAM, ap-south-1)

What gets created (`template.yaml`, stack `heatgate`):

- **ApiFunction**: one Lambda (Node 20, bundled by esbuild from `api/src/lambda.ts`, timeout 29 s)
  running the Express app, behind an HTTP API (API Gateway v2) with CORS and throttling (below). Every
  route works as it does
  locally: `GET /health`, `/policies`, `/defaults`, `/break-even`, `/audit`, `/simulations/:id`,
  `POST /decide`, `/simulations`. Unknown paths reach Express too, so they get the usual 404 error body.
- **SimFunction**: the same bundle, handler `simHandler`, timeout 600 s, 2048 MB. `POST /simulations`
  stores a queued job, invokes SimFunction asynchronously and answers 202. SimFunction sets the job to
  running, then done (with the result) or failed. Automatic retries are off.
- **AuditTable** (DynamoDB, pay per request): live `/decide` decisions. Key: `simulationId` (always
  `live` for these) + `decisionId`.
- **SimulationsTable** (DynamoDB, pay per request): job status and a pointer to the result, plus one
  item (`#audit-trails`) listing the simulations whose audit trails are kept (the last 5). A sparse
  index, `active-jobs`, holds only the queued and running jobs, for the guard below.
- **ResultsBucket** (S3, private, HTTPS only): each simulation's `SimResult` (`results/<id>.json`) and
  audit trail (`audit/<id>/<seq>.json`). They are too large for DynamoDB's 400 KB item limit
  (a default 5-seed run is about 1.5 MB of result and 2.3 MB of trail).
- **WebBucket** (S3 static website) for `web/dist`. Anyone can read its objects; nobody can list it.
- Outputs: `ApiUrl`, `WebsiteUrl`, `WebBucketName`, `ResultsBucketName`, `AuditTableName`,
  `SimulationsTableName`, `SimFunctionName`.

Privacy: every DynamoDB item has an `expiresAt` attribute and DynamoDB TTL deletes it about 30 days
after it was written (TTL can lag by a day or two). The results bucket deletes objects 30 days after
they were written. Rider IDs are pseudonymous, which is likely still personal data under DPDP.

Cost guards (instead of reserving Lambda concurrency, which small accounts often can't do):

- `POST /simulations` answers 429 with the usual error body, code `TOO_MANY_RUNNING`, when 3 or more
  jobs are already queued or running (jobs older than 15 minutes don't count). Locally the same rule
  applies to the in-memory queue. The check is not atomic and, in the cloud, reads an index that can lag
  by a moment, so two requests at the same instant can both get through.
- API Gateway throttles every route to 10 requests per second with bursts of 20. Past that it answers
  429 with its own body, `{"message":"Too Many Requests"}`, not the usual error body, and Lambda is not
  called. The limit is shared by everyone using the API.

Each function gets only what it needs (SAM policy templates). ApiFunction can read and write both
tables, read the results bucket and invoke SimFunction. SimFunction can read and write the jobs table
and read, write and delete in the results bucket.

`GET /break-even` serves the `sim/results/break-even.json` that was committed when you ran
`sam build`. To update it, run `npm run sim:breakeven`, then build and deploy again.

The store is chosen by `STORE`: `dynamo` in the cloud (set in `template.yaml`), `memory` by default
locally. `npm start -w api`, `npm test` and `npm run smoke` stay in memory and need no AWS account.

### Differences from local runs

- A simulation stuck in `queued` or `running` for more than 15 minutes is reported as `failed`. That
  happens only if SimFunction crashes or times out, which it can't record itself.
- If a `/decide` request names a `simulationId`, locally that decision is dropped together with that
  simulation's audit trail. In the cloud it stays in the audit table until its 30 days are up.
- Results and audit trails disappear after 30 days, after which `GET /simulations/:id` answers 404.

## One-time setup

- AWS SAM CLI and AWS CLI v2, signed in with your own profile (`aws configure` or
  `aws sso login`). Never put keys in this repo or in `samconfig.toml`.
- esbuild on your PATH. SAM uses it for the bundle and it isn't a dependency of this repo:

  ```sh
  npm install -g esbuild
  ```

- `npm ci` at the repo root.

All commands below run from the repo root.

## 1. Validate and build

```sh
sam validate
sam validate --lint   # optional: also runs cfn-lint (warns that nodejs20.x is deprecated)
sam build
```

`sam build` bundles the same code twice, once for each function. The two bundles are identical.

## 2. Deploy

```sh
sam deploy --guided
```

Accept the defaults from `samconfig.toml` (stack `heatgate`, region `ap-south-1`, IAM capability,
changeset confirmation). When it asks *"ApiFunction has no authentication. Is this okay?"*,
answer `y`, because the API is public for now. After the first deploy, plain `sam deploy` is
enough.

Upgrading a stack deployed before this version replaces the audit table, because its key changed
(possible because the table has no fixed `TableName`; CloudFormation generates it). The old table was
unused, so no data is lost. The `active-jobs` index is added to the jobs table in place.

Read the outputs into shell variables:

```sh
out() { aws cloudformation describe-stacks --stack-name heatgate --region ap-south-1 \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
API_URL=$(out ApiUrl)
curl "$API_URL/health"   # {"status":"ok"}
```

## 3. Check the deployed API

Run the same checks as the local smoke test against the cloud, with a short one-seed simulation:

```sh
npm run smoke -- --url "$API_URL"
```

It uses rider IDs made fresh for this run, because the cloud audit log already holds other
decisions. It spaces its calls 150 ms apart to stay under the API throttle, and its simulation gets 429
`TOO_MANY_RUNNING` if 3 others are running. The "newest first" checks assume nobody else is calling the API at the same moment. The
first simulation can take longer because of cold starts, so the smoke test waits up to 5 minutes.

Logs: `sam logs --stack-name heatgate --region ap-south-1 -n ApiFunction` (or `-n SimFunction`).

## 4. Build and upload the web app

```sh
npm run deploy:web
```

This reads `ApiUrl` and `WebBucketName` from the stack outputs and builds `web/` with
`VITE_API_URL` set to `ApiUrl` (fixtures off). Then it runs `aws s3 sync web/dist s3://<bucket> --delete`
and prints the website URL. It stops with a clear message if the aws CLI is missing, you are not signed
in, or the stack does not exist. S3 website endpoints are plain `http://`.

## 5. Delete everything

`sam delete` can't remove a bucket that still has files in it, so empty both buckets first:

```sh
out() { aws cloudformation describe-stacks --stack-name heatgate --region ap-south-1 \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
aws s3 rm "s3://$(out WebBucketName)" --recursive --region ap-south-1
aws s3 rm "s3://$(out ResultsBucketName)" --recursive --region ap-south-1
sam delete --stack-name heatgate --region ap-south-1
```

Run nothing that starts a simulation between emptying the results bucket and `sam delete`, or the
bucket will have files in it again.

This deletes both Lambdas, the API, both buckets and both DynamoDB tables, including their data.
SAM's shared artifact bucket (`aws-sam-cli-managed-default-...`, created by `resolve_s3`) is a separate
stack and stays.
