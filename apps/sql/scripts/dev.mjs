#!/usr/bin/env node
// Local dev launcher for apps/sql.
//
// Direct postgres-js TLS from workerd hangs under `wrangler dev`, so the master
// DB goes through wrangler's local Hyperdrive simulator. Wrangler reads that
// connection string from CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_<BINDING>
// in process.env — it does NOT load .dev.vars into process.env itself. This
// script is launched with `node --env-file-if-exists=.dev.vars`, so Node loads
// it and the spawned wrangler inherits it. Mirrors apps/api, apps/hooks and
// apps/server; keeps the credential out of the committed wrangler.jsonc, which
// carries no localConnectionString in any env.
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");

const HD = "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE";

// Wrangler emulates Hyperdrive locally from this env var. Set it directly in
// .dev.vars — this script runs under `node --env-file-if-exists=.dev.vars`, so
// Node loads it into process.env and the spawned wrangler inherits it.
//
// DATABASE_URL is accepted as a fallback for anyone whose .dev.vars predates
// the rename, but the explicit name is preferred: it is what wrangler actually
// reads, and it keeps one mechanism instead of a mapping.
if (!process.env[HD] && process.env.DATABASE_URL) {
  process.env[HD] = process.env.DATABASE_URL;
  console.log(`  \u2139 ${HD} derived from DATABASE_URL — set it directly to silence this.`);
}
if (!process.env[HD]) {
  console.warn(
    `\n  ! ${HD} is not set in .dev.vars.` +
      "\n    Hyperdrive has no local connection string, so every DB query will fail.\n",
  );
}

const child = spawn("npx", ["wrangler", "dev", ...process.argv.slice(2)], {
  cwd: ROOT,
  stdio: "inherit",
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 1));
