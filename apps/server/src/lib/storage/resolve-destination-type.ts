// Storage-destination type resolution (shared-multi-destinations).
//
// A Space holds one storage_destinations row per provider type; the internal
// creds route picks WHICH row via:
//   1. an explicit ?type= from workflows — the run payload's storageType,
//      snapshotted at enqueue, so a mid-run primary swap can't flip creds
//      between the initial read and a ?refresh=1 re-read;
//   2. else the Space's backup_configurations.storage_type (the primary) —
//      covers deploy skew where workflows doesn't send the param yet;
//   3. else the legacy single-row lookup (null filter) — config missing, or
//      storage_type is r2_managed (row-less; filtering by it would 404 spaces
//      that predate multi-destination).

/** Row-backed destination types — mirrors the canonical CHECK constraint. */
export const DESTINATION_TYPES: ReadonlySet<string> = new Set([
  "local_fs",
  "google_drive",
  "box",
  "dropbox",
  "onedrive",
]);

export type ParseTypeParamResult =
  | { ok: true; type: string | null }
  | { ok: false };

/** Validate the raw ?type= query value. Absent (null) means "no filter". */
export function parseTypeParam(raw: string | null): ParseTypeParamResult {
  if (raw === null) return { ok: true, type: null };
  if (!DESTINATION_TYPES.has(raw)) return { ok: false };
  return { ok: true, type: raw };
}

/**
 * Which type to filter the storage_destinations lookup by, or null for the
 * legacy single-row lookup.
 */
export function resolveTypeFilter(
  queryType: string | null,
  configStorageType: string | null,
): string | null {
  if (queryType !== null) return queryType;
  if (configStorageType !== null && DESTINATION_TYPES.has(configStorageType)) {
    return configStorageType;
  }
  return null;
}
