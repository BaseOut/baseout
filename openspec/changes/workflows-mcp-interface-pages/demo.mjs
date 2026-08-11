#!/usr/bin/env node
// Demo/confirm for the MCP interface-pages capture (workflows-mcp-interface-pages).
//
//   1. In Airtable, create an Interface (with a page or two) on any dev base.
//   2. Make sure the local worker is running:  npx trigger.dev@4.5.1 dev  (apps/workflows)
//   3. node openspec/changes/workflows-mcp-interface-pages/demo.mjs
//
// The script fires a real schema backup through the deployed dev engine, waits
// for it, then prints what the MCP capture persisted: bo_at_interfaces rows
// (submitted_via='mcp') and interface changelog events. Run it again after
// renaming a page in Airtable to see a `name` changelog event appear.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const postgres = createRequire(path.join(repo, "apps/web/package.json"))("postgres");

const ENGINE = "https://baseout-server-dev.openside.workers.dev";
const SPACE_ID = process.argv[2] ?? "b061d945-e9ea-4a41-a2d6-6628b099b13e"; // "pers"
const SPACE_SCHEMA = `bo_space_${SPACE_ID.replace(/-/g, "_")}`;
const TEMPLATE_RUN = "15a49078-c65e-42f2-8be3-18f5668a875a"; // donor for connection/triggered_by

const envLine = (file, name) => {
  const line = readFileSync(path.join(repo, file), "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in ${file}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
};
const INTERNAL_TOKEN = envLine("apps/server/.dev.vars", "INTERNAL_TOKEN");
const sql = postgres(envLine("apps/web/.env", "DATABASE_URL"), { prepare: false, max: 1 });

try {
  // 1. Fire a schema backup (fast — no records/attachments; interfaces ride it).
  const [prev] = await sql`select space_id, connection_id, is_trial, triggered_by
    from baseout.backup_runs where id = ${TEMPLATE_RUN}`;
  const [run] = await sql`insert into baseout.backup_runs (space_id, connection_id, status, is_trial, kind, triggered_by)
    values (${prev.space_id}, ${prev.connection_id}, ${"queued"}, ${prev.is_trial}, ${"schema"}, ${prev.triggered_by}) returning id`;
  const start = await fetch(`${ENGINE}/api/internal/runs/${run.id}/start`, {
    method: "POST", headers: { "x-internal-token": INTERNAL_TOKEN },
  });
  if (start.status !== 202) {
    console.log(`run start FAILED: HTTP ${start.status} ${await start.text()}`);
    process.exit(1);
  }
  console.log(`backup run ${run.id} started (schema-only) — waiting…`);

  // 2. Wait for a terminal state (~10-30s with the worker up).
  const deadline = Date.now() + 4 * 60_000;
  let status = "running";
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5_000));
    const [row] = await sql`select status from baseout.backup_runs where id = ${run.id}`;
    status = row.status;
    if (!["queued", "running"].includes(status)) break;
    process.stdout.write(".");
  }
  console.log(`\nrun finished: ${status}`);
  if (["queued", "running"].includes(status)) {
    console.log("⚠ run never completed — is the local worker running?");
    console.log("  cd apps/workflows && npx trigger.dev@4.5.1 dev");
    process.exit(1);
  }

  // 3. Show what the MCP capture persisted.
  const rows = await sql`select base_id, airtable_entity_id, name, type, status, first_seen_at, last_seen_at
    from ${sql(SPACE_SCHEMA)}.bo_at_interfaces where submitted_via = ${"mcp"}
    order by base_id, type, name`;
  console.log(`\n── bo_at_interfaces (MCP-captured): ${rows.length} row(s)`);
  for (const r of rows) {
    console.log(`  ${r.base_id} | ${r.type.padEnd(4)} | ${String(r.name).padEnd(28)} | ${r.status.padEnd(7)} | first ${r.first_seen_at?.toISOString().slice(0, 16)} | last ${r.last_seen_at?.toISOString().slice(0, 16)}`);
  }

  const events = await sql`select u.entity_id, u.change_type, u.before_value, u.after_value, br.started_at
    from ${sql(SPACE_SCHEMA)}.bo_at_schema_updates u
    left join ${sql(SPACE_SCHEMA)}.bo_at_base_runs br on br.id = u.run_id
    where u.entity_type = ${"interface"} order by br.started_at desc nulls last limit 10`;
  console.log(`\n── interface changelog events: ${events.length}`);
  for (const e of events) {
    const detail = e.change_type === "name"
      ? `"${e.before_value}" → "${e.after_value}"`
      : JSON.stringify(e.after_value)?.slice(0, 100);
    console.log(`  ${e.started_at?.toISOString().slice(0, 16) ?? "?"} | ${e.change_type.padEnd(6)} | ${e.entity_id} | ${detail}`);
  }

  console.log(
    rows.length === 0
      ? "\nRESULT: capture ran but found no interfaces — create an Interface in Airtable on one of the backed-up bases, then run this again."
      : "\nRESULT: MCP capture is persisting interfaces. Rename a page in Airtable and run this again to see a `name` changelog event.",
  );
} finally {
  await sql.end({ timeout: 5 });
}
