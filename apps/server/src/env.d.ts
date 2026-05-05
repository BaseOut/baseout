// Worker bindings + per-request locals for apps/server.
// See CLAUDE.md §5.3 for the AppLocals = { masterDb } convention.

import type { createMasterDb } from "./db/worker";

export interface Env {
  /** Shared secret with apps/web (BACKUP_ENGINE_INTERNAL_TOKEN). Gates /api/internal/*. */
  INTERNAL_TOKEN: string;
  /** Master Postgres URL — used in local wrangler dev only; deployed envs use HYPERDRIVE binding. */
  DATABASE_URL: string;
  /** Trigger.dev v3 project-scoped secret key. */
  TRIGGER_SECRET_KEY: string;
  /** Trigger.dev project reference. */
  TRIGGER_PROJECT_REF: string;
  /** Per-Connection rate-limit gateway DO. */
  CONNECTION_DO: DurableObjectNamespace;
  /** Per-Space scheduler DO. */
  SPACE_DO: DurableObjectNamespace;
}

export interface AppLocals {
  /** Per-request master DB client. Null in PoC; phase 1 wires postgres-js per CLAUDE.md §5.1. */
  masterDb: ReturnType<typeof createMasterDb>;
}
