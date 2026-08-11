#!/usr/bin/env node
// Spike for server-comment-attachments task 1.1 + 1.2 (payload shape + the
// count-delta open question). Confirms the LIVE shape of a comment's
// `attachments[]` array and answers: does an attachment-only comment edit bump
// the record's `commentCount` / the comment's `lastUpdatedTime`?
//
//   node openspec/changes/server-comment-attachments/spike.mjs
//
// PREREQ (human): on the dev Connection's base + record below, post a comment
// that carries an attachment (drag a file into a record comment in the Airtable
// UI). Then run this. It:
//   1. Resolves the dev Connection access token the production way (master DB →
//      deployed dev engine ConnectionDO /token route, refresh-if-needed).
//   2. GET /v0/{baseId}/{tableId}/{recordId}/comments — prints the attachments[]
//      shape (id/filename/url/type/size/width/height/thumbnails).
//   3. GET /v0/{baseId}/{tableId}?recordMetadata[]=commentCount for the record —
//      prints its commentCount (compare before/after an attachment-only edit to
//      answer the open question).
// NEVER prints the access token or the (2h) attachment URLs in full.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const postgres = createRequire(path.join(repo, "apps/web/package.json"))("postgres");

const ENGINE = "https://baseout-server-dev.openside.workers.dev";
const CONNECTION_ID = "d0374502-acdf-45ad-86fb-2f8aa87345e0"; // dev, non-enterprise
// {{confirm}} — set to a base/table/record that has a comment WITH an attachment.
const BASE_ID = process.env.SPIKE_BASE_ID ?? "appsiv0mQztko91el";
const TABLE_ID = process.env.SPIKE_TABLE_ID ?? "{{confirm — tblXXXX}}";
const RECORD_ID = process.env.SPIKE_RECORD_ID ?? "{{confirm — recXXXX}}";
const AT = "https://api.airtable.com";

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
if (!conn) throw new Error("connection not found");
const tokenRes = await fetch(`${ENGINE}/api/internal/connections/${CONNECTION_ID}/token`, {
  method: "POST",
  headers: { "x-internal-token": INTERNAL_TOKEN, "content-type": "application/json" },
  body: JSON.stringify({ encryptedToken: conn.access_token_enc }),
});
if (tokenRes.status !== 200) {
  console.error(`token exchange FAILED: HTTP ${tokenRes.status} ${await tokenRes.text()}`);
  process.exit(1);
}
const { accessToken } = await tokenRes.json();
console.log("token: OK (redacted)");

const authHeaders = { authorization: `Bearer ${accessToken}`, accept: "application/json" };
const redactUrls = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (k, v) => (k === "url" && typeof v === "string" ? v.slice(0, 40) + "…(redacted)" : v)),
  );

// ── comments (attachments[] shape) ──
const cRes = await fetch(
  `${AT}/v0/${BASE_ID}/${TABLE_ID}/${RECORD_ID}/comments`,
  { headers: authHeaders },
);
console.log(`\ncomments HTTP ${cRes.status}`);
const cBody = await cRes.json();
const withAttachments = (cBody.comments ?? []).filter((c) => Array.isArray(c.attachments) && c.attachments.length);
console.log(`comments with attachments: ${withAttachments.length}`);
console.log(JSON.stringify(redactUrls(withAttachments), null, 2));

// ── record commentCount (open question) ──
const rRes = await fetch(
  `${AT}/v0/${BASE_ID}/${TABLE_ID}?recordMetadata%5B%5D=commentCount&filterByFormula=${encodeURIComponent(`RECORD_ID()='${RECORD_ID}'`)}`,
  { headers: authHeaders },
);
console.log(`\nrecord metadata HTTP ${rRes.status}`);
const rBody = await rRes.json();
for (const rec of rBody.records ?? []) {
  console.log(`record ${rec.id}: commentCount = ${rec.commentCount}`);
}
console.log(
  "\nOpen question: note this commentCount + each comment's lastUpdatedTime, then\n" +
    "add/remove ONLY an attachment on an existing comment and re-run. If neither\n" +
    "changes, the count-delta plan can miss attachment-only edits (documented\n" +
    "blind spot) — the comments-plan stuck-pending recovery is the safety net.",
);
