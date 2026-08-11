#!/usr/bin/env node
// Local dev launcher for apps/api. Direct postgres-js TLS from workerd hangs
// under `wrangler dev` (the apps/server-documented trap), so the master DB must
// go through wrangler's local Hyperdrive simulator. Wrangler takes the local
// connection string from this env var — reading it here from .dev.vars keeps
// the secret out of the committed wrangler.jsonc.
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let databaseUrl;
try {
  const devVars = readFileSync(path.join(appDir, ".dev.vars"), "utf8");
  const line = devVars.split("\n").find((l) => l.startsWith("DATABASE_URL="));
  databaseUrl = line?.slice("DATABASE_URL=".length).trim().replace(/^["']|["']$/g, "");
} catch {
  /* fall through to the error below */
}
if (!databaseUrl) {
  console.error("apps/api/.dev.vars with DATABASE_URL=… is required (copy .dev.vars.example).");
  process.exit(1);
}

const child = spawn("npx", ["wrangler", "dev", ...process.argv.slice(2)], {
  cwd: appDir,
  stdio: "inherit",
  env: {
    ...process.env,
    // Both names: CLOUDFLARE_ is current, WRANGLER_ kept for older wranglers.
    CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
    WRANGLER_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE: databaseUrl,
  },
});
child.on("exit", (code) => process.exit(code ?? 1));
