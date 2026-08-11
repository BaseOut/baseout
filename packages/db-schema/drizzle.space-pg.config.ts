import { defineConfig } from "drizzle-kit";

// Per-Space DB migrations — Postgres dialect (managed_pg + byodb backends).
// Separate from the master-DB config (drizzle.config.ts) per PRD §21.1: the
// per-Space DB is a distinct database with its own schema + migration lineage.
// Generate-only here (offline schema diff); per-Space DBs are migrated by the
// provisioner against each Space's own database, not a single shared URL.
export default defineConfig({
  schema: "./src/space/pg.ts",
  out: "./migrations/space-pg",
  dialect: "postgresql",
  strict: true,
  verbose: true,
});
