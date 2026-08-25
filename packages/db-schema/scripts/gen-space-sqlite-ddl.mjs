// Regenerates src/space/sqlite-ddl.ts from the latest space-sqlite migration.
//
// The per-Space D1 provisioner runs inside the engine Cloudflare Worker
// (workerd, no filesystem), so it can't read the .sql migration at runtime —
// it needs the DDL bundled as a string. This script is the codegen step.
//
// Run after changing the per-Space SQLite schema:
//   pnpm --filter @baseout/db-schema db:generate:space-sqlite
//   node packages/db-schema/scripts/gen-space-sqlite-ddl.mjs
//
// tests/space-sqlite-ddl-parity.test.ts fails CI if sqlite-ddl.ts drifts.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIG_DIR = resolve(ROOT, "migrations/space-sqlite");
const OUT = resolve(ROOT, "src/space/sqlite-ddl.ts");

const sqlFile = readdirSync(MIG_DIR).find((f) => f.endsWith(".sql"));
if (!sqlFile) throw new Error(`no .sql migration in ${MIG_DIR}`);
const relSrc = `migrations/space-sqlite/${sqlFile}`;

const sql = readFileSync(resolve(MIG_DIR, sqlFile), "utf8").trimEnd();
const escaped = sql
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${");

const out = `/**
 * Per-Space DB DDL — SQLite / D1 dialect, as an executable string.
 *
 * The per-Space D1 provisioner runs inside the engine Cloudflare Worker
 * (workerd, no filesystem), so it cannot read the .sql migration at runtime —
 * it needs the DDL bundled. This module is the bundled copy.
 *
 * GENERATED FROM ${relSrc} by scripts/gen-space-sqlite-ddl.mjs — DO NOT HAND-EDIT.
 * tests/space-sqlite-ddl-parity.test.ts asserts this stays in lockstep with that
 * migration (drift fails CI). Regenerate after a per-Space schema change:
 *   node packages/db-schema/scripts/gen-space-sqlite-ddl.mjs
 *
 * No imports on purpose — the engine bundle gets the string with zero drizzle
 * weight. Statements are separated by drizzle's \`--> statement-breakpoint\`.
 */

export const SPACE_SQLITE_DDL = \`${escaped}\`;

/** Split SPACE_SQLITE_DDL into individual executable statements. */
export function spaceSqliteDdlStatements(): string[] {
  return SPACE_SQLITE_DDL.split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
`;

writeFileSync(OUT, out);
console.log(`wrote ${OUT} from ${relSrc} (${out.length} bytes)`);
