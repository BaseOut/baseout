#!/usr/bin/env node
// scripts/openspec-changes.js — list openspec changes for a given app.
//
// Usage:
//   pnpm openspec:changes <app>
//
// Example:
//   pnpm openspec:changes web       → lists web + web-*
//   pnpm openspec:changes server    → lists server + server-*
//   pnpm openspec:changes workflows → lists workflows + workflows-*
//
// The prefix convention is `<app>` for the parent change and
// `<app>-<topic>` for each in-flight follow-up. This script walks
// `openspec/changes/` (skipping the `archive/` subdirectory) and prints the
// matching set, sorted with the parent first, then siblings alphabetically.
//
// Exit codes:
//   0 — found one or more matches (or app is a known empty app)
//   1 — no matches and the app name is not recognized
//   2 — bad invocation (missing arg, etc.)

import { readdirSync, statSync, existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = dirname(__dirname);
const CHANGES_DIR = join(ROOT, "openspec", "changes");

const app = process.argv[2];
if (!app) {
  console.error("Usage: pnpm openspec:changes <app>");
  console.error("Example: pnpm openspec:changes web");
  process.exit(2);
}

if (!existsSync(CHANGES_DIR)) {
  console.error(`openspec/changes/ not found at ${CHANGES_DIR}`);
  process.exit(2);
}

const prefix = app;
const entries = readdirSync(CHANGES_DIR)
  .filter((name) => {
    if (name === "archive") return false;
    if (name !== prefix && !name.startsWith(`${prefix}-`)) return false;
    return statSync(join(CHANGES_DIR, name)).isDirectory();
  })
  .sort((a, b) => {
    if (a === prefix) return -1;
    if (b === prefix) return 1;
    return a.localeCompare(b);
  });

if (entries.length === 0) {
  console.error(`No openspec changes found with prefix "${prefix}".`);
  console.error("");
  console.error("Known app prefixes (from existing changes):");
  const seen = new Set();
  for (const name of readdirSync(CHANGES_DIR)) {
    if (name === "archive") continue;
    const m = name.match(/^([a-z][a-z0-9-]*?)(?:-|$)/);
    if (m) seen.add(m[1]);
  }
  for (const a of [...seen].sort()) console.error(`  ${a}`);
  process.exit(1);
}

function progress(taskPath) {
  if (!existsSync(taskPath)) return null;
  const text = readFileSync(taskPath, "utf8");
  const total = (text.match(/^- \[[ x]\]/gm) || []).length;
  const done = (text.match(/^- \[x\]/gm) || []).length;
  if (total === 0) return null;
  return { done, total };
}

const heading =
  app === "shared"
    ? "OpenSpec changes that touch multiple apps (shared-*):"
    : app === "system"
      ? "OpenSpec changes for repo structure / tooling (system-*):"
      : `OpenSpec changes for apps/${app}:`;
console.log(heading);
console.log("");
for (const name of entries) {
  const tasksPath = join(CHANGES_DIR, name, "tasks.md");
  const p = progress(tasksPath);
  const role = name === prefix ? "  (parent)" : "";
  const tasks = p ? `  [${p.done}/${p.total} tasks]` : "  [no tasks.md]";
  console.log(`  ${name}${tasks}${role}`);
}
console.log("");
console.log(
  `Total: ${entries.length} change${entries.length === 1 ? "" : "s"}.`,
);
