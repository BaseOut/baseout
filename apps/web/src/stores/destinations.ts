/**
 * Account-level Destinations — types only (skeleton).
 *
 * A Destination is created ONCE on the account and reused across Spaces. A Space's
 * backup fans out to one file destination (required) plus optionally one database
 * destination (encouraged, never required). Each destination carries its own status
 * and reconnect, shared by every Space that uses it.
 *
 * Real persistence/wiring is an engineering follow-up in the monorepo; here this is
 * just the shape the design harness feeds.
 */
export type DestinationKind = 'file' | 'database';
export type DestinationStatus = 'connected' | 'reconnect' | 'connecting' | 'needs_connection';

export interface DestinationSummary {
  id: string;
  name: string;
  kind: DestinationKind;
  /** provider slug, e.g. 'google_drive' | 's3' | 'postgres' */
  provider: string;
  /** human label, e.g. 'Google Drive' | 'Amazon S3' | 'Postgres' */
  providerLabel: string;
  status: DestinationStatus;
  /** where data lands, e.g. 'folder /Baseout' | 'bucket baseout-ops' | 'database ops_mirror' */
  detail: string;
  /** Space names currently linked to this destination ("in use by") */
  inUseBy: string[];
  /** relative last-write label, or null if never written */
  lastWrite: string | null;
  /** ISO-ish date the destination was added */
  addedAt: string;
}
