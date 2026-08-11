#!/usr/bin/env node
// scripts/sync-drift.mjs — bidirectional drift between the ui-only fork and this repo.
//
// Usage:
//   pnpm ui:sync-drift [--no-fetch]
//
// ui-sync-status.mjs answers ONE direction — "what has the fork changed since our
// last sync?" (forward). This answers BOTH, per synced surface:
//
//   in-sync           neither side changed the file since the last sync
//   forward-pending   the fork changed it (a normal /ui-sync forward sync)
//   reverse-pending   WE changed it since the last sync (needs reverse-sync UP
//                     to ui-only, else the next forward sync clobbers our edit)
//   diverged          BOTH changed it (STOP — human reconcile, which side wins)
//
// This is the guard the write-back removal (design-descriptions-readonly) needs:
// EntityPanel.astro is edited locally after the last sync, so it shows up as
// `reverse-pending` and can't be silently re-imported by a forward sync.
//
// v1 is a FILE-LEVEL model computed from commit ranges + the working tree — it
// does not do a content-level 3-way (that, plus import-rewrite-aware
// normalization, is the documented follow-up in system-sync-skills/tasks.md).
// Mapping rules mirror shared/internal/ui-sync.md §2 — keep in lockstep with
// scripts/ui-sync-status.mjs.
//
// Exit codes:
//   0 — report printed (any mix of verdicts)
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

// --- last DESIGN-SYNC commit -------------------------------------------------
// The reverse baseline must be the last actual `apps/design` sync, NOT a later
// web-side PROMOTION that also cites the same hash (a promotion doesn't change
// the design harness, so it's the wrong baseline for "what have WE changed in
// the harness since the fork"). Sync commits are `chore(design): sync ui-only@`;
// prefer those, and fall back to any ui-only@ subject citation only if none
// exist (fresh repo before the first sync).
const HASH_RE = /ui-only@([0-9a-f]{7,40})/;
const SYNC_SUBJECT_RE = /^chore\(design\):\s*sync\b/;
const markers = git("log", "--grep=ui-only@", "-n", "20", "--format=%H%x00%s%x00%b%x1e")
  .split("\x1e")
  .map((e) => e.trim())
  .filter(Boolean)
  .map((e) => {
    const [commit, subject, body] = e.split("\0");
    return { commit, subject, body: body ?? "" };
  })
  .filter((m) => HASH_RE.test(m.subject) || HASH_RE.test(m.body));
if (markers.length === 0) {
  console.error('No commit citing "ui-only@<hash>" found on HEAD — cannot determine the last sync point.');
  console.error("See shared/internal/ui-sync.md §1 for the convention.");
  process.exit(1);
}
const marker =
  markers.find((m) => SYNC_SUBJECT_RE.test(m.subject) && HASH_RE.test(m.subject)) ??
  markers.find((m) => HASH_RE.test(m.subject)) ??
  markers[0];
const lastSynced = (marker.subject.match(HASH_RE) ?? marker.body.match(HASH_RE))[1];
const syncCommit = marker.commit;

// --- fetch -------------------------------------------------------------------
if (!process.argv.includes("--no-fetch")) git("fetch", "ui-only");
const upstream = git("rev-parse", "--short", "ui-only/main");

// --- mapping (mirrors ui-sync.md §2 / ui-sync-status.mjs) ---------------------
const NEVER_SYNC = [
  /^\.claude\//,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^\.github\//,
  /\/shots\/.*\.(png|jpe?g|gif)$/,
];
const isNeverSync = (p) => NEVER_SYNC.some((re) => re.test(p));

// Optional `--path <prefix>` scopes the whole report to one surface, e.g.
//   pnpm ui:sync-drift --path apps/design/src/components/schema
const pathIdx = process.argv.indexOf("--path");
const pathScope = pathIdx !== -1 ? process.argv[pathIdx + 1] : null;
const inScope = (p) => !pathScope || p.startsWith(pathScope);

// FORWARD compares the fork's changes (which may live under apps/web/src and
// localize into apps/design). REVERSE is "the verbatim mirror has diverged from
// the fork" — so it is apps/design/** ONLY: local apps/web changes are the
// forward pipeline's normal promotions (tracked by the §4 matrix), not
// reverse-sync candidates.
const isForwardSurface = (p) =>
  !isNeverSync(p) && (p.startsWith("apps/design/") || p.startsWith("apps/web/src/"));
const isReverseSurface = (p) => !isNeverSync(p) && p.startsWith("apps/design/");

// Fork path -> our local target (same rule ui-sync-status.mjs uses at sync).
function targetOf(path) {
  if (path.startsWith("apps/web/src/components/") || path.startsWith("apps/web/src/views/") || path.startsWith("apps/web/src/stores/"))
    return join("apps/design/src", path.slice("apps/web/src/".length));
  if (path.startsWith("apps/design/")) return path;
  if (path.startsWith("apps/web/src/")) return join("apps/design/src", path.slice("apps/web/src/".length));
  return path;
}

// --- forward set: files the fork changed since our last sync -----------------
const forwardLocal = new Set(
  git("diff", "--name-only", `${lastSynced}..ui-only/main`)
    .split("\n")
    .filter(Boolean)
    .filter(isForwardSurface)
    .map(targetOf)
    .filter(inScope),
);

// --- reverse set: files WE changed since the sync commit (incl. working tree) -
// `git diff <syncCommit>` (no ..HEAD) compares the WORKING TREE to the sync
// commit, so uncommitted edits (e.g. an in-progress write-back removal) count.
const reverseLocal = new Set(
  git("diff", "--name-only", syncCommit)
    .split("\n")
    .filter(Boolean)
    .filter(isReverseSurface)
    .filter(inScope),
);

// --- classify ----------------------------------------------------------------
const diverged = [];
const reversePending = [];
const forwardPending = [];
for (const f of reverseLocal) (forwardLocal.has(f) ? diverged : reversePending).push(f);
for (const f of forwardLocal) if (!reverseLocal.has(f)) forwardPending.push(f);

// --- report ------------------------------------------------------------------
console.log(`Last synced: ui-only@${lastSynced}  (baseout ${syncCommit.slice(0, 9)}: ${marker.subject})`);
console.log(`Upstream:    ui-only/main @ ${upstream}`);
console.log("");

const section = (title, list, hint) => {
  console.log(`${title}  (${list.length})`);
  if (hint && list.length) console.log(`  ${hint}`);
  for (const f of [...list].sort()) console.log(`  ${f}`);
  console.log("");
};

if (!diverged.length && !reversePending.length && !forwardPending.length) {
  console.log("in-sync — no drift on any synced surface.");
  process.exit(0);
}
if (diverged.length)
  section("⚠ diverged (STOP — both sides changed; reconcile which wins per file)", diverged);
if (reversePending.length)
  section(
    "reverse-pending (WE are ahead — reverse-sync UP to ui-only before the next forward sync)",
    reversePending,
    "→ use the /sync-reconcile skill to emit a ui-only patch (human applies + pushes).",
  );
if (forwardPending.length)
  section(
    "forward-pending (fork is ahead — a normal /ui-sync forward sync)",
    forwardPending,
    "→ run pnpm ui:sync-status for the full forward delta.",
  );

if (diverged.length)
  console.log(`⚠ ${diverged.length} file(s) diverged — do NOT sync either direction until reconciled.`);
process.exit(0);
