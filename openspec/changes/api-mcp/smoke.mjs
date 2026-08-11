#!/usr/bin/env node
// Smoke for api-mcp against a LOCAL `wrangler dev` of apps/api.
//
//   pnpm --filter @baseout/api dev            # http://localhost:8787 (+ .dev.vars)
//   node openspec/changes/api-mcp/smoke.mjs [orgId] [spaceId]
//
// Seeds an org-wide api_token, then drives the MCP endpoint over raw JSON-RPC:
// initialize → tools/list → tools/call (get_backup_status, list_spaces) and a
// missing-token 401. Deletes the token. (A full client-SDK e2e is task 3.1.)

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const postgres = createRequire(path.join(repo, "apps/web/package.json"))("postgres");
const BASE = process.env.API_BASE ?? "http://localhost:8787";
const envLine = (f, n) => { const l = readFileSync(path.join(repo, f), "utf8").split("\n").find((x) => x.startsWith(`${n}=`)); if (!l) throw new Error(`${n} not in ${f}`); return l.slice(n.length + 1).trim().replace(/^["']|["']$/g, ""); };
const sql = postgres(envLine("apps/web/.env", "DATABASE_URL"), { prepare: false, connection: { search_path: "baseout,public" } });

let failures = 0;
const check = (l, ok, d = "") => { console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${l}${ok || !d ? "" : ` — ${d}`}`); if (!ok) failures++; };
const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
const NAME = "__mcp_smoke__";

let rpcId = 0;
async function rpc(method, params, token) {
  const res = await fetch(`${BASE}/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

try {
  await sql`delete from baseout.api_tokens where name = ${NAME}`.catch(() => {});
  let orgId = process.argv[2], spaceId = process.argv[3];
  if (!orgId) {
    const [r] = await sql`select o.id org, s.id space from baseout.organizations o join baseout.spaces s on s.organization_id=o.id order by s.created_at desc limit 1`;
    if (!r) throw new Error("no org/space — pass [orgId] [spaceId]");
    orgId = r.org; spaceId = r.space;
  }
  const entropy = new Uint8Array(32); webcrypto.getRandomValues(entropy);
  const token = `bo_live_${Buffer.from(entropy).toString("base64url")}`;
  const hash = hex(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  await sql`insert into baseout.api_tokens (organization_id, space_id, name, token_prefix, token_hash, scopes, is_active)
    values (${orgId}, ${spaceId}, ${NAME}, ${token.slice(0, 14)}, ${hash}, ${sql.array(["org:read", "backups:read", "schema:read"])}, ${true})`;
  console.log(`org ${orgId}, space ${spaceId} (Space-bound token), MCP ${BASE}/mcp\n`);

  check("no token → 401", (await rpc("initialize", {})).status === 401);

  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {} }, token);
  check("initialize → protocolVersion + serverInfo", !!init.body.result?.protocolVersion && init.body.result?.serverInfo?.name === "baseout");

  const list = await rpc("tools/list", {}, token);
  const names = (list.body.result?.tools ?? []).map((t) => t.name);
  check("tools/list returns the read tools", names.includes("get_backup_status") && names.includes("search_schema"));
  check("Space-bound token elides spaceId from search_schema args", (() => {
    const s = list.body.result.tools.find((t) => t.name === "search_schema");
    return s && !("spaceId" in (s.inputSchema.properties ?? {}));
  })());

  const statusCall = await rpc("tools/call", { name: "get_backup_status", arguments: {} }, token);
  const statusText = statusCall.body.result?.content?.[0]?.text ?? "";
  check("tools/call get_backup_status → JSON rollup", statusText.includes("consecutiveFailures"), statusText.slice(0, 120));

  const spacesCall = await rpc("tools/call", { name: "list_spaces", arguments: { limit: 3 } }, token);
  check("tools/call list_spaces → data envelope", (spacesCall.body.result?.content?.[0]?.text ?? "").includes('"data"'));

  console.log(`\n${failures === 0 ? "PASS — all checks green" : `FAIL — ${failures} check(s) failed`}`);
} finally {
  await sql`delete from baseout.api_tokens where name = ${NAME}`.catch(() => {});
  console.log("(smoke token cleaned up)");
  await sql.end({ timeout: 5 });
}
process.exit(failures === 0 ? 0 : 1);
