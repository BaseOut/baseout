#!/usr/bin/env node
// Spike for server-base-collaborators task 1.1 (base-metadata payload shape).
// Confirms the LIVE shape of GET /v0/meta/bases/{baseId} with all four
// collaborator includes — individualCollaborators/groupCollaborators (base +
// workspace), inviteLinks, per-interface collaborator/invite blocks, packages,
// plus workspaceId / createdTime / the token's own permissionLevel.
//
//   node openspec/changes/server-base-collaborators/spike.mjs
//
// PREREQ (human, for full coverage): pick a base that has ≥1 group collaborator,
// ≥1 outstanding invite link, and ≥1 interface with its own collaborators.
// It:
//   1. Resolves the dev Connection access token the production way (master DB →
//      deployed dev engine ConnectionDO /token route, refresh-if-needed).
//   2. GET /v0/meta/bases/{baseId}?include=collaborators&inviteLinks&interfaces&packages
//   3. Prints the top-level keys + a redacted structural dump (emails →
//      first char only; invite/attachment URLs truncated). NEVER prints the token.
//
// The ingest module (collaborators-sync.ts) parses exactly these blocks; use
// this to confirm the fixture in ./fixtures/base-metadata.json matches reality.

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const postgres = createRequire(path.join(repo, "apps/web/package.json"))("postgres");

const ENGINE = "https://baseout-server-dev.openside.workers.dev";
const CONNECTION_ID = "d0374502-acdf-45ad-86fb-2f8aa87345e0"; // dev, non-enterprise
const BASE_ID = process.env.SPIKE_BASE_ID ?? "appsiv0mQztko91el";
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

const includes = ["collaborators", "inviteLinks", "interfaces", "packages"].map((i) => `include=${i}`).join("&");
const res = await fetch(`${AT}/v0/meta/bases/${BASE_ID}?${includes}`, {
  headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
});
console.log(`\nbase-metadata HTTP ${res.status}`);
if (res.status !== 200) {
  console.error(await res.text());
  process.exit(1);
}
const body = await res.json();

// Redact PII/URLs for safe stdout.
const redact = (obj) =>
  JSON.parse(
    JSON.stringify(obj, (k, v) => {
      if (typeof v !== "string") return v;
      if (k === "email" || k === "invitedEmail") return v.replace(/(.).*(@.*)/, "$1***$2");
      if (k === "url") return v.slice(0, 40) + "…(redacted)";
      return v;
    }),
  );

console.log("\ntop-level keys:", Object.keys(body).join(", "));
console.log("workspaceId:", body.workspaceId);
console.log("createdTime:", body.createdTime);
console.log("own permissionLevel:", body.permissionLevel);
console.log("\nindividualCollaborators keys:", Object.keys(body.individualCollaborators ?? {}));
console.log("groupCollaborators keys:", Object.keys(body.groupCollaborators ?? {}));
console.log("inviteLinks keys:", Object.keys(body.inviteLinks ?? {}));
console.log("interfaces (pageBundleIds):", Object.keys(body.interfaces ?? {}));
console.log("has deprecated top-level collaborators block:", !!body.collaborators);
console.log("packages:", JSON.stringify(redact(body.packages ?? null)));
console.log("\nfull redacted payload:\n", JSON.stringify(redact(body), null, 2));
