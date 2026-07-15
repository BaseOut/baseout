#!/usr/bin/env node
// Smoke for server-mcp-interface-pages (task 4.2) against the DEPLOYED dev engine.
//
//   pnpm --filter @baseout/server deploy:dev          # once, after code changes
//   node openspec/changes/server-mcp-interface-pages/smoke.mjs [spaceId]
//
// Plays the workflows task's role: POSTs an interface capture to schema-sync,
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
const BASE_ID = "appZZitfSmokeTest1"; // fictional — NEVER a real base id
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

const capture = ({ pageName = "Page A", extraField = false } = {}) => ({
  capturedAt: "2026-07-14T10:00:00.000Z",
  raw: {
    interfaces: [
      {
        id: "pbdSmoke1",
        name: "Interface",
        pages: [
          {
            id: "pagSmoke1",
            interfaceId: "pbdSmoke1",
            name: pageName,
            pageType: "list",
            sourceTableId: "tblSmoke1",
            tablesByTableId: {
              tblSmoke1: {
                id: "tblSmoke1",
                name: "T",
                fields: [
                  { id: "fldA", name: "Status", isEditable: false },
                  ...(extraField ? [{ id: "fldB", name: "Owner", isEditable: true }] : []),
                ],
              },
            },
          },
        ],
      },
    ],
    standaloneForms: [],
  },
});

const runId = crypto.randomUUID();
async function sync(interfacePages) {
  const res = await fetch(`${ENGINE}/api/internal/spaces/${SPACE_ID}/schema-sync`, {
    method: "POST",
    headers: { "x-internal-token": INTERNAL_TOKEN, "content-type": "application/json" },
    body: JSON.stringify({
      backupRunId: runId,
      captured: { baseId: BASE_ID, name: "Smoke", tables: [] },
      ...(interfacePages !== undefined ? { interfacePages } : {}),
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
  sql`select airtable_entity_id, name, type, status, submitted_via, first_seen_at, last_seen_at, definition
      from ${sql(SPACE_SCHEMA)}.bo_at_interfaces where base_id = ${BASE_ID}
      order by airtable_entity_id`;
const updates = () =>
  sql`select entity_id, change_type, before_value, after_value
      from ${sql(SPACE_SCHEMA)}.bo_at_schema_updates
      where base_id = ${BASE_ID} and entity_type = ${"interface"} order by id`;

async function cleanup() {
  for (const table of ["bo_at_schema_updates", "bo_at_interfaces", "bo_at_schema_versions", "bo_at_base_runs", "bo_at_bases"]) {
    await sql`delete from ${sql(SPACE_SCHEMA)}.${sql(table)} where base_id = ${BASE_ID}`.catch(async () => {
      // bo_at_base_runs has no base_id?  It does — but keep cleanup best-effort.
    });
  }
}

try {
  await cleanup(); // in case a previous run aborted

  console.log(`Space ${SPACE_ID} (${SPACE_SCHEMA}), fictional base ${BASE_ID}\n`);

  console.log("Step 1 — first capture (app + page)");
  const r1 = await sync(capture());
  check("interfaceSync.ok", r1.interfaceSync?.ok === true, JSON.stringify(r1.interfaceSync));
  check("added: 2", r1.interfaceSync?.added === 2, JSON.stringify(r1.interfaceSync));
  let dbRows = await rows();
  check("2 mcp rows in bo_at_interfaces", dbRows.length === 2 && dbRows.every((r) => r.submitted_via === "mcp"));

  console.log("\nStep 1b — plant a MANUAL row for the same page entity");
  await sql`insert into ${sql(SPACE_SCHEMA)}.bo_at_interfaces
    (base_id, airtable_entity_id, name, type, definition, status, submitted_via)
    values (${BASE_ID}, ${"pagSmoke1"}, ${"Manual name"}, ${"page"}, ${sql.json({ manual: true })}, ${"active"}, ${"manual"})`;

  console.log("\nStep 2 — mutated capture (page renamed + field fldB added)");
  const r2 = await sync(capture({ pageName: "Page A v2", extraField: true }));
  check("updates: 2 (name + config)", r2.interfaceSync?.updates === 2, JSON.stringify(r2.interfaceSync));
  check("added: 0", r2.interfaceSync?.added === 0, JSON.stringify(r2.interfaceSync));
  const ups = await updates();
  const nameUp = ups.find((u) => u.change_type === "name");
  const confUp = ups.find((u) => u.change_type === "config");
  check("name event Page A → Page A v2", nameUp?.before_value === "Page A" && nameUp?.after_value === "Page A v2", JSON.stringify(nameUp));
  check(
    "config event carries fieldUsage.added [fldB]",
    JSON.stringify(confUp?.after_value?.fieldUsage?.added) === JSON.stringify([{ tableId: "tblSmoke1", fieldIds: ["fldB"] }]),
    JSON.stringify(confUp?.after_value),
  );

  console.log("\nStep 3 — capture ABSENT (old workflows / skipped)");
  const before3 = JSON.stringify(await rows()) + JSON.stringify(await updates());
  const r3 = await sync(undefined);
  check("response has NO interfaceSync key", !("interfaceSync" in r3));
  const after3 = JSON.stringify(await rows()) + JSON.stringify(await updates());
  check("rows + events untouched (absent ≠ deleted)", before3 === after3);

  console.log("\nStep 4 — identical capture (hash short-circuit)");
  const r4 = await sync(capture({ pageName: "Page A v2", extraField: true }));
  check("unchanged: true", r4.interfaceSync?.unchanged === true, JSON.stringify(r4.interfaceSync));
  check("updates: 0", r4.interfaceSync?.updates === 0);

  console.log("\nStep 5 — page deleted in Airtable (empty pages)");
  const r5 = await sync({ ...capture(), raw: { interfaces: [{ id: "pbdSmoke1", name: "Interface", pages: [] }], standaloneForms: [] } });
  check("removed: 1", r5.interfaceSync?.removed === 1, JSON.stringify(r5.interfaceSync));
  dbRows = await rows();
  const removedPage = dbRows.find((r) => r.airtable_entity_id === "pagSmoke1" && r.submitted_via === "mcp");
  check("page row status = removed", removedPage?.status === "removed");

  console.log("\nStep 6 — manual row untouched throughout (2.4)");
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
