#!/usr/bin/env node
// Smoke for the hooks receiver against a LOCAL `wrangler dev` of apps/hooks:
//
//   pnpm --filter @baseout/hooks dev            # http://localhost:8788 (+ .dev.vars)
//   node openspec/changes/hooks/smoke.mjs
//
// Seeds an airtable_webhooks row (encrypted MAC secret, FK'd to the dev DB's
// first org + connection), then drives the wire: verified ping → 200 empty +
// last_ping_at stamped; tampered body → 401; unknown id → 410; wrong method →
// 405; inactive row → 410. Deletes the row. Reads DATABASE_URL from
// apps/web/.env and the encryption key from apps/hooks/.dev.vars.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import crypto from "node:crypto";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const requireWeb = createRequire(path.join(repo, "apps/web/package.json"));
const postgres = requireWeb("postgres");

const BASE = process.env.HOOKS_BASE ?? "http://localhost:8788";
const envLine = (file, name) => {
  const line = readFileSync(path.join(repo, file), "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in ${file}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
};
const sql = postgres(envLine("apps/web/.env", "DATABASE_URL"), { prepare: false, connection: { search_path: "baseout,public" } });
const KEY = envLine("apps/hooks/.dev.vars", "MASTER_ENCRYPTION_KEY");

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`  ${ok ? "✓" : "✗ FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
};

// AES-256-GCM in the shared format: base64( iv(12) || ciphertext+tag ).
async function encrypt(plaintext, keyB64) {
  const raw = Buffer.from(keyB64, "base64");
  const key = await webcrypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = webcrypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await webcrypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext)));
  return Buffer.concat([iv, ct]).toString("base64");
}

const MAC_SECRET_B64 = Buffer.from(webcrypto.getRandomValues(new Uint8Array(32))).toString("base64");
const macFor = (body) =>
  "hmac-sha256=" + crypto.createHmac("sha256", Buffer.from(MAC_SECRET_B64, "base64")).update(body).digest("hex");

const AT_WEBHOOK_ID = "ach_smoke_" + Math.random().toString(36).slice(2, 10);
const BASE_ID = "appSMOKEBASE00000";

async function cleanup() {
  await sql`delete from baseout.airtable_webhooks where airtable_webhook_id like 'ach_smoke_%'`.catch(() => {});
}

try {
  await cleanup();
  const [org] = await sql`select id from baseout.organizations order by created_at asc limit 1`;
  const [conn] = await sql`select id from baseout.connections order by created_at asc limit 1`;
  if (!org || !conn) throw new Error("dev DB needs at least one organization + connection");

  const enc = await encrypt(MAC_SECRET_B64, KEY);
  const [row] = await sql`
    insert into baseout.airtable_webhooks
      (organization_id, connection_id, base_id, airtable_webhook_id, mac_secret_base64_enc, status)
    values (${org.id}, ${conn.id}, ${BASE_ID}, ${AT_WEBHOOK_ID}, ${enc}, 'active')
    returning id`;
  console.log(`webhook row ${row.id}, receiver ${BASE}\n`);

  const url = `${BASE}/webhooks/airtable/${row.id}`;
  const body = JSON.stringify({ base: { id: BASE_ID }, webhook: { id: AT_WEBHOOK_ID }, timestamp: new Date().toISOString() });

  console.log("Step 1 — verified ping");
  const ok = await fetch(url, { method: "POST", headers: { "x-airtable-content-mac": macFor(body), "content-type": "application/json" }, body });
  check("200 status", ok.status === 200, `got ${ok.status}`);
  check("empty body (Airtable contract)", (await ok.text()) === "");
  const [after] = await sql`select last_ping_at from baseout.airtable_webhooks where id = ${row.id}`;
  check("last_ping_at stamped", after.last_ping_at !== null);

  console.log("Step 2 — rejections");
  const tampered = await fetch(url, { method: "POST", headers: { "x-airtable-content-mac": macFor(body) }, body: body.replace(BASE_ID, "appEVIL0000000000") });
  check("tampered body → 401", tampered.status === 401, `got ${tampered.status}`);
  const noMac = await fetch(url, { method: "POST", body });
  check("missing MAC → 401", noMac.status === 401, `got ${noMac.status}`);
  const unknown = await fetch(`${BASE}/webhooks/airtable/00000000-0000-4000-8000-000000000000`, { method: "POST", headers: { "x-airtable-content-mac": macFor(body) }, body });
  check("unknown row id → 410", unknown.status === 410, `got ${unknown.status}`);
  const wrongMethod = await fetch(url, { method: "GET" });
  check("GET → 405", wrongMethod.status === 405, `got ${wrongMethod.status}`);

  console.log("Step 3 — inactive row");
  await sql`update baseout.airtable_webhooks set status = 'inactive' where id = ${row.id}`;
  const inactive = await fetch(url, { method: "POST", headers: { "x-airtable-content-mac": macFor(body) }, body });
  check("inactive row → 410", inactive.status === 410, `got ${inactive.status}`);

  console.log(failures ? `\nFAIL — ${failures} check(s) failed` : "\nPASS — all checks green");
} finally {
  await cleanup();
  await sql.end({ timeout: 5 });
  console.log("(smoke row cleaned up)");
}
process.exit(failures ? 1 : 0);
