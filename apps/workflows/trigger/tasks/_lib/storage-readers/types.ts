// StorageReader — the read-side mirror of StorageWriter (storage-writer.ts).
//
// Filed by openspec/changes/workflows-restore (sections 1.1–1.3).
// Consumers: restore-base.ts (a later dispatch — sections 4–6).
//
// Each implementation reads from the EXACT keys/paths the corresponding
// StorageWriter wrote. The canonical key scheme is produced by buildR2Key()
// in r2-path.ts; both sides must agree on that contract.

export interface StorageReader {
  /**
   * Called once before any read. Implementations may perform credential
   * validation or directory existence checks here.
   */
  init(): Promise<void>;

  /**
   * Read the file at `relativeKey` (relative to the reader's configured root).
   * Returns the file contents as a Buffer (binary-safe) or string.
   * Throws if the key does not exist or a path-traversal segment (`..`) is
   * detected.
   */
  readFile(key: string): Promise<Buffer | string>;

  /**
   * List all keys whose path begins with `prefix` (relative to the reader's
   * configured root). Returns the full relative key for each match, in
   * lexicographic order.
   *
   * Used by restore-base to enumerate all CSVs under a run's directory
   * prefix (e.g. `orgSlug/spaceName/baseName/2026-06-24T10-00-00Z/`).
   *
   * Throws on path-traversal segments (`..`).
   */
  listKeys(prefix: string): Promise<string[]>;

  /**
   * Called once after all reads are complete. Implementations may release
   * connections or temp resources here. Must not throw (swallow internally).
   */
  cleanup(): Promise<void>;
}
