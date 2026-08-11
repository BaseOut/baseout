// Regenerates src/space/pg-ddl.ts from the latest space-pg migration.
//
// The per-Space DB provisioner runs inside the engine Cloudflare Worker
// (workerd, no filesystem), so it can't read the .sql migration at runtime —
// it needs the DDL bundled as a string. This script is the codegen step.
//
// Run after changing the per-Space Postgres schema:
//   pnpm --filter @baseout/db-schema db:generate:space-pg   # regenerate migration
//   node packages/db-schema/scripts/gen-space-pg-ddl.mjs     # regenerate pg-ddl.ts
//
// tests/space-pg-ddl-parity.test.ts fails CI if pg-ddl.ts drifts from the
// migration, so a forgotten regenerate is caught.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MIG_DIR = resolve(ROOT, "migrations/space-pg");
const OUT = resolve(ROOT, "src/space/pg-ddl.ts");

const sqlFile = readdirSync(MIG_DIR).find((f) => f.endsWith(".sql"));
if (!sqlFile) throw new Error(`no .sql migration in ${MIG_DIR}`);
const relSrc = `migrations/space-pg/${sqlFile}`;

const sql = readFileSync(resolve(MIG_DIR, sqlFile), "utf8").trimEnd();
// Escape for a JS template literal: backslash, backtick, ${.
const escaped = sql
  .replace(/\\/g, "\\\\")
  .replace(/`/g, "\\`")
  .replace(/\$\{/g, "\\${");

const out = `/**
 * Per-Space DB DDL — Postgres dialect, as an executable string.
 *
 * The per-Space DB provisioner runs inside the engine Cloudflare Worker
 * (workerd, no filesystem), so it cannot read the .sql migration at runtime —
 * it needs the DDL bundled. This module is the bundled copy.
 *
 * GENERATED FROM ${relSrc} by scripts/gen-space-pg-ddl.mjs — DO NOT HAND-EDIT.
 * tests/space-pg-ddl-parity.test.ts asserts this stays in lockstep with that
 * migration (drift fails CI). Regenerate after a per-Space schema change:
 *   node packages/db-schema/scripts/gen-space-pg-ddl.mjs
 *
 * No imports on purpose — the engine bundle gets the string with zero drizzle
 * weight. Statements are separated by drizzle's \`--> statement-breakpoint\`.
 */

export const SPACE_PG_DDL = \`${escaped}\`;

/** Split SPACE_PG_DDL into individual executable statements. */
export function spacePgDdlStatements(): string[] {
  return SPACE_PG_DDL.split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
`;

writeFileSync(OUT, out);
console.log(`wrote ${OUT} from ${relSrc} (${out.length} bytes)`);
