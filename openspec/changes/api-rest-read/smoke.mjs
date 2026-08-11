#!/usr/bin/env node
// Smoke for api-rest-read against a LOCAL `wrangler dev` of apps/api.
//
//   # terminal 1: the engine (for schema endpoints)
//   pnpm --filter @baseout/server deploy:dev   # or run it locally
//   # terminal 2: the API worker (needs .dev.vars: DATABASE_URL + INTERNAL_TOKEN)
//   pnpm --filter @baseout/api dev             # http://localhost:8787
//   # terminal 3:
//   node openspec/changes/api-rest-read/smoke.mjs [orgId] [spaceId]
//
// Seeds an org-wide api_token (all read scopes), exercises the master-DB
// endpoints + the auth matrix (401 no token, 404 wrong org), then deletes the
// token. Schema endpoints additionally require the SERVER binding → a running
// baseout-server; they're checked best-effort (skipped if 502). Reads
// DATABASE_URL from apps/web/.env.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { webcrypto } from "node:crypto";
import path from "node:path";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const requireWeb = createRequire(path.join(repo, "apps/web/package.json"));
const postgres = requireWeb("postgres");

const BASE = process.env.API_BASE ?? "http://localhost:8787";
const envLine = (file, name) => {
  const line = readFileSync(path.join(repo, file), "utf8").split("\n").find((l) => l.startsWith(`${name}=`));
  if (!line) throw new Error(`${name} not found in ${file}`);
  return line.slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
};
const sql = postgres(envLine("apps/web/.env", "DATABASE_URL"), { prepare: false, connection: { search_path: "baseout,public" } });

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  ✓" : "  ✗ FAIL"} ${label}${ok || !detail ? "" : ` — ${detail}`}`);
  if (!ok) failures++;
};

const hex = (buf) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
async function mintToken() {
  const entropy = new Uint8Array(32);
  webcrypto.getRandomValues(entropy);
  const b64 = Buffer.from(entropy).toString("base64url");
  const token = `bo_live_${b64}`;
  const hash = hex(await webcrypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
  return { token, hash, prefix: token.slice(0, 14) };
}

const TOKEN_NAME = "__api_smoke__";
async function cleanup() {
  await sql`delete from baseout.api_tokens where name = ${TOKEN_NAME}`.catch(() => {});
}

try {
  await cleanup();

  let orgId = process.argv[2];
  let spaceId = process.argv[3];
  if (!orgId) {
    const [row] = await sql`select o.id as org, s.id as space from baseout.organizations o
      join baseout.spaces s on s.organization_id = o.id order by s.created_at desc limit 1`;
    if (!row) throw new Error("no org/space found — pass [orgId] [spaceId]");
    orgId = row.org; spaceId = row.space;
  }
  console.log(`org ${orgId}, space ${spaceId}, API ${BASE}\n`);

  const { token, hash, prefix } = await mintToken();
  await sql`insert into baseout.api_tokens (organization_id, space_id, name, token_prefix, token_hash, scopes, is_active)
    values (${orgId}, ${null}, ${TOKEN_NAME}, ${prefix}, ${hash}, ${sql.array(["org:read", "backups:read", "schema:read"])}, ${true})`;

  const auth = { Authorization: `Bearer ${token}` };
  const get = (p, headers = auth) => fetch(`${BASE}${p}`, { headers });

  console.log("Step 1 — auth gate");
  check("no token → 401", (await get("/v1/orgs/" + orgId, {})).status === 401);
  check("bad version → 404 version_not_found", (await (await get("/v2/orgs/" + orgId)).json()).error?.code === "version_not_found");
  check("wrong org → 404 org_not_found", (await (await get("/v1/orgs/org_does_not_exist")).json()).error?.code === "org_not_found");

  console.log("\nStep 2 — org + spaces");
  const org = await (await get(`/v1/orgs/${orgId}`)).json();
  check("org profile", org.id === orgId && "plan" in org);
  const spaces = await (await get(`/v1/orgs/${orgId}/spaces`)).json();
  check("spaces list envelope { data, pagination }", Array.isArray(spaces.data) && "pagination" in spaces);
  check("X-Request-Id header present", !!(await get(`/v1/orgs/${orgId}/spaces`)).headers.get("x-request-id"));

  console.log("\nStep 3 — backups");
  const runs = await get(`/v1/orgs/${orgId}/spaces/${spaceId}/backups/runs?limit=5`);
  check("runs 200 + rate headers", runs.status === 200 && runs.headers.get("x-ratelimit-limit") === "100");
  const status = await (await get(`/v1/orgs/${orgId}/spaces/${spaceId}/backups/status`)).json();
  check("status rollup shape", "consecutiveFailures" in status && "successRate30d" in status);

  console.log("\nStep 4 — schema (best-effort; needs baseout-server binding)");
  const bases = await get(`/v1/orgs/${orgId}/spaces/${spaceId}/at/schema/bases`);
  if (bases.status === 502) {
    console.log("  … skipped (SERVER binding unavailable → 502 upstream_unavailable)");
  } else {
    check("schema/bases 200 + ETag", bases.status === 200 && !!bases.headers.get("etag"));
    check("bad platform → 404 platform_not_found", (await (await get(`/v1/orgs/${orgId}/spaces/${spaceId}/zz/schema/bases`)).json()).error?.code === "platform_not_found");
  }

  console.log(`\n${failures === 0 ? "PASS — all checks green" : `FAIL — ${failures} check(s) failed`}`);
} finally {
  await cleanup();
  console.log("(smoke token cleaned up)");
  await sql.end({ timeout: 5 });
}
process.exit(failures === 0 ? 0 : 1);
