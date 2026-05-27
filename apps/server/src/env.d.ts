// Worker bindings + per-request locals for apps/server.
// See CLAUDE.md §5.3 for the AppLocals = { masterDb } convention.

import type { createMasterDb } from "./db/worker";

export interface Env {
  /** Shared secret with apps/web (BACKUP_ENGINE_INTERNAL_TOKEN). Gates /api/internal/*. */
  INTERNAL_TOKEN: string;
  /** Master Postgres URL — used in local wrangler dev only; deployed envs use HYPERDRIVE binding. */
  DATABASE_URL: string;
  /** Hyperdrive binding — used in deployed envs (production / staging). Optional locally. */
  HYPERDRIVE?: Hyperdrive;
  /**
   * AES-256-GCM key (base64-encoded 32 bytes) — must match apps/web.
   * The engine reads for decrypt and (Phase B1) writes during the OAuth-
   * refresh cron's success path.
   */
  BASEOUT_ENCRYPTION_KEY: string;
  /** Airtable OAuth app client_id (must match apps/web). Used by the OAuth-refresh cron. */
  AIRTABLE_OAUTH_CLIENT_ID: string;
  /** Airtable OAuth app client_secret (must match apps/web). Used by the OAuth-refresh cron. */
  AIRTABLE_OAUTH_CLIENT_SECRET: string;
  /**
   * Google Drive OAuth app client_id (must match apps/web). The engine
   * refreshes Drive access tokens on behalf of the workflows runner — see
   * /api/internal/spaces/:spaceId/storage-destination.
   */
  GOOGLE_DRIVE_OAUTH_CLIENT_ID: string;
  /** Google Drive OAuth app client_secret (must match apps/web). */
  GOOGLE_DRIVE_OAUTH_CLIENT_SECRET: string;
  /**
   * Box OAuth app client_id (must match apps/web). The engine refreshes Box
   * access tokens (and persists the rotated refresh_token) on behalf of the
   * workflows runner — see /api/internal/spaces/:spaceId/storage-destination.
   */
  BOX_OAUTH_CLIENT_ID: string;
  /** Box OAuth app client_secret (must match apps/web). */
  BOX_OAUTH_CLIENT_SECRET: string;
  /**
   * Dropbox OAuth app client_id (App key — must match apps/web). The engine
   * refreshes Dropbox access tokens on behalf of the workflows runner. Unlike
   * Box, Dropbox refresh tokens are STABLE (no rotation, no expiry by
   * default) — like Drive — so the engine route preserves the stored
   * encrypted refresh token on refresh.
   */
  DROPBOX_OAUTH_CLIENT_ID: string;
  /** Dropbox OAuth app client_secret (App secret — must match apps/web). */
  DROPBOX_OAUTH_CLIENT_SECRET: string;
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
  /**
   * Lazy per-request master DB accessor. Handlers that need the DB call this;
   * handlers that don't (health, ping) skip it entirely. The factory is built
   * once per request on first access, and torn down by index.ts in `finally`.
   */
  getMasterDb: () => ReturnType<typeof createMasterDb>;
}
