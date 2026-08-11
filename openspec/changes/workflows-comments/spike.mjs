#!/usr/bin/env node
// Spike for workflows-comments task 1.1 — verify `recordMetadata=commentCount`
// on the REST list-records call, plus the comments endpoint envelope.
//
//   node openspec/changes/workflows-comments/spike.mjs
//
// Token resolution identical to the MCP spike (see
// openspec/changes/server-mcp-workspaces/spike.mjs). Read-only: list records
// with metadata, list comments on the first commented record found.
// NEVER prints the token.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const postgres = createRequire(path.join(repo, "apps/web/package.json"))("postgres");

const ENGINE = "https://baseout-server-dev.openside.workers.dev";
const CONNECTION_ID = "d0374502-acdf-45ad-86fb-2f8aa87345e0";
const BASES = [
  { id: "appsiv0mQztko91el", name: "DevHire Tracker", tables: ["tbljTQvbVyO3PYnDW", "tbl1FBMLjII7N1zZz"] },
  { id: "appzjlttT62QnEbjw", name: "flashcards", tables: ["tblrWFjRc2nF6Psp2"] },
  { id: "appqNmpWLw5Ztl2V8", name: "Inventory Tracker", tables: ["tblDyVvAItR9YBHow"] },
];

const envLine = (file, name) => {
  const line = readFileSync(path.join(repo, file), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in ${file}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
};
const INTERNAL_TOKEN = envLine("apps/server/.dev.vars", "INTERNAL_TOKEN");
const sql = postgres(envLine("apps/web/.env", "DATABASE_URL"), { prepare: false, max: 1 });

const [conn] = await sql`select access_token_enc from baseout.connections where id = ${CONNECTION_ID}`;
await sql.end();
const tokenRes = await fetch(`${ENGINE}/api/internal/connections/${CONNECTION_ID}/token`, {
  method: "POST",
  headers: { "x-internal-token": INTERNAL_TOKEN, "content-type": "application/json" },
  body: JSON.stringify({ encryptedToken: conn.access_token_enc }),
});
if (tokenRes.status !== 200) {
  console.error(`token exchange FAILED: HTTP ${tokenRes.status}`);
  process.exit(1);
}
const { accessToken } = await tokenRes.json();
console.log("token: OK (redacted)");

const at = (url) =>
  fetch(`https://api.airtable.com/v0/${url}`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });

// ── 1. Param-form probes on one table ───────────────────────────────────────
const probe = BASES[0];
console.log(`\n══════════ param-form probes (${probe.name}/${probe.tables[0]}) ══════════`);
for (const qs of [
  "recordMetadata=commentCount",
  "recordMetadata[]=commentCount",
  "recordMetadata%5B%5D=commentCount",
]) {
  const res = await at(`${probe.id}/${probe.tables[0]}?${qs}&maxRecords=2`);
  const body = await res.json();
  const first = body.records?.[0];
  console.log(
    `?${qs} → HTTP ${res.status}` +
      (res.status === 200
        ? ` | first record keys: ${first ? Object.keys(first).join(",") : "-"} | commentCount present: ${first?.commentCount !== undefined}`
        : ` | error: ${JSON.stringify(body.error ?? body).slice(0, 200)}`),
  );
}

// ── 2. Pagination interaction + hunt for a commented record ────────────────
console.log("\n══════════ commentCount across all dev tables (paginated) ══════════");
let commented = null;
let sampleRecord = null;
for (const base of BASES) {
  for (const tableId of base.tables) {
    let offset;
    let total = 0;
    let withComments = 0;
    do {
      const qs = new URLSearchParams({ pageSize: "100" });
      qs.append("recordMetadata[]", "commentCount");
      if (offset) qs.set("offset", offset);
      const res = await at(`${base.id}/${tableId}?${qs}`);
      if (res.status !== 200) {
        console.log(`  ${base.name}/${tableId}: HTTP ${res.status}`);
        break;
      }
      const body = await res.json();
      for (const r of body.records ?? []) {
        total++;
        if (sampleRecord === null) sampleRecord = r;
        if ((r.commentCount ?? 0) > 0) {
          withComments++;
          if (!commented) commented = { base, tableId, record: r };
        }
      }
      offset = body.offset;
    } while (offset);
    console.log(`  ${base.name}/${tableId}: ${total} records, ${withComments} with commentCount > 0`);
  }
}
if (sampleRecord) {
  const scrub = { ...sampleRecord, fields: `<${Object.keys(sampleRecord.fields ?? {}).length} fields scrubbed>` };
  console.log(`\nsample listing entry shape (fields scrubbed):\n${JSON.stringify(scrub, null, 2)}`);
}

// ── 3. Comments endpoint envelope on the first commented record ────────────
console.log("\n══════════ comments endpoint ══════════");
if (!commented) {
  console.log("No commented record found in any dev base — add a comment in Airtable and re-run for the populated fixture.");
  // Still probe the endpoint shape on an uncommented record (empty envelope).
  const { id: baseId } = BASES[0];
  const res = await at(`${baseId}/${BASES[0].tables[0]}/${sampleRecord.id}/comments`);
  const body = await res.json();
  console.log(`GET …/${sampleRecord.id}/comments → HTTP ${res.status}\n${JSON.stringify(body, null, 2).slice(0, 2000)}`);
} else {
  const { base, tableId, record } = commented;
  const res = await at(`${base.id}/${tableId}/${record.id}/comments`);
  const body = await res.json();
  console.log(
    `GET …/${record.id}/comments (commentCount=${record.commentCount}) → HTTP ${res.status}\n${JSON.stringify(body, null, 2).slice(0, 4000)}`,
  );
}
