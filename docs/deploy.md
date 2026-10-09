# Deploy to AWS (SAM, ap-south-1)

What gets created (`template.yaml`, stack `heatgate`):

- One Lambda (Node 20, bundled by esbuild from `api/src/lambda.ts`) running the Express app, behind
  an HTTP API (API Gateway v2) with CORS. Routes for now: `GET /health`, `GET /policies`,
  `GET /defaults`, `GET /break-even`.
- An S3 bucket set up as a static website for `web/dist`. Anyone can read its objects; nobody can
  list it.
- Two DynamoDB tables (audit log, simulation jobs). They exist but nothing uses them yet.
- Outputs: `ApiUrl`, `WebsiteUrl`, `WebBucketName`.

`GET /break-even` serves the `sim/results/break-even.json` that was committed when you ran
`sam build`. To update it, run `npm run sim:breakeven`, then build and deploy again.

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

## 2. Deploy

```sh
sam deploy --guided
```

Accept the defaults from `samconfig.toml` (stack `heatgate`, region `ap-south-1`, IAM capability,
changeset confirmation). When it asks *"ApiFunction has no authentication. Is this okay?"*,
answer `y`, because the API is public for now. After the first deploy, plain `sam deploy` is
enough.

Read the outputs into shell variables:

```sh
out() { aws cloudformation describe-stacks --stack-name heatgate --region ap-south-1 \
  --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
API_URL=$(out ApiUrl)
WEB_BUCKET=$(out WebBucketName)
WEBSITE_URL=$(out WebsiteUrl)
curl "$API_URL/health"   # {"status":"ok"}
```

## 3. Build the web app against the API

```sh
VITE_API_URL="$API_URL" npm run build -w web
```

## 4. Upload web/dist to the bucket

```sh
aws s3 sync web/dist "s3://$WEB_BUCKET" --delete --region ap-south-1
echo "$WEBSITE_URL"
```

Open the website URL. S3 website endpoints are plain `http://`.

## 5. Delete everything

`sam delete` can't remove a bucket that still has files in it, so empty the website bucket first:

```sh
aws s3 rm "s3://$WEB_BUCKET" --recursive --region ap-south-1
sam delete --stack-name heatgate --region ap-south-1
```

This deletes the Lambda, the API, the bucket and both DynamoDB tables, including their data. SAM's
shared artifact bucket (`aws-sam-cli-managed-default-...`, created by `resolve_s3`) is a separate
stack and stays.
