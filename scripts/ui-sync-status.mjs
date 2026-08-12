#!/usr/bin/env node
// scripts/ui-sync-status.mjs — report pending ui-only → baseout sync state.
//
// Usage:
//   pnpm ui:sync-status [--no-fetch]
//
// Finds the last synced ui-only hash (parsed from the most recent commit on
// HEAD whose subject cites `ui-only@<hash>`), fetches the ui-only remote,
// and prints the pending delta bucketed by surface, flagging any pending
// upstream file whose local sync target is dirty in the working tree.
//
// The mapping rules mirror shared/internal/ui-sync.md §2 — keep in lockstep.
//
// Exit codes:
//   0 — in sync, or pending delta reported
//   1 — no `ui-only@<hash>` marker found in history
//   2 — git failure (missing remote, bad ref, etc.)

import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
  } catch (err) {
    console.error(`git ${args.join(" ")} failed:`);
    console.error(String(err.stderr || err.message).trim());
    process.exit(2);
  }
}

// --- ledger-update gate (--check) -------------------------------------------
// A `chore(design): sync ui-only@…` commit MUST also touch the ledger
// (shared/internal/ui-sync.md §3 sync ledger + §4 promotion matrix) so the
// sync point never drifts from history. `pnpm ui:sync-check` fails CI / a
// pre-commit hook when the tip sync commit forgot. No-op on non-sync tips.
if (process.argv.includes("--check")) {
  const subject = git("log", "-1", "--format=%s");
  if (!/^chore\(design\):\s*sync\b.*ui-only@/.test(subject)) {
    console.log("ui:sync-check — tip is not a `chore(design): sync ui-only@…` commit; nothing to check.");
    process.exit(0);
  }
  const touched = git("show", "--name-only", "--format=", "HEAD").split("\n").filter(Boolean);
  if (touched.includes("shared/internal/ui-sync.md")) {
    console.log("ui:sync-check — sync commit updates the ledger (shared/internal/ui-sync.md). OK.");
    process.exit(0);
  }
  console.error("ui:sync-check FAILED — the tip `chore(design): sync` commit did not update");
  console.error("shared/internal/ui-sync.md. Update the §3 sync ledger + §4 promotion matrix in the");
  console.error("SAME commit (CLAUDE.md §3.7 / ui-sync.md §6).");
  process.exit(1);
}

// --- last synced hash -------------------------------------------------------
// `--grep` matches the WHOLE message, so promotion commits that cite the hash
// in their body match too. Walk recent matches: a subject citation wins
// (sync commits put it there); otherwise fall back to the newest body match.
const markers = git(
  "log",
  "--grep=ui-only@",
  "-n",
  "10",
  "--format=%H%x00%s%x00%b%x1e",
)
  .split("\x1e")
  .map((e) => e.trim())
  .filter(Boolean)
  .map((e) => {
    const [commit, subject, body] = e.split("\0");
    return { commit, subject, body: body ?? "" };
  });
if (markers.length === 0) {
  console.error(
    'No commit citing "ui-only@<hash>" found on HEAD — cannot determine the last sync point.',
  );
  console.error("See shared/internal/ui-sync.md §1 for the convention.");
  process.exit(1);
}
const HASH_RE = /ui-only@([0-9a-f]{7,40})/;
const bySubject = markers.find((m) => HASH_RE.test(m.subject));
const byBody = markers.find((m) => HASH_RE.test(m.body));
const marker = bySubject ?? byBody;
if (!marker) {
  console.error(
    `Found ${markers.length} commit(s) mentioning ui-only@ but none carries a parseable hash.`,
  );
  process.exit(1);
}
const markerSubject = marker.subject;
const lastSynced = (marker.subject.match(HASH_RE) ?? marker.body.match(HASH_RE))[1];

// --- fetch -------------------------------------------------------------------
if (!process.argv.includes("--no-fetch")) {
  git("fetch", "ui-only");
}
const upstream = git("rev-parse", "--short", "ui-only/main");

// --- pending delta -----------------------------------------------------------
const count = Number(git("rev-list", "--count", `${lastSynced}..ui-only/main`));
console.log(`Last synced: ui-only@${lastSynced} (${markerSubject})`);
console.log(`Upstream:    ui-only/main @ ${upstream}`);
console.log("");
if (count === 0) {
  console.log("In sync — no pending ui-only commits.");
  process.exit(0);
}
console.log(`Pending: ${count} commit${count === 1 ? "" : "s"}.`);
console.log("");

const files = git("diff", "--name-only", `${lastSynced}..ui-only/main`)
  .split("\n")
  .filter(Boolean);

// --- bucketing (mirrors ui-sync.md §2) ---------------------------------------
const NEVER_SYNC = [
  /^\.claude\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^\.github\//,
  /\/shots\/.*\.(png|jpe?g|gif)$/,
];

function bucketOf(path) {
  if (NEVER_SYNC.some((re) => re.test(path))) return "never-sync";
  if (path.startsWith("apps/web/src/")) return "web layer (localize → apps/design; promote → apps/web)";
  if (path.startsWith("apps/design/")) return "design harness (verbatim)";
  if (path.startsWith("overview/") || path.startsWith("research/"))
    return "docs (→ apps/design)";
  if (path.startsWith("openspec/changes/")) return "openspec import (rename per §3.6)";
  return "unmapped — review before syncing";
}

// Local target per ui-sync.md §2 (sync stage targets only).
function targetOf(path) {
  if (path.startsWith("apps/web/src/"))
    return join("apps/design/src", path.slice("apps/web/src/".length));
  if (path.startsWith("overview/") || path.startsWith("research/"))
    return join("apps/design", path);
  if (path.startsWith("openspec/changes/"))
    return path.replace(/^openspec\/changes\//, "openspec/changes/web-");
  return path;
}

const dirty = new Set(
  git("status", "--porcelain")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).trim()),
);

const buckets = new Map();
for (const f of files) {
  const b = bucketOf(f);
  if (!buckets.has(b)) buckets.set(b, []);
  buckets.get(b).push(f);
}

const warnings = [];
for (const [bucket, list] of buckets) {
  console.log(`${bucket}  (${list.length})`);
  for (const f of list) {
    const target = targetOf(f);
    const flag =
      bucket !== "never-sync" && dirty.has(target) ? "  ⚠ DIRTY TARGET" : "";
    if (flag) warnings.push(target);
    console.log(`  ${f}${flag}`);
  }
  console.log("");
}

if (warnings.length) {
  console.log(
    `⚠ ${warnings.length} pending file(s) map onto locally-dirty targets — commit or set aside that work before syncing:`,
  );
  for (const t of [...new Set(warnings)]) console.log(`  ${t}`);
}
