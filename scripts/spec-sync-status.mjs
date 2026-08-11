#!/usr/bin/env node
// scripts/spec-sync-status.mjs — report OpenSpec ↔ code drift.
//
// Usage:
//   pnpm spec:sync-status
//
// Two checks over openspec/changes/* (the active, non-archived changes):
//
//   1. archive-ready — every checkbox in tasks.md is [x] (and there is at least
//      one), so the change looks implemented but is not archived. → /opsx:archive
//   2. stale references — for archive-ready changes ONLY (where the files SHOULD
//      exist), any `apps/… packages/… scripts/… shared/…` file path cited in
//      proposal.md / design.md / tasks.md / specs/** that is missing on disk.
//      (In-progress changes are skipped: their paths may be not-yet-created.)
//
// Report-only. Exit 0 always (a reporter, like sync-drift) — wire the exit into
// CI later if you want it blocking.

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHANGES = join(ROOT, "openspec", "changes");

const isDir = (p) => { try { return statSync(p).isDirectory(); } catch { return false; } };
if (!isDir(CHANGES)) {
  console.log("No openspec/changes directory — nothing to check.");
  process.exit(0);
}

// Active changes = direct subdirs of openspec/changes, excluding `archive`.
const changes = readdirSync(CHANGES)
  .filter((n) => n !== "archive" && isDir(join(CHANGES, n)))
  .sort();

const read = (p) => { try { return readFileSync(p, "utf8"); } catch { return ""; } };

// A change is archive-ready when tasks.md has ≥1 checkbox and none are unchecked.
function taskState(dir) {
  const txt = read(join(dir, "tasks.md"));
  const boxes = [...txt.matchAll(/^\s*[-*]\s*\[( |x|X|~)\]/gm)].map((m) => m[1]);
  const total = boxes.length;
  const open = boxes.filter((b) => b === " ").length; // '~' (skipped) counts as resolved
  return { total, open, done: total - open };
}

// File-path tokens in spec prose. Skip globs / placeholders.
const PATH_RE = /\b(?:apps|packages|scripts|shared)\/[A-Za-z0-9_.@/-]+/g;
function citedPaths(dir) {
  const files = ["proposal.md", "design.md", "tasks.md"];
  const specsDir = join(dir, "specs");
  if (isDir(specsDir)) {
    const walk = (d) => readdirSync(d).forEach((n) => {
      const p = join(d, n);
      if (isDir(p)) walk(p);
      else if (n.endsWith(".md")) files.push(p.slice(dir.length + 1));
    });
    walk(specsDir);
  }
  const found = new Set();
  for (const rel of files) {
    const txt = read(join(dir, rel));
    for (const m of txt.matchAll(PATH_RE)) {
      let tok = m[0].replace(/[.,;:)"'`\]]+$/, ""); // strip trailing punctuation
      if (/[*<>]/.test(tok) || tok.includes("…") || tok.includes("...") || tok.endsWith("/")) continue; // globs / prose elisions
      // Only treat tokens that look like a concrete file (have an extension) as refs.
      if (!/\.[A-Za-z0-9]+$/.test(tok)) continue;
      found.add(tok);
    }
  }
  return [...found];
}

const archiveReady = [];
const staleByChange = new Map();

for (const name of changes) {
  const dir = join(CHANGES, name);
  const { total, open, done } = taskState(dir);
  if (total > 0 && open === 0) {
    archiveReady.push({ name, done, total });
    const missing = citedPaths(dir).filter((rel) => !existsSync(join(ROOT, rel)));
    if (missing.length) staleByChange.set(name, missing);
  }
}

console.log(`OpenSpec ↔ code — ${changes.length} active change(s) scanned.\n`);

console.log(`archive-ready  (${archiveReady.length})`);
if (archiveReady.length) console.log("  → all tasks complete but not archived; run /opsx:archive <name>.");
for (const c of archiveReady) console.log(`  ${c.name}  [${c.done}/${c.total} tasks]`);
console.log("");

let staleCount = 0;
console.log(`stale references  (${staleByChange.size} change(s))`);
if (staleByChange.size) console.log("  → completed change cites a file that no longer exists on disk:");
for (const [name, missing] of staleByChange) {
  console.log(`  ${name}`);
  for (const rel of missing) { console.log(`    ✗ ${rel}`); staleCount++; }
}
if (!staleByChange.size) console.log("  none.");
console.log("");

console.log(`Summary: ${archiveReady.length} archive-ready, ${staleCount} stale reference(s).`);
process.exit(0);
