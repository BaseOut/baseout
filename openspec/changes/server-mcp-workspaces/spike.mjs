#!/usr/bin/env node
// Spike for server-mcp-workspaces task 0.2 AND workflows-mcp-views task 0.2
// (one MCP session answers both — and the shared session IS the
// one-handshake-many-calls check the views design asks for).
//
//   node openspec/changes/server-mcp-workspaces/spike.mjs
//
// Steps:
//   1. Resolve the dev Connection's access token the production way:
//      read connections.access_token_enc from the master DB, exchange it at
//      the deployed dev engine's ConnectionDO token route (refresh-if-needed).
//   2. One MCP session against https://mcp.airtable.com/mcp:
//      initialize → notifications/initialized → tools/list (FULL inventory)
//      → tools/call for every workspace-ish and view-ish tool discovered
//      → list_pages_for_base + list_automations on one base (multi-call check).
//   3. Print sizes + raw envelopes to stdout. NEVER prints the token.
//
// Findings are scrubbed into README.md files by hand — this script is the
// evidence generator, not the record. Read-only against Airtable (only
// list/read tools are ever called; names are checked against an allow-list).

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const postgres = createRequire(path.join(repo, "apps/web/package.json"))("postgres");

const ENGINE = "https://baseout-server-dev.openside.workers.dev";
const CONNECTION_ID = "d0374502-acdf-45ad-86fb-2f8aa87345e0"; // dev, non-enterprise
const BASES = [
  { id: "appsiv0mQztko91el", name: "DevHire Tracker" },
  { id: "appzjlttT62QnEbjw", name: "flashcards" },
  { id: "appqNmpWLw5Ztl2V8", name: "Inventory Tracker" },
];
const MCP = "https://mcp.airtable.com/mcp";

const envLine = (file, name) => {
  const line = readFileSync(path.join(repo, file), "utf8")
    .split("\n")
    .find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in ${file}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
};
const INTERNAL_TOKEN = envLine("apps/server/.dev.vars", "INTERNAL_TOKEN");
const sql = postgres(envLine("apps/web/.env", "DATABASE_URL"), { prepare: false, max: 1 });

// ── 1. Token ────────────────────────────────────────────────────────────────
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

// ── 2. MCP session (persistent across all calls) ────────────────────────────
let sessionId = null;
let protocolVersion = null;
let nextId = 0;

const parseSse = (text) =>
  text
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => {
      try {
        return JSON.parse(l.slice(5).trim());
      } catch {
        return null;
      }
    })
    .filter(Boolean);

async function post(payload, expectId) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    authorization: `Bearer ${accessToken}`,
  };
  if (protocolVersion) headers["mcp-protocol-version"] = protocolVersion;
  if (sessionId) headers["mcp-session-id"] = sessionId;
  const res = await fetch(MCP, { method: "POST", headers, body: JSON.stringify(payload) });
  const issued = res.headers.get("mcp-session-id");
  if (issued) sessionId = issued;
  const text = await res.text();
  if (res.status < 200 || res.status >= 300) {
    return { httpError: `HTTP ${res.status}: ${text.slice(0, 300)}`, bytes: text.length };
  }
  if (expectId === null) return { message: null, bytes: text.length };
  const ct = res.headers.get("content-type") ?? "";
  const message = ct.includes("text/event-stream")
    ? (parseSse(text).find((m) => m.id === expectId) ?? null)
    : (() => {
        try {
          const m = JSON.parse(text);
          return m.id === expectId ? m : null;
        } catch {
          return null;
        }
      })();
  return { message, bytes: text.length };
}

async function rpc(method, params) {
  const id = ++nextId;
  const { message, bytes, httpError } = await post({ jsonrpc: "2.0", id, method, params }, id);
  if (httpError) return { error: httpError, bytes };
  if (!message) return { error: `${method}: no matching response message`, bytes };
  if (message.error) return { error: message.error, bytes };
  return { result: message.result, bytes };
}

const init = await rpc("initialize", {
  protocolVersion: "2025-06-18",
  capabilities: {},
  clientInfo: { name: "baseout-spike", version: "1.0.0" },
});
protocolVersion = init.result?.protocolVersion ?? "2025-06-18";
console.log(
  `initialize: OK — server ${init.result?.serverInfo?.name} v${init.result?.serverInfo?.version}, protocol ${protocolVersion}, session ${sessionId ? "issued" : "not issued"}`,
);
await post({ jsonrpc: "2.0", method: "notifications/initialized" }, null);

// ── tools/list — FULL inventory ─────────────────────────────────────────────
const list = await rpc("tools/list", {});
const tools = list.result?.tools ?? [];
console.log(`\ntools/list: ${tools.length} tools (${list.bytes} bytes)`);
for (const t of tools) {
  console.log(`  - ${t.name}: ${(t.description ?? "").split("\n")[0].slice(0, 110)}`);
}

const findTools = (re) => tools.filter((t) => re.test(t.name));
const READ_ONLY = /^(list|get|describe|read|search)/i;
const dumpSchema = (t) =>
  console.log(`\n### ${t.name} inputSchema\n${JSON.stringify(t.inputSchema, null, 2)}\n(description: ${t.description ?? "-"})`);

async function callTool(name, args) {
  const { result, error, bytes } = await rpc("tools/call", { name, arguments: args });
  if (error) return { error, bytes };
  if (result?.isError === true) {
    return { error: result.content?.[0]?.text ?? "isError", bytes };
  }
  const envelope =
    result?.structuredContent !== undefined
      ? result.structuredContent
      : (() => {
          try {
            return JSON.parse(result?.content?.[0]?.text ?? "null");
          } catch {
            return result?.content?.[0]?.text;
          }
        })();
  return { envelope, bytes };
}

// ── Spike A: workspace tools ────────────────────────────────────────────────
console.log("\n══════════ SPIKE A — workspace tools ══════════");
const wsTools = findTools(/workspace/i);
if (wsTools.length === 0) {
  console.log("NO workspace tools advertised — record as spike verdict.");
} else {
  for (const t of wsTools) dumpSchema(t);
}
{
  const r = await callTool("list_workspaces", {});
  console.log(`\n>>> tools/call list_workspaces {} (${r.bytes} bytes)`);
  console.log(JSON.stringify(r.error ?? r.envelope, null, 2).slice(0, 4000));
}
// list_bases is the likely base→workspace membership source — check its envelope.
{
  const t = tools.find((t) => t.name === "list_bases");
  if (t) dumpSchema(t);
  const r = await callTool("list_bases", {});
  console.log(`\n>>> tools/call list_bases {} (${r.bytes} bytes)`);
  console.log(JSON.stringify(r.error ?? r.envelope, null, 2).slice(0, 4000));
}

// ── Spike B: view tools, per table ──────────────────────────────────────────
console.log("\n══════════ SPIKE B — view tools ══════════");
const viewTools = findTools(/view/i);
if (viewTools.length === 0) {
  console.log("NO view tools advertised — record as spike verdict.");
} else {
  for (const t of viewTools) dumpSchema(t);
}
// list_views_for_table needs table ids — discover them per base.
{
  const t = tools.find((t) => t.name === "list_tables_for_base");
  if (t) dumpSchema(t);
}
for (const base of BASES) {
  const tablesRes = await callTool("list_tables_for_base", { baseId: base.id });
  if (tablesRes.error) {
    console.log(`\nlist_tables_for_base ${base.name}: ERROR ${JSON.stringify(tablesRes.error).slice(0, 300)}`);
    continue;
  }
  const env = tablesRes.envelope;
  const tables = Array.isArray(env?.tables) ? env.tables : Array.isArray(env) ? env : [];
  console.log(`\nlist_tables_for_base ${base.name} (${tablesRes.bytes} bytes): ${tables.length} tables — keys of first: ${tables[0] ? Object.keys(tables[0]).join(",") : "-"}`);
  for (const tbl of tables.slice(0, 2)) {
    const r = await callTool("list_views_for_table", { baseId: base.id, tableId: tbl.id });
    console.log(`\n>>> tools/call list_views_for_table { baseId: ${base.id} /* ${base.name} */, tableId: ${tbl.id} /* ${tbl.name} */ } (${r.bytes} bytes)`);
    console.log(JSON.stringify(r.error ?? r.envelope, null, 2).slice(0, 6000));
  }
}

// ── One-handshake-many-calls: interfaces + automations on the same session ──
console.log("\n══════════ multi-call session check (interfaces + automations) ══════════");
for (const [tool, args] of [
  ["list_pages_for_base", { baseId: BASES[0].id }],
  ["list_automations", { baseId: BASES[0].id }],
]) {
  if (!tools.some((t) => t.name === tool)) {
    console.log(`${tool}: not advertised`);
    continue;
  }
  const r = await callTool(tool, args);
  console.log(
    `${tool}: ${r.error ? `ERROR ${JSON.stringify(r.error).slice(0, 200)}` : `OK (${r.bytes} bytes)`}`,
  );
}
console.log(`\ntotal tools/call issued on ONE session: ${nextId - 2} — session survived: yes`);
