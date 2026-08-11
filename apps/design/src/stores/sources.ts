/**
 * Account-level Sources — types only (skeleton).
 *
 * A Source is one account-level Airtable connection (OAuth grant or personal
 * access token), created once and reused across Spaces. An account can have
 * several; a Space uses exactly one. Each source carries its own status +
 * reconnect, shared by every Space that uses it, and a table of the Spaces that
 * use it (with per-Space meta).
 *
 * Only fields Airtable's API can actually return are modelled — see
 * openspec/changes/account-sources/research.md (no workspace/plan/record-counts).
 */
export type SourceStatus = 'connected' | 'reconnect' | 'needs_connection';
export type SourceAuth = 'oauth' | 'pat';

/** One Space that uses this source, with its per-Space meta (all Baseout-owned data). */
export interface SourceSpaceUsage {
  spaceId: string;
  spaceName: string;
  /** # of bases this Space includes from the source */
  baseCount: number;
  /** where this Space's backup goes, e.g. "Company Drive" or "Company Drive + Analytics DB" */
  destinations: string;
  /** e.g. "Daily" */
  schedule: string;
  /** relative last-backup label, or null */
  lastBackup: string | null;
  status: 'ok' | 'failed' | 'paused';
}

export interface SourceSummary {
  id: string;
  /** user-set label */
  name: string;
  provider: 'airtable';
  /** the authorized Airtable account — email if the `user.email:read` scope is granted, else the usr… id */
  account: string;
  auth: SourceAuth;
  status: SourceStatus;
  /** # bases the connection can see (GET /v0/meta/bases) */
  basesAvailable: number;
  /** the Spaces using this source */
  inUseBy: SourceSpaceUsage[];
  /** when status was last verified (status is last-known-good, not live) */
  lastChecked: string | null;
  addedAt: string;
}
