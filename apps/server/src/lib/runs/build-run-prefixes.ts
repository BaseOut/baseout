// Build per-base storage prefixes for a backup run (Phase C.2 of
// openspec/changes/shared-backup-run-delete).
//
// A run's "prefix" is the directory layout in which buildR2Key would have
// placed CSVs — minus the trailing <tableName>.csv segment. Each base in
// the run gets its own prefix, all sharing the run's started_at timestamp:
//
//   <orgSlug>/<segment(spaceName)>/<segment(baseName)>/<timestamp>/
//
// One prefix per base. The delete-run-files task calls
// StorageWriter.deletePrefix(prefix) for each. Sanitization rules are kept
// identical to buildR2Key so the strings match what the writer originally
// wrote: `/` in name segments → `_`, `:` in the timestamp → `-`,
// subsecond precision stripped.

export interface JoinedBaseRow {
  /** organizations.slug — already a slug, used verbatim. */
  orgSlug: string;
  /** spaces.name — user-controlled, segment-sanitized. */
  spaceName: string;
  /** at_bases.name — user-controlled, segment-sanitized. */
  baseName: string;
}

function segment(s: string): string {
  return s.replace(/\//g, "_");
}

export function buildRunPrefixes(
  rows: JoinedBaseRow[],
  runStartedAt: Date,
): string[] {
  const timestamp = runStartedAt
    .toISOString()
    .replace(/\.\d+Z$/, "Z")
    .replace(/:/g, "-");
  return rows.map(
    (r) =>
      `${r.orgSlug}/${segment(r.spaceName)}/${segment(r.baseName)}/${timestamp}/`,
  );
}
