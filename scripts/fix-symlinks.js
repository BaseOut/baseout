#!/usr/bin/env node
// scripts/fix-symlinks.js — verify and (re)create the OpenSpec symlinks.
//
// Each app/package has a symlink at <app>/openspec → ../../openspec/changes/<name>.
// Git stores these natively on Mac/Linux. On Windows (or after a clone with
// core.symlinks=false) they may come down as plain text files — this script
// detects that and recreates them as real symlinks.
//
// Cross-platform Node implementation; safe to run repeatedly.
// Wired to run via `postinstall` so `pnpm install` repairs broken symlinks.
//
// On Windows, symlink creation requires either Developer Mode enabled OR
// running with admin privileges. If neither is set, the script reports the
// fix and exits non-zero with guidance.

import { existsSync, lstatSync, readFileSync, readlinkSync, rmSync, symlinkSync, mkdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = dirname(__dirname);

// apps/server can be worked by multiple agents in parallel — each agent's
// in-flight server change folder is picked via apps/server/.openspec-target
// (single-line file, gitignored). Default when the marker is absent:
const SERVER_OPENSPEC_DEFAULT_TARGET = "airtable-client";

function resolveServerOpenspecTarget() {
  const markerPath = join(ROOT, "apps/server/.openspec-target");
  if (existsSync(markerPath)) {
    const raw = readFileSync(markerPath, "utf8").trim();
    if (raw) return raw;
  }
  return SERVER_OPENSPEC_DEFAULT_TARGET;
}

const LINKS = [
  ["apps/web/openspec",                "../../openspec/changes/baseout-web"],
  ["apps/server/openspec",             `../../openspec/changes/${resolveServerOpenspecTarget()}`],
  ["apps/admin/openspec",              "../../openspec/changes/baseout-admin"],
  ["apps/api/openspec",                "../../openspec/changes/baseout-api"],
  ["apps/sql/openspec",                "../../openspec/changes/baseout-sql"],
  ["apps/hooks/openspec",              "../../openspec/changes/baseout-hooks"],
  ["packages/db-schema/openspec",      "../../openspec/changes/baseout-db-schema"],
];

let ok = 0, fixed = 0, failed = 0;

for (const [src, target] of LINKS) {
  const srcAbs = join(ROOT, src);
  const srcParent = dirname(srcAbs);
  const targetAbs = join(srcParent, target);

  if (!existsSync(targetAbs)) {
    console.error(`  ✗ ${src} — target does not exist: ${target}`);
    failed++;
    continue;
  }

  let action = "create"; // "create" | "skip" | "replace"
  // Use lstatSync (not existsSync) so dangling symlinks — e.g. left over after
  // an in-flight change folder is moved to archive — are still detected.
  let srcStat = null;
  try { srcStat = lstatSync(srcAbs); } catch { srcStat = null; }
  if (srcStat) {
    const stat = srcStat;
    if (stat.isSymbolicLink()) {
      const current = readlinkSync(srcAbs);
      if (current === target) {
        console.log(`  ✓ ${src} (already correct)`);
        ok++;
        continue;
      }
      console.log(`  ! ${src} — symlink points to '${current}', recreating`);
      action = "replace";
    } else if (stat.isFile()) {
      // Most common cause: Windows clone without core.symlinks=true wrote a text file.
      const content = readFileSync(srcAbs, "utf8").trim().replace(/\r/g, "");
      if (content === target) {
        console.log(`  ! ${src} — text file (likely Windows without symlinks), recreating`);
        action = "replace";
      } else {
        console.error(`  ✗ ${src} — non-symlink file with unexpected content; refusing to overwrite`);
        failed++;
        continue;
      }
    } else {
      console.error(`  ✗ ${src} — non-symlink ${stat.isDirectory() ? "directory" : "entry"} exists; refusing to overwrite`);
      failed++;
      continue;
    }
  }

  if (action === "replace") {
    try { rmSync(srcAbs, { force: true, recursive: false }); }
    catch (err) {
      console.error(`  ✗ ${src} — failed to remove existing entry: ${err.message}`);
      failed++;
      continue;
    }
  }

  mkdirSync(srcParent, { recursive: true });

  try {
    // Use 'junction' on Windows for directory symlinks — works without
    // Developer Mode / admin. Mac/Linux ignore the type hint.
    const type = process.platform === "win32" ? "junction" : "dir";
    symlinkSync(target, srcAbs, type);
    console.log(`  ✓ ${src} (${action === "replace" ? "recreated" : "created"})`);
    fixed++;
  } catch (err) {
    console.error(`  ✗ ${src} — failed to create symlink: ${err.message}`);
    if (process.platform === "win32") {
      console.error(`    Windows: enable Developer Mode (Settings → For developers) AND set 'git config --global core.symlinks true'`);
    }
    failed++;
  }
}

console.log("");
console.log(`Done: ${ok} already correct, ${fixed} fixed, ${failed} failed.`);
process.exit(failed > 0 ? 1 : 0);
