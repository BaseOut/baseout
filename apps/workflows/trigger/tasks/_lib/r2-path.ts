// Relative-path builder for backup output.
//
// This function produces a destination-relative storage key. With managed R2
// revived (openspec/changes/workflows-r2-writer + system-r2-revive) the same
// string is used as the R2 S3 object key, a BYOS relative path (Drive/Box/
// Dropbox/OneDrive sub-folder layout), or a local-disk relative path under
// apps/workflows/.backups/ — whichever StorageWriter the Space selected. The
// `buildR2Key` name is kept stable so existing call sites and tests don't churn.
//
// Canonical layout per openspec/changes/baseout-server/specs/backup-engine/spec.md
// "Static backup file path layout":
//   /{user-root}/{SpaceName}/{BaseName}/{DateTime}/{TableName}.csv
//
// orgSlug fills {user-root} (BYOS destinations will replace this with
// their configured root in a later phase). `:` in the timestamp is
// replaced with `-` per the spec's static-path-construction scenario.
// User-controlled name segments have `/` replaced with `_` so a base named
// "Foo/Bar" doesn't silently nest below a phantom "Foo" folder.

export interface BuildR2KeyInput {
  orgSlug: string;
  spaceName: string;
  baseName: string;
  runStartedAt: Date;
  tableName: string;
}

export function buildR2Key(input: BuildR2KeyInput): string {
  const { orgSlug, spaceName, baseName, runStartedAt, tableName } = input;
  const segment = (s: string): string => s.replace(/\//g, "_");
  const timestamp = runStartedAt
    .toISOString()
    .replace(/\.\d+Z$/, "Z")
    .replace(/:/g, "-");
  return `${orgSlug}/${segment(spaceName)}/${segment(baseName)}/${timestamp}/${segment(tableName)}.csv`;
}

export interface BuildAttachmentKeyInput {
  orgSlug: string;
  spaceName: string;
  baseName: string;
  /** {base_id}_{table_id}_{record_id}_{field_id}_{attachment_id} per PRD §2.8. */
  compositeId: string;
  filename: string;
}

// Storage key for a downloaded attachment (openspec/changes/workflows-attachments).
// Deliberately NOT under the per-run timestamp: the composite-ID dedup row
// records this key on first download, and every later run that hits the dedup
// table reuses it — so the attachment lives at one stable path across runs,
// co-located with the base's backups under an `attachments/` subtree. The
// composite ID (slash-free) is the unique path segment; the filename is kept
// human-readable (with `/` sanitized to `_`).
export function buildAttachmentKey(input: BuildAttachmentKeyInput): string {
  const { orgSlug, spaceName, baseName, compositeId, filename } = input;
  const segment = (s: string): string => s.replace(/\//g, "_");
  return `${orgSlug}/${segment(spaceName)}/${segment(baseName)}/attachments/${segment(compositeId)}/${segment(filename)}`;
}
