// Token-day smoke for the D1 backend (server-d1-backend 6.1 / server-d1-data-plane 3.2).
//
// Drives the engine's internal routes end-to-end against a REAL Cloudflare D1:
//   provision (backend:d1) → schema-sync a sample base → schema-read it back
//   → deprovision. Prints each step; exits non-zero on the first failure.
//
// Prereqs: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_D1_API_TOKEN set on the target
// engine (via .dev.vars + deploy — never `wrangler secret put` by hand), and
// migration 0039 applied to that env's master DB.
//
// Usage:
//   ENGINE_URL=https://baseout-server.openside.workers.dev \
//   SERVER_INTERNAL_TOKEN=... SPACE_ID=<existing Space uuid> \
//   node apps/server/scripts/smoke-d1.mjs [--keep]
//
// --keep skips the deprovision so the database stays visible in the dashboard.

const ENGINE_URL = process.env.ENGINE_URL?.replace(/\/$/, "");
const SERVER_INTERNAL_TOKEN = process.env.SERVER_INTERNAL_TOKEN;
const SPACE_ID = process.env.SPACE_ID;
const KEEP = process.argv.includes("--keep");

if (!ENGINE_URL || !SERVER_INTERNAL_TOKEN || !SPACE_ID) {
  console.error("Set ENGINE_URL, SERVER_INTERNAL_TOKEN, SPACE_ID env vars.");
  process.exit(2);
}

const headers = { "x-internal-token": SERVER_INTERNAL_TOKEN, "content-type": "application/json" };

async function step(name, method, path, body) {
  const res = await fetch(`${ENGINE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 300) }; }
  const ok = res.ok;
  console.log(`${ok ? "✓" : "✗"} ${name} → ${res.status}`, JSON.stringify(json).slice(0, 240));
  if (!ok) {
    console.error(`FAILED at: ${name}`);
    process.exit(1);
  }
  return json;
}

const SAMPLE = {
  baseId: "appSmokeD1000000",
  name: "D1 Smoke Base",
  tables: [
    {
      tableId: "tblSmoke1",
      name: "Deals",
      primaryFieldId: "fldSmokeName",
      fields: [
        { fieldId: "fldSmokeName", name: "Name", type: "singleLineText" },
        { fieldId: "fldSmokeAmt", name: "Amount", type: "currency" },
      ],
      views: [{ viewId: "viwSmokeAll", name: "All", type: "grid" }],
    },
  ],
};

const prov = await step("provision d1", "POST", `/api/internal/spaces/${SPACE_ID}/provision-database`, {
  backend: "d1",
  recordsEnabled: false,
});
console.log("  locator:", prov.locator);

await step("schema-sync", "POST", `/api/internal/spaces/${SPACE_ID}/schema-sync`, {
  backupRunId: crypto.randomUUID(),
  captured: SAMPLE,
  confident: true,
});

const read = await step("schema-read", "GET", `/api/internal/spaces/${SPACE_ID}/schema`);
const gotTable = read.tables?.some((t) => t.tableId === "tblSmoke1");
if (!gotTable) {
  console.error("✗ schema-read did not return the synced table");
  process.exit(1);
}
console.log(`✓ round-trip verified: ${read.bases?.length} base(s), ${read.tables?.length} table(s), ${read.fields?.length} field(s)`);

if (KEEP) {
  console.log("— keeping the database (--keep); check the Cloudflare D1 dashboard, then DELETE the route to clean up.");
} else {
  await step("deprovision", "DELETE", `/api/internal/spaces/${SPACE_ID}/provision-database`);
  console.log("✓ smoke complete — database created, written, read, and removed.");
}
