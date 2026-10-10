// npm run deploy:web: build web/ against the deployed API and upload it to the website bucket.
// Reads ApiUrl and WebBucketName from the outputs of the CloudFormation stack that sam deploy made
// (docs/deploy.md), so run sam build and sam deploy first. Uses your own AWS CLI sign-in; it never
// reads or writes keys.
import { spawnSync, type SpawnSyncOptions } from "node:child_process";
import { fileURLToPath } from "node:url";

const STACK = "heatgate"; // samconfig.toml
const REGION = "ap-south-1";
const ROOT = fileURLToPath(new URL("..", import.meta.url));

function fail(message: string): never {
  console.error(`deploy:web: ${message}`);
  process.exit(1);
}

function run(command: string, args: string[], options: SpawnSyncOptions = {}) {
  // npm is npm.cmd on Windows, which needs a shell.
  const result = spawnSync(command, args, { cwd: ROOT, encoding: "utf8", shell: process.platform === "win32", ...options });
  if ((result.error as NodeJS.ErrnoException | undefined)?.code === "ENOENT") {
    fail(`${command} is not installed or not on your PATH.${command === "aws" ? " Install AWS CLI v2 and sign in (docs/deploy.md)." : ""}`);
  }
  if (result.error) throw result.error;
  return result;
}

run("aws", ["--version"], { stdio: "ignore" });

const described = run("aws", [
  "cloudformation",
  "describe-stacks",
  "--stack-name",
  STACK,
  "--region",
  REGION,
  "--query",
  "Stacks[0].Outputs",
  "--output",
  "json",
]);
if (described.status !== 0) {
  const err = String(described.stderr).trim();
  if (/does not exist/.test(err)) fail(`stack "${STACK}" not found in ${REGION}. Run sam build and sam deploy first (docs/deploy.md).`);
  fail(`could not read stack "${STACK}" in ${REGION}. Are you signed in (aws sso login / aws configure)?\n${err}`);
}

const outputs = (JSON.parse(String(described.stdout)) ?? []) as { OutputKey: string; OutputValue: string }[];
const output = (key: string) => {
  const value = outputs.find((o) => o.OutputKey === key)?.OutputValue;
  if (!value) fail(`stack "${STACK}" has no ${key} output. Deploy the current template.yaml with sam deploy.`);
  return value;
};
const apiUrl = output("ApiUrl");
const bucket = output("WebBucketName");
const websiteUrl = outputs.find((o) => o.OutputKey === "WebsiteUrl")?.OutputValue;

console.log(`deploy:web: building web/ with VITE_API_URL=${apiUrl}`);
// Shell variables win over web/.env files, so a local fixtures setting cannot leak into the deployed site.
const build = run("npm", ["run", "build", "-w", "web"], {
  stdio: "inherit",
  env: { ...process.env, VITE_API_URL: apiUrl, VITE_USE_FIXTURES: "false" },
});
if (build.status !== 0) fail("the web build failed (see above).");

console.log(`deploy:web: uploading web/dist to s3://${bucket}`);
const sync = run("aws", ["s3", "sync", "web/dist", `s3://${bucket}`, "--delete", "--region", REGION], { stdio: "inherit" });
if (sync.status !== 0) fail("aws s3 sync failed (see above).");

console.log(`deploy:web: done.${websiteUrl ? ` Open ${websiteUrl}` : ""}`);
