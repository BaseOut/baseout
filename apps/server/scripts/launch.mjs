#!/usr/bin/env node
// Render apps/server/wrangler.jsonc from wrangler.jsonc.example using
// DATABASE_URL from the env. Mirrors apps/web/scripts/launch.mjs in pattern,
// stripped down — apps/server has no Astro setup wizard / app-config.
//
// Invoked from package.json before `wrangler dev` and `wrangler deploy`.
// Reads DATABASE_URL from process.env (loaded via `node --env-file=.env`
// in the npm scripts). The rendered wrangler.jsonc is gitignored.
// Wrangler's runtime worker secrets continue to live in .dev.vars (auto-
// loaded by `wrangler dev` itself).
//
// `localConnectionString` is local-dev-only — deployed Workers connect via
// the Hyperdrive `id`. So an unrendered template would fail wrangler dev
// but a missing DATABASE_URL on deploy is non-fatal (we still write the
// placeholder so the rest of the config parses).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const TEMPLATE_PATH = resolve(ROOT, "wrangler.jsonc.example");
const OUTPUT_PATH = resolve(ROOT, "wrangler.jsonc");

const command = process.argv[2] || "dev";
const isDev = command === "dev";

// Local-dev-only fallback — wrangler still parses the rendered config under
// `wrangler deploy`, but the deployed Worker ignores localConnectionString.
const DEV_DB_PLACEHOLDER =
  "postgres://placeholder:placeholder@localhost:5432/placeholder";

if (!existsSync(TEMPLATE_PATH)) {
  console.error(`\n  Missing wrangler.jsonc.example at ${TEMPLATE_PATH}\n`);
  process.exit(1);
}

const dbUrl = process.env.DATABASE_URL || (isDev ? null : DEV_DB_PLACEHOLDER);
if (!dbUrl) {
  console.error(
    "\n  DATABASE_URL is not set." +
      "\n  Add it to apps/server/.env (see apps/server/.dev.vars.example for the value template).\n",
  );
  process.exit(1);
}

const template = readFileSync(TEMPLATE_PATH, "utf8");
const rendered = template.replaceAll("{{DATABASE_URL}}", dbUrl);
writeFileSync(OUTPUT_PATH, rendered);
