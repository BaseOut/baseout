#!/usr/bin/env node
// Smoke for server-mcp-automations (task 5.2's route half) against the
// DEPLOYED dev engine.
//
//   pnpm --filter @baseout/server deploy:dev          # once, after code changes
//   node openspec/changes/server-mcp-automations/smoke.mjs [spaceId]
//
// Plays the workflows task's role: POSTs an automations capture to schema-sync,
// mutates it, omits it, repeats it — asserting the engine's response and the
// per-Space DB rows at each step, including the manual-row isolation check.
// Uses a FICTIONAL baseId and deletes everything it created at the end.
// Reads INTERNAL_TOKEN from apps/server/.dev.vars and DATABASE_URL from
// apps/web/.env. Exit code 0 = all checks passed.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const requireWeb = createRequire(path.join(repo, "apps/web/package.json"));
const postgres = requireWeb("postgres");

const ENGINE = "https://baseout-server-dev.openside.workers.dev";
const SPACE_ID = process.argv[2] ?? "b061d945-e9ea-4a41-a2d6-6628b099b13e"; // "pers"
const BASE_ID = "appZZautoSmokeTst1"; // fictional — NEVER a real base id
const SPACE_SCHEMA = `bo_space_${SPACE_ID.replace(/-/g, "_")}`;

const envLine = (file, name) => {
  const line = readFileSync(path.join(repo, file), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in ${file}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
};

const INTERNAL_TOKEN = envLine("apps/server/.dev.vars", "INTERNAL_TOKEN");
const sql = postgres(envLine("apps/web/.env", "DATABASE_URL"), { prepare: false });

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
};

const WFL_A = "wflSmokeAAAA000001";
const WFL_B = "wflSmokeBBBB000002";

const capture = ({ nameA = "Notify on new order", statusA = "enabled", includeB = true } = {}) => ({
  capturedAt: "2026-07-24T10:00:00.000Z",
  raw: {
    automations: [
      {
        id: WFL_A,
        name: nameA,
        deploymentStatus: statusA,
        trigger: { type: "recordCreated", tableId: "tblSmoke1" },
      },
      ...(includeB ? [{ id: WFL_B, name: "Weekly digest", deploymentStatus: "enabled", trigger: { type: "cron" } }] : []),
    ],
  },
});

const runId = crypto.randomUUID();
async function sync(automations) {
  const res = await fetch(`${ENGINE}/api/internal/spaces/${SPACE_ID}/schema-sync`, {
    method: "POST",
    headers: { "x-internal-token": INTERNAL_TOKEN, "content-type": "application/json" },
    body: JSON.stringify({
      backupRunId: runId,
      captured: { baseId: BASE_ID, name: "Smoke", tables: [] },
      ...(automations !== undefined ? { automations } : {}),
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    console.log(`  ✗ FAIL schema-sync HTTP ${res.status}: ${JSON.stringify(body)}`);
    failures++;
  }
  return body;
}

const rows = () =>
  sql`select airtable_entity_id, name, status, submitted_via, first_seen_at, last_seen_at, definition
      from ${sql(SPACE_SCHEMA)}.bo_at_automations where base_id = ${BASE_ID}
      order by airtable_entity_id`;
const updates = () =>
  sql`select entity_id, change_type, before_value, after_value
      from ${sql(SPACE_SCHEMA)}.bo_at_schema_updates
      where base_id = ${BASE_ID} and entity_type = ${"automation"} order by id`;

async function cleanup() {
  for (const table of ["bo_at_schema_updates", "bo_at_automations", "bo_at_schema_versions", "bo_at_base_runs", "bo_at_bases"]) {
    await sql`delete from ${sql(SPACE_SCHEMA)}.${sql(table)} where base_id = ${BASE_ID}`.catch(() => {});
  }
}

try {
  await cleanup(); // in case a previous run aborted

  console.log(`Space ${SPACE_ID} (${SPACE_SCHEMA}), fictional base ${BASE_ID}\n`);

  console.log("Step 1 — first capture (two automations)");
  const r1 = await sync(capture());
  check("automationSync.ok", r1.automationSync?.ok === true, JSON.stringify(r1.automationSync));
  check("added: 2", r1.automationSync?.added === 2, JSON.stringify(r1.automationSync));
  let dbRows = await rows();
  check(
    "2 mcp rows in bo_at_automations with timestamps",
    dbRows.length === 2 && dbRows.every((r) => r.submitted_via === "mcp" && r.first_seen_at && r.last_seen_at),
  );

  console.log("\nStep 1b — plant a MANUAL row for the same automation entity");
  await sql`insert into ${sql(SPACE_SCHEMA)}.bo_at_automations
    (base_id, airtable_entity_id, name, definition, status, submitted_via)
    values (${BASE_ID}, ${WFL_A}, ${"Manual name"}, ${sql.json({ manual: true })}, ${"active"}, ${"manual"})`;

  console.log("\nStep 2 — mutated capture (rename + deploymentStatus flip)");
  const r2 = await sync(capture({ nameA: "Notify on ANY order", statusA: "disabled" }));
  check("updates: 2 (name + config)", r2.automationSync?.updates === 2, JSON.stringify(r2.automationSync));
  check("added: 0", r2.automationSync?.added === 0, JSON.stringify(r2.automationSync));
  const ups = await updates();
  const nameUp = ups.find((u) => u.change_type === "name");
  const confUp = ups.find((u) => u.change_type === "config");
  check(
    "name event before → after",
    nameUp?.before_value === "Notify on new order" && nameUp?.after_value === "Notify on ANY order",
    JSON.stringify(nameUp),
  );
  check(
    "config event carries the definition delta (deploymentStatus disabled)",
    confUp?.after_value?.deploymentStatus === "disabled" && confUp?.before_value?.deploymentStatus === "enabled",
    JSON.stringify(confUp),
  );

  console.log("\nStep 3 — capture ABSENT (old workflows / skipped)");
  const before3 = JSON.stringify(await rows()) + JSON.stringify(await updates());
  const r3 = await sync(undefined);
  check("response has NO automationSync key", !("automationSync" in r3));
  const after3 = JSON.stringify(await rows()) + JSON.stringify(await updates());
  check("rows + events untouched (absent ≠ deleted)", before3 === after3);

  console.log("\nStep 4 — identical capture (hash short-circuit)");
  const r4 = await sync(capture({ nameA: "Notify on ANY order", statusA: "disabled" }));
  check("unchanged: true", r4.automationSync?.unchanged === true, JSON.stringify(r4.automationSync));
  check("updates: 0", r4.automationSync?.updates === 0);

  console.log("\nStep 5 — automation deleted in Airtable (B absent)");
  const r5 = await sync(capture({ nameA: "Notify on ANY order", statusA: "disabled", includeB: false }));
  check("removed: 1", r5.automationSync?.removed === 1, JSON.stringify(r5.automationSync));
  dbRows = await rows();
  const removed = dbRows.find((r) => r.airtable_entity_id === WFL_B);
  check("removed row status = removed, last_seen_at kept", removed?.status === "removed" && !!removed?.last_seen_at);

  console.log("\nStep 6 — manual row untouched throughout");
  const manual = dbRows.find((r) => r.submitted_via === "manual");
  check(
    "manual row byte-identical",
    manual?.name === "Manual name" && manual?.status === "active" && JSON.stringify(manual?.definition) === JSON.stringify({ manual: true }),
    JSON.stringify(manual),
  );

  console.log(`\n${failures === 0 ? "PASS — all checks green" : `FAIL — ${failures} check(s) failed`}`);
} finally {
  await cleanup();
  console.log("(smoke rows cleaned up)");
  await sql.end({ timeout: 5 });
}
process.exit(failures === 0 ? 0 : 1);
