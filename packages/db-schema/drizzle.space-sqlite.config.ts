import { defineConfig } from "drizzle-kit";

// Per-Space DB migrations — SQLite / Cloudflare D1 dialect (d1 backend).
// Mirror of drizzle.space-pg.config.ts for the other dialect. Generate-only
// (offline schema diff); D1 databases are migrated per-Space by the provisioner.
export default defineConfig({
  schema: "./src/space/sqlite.ts",
  out: "./migrations/space-sqlite",
  dialect: "sqlite",
  strict: true,
  verbose: true,
});
