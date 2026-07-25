#!/usr/bin/env node
// Smoke for server-interfaces-normalize (task 5.2) against the DEPLOYED dev engine.
//
//   pnpm --filter @baseout/server deploy:dev          # once, after code changes
//   node openspec/changes/server-interfaces-normalize/smoke.mjs [spaceId]
//
// Plays the workflows task's role: POSTs interface captures to schema-sync and
// asserts the engine response + the SIX normalized per-Space tables at each
// step — fixture inspection → mutate (rename + field removal) → page removal
// (cascade) → absent field → identical capture (short-circuit) → resurrection
// (first_seen_run preserved) → manual-row isolation. Uses a FICTIONAL baseId and
// deletes everything it created at the end. Reads INTERNAL_TOKEN from
// apps/server/.dev.vars and DATABASE_URL from apps/web/.env. Exit 0 = all green.

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

// app + one list page (fldA [+ fldB]) + one standalone form.
const capture = ({ pageName = "Page A", extraField = true } = {}) => ({
  capturedAt: "2026-07-20T10:00:00.000Z",
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
    standaloneForms: [
      { id: "pagFormSmoke", name: "Intake", interfaceId: null, pageType: "form", sourceTableId: "tblSmoke1" },
    ],
  },
});

// Empty pages + form removed → confident full capture with the page gone.
const captureEmpty = () => ({
  capturedAt: "2026-07-20T10:00:00.000Z",
  raw: { interfaces: [{ id: "pbdSmoke1", name: "Interface", pages: [] }], standaloneForms: [] },
});

async function sync(interfacePages, runId) {
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

const q = {
  interfaces: () => sql`select airtable_entity_id, name, status, submitted_via, first_seen_run, last_seen_run, definition
      from ${sql(SPACE_SCHEMA)}.bo_at_interfaces where base_id = ${BASE_ID} order by airtable_entity_id, submitted_via`,
  pages: () => sql`select airtable_entity_id, interface_id, name, page_type, source_table_id, status, submitted_via, first_seen_run, last_seen_run, definition
      from ${sql(SPACE_SCHEMA)}.bo_at_pages where base_id = ${BASE_ID} order by airtable_entity_id, submitted_via`,
  forms: () => sql`select airtable_entity_id, interface_id, name, source_table_id, status
      from ${sql(SPACE_SCHEMA)}.bo_at_forms where base_id = ${BASE_ID} order by airtable_entity_id`,
  pageTables: () => sql`select page_id, table_id, status from ${sql(SPACE_SCHEMA)}.bo_at_page_tables where base_id = ${BASE_ID} order by page_id, table_id`,
  pageFields: () => sql`select page_id, table_id, field_id, is_editable, status, first_seen_run from ${sql(SPACE_SCHEMA)}.bo_at_page_fields where base_id = ${BASE_ID} order by page_id, field_id`,
  formFields: () => sql`select count(*)::int as n from ${sql(SPACE_SCHEMA)}.bo_at_form_fields where base_id = ${BASE_ID}`,
  updates: () => sql`select entity_type, entity_id, change_type, before_value, after_value
      from ${sql(SPACE_SCHEMA)}.bo_at_schema_updates where base_id = ${BASE_ID} and entity_type in ('interface','page','form') order by id`,
};

async function cleanup() {
  for (const table of [
    "bo_at_schema_updates", "bo_at_interfaces", "bo_at_pages", "bo_at_forms",
    "bo_at_page_tables", "bo_at_page_fields", "bo_at_form_fields",
    "bo_at_schema_versions", "bo_at_base_runs", "bo_at_bases",
  ]) {
    await sql`delete from ${sql(SPACE_SCHEMA)}.${sql(table)} where base_id = ${BASE_ID}`.catch(() => {});
  }
}

try {
  await cleanup(); // in case a previous run aborted
  console.log(`Space ${SPACE_ID} (${SPACE_SCHEMA}), fictional base ${BASE_ID}\n`);

  const run1 = crypto.randomUUID();
  console.log("Step 1 — first capture (app + page[fldA,fldB] + standalone form)");
  const r1 = await sync(capture(), run1);
  check("interfaceSync.ok", r1.interfaceSync?.ok === true, JSON.stringify(r1.interfaceSync));
  check("added: 3 (app + page + form)", r1.interfaceSync?.added === 3, JSON.stringify(r1.interfaceSync));
  check("1 interface (app) row, mcp", (await q.interfaces()).filter((r) => r.submitted_via === "mcp").length === 1);
  const pg1 = await q.pages();
  check("1 page row with columns", pg1.length === 1 && pg1[0].page_type === "list" && pg1[0].source_table_id === "tblSmoke1" && pg1[0].interface_id === "pbdSmoke1");
  check("page definition has NO tablesByTableId / field names", !JSON.stringify(pg1[0].definition).includes("tablesByTableId") && !JSON.stringify(pg1[0].definition).includes("Status"));
  const fm1 = await q.forms();
  check("1 form row (standalone, interface_id null)", fm1.length === 1 && fm1[0].interface_id === null && fm1[0].source_table_id === "tblSmoke1");
  check("1 page_tables row", (await q.pageTables()).length === 1);
  const pf1 = await q.pageFields();
  check("2 page_fields rows (fldA not-editable, fldB editable)", pf1.length === 2 && pf1.find((r) => r.field_id === "fldA")?.is_editable === false && pf1.find((r) => r.field_id === "fldB")?.is_editable === true);
  check("form_fields EMPTY (no get_form_schema path)", (await q.formFields())[0].n === 0);
  const firstSeenPage = pg1[0].first_seen_run;

  console.log("\nStep 1b — plant a MANUAL page row for the same entity id");
  await sql`insert into ${sql(SPACE_SCHEMA)}.bo_at_pages
    (base_id, airtable_entity_id, interface_id, name, page_type, source_table_id, definition, status, submitted_via)
    values (${BASE_ID}, ${"pagSmoke1"}, ${"pbdSmoke1"}, ${"Manual name"}, ${"list"}, ${"tblSmoke1"}, ${sql.json({ manual: true })}, ${"active"}, ${"manual"})`;

  console.log("\nStep 2 — mutate: rename page + remove field fldB");
  const r2 = await sync(capture({ pageName: "Page A v2", extraField: false }), crypto.randomUUID());
  check("updates: 2 (name + config)", r2.interfaceSync?.updates === 2, JSON.stringify(r2.interfaceSync));
  check("added: 0", r2.interfaceSync?.added === 0);
  const ups = await q.updates();
  const nameUp = ups.find((u) => u.change_type === "name" && u.entity_type === "page");
  const confUp = ups.find((u) => u.change_type === "config" && u.entity_type === "page");
  check("page name event Page A → Page A v2", nameUp?.before_value === "Page A" && nameUp?.after_value === "Page A v2", JSON.stringify(nameUp));
  check("config event removes fldB", JSON.stringify(confUp?.after_value?.fieldUsage?.removed) === JSON.stringify([{ tableId: "tblSmoke1", fieldIds: ["fldB"] }]), JSON.stringify(confUp?.after_value));
  check("fldB page_field row now removed", (await q.pageFields()).find((r) => r.field_id === "fldB")?.status === "removed");

  console.log("\nStep 3 — capture ABSENT (old workflows / skipped)");
  const before3 = JSON.stringify([await q.pages(), await q.pageFields(), await q.updates()]);
  const r3 = await sync(undefined, crypto.randomUUID());
  check("response has NO interfaceSync key", !("interfaceSync" in r3));
  check("rows + events untouched (absent ≠ deleted)", JSON.stringify([await q.pages(), await q.pageFields(), await q.updates()]) === before3);

  console.log("\nStep 4 — identical capture (hash short-circuit)");
  const r4 = await sync(capture({ pageName: "Page A v2", extraField: false }), crypto.randomUUID());
  check("unchanged: true", r4.interfaceSync?.unchanged === true, JSON.stringify(r4.interfaceSync));
  check("updates: 0", r4.interfaceSync?.updates === 0);

  console.log("\nStep 5 — page + form deleted (cascade: page links removed)");
  const r5 = await sync(captureEmpty(), crypto.randomUUID());
  check("removed ≥ 2 (page + form)", (r5.interfaceSync?.removed ?? 0) >= 2, JSON.stringify(r5.interfaceSync));
  check("mcp page row status = removed", (await q.pages()).find((r) => r.submitted_via === "mcp")?.status === "removed");
  check("all mcp page_fields removed (cascade)", (await q.pageFields()).every((r) => r.status === "removed"));
  check("page_tables removed (cascade)", (await q.pageTables()).every((r) => r.status === "removed"));

  console.log("\nStep 6 — page republished (resurrection: first_seen_run preserved)");
  const r6 = await sync(capture({ pageName: "Page A v2", extraField: false }), crypto.randomUUID());
  check("added: 0 (resurrected, not re-inserted)", r6.interfaceSync?.added === 0, JSON.stringify(r6.interfaceSync));
  const pg6 = (await q.pages()).find((r) => r.submitted_via === "mcp");
  check("page active again", pg6?.status === "active");
  check("first_seen_run preserved from run 1", pg6?.first_seen_run === firstSeenPage);
  check("last_seen_run advanced", pg6?.last_seen_run !== firstSeenPage);
  check("fldA page_field active again (resurrected)", (await q.pageFields()).find((r) => r.field_id === "fldA" && r.status === "active"));

  console.log("\nStep 7 — manual row untouched throughout");
  const manual = (await q.pages()).find((r) => r.submitted_via === "manual");
  check("manual page row byte-identical", manual?.name === "Manual name" && manual?.status === "active" && JSON.stringify(manual?.definition) === JSON.stringify({ manual: true }), JSON.stringify(manual));

  console.log(`\n${failures === 0 ? "PASS — all checks green" : `FAIL — ${failures} check(s) failed`}`);
} finally {
  await cleanup();
  console.log("(smoke rows cleaned up)");
  await sql.end({ timeout: 5 });
}
process.exit(failures === 0 ? 0 : 1);
