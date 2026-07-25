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
   * The engine decrypts connection/storage tokens and re-encrypts on BYOS
   * storage-destination refresh paths.
   */
  BASEOUT_ENCRYPTION_KEY: string;
  /**
   * Feature flag for the new on-demand Airtable token refresh path. Default is
   * off when unset so deployed behavior remains decrypt-only.
   */
  AIRTABLE_ON_DEMAND_REFRESH_ENABLED?: string;
  /**
   * Refresh model selector (shadow-first migration to idle keep-alive):
   *   'sweep'     (default/unset) — the 15-minute access-token sweep refreshes;
   *                                 the daily keep-alive job no-ops.
   *   'shadow'    — the sweep still refreshes; the daily keep-alive job runs its
   *                 refresh-idle SELECTION and logs what it WOULD refresh (no
   *                 writes) for comparison before cutover.
   *   'keepalive' — the daily keep-alive job refreshes idle-expiring tokens; the
   *                 15-minute sweep no-ops. On-demand at backup time is the
   *                 primary liveness path. Flip only after the gauge is re-keyed
   *                 to refresh-token staleness (else it false-alarms on idle
   *                 tokens).
   * Rollback is `sweep`. See resolveKeepaliveMode in lib/cron/keepalive-mode.ts.
   */
  AIRTABLE_KEEPALIVE_MODE?: string;
  /** Airtable OAuth app client_id (must match apps/web). Used only by on-demand refresh when enabled. */
  AIRTABLE_OAUTH_CLIENT_ID?: string;
  /** Airtable OAuth app client_secret (must match apps/web). Used only by on-demand refresh when enabled. */
  AIRTABLE_OAUTH_CLIENT_SECRET?: string;
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
  /**
   * Microsoft OneDrive OAuth app client_id (must match apps/web). The engine
   * refreshes OneDrive access tokens on behalf of the workflows runner. The
   * Azure App is a PUBLIC client (`allowPublicClient: true`) — there is NO
   * client secret, and the refresh call carries only `client_id` +
   * `refresh_token` + `scope`. Microsoft ROTATES refresh tokens on every
   * refresh (like Box, unlike Drive/Dropbox) — the engine route MUST
   * re-encrypt and persist the new refresh_token on every successful refresh,
   * or the next refresh fails with `invalid_grant` (AADSTS50173).
   */
  MICROSOFT_OAUTH_CLIENT_ID: string;
  /** Trigger.dev v3 project-scoped secret key. */
  TRIGGER_SECRET_KEY: string;
  /** Trigger.dev project reference. */
  TRIGGER_PROJECT_REF: string;
  /** Per-Connection rate-limit gateway DO. */
  CONNECTION_DO: DurableObjectNamespace;
  /** Per-Space scheduler DO. */
  SPACE_DO: DurableObjectNamespace;
  /**
   * Workers AI binding — schema description generation
   * (server-schema-descriptions). Platform-authenticated: no API key. Optional
   * so environments without the binding skip generation gracefully.
   */
  AI?: Ai;
  /** Kill switch for post-sync AI description generation. Unset/anything-but-"false" = on. */
  AI_DESCRIPTIONS_ENABLED?: string;
  /** Workers AI model id override for descriptions. */
  AI_DESCRIPTIONS_MODEL?: string;
  /**
   * Dev/demo override for the Enterprise view-capture gate
   * (server-view-capture-override): exactly "1" makes /schema-sync treat every
   * connection as view-capture-enabled (response viewCapture: "override").
   * Set in .dev.vars for the dev Worker ONLY — never staging/production.
   */
  VIEW_CAPTURE_OVERRIDE?: string;
}

export interface AppLocals {
  /**
   * Lazy per-request master DB accessor. Handlers that need the DB call this;
   * handlers that don't (health, ping) skip it entirely. The factory is built
   * once per request on first access, and torn down by index.ts in `finally`.
   */
  getMasterDb: () => ReturnType<typeof createMasterDb>;
}
