#!/usr/bin/env node
// scripts/storybook-reconcile.mjs — de-risk the standing storybook.ts 3-way merge.
//
// Usage:
//   pnpm storybook:reconcile [--no-fetch]
//
// apps/design/src/lib/storybook.ts is the ONE catalog file BOTH repos edit, so
// every sync is a hand-done 3-way reconcile (ui-sync.md §2 standing exception,
// §5 trap). This shows the two edit sets side by side so the reconcile is a
// review, not archaeology:
//   • fork side  — what ui-only changed since our last sync (lastSynced..main)
//   • local side — what WE changed since the sync commit (syncCommit..worktree)
//
// It prints diffstats + the unified diffs; it does NOT write or merge anything.
//
// Exit codes: 0 report printed · 1 no sync marker · 2 git failure.

import { execFileSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const LOCAL = "apps/design/src/lib/storybook.ts";

function git(...args) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
  } catch (err) {
    // A diff of a path the ref doesn't have exits non-zero with empty output —
    // treat "no such path" as empty, but hard-fail on real git errors.
    const msg = String(err.stderr || err.message);
    if (/exists on disk, but not in|unknown revision|does not exist|fatal: path/.test(msg)) return "";
    console.error(`git ${args.join(" ")} failed:\n${msg.trim()}`);
    process.exit(2);
  }
}

// Last DESIGN-SYNC commit (same rule as sync-drift.mjs).
const HASH_RE = /ui-only@([0-9a-f]{7,40})/;
const SYNC_RE = /^chore\(design\):\s*sync\b/;
const markers = git("log", "--grep=ui-only@", "-n", "20", "--format=%H%x00%s%x00%b%x1e")
  .split("\x1e").map((e) => e.trim()).filter(Boolean)
  .map((e) => { const [commit, subject, body] = e.split("\0"); return { commit, subject, body: body ?? "" }; })
  .filter((m) => HASH_RE.test(m.subject) || HASH_RE.test(m.body));
if (!markers.length) {
  console.error('No `ui-only@<hash>` sync marker in history — cannot reconcile.');
  process.exit(1);
}
const marker =
  markers.find((m) => SYNC_RE.test(m.subject) && HASH_RE.test(m.subject)) ??
  markers.find((m) => HASH_RE.test(m.subject)) ?? markers[0];
const lastSynced = (marker.subject.match(HASH_RE) ?? marker.body.match(HASH_RE))[1];
const syncCommit = marker.commit;

if (!process.argv.includes("--no-fetch")) git("fetch", "ui-only");

// Resolve the fork's path for storybook.ts (full monorepo fork — try design, then web).
const forkCandidates = [
  "apps/design/src/lib/storybook.ts",
  "apps/web/src/lib/storybook.ts",
];
let forkPath = null;
for (const c of forkCandidates) {
  if (git("cat-file", "-e", `ui-only/main:${c}`) !== null && git("ls-tree", "ui-only/main", "--", c).trim()) {
    forkPath = c;
    break;
  }
}
forkPath = forkPath ?? forkCandidates[0];

console.log(`storybook.ts 3-way reconcile`);
console.log(`  local:        ${LOCAL}`);
console.log(`  fork path:    ${forkPath}`);
console.log(`  last synced:  ui-only@${lastSynced}  (baseout ${syncCommit.slice(0, 9)})`);
console.log("");

const forkDiff = git("diff", `${lastSynced}..ui-only/main`, "--", forkPath);
const localDiff = git("diff", syncCommit, "--", LOCAL);

console.log("── FORK side — ui-only changes since our last sync ──────────────");
console.log(git("diff", "--stat", `${lastSynced}..ui-only/main`, "--", forkPath).trim() || "  (no fork changes)");
console.log("");
console.log("── LOCAL side — our changes since the sync commit ───────────────");
console.log(git("diff", "--stat", syncCommit, "--", LOCAL).trim() || "  (no local changes)");
console.log("");

if (!forkDiff.trim() && !localDiff.trim()) {
  console.log("storybook.ts is in sync — nothing to reconcile.");
  process.exit(0);
}
console.log("Reconcile by hand: keep BOTH sides' entries (upstream skeleton + local-only");
console.log("entries), never overwrite blindly (ui-sync.md §2 standing exception). Full diffs:");
console.log("");
if (forkDiff.trim()) { console.log("═══ FORK DIFF ═══"); console.log(forkDiff); }
if (localDiff.trim()) { console.log("═══ LOCAL DIFF ═══"); console.log(localDiff); }
process.exit(0);
