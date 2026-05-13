// Relative-path builder for backup output.
//
// Historical name: this function used to produce R2 object keys. R2 has
// been removed; the string is now a tree-relative path joined under
// apps/server/.backups/ by writeCsvToLocalDisk. Naming kept stable so the
// existing tests and call sites don't churn.
//
// Canonical layout per openspec/changes/baseout-backup/specs/backup-engine/spec.md
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
