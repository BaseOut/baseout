#!/usr/bin/env node
// Smoke for server-rest-read-support against the DEPLOYED dev engine.
//
//   pnpm --filter @baseout/server deploy:dev
//   node openspec/changes/server-rest-read-support/smoke.mjs [spaceId]
//
// Seeds a fictional base's schema (base + table + 2 fields + view + a base_run &
// schema_version) directly into the Space's per-Space schema, then exercises the
// new/extended internal endpoints over the service surface: legacy schema-read,
// scoped+paginated reads, schema-search (name / options / wildcard-escape),
// schema-versions, filtered changelog, and the internal-token gate. Cleans up.
// Reads INTERNAL_TOKEN from apps/server/.dev.vars, DATABASE_URL from apps/web/.env.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const requireWeb = createRequire(path.join(repo, "apps/web/package.json"));
const postgres = requireWeb("postgres");

const ENGINE = "https://baseout-server-dev.openside.workers.dev";
const SPACE_ID = process.argv[2] ?? "b061d945-e9ea-4a41-a2d6-6628b099b13e";
const BASE_ID = "appZZitfReadSmoke1"; // fictional
const SPACE_SCHEMA = `bo_space_${SPACE_ID.replace(/-/g, "_")}`;

const envLine = (file, name) => {
  const line = readFileSync(path.join(repo, file), "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
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

const RUN_ID = crypto.randomUUID();
const S = (t) => sql(SPACE_SCHEMA + "." + t); // qualified table

async function seed() {
  await sql`insert into ${S("bo_at_base_runs")} (id, backup_run_id, base_id, status, schema_hash, started_at, completed_at)
    values (${RUN_ID}, ${crypto.randomUUID()}, ${BASE_ID}, ${"succeeded"}, ${"hashREAD1"}, now(), now())`;
  await sql`insert into ${S("bo_at_schema_versions")} (base_id, schema_hash, schema_json, first_seen_run)
    values (${BASE_ID}, ${"hashREAD1"}, ${sql.json({ base: BASE_ID })}, ${RUN_ID})`;
  await sql`insert into ${S("bo_at_bases")} (base_id, name, description, status, first_seen_run, last_seen_run)
    values (${BASE_ID}, ${"Read Smoke Base"}, ${"desc"}, ${"active"}, ${RUN_ID}, ${RUN_ID})`;
  await sql`insert into ${S("bo_at_tables")} (table_id, base_id, name, status, first_seen_run, last_seen_run)
    values (${"tblReadSmoke1"}, ${BASE_ID}, ${"Contacts"}, ${"active"}, ${RUN_ID}, ${RUN_ID})`;
  await sql`insert into ${S("bo_at_fields")} (field_id, table_id, base_id, name, type, options, is_primary, status, first_seen_run, last_seen_run)
    values (${"fldEmail"}, ${"tblReadSmoke1"}, ${BASE_ID}, ${"Email"}, ${"email"}, null, ${true}, ${"active"}, ${RUN_ID}, ${RUN_ID})`;
  await sql`insert into ${S("bo_at_fields")} (field_id, table_id, base_id, name, type, options, is_primary, status, first_seen_run, last_seen_run)
    values (${"fldStatus"}, ${"tblReadSmoke1"}, ${BASE_ID}, ${"Status"}, ${"singleSelect"},
      ${sql.json({ choices: [{ name: "Archived" }, { name: "Active" }] })}, ${false}, ${"active"}, ${RUN_ID}, ${RUN_ID})`;
  await sql`insert into ${S("bo_at_views")} (view_id, table_id, base_id, name, type, status, first_seen_run, last_seen_run)
    values (${"viwGrid"}, ${"tblReadSmoke1"}, ${BASE_ID}, ${"Grid view"}, ${"grid"}, ${"active"}, ${RUN_ID}, ${RUN_ID})`;
  // a breaking changelog row to exercise the filter
  await sql`insert into ${S("bo_at_schema_updates")} (run_id, entity_type, entity_id, base_id, table_id, change_type, breaks_data)
    values (${RUN_ID}, ${"field"}, ${"fldEmail"}, ${BASE_ID}, ${"tblReadSmoke1"}, ${"type"}, ${true})`;
}

async function cleanup() {
  for (const t of ["bo_at_schema_updates", "bo_at_fields", "bo_at_views", "bo_at_tables", "bo_at_schema_versions", "bo_at_bases", "bo_at_base_runs"]) {
    await sql`delete from ${S(t)} where base_id = ${BASE_ID}`.catch(() => {});
  }
}

const get = (p, withToken = true) =>
  fetch(`${ENGINE}/api/internal/spaces/${SPACE_ID}${p}`, {
    headers: withToken ? { "x-internal-token": INTERNAL_TOKEN } : {},
  });
const post = (p, body) =>
  fetch(`${ENGINE}/api/internal/spaces/${SPACE_ID}${p}`, {
    method: "POST",
    headers: { "x-internal-token": INTERNAL_TOKEN, "content-type": "application/json" },
    body: JSON.stringify(body),
  });

try {
  await cleanup();
  await seed();
  console.log(`Space ${SPACE_ID} (${SPACE_SCHEMA}), fictional base ${BASE_ID}\n`);

  console.log("Step 1 — legacy schema-read (web contract) + schemaHash");
  const r1 = await (await get(`/schema`)).json();
  check("bases/tables/fields/views present", r1.ok && r1.bases?.length >= 1 && r1.tables?.length >= 1 && r1.fields?.length >= 2 && r1.views?.length >= 1);
  check("schemaHashByBase carries hashREAD1", r1.schemaHashByBase?.[BASE_ID] === "hashREAD1", JSON.stringify(r1.schemaHashByBase));

  console.log("\nStep 2 — scoped read (tables of the base) + limit/cursor");
  const r2 = await (await get(`/schema?entity=tables&baseId=${BASE_ID}&limit=1`)).json();
  check("one table row, entity=tables", r2.ok && r2.entity === "tables" && r2.rows.length === 1);
  check("scoped read includes schemaHash", r2.schemaHashByBase?.[BASE_ID] === "hashREAD1");

  console.log("\nStep 3 — scoped fields read by tableId");
  const r3 = await (await get(`/schema?entity=fields&tableId=tblReadSmoke1`)).json();
  check("2 field rows", r3.ok && r3.rows.length === 2);

  console.log("\nStep 4 — schema-search by name (field 'email' → ancestry)");
  const r4 = await (await post(`/schema-search`, { query: "email", types: ["field"] })).json();
  const emailHit = r4.hits?.find((h) => h.entity.fieldId === "fldEmail");
  check("field hit with base + table ancestry", !!emailHit && emailHit.ancestry?.base?.baseId === BASE_ID && emailHit.ancestry?.table?.tableId === "tblReadSmoke1", JSON.stringify(emailHit?.ancestry));

  console.log("\nStep 5 — schema-search in options ('Archived')");
  const r5 = await (await post(`/schema-search`, { query: "Archived", types: ["field"], match: { in: ["options"] } })).json();
  check("options match finds fldStatus", r5.hits?.some((h) => h.entity.fieldId === "fldStatus"), JSON.stringify(r5.hits?.map((h) => h.entity.fieldId)));

  console.log("\nStep 6 — wildcard escaping (query '%' matches literally → no hits)");
  const r6 = await (await post(`/schema-search`, { query: "%", types: ["field", "table", "base", "view"] })).json();
  check("literal % returns zero hits (not everything)", Array.isArray(r6.hits) && r6.hits.length === 0, `got ${r6.hits?.length}`);

  console.log("\nStep 7 — bad property rejected 400 naming param");
  const r7 = await post(`/schema-search`, { query: "x", bogus: 1 });
  const r7b = await r7.json();
  check("400 invalid_request param=bogus", r7.status === 400 && r7b.param === "bogus", JSON.stringify(r7b));

  console.log("\nStep 8 — schema-versions (no schema_json)");
  const r8 = await (await get(`/schema-versions?baseId=${BASE_ID}`)).json();
  check("version listed with hash, no schema_json body", r8.ok && r8.versions?.[0]?.schemaHash === "hashREAD1" && !("schemaJson" in (r8.versions?.[0] ?? {})), JSON.stringify(r8.versions?.[0]));

  console.log("\nStep 9 — changelog filter breaksData=true");
  const r9 = await (await get(`/schema-changelog?baseId=${BASE_ID}&breaksData=true`)).json();
  check("only the breaking change returned", r9.ok && r9.entries?.length === 1 && r9.entries[0].breaksData === true && "nextCursor" in r9, JSON.stringify(r9.entries?.map((e) => e.entityId)));

  console.log("\nStep 10 — internal-token gate (401 before DB access)");
  const r10 = await get(`/schema-versions?baseId=${BASE_ID}`, false);
  check("no token → 401", r10.status === 401, `got ${r10.status}`);

  console.log(`\n${failures === 0 ? "PASS — all checks green" : `FAIL — ${failures} check(s) failed`}`);
} finally {
  await cleanup();
  console.log("(smoke rows cleaned up)");
  await sql.end({ timeout: 5 });
}
process.exit(failures === 0 ? 0 : 1);
