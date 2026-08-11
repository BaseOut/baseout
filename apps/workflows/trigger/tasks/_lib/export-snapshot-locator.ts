// Snapshot locator for the portable export archive
// (shared-data-portability task 2.3, design D2/D3).
//
// The backup engine writes every table under a per-run DateTime segment:
//   {orgSlug}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv   (buildR2Key)
// and co-locates attachments OUTSIDE that segment:
//   {orgSlug}/{SpaceName}/{BaseName}/attachments/{compositeId}/{file}
//
// This module resolves, via an injected storage reader (the read-side mirror
// of the writers — StorageReader in _lib/storage-readers/types.ts), the prefix
// of a base's LATEST completed snapshot run and the CSV keys under it. A base
// with no completed snapshot yields null (design D2: represented as
// `snapshot: null` in the manifest, honest about what is missing).
//
// "Latest" is a lexicographic max over the DateTime segments: the DateTime
// format is fixed-width and year-first (`2026-05-02T12-00-00Z`), so string
// order equals chronological order. "Completed" is approximated by the
// presence of CSV keys under the run folder — the snapshot layout has no
// partial-run marker; a run that produced CSVs is a run we can bundle.

import type { StorageReader } from "./storage-readers/types";

// The DateTime segment shape produced by buildR2Key (r2-path.ts): the ISO
// timestamp with subsecond precision stripped and `:` replaced by `-`.
const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z$/;

/**
 * Mirrors r2-path.ts's internal `segment`: replace `/` with `_` so a
 * user-controlled name like "Foo/Bar" can't nest below a phantom folder. Kept
 * as a re-implementation (r2-path.ts does not export its helper).
 */
export function sanitizeSegment(s: string): string {
  return s.replace(/\//g, "_");
}

export interface BasePrefixInput {
  orgSlug: string;
  spaceName: string;
  baseName: string;
}

/** The DateTime-less base prefix: {orgSlug}/{SpaceName}/{BaseName}/ */
export function buildBasePrefix(input: BasePrefixInput): string {
  return `${input.orgSlug}/${sanitizeSegment(input.spaceName)}/${sanitizeSegment(
    input.baseName,
  )}/`;
}

export interface LocatedSnapshot {
  /** Full prefix of the chosen run: {orgSlug}/{SpaceName}/{BaseName}/{DateTime}/ */
  prefix: string;
  /** The raw DateTime segment, e.g. "2026-05-02T12-00-00Z". */
  dateTime: string;
  /** DateTime reconstructed as a real ISO instant, for the manifest. */
  snapshotAt: string;
  /** Full relative keys of the CSVs in the chosen run, lexicographically sorted. */
  keys: string[];
}

/** "2026-05-02T12-00-00Z" → "2026-05-02T12:00:00Z" (restore the time colons). */
function isoFromDateTimeSegment(dateTime: string): string {
  const tIndex = dateTime.indexOf("T");
  if (tIndex === -1) return dateTime;
  const date = dateTime.slice(0, tIndex);
  const time = dateTime.slice(tIndex + 1).replace(/-/g, ":");
  return `${date}T${time}`;
}

/**
 * Locate a base's latest completed snapshot. `reader` only needs `listKeys`;
 * the full StorageReader is accepted structurally so production passes the real
 * reader and tests pass a minimal fake.
 */
export async function locateLatestSnapshot(
  reader: Pick<StorageReader, "listKeys">,
  input: BasePrefixInput,
): Promise<LocatedSnapshot | null> {
  const basePrefix = buildBasePrefix(input);
  const keys = await reader.listKeys(basePrefix);

  // Group CSV keys by their DateTime segment; drop attachments and non-CSVs.
  const byDateTime = new Map<string, string[]>();
  for (const key of keys) {
    if (!key.startsWith(basePrefix) || !key.endsWith(".csv")) continue;
    const remainder = key.slice(basePrefix.length);
    const firstSegment = remainder.slice(0, remainder.indexOf("/"));
    if (!DATETIME_RE.test(firstSegment)) continue; // e.g. "attachments"
    const bucket = byDateTime.get(firstSegment) ?? [];
    bucket.push(key);
    byDateTime.set(firstSegment, bucket);
  }

  if (byDateTime.size === 0) return null;

  // Lexicographic max == chronological latest (fixed-width, year-first).
  const latest = [...byDateTime.keys()].sort().at(-1)!;
  return {
    prefix: `${basePrefix}${latest}/`,
    dateTime: latest,
    snapshotAt: isoFromDateTimeSegment(latest),
    keys: byDateTime.get(latest)!.sort(),
  };
}
