#!/usr/bin/env node
// Smoke-test seed for the run-lifecycle endpoints (Phase 8a + 8b).
//
// `seed` picks the first existing space + connection from the dev master DB,
// INSERTs a backup_runs row in 'running' state with a synthetic two-element
// trigger_run_ids array, and prints the runId + token IDs to stdout. This
// lets the smoke curl loop in the Phase 8b plan run without psql or
// hand-crafted UUIDs.
//
// `cleanup <runId>` DELETEs the row when you're done.
//
// Why a small standalone script instead of psql: pulled out so a teammate
// or the boss can clone the repo, drop their DATABASE_URL into .env, and
// reproduce the smoke run identically — see CLAUDE.md §3.4 / §6.
//
// Invoked via:
//   node --env-file-if-exists=.env scripts/smoke-seed-run.mjs seed
//   node --env-file-if-exists=.env scripts/smoke-seed-run.mjs cleanup <runId>
//
// Reads DATABASE_URL from process.env. Uses the same `postgres` driver as
// apps/server's per-request masterDb factory. No FK violations possible —
// we look up real parents instead of seeding them.

import postgres from "postgres";
import { randomUUID } from "node:crypto";

const SEED_TRIGGER_RUN_IDS = ["t_run_a_smoke", "t_run_b_smoke"];

function fail(message) {
  console.error(`smoke-seed-run: ${message}`);
  process.exit(1);
}

const command = process.argv[2];
if (!command) {
  fail("usage: smoke-seed-run.mjs <seed|cleanup [runId]>");
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  fail(
    "DATABASE_URL is not set. Add it to apps/server/.env or export it before running.",
  );
}

const sql = postgres(databaseUrl, { max: 1, prepare: false });

try {
  if (command === "seed") {
    const spaces = await sql`SELECT id FROM baseout.spaces LIMIT 1`;
    if (spaces.length === 0) {
      fail(
        "No rows in baseout.spaces. Complete a connect-Airtable flow in apps/web first so the parent rows exist.",
      );
    }
    const connections = await sql`
      SELECT id FROM baseout.connections WHERE status = 'active' LIMIT 1
    `;
    if (connections.length === 0) {
      fail(
        "No active rows in baseout.connections. Complete a connect-Airtable flow in apps/web first.",
      );
    }

    const runId = randomUUID();
    const spaceId = spaces[0].id;
    const connectionId = connections[0].id;

    await sql`
      INSERT INTO baseout.backup_runs (
        id, space_id, connection_id, status, triggered_by,
        is_trial, trigger_run_ids, modified_at, created_at
      ) VALUES (
        ${runId}, ${spaceId}, ${connectionId}, 'running', 'manual',
        false, ${sql.json(SEED_TRIGGER_RUN_IDS)}, NOW(), NOW()
      )
    `;

    console.log(JSON.stringify({
      runId,
      spaceId,
      connectionId,
      triggerRunIds: SEED_TRIGGER_RUN_IDS,
      hint: "Use these in your curl smoke loop. Run `cleanup <runId>` when done.",
    }, null, 2));
  } else if (command === "cleanup") {
    const runId = process.argv[3];
    if (!runId) {
      fail("usage: smoke-seed-run.mjs cleanup <runId>");
    }
    const result = await sql`
      DELETE FROM baseout.backup_runs WHERE id = ${runId}
    `;
    console.log(JSON.stringify({ deleted: result.count, runId }, null, 2));
  } else {
    fail(`unknown command "${command}" — expected seed | cleanup`);
  }
} catch (err) {
  console.error("smoke-seed-run: query failed");
  console.error(err);
  process.exit(1);
} finally {
  await sql.end({ timeout: 5 });
}
