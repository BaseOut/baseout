// Pure export-archive orchestration (shared-data-portability task 2.5, design D4).
//
// The bundling half of the customer-facing "export all my data" feature.
// Mirrors runBackupBase (backup-base.ts): a pure async function with fully
// INJECTED deps so it is unit-testable with fakes and carries no Trigger.dev
// runtime coupling. The thin wrapper (task 2.6, deferred) reads process.env,
// builds the real storage reader (makeStorageReader) + a resolveStorageWriter-
// backed sink + the callbacks, and calls this.
//
// Flow:
//   1. Enumerate the org's Spaces → Bases (from the injected `input` tree —
//      the wrapper builds it from master-DB / per-Space metadata the org owns).
//   2. Per base: locate the latest completed snapshot via the reader
//      (locateLatestSnapshot). A base with no snapshot → manifest snapshot:null,
//      no CSV entries (design D2).
//   3. Per located table CSV: read it, re-emit through the human-safe guard
//      (reguardCsv — task 2.1 / design D5), count records, hand a
//      {Space}/{Base}/{Table}.csv entry to the sink.
//   4. Emit manifest.json (task 2.2) as the final entry, finalize the sink.
//   5. Fire-and-forget progress after each base; best-effort completion notify.
//
// Deliberately NOT here (reported as remaining): the ZIP container itself —
// no zip library exists in the workspace and this slice adds no deps — so the
// sink is an INTERFACE (ArchiveSink). The streaming, never-buffer-a-whole-base
// assembler and the optional {TableName}.json (format 'csv+json', design D6)
// are task 2.4.

import {
  buildManifest,
  type ExportFormat,
  type ExportManifest,
  type ManifestBaseInput,
  type ManifestSpaceInput,
  type ManifestTableInput,
} from "./_lib/export-manifest";
import { reguardCsv, type ReguardedCsv } from "./_lib/export-csv-guard";
import {
  locateLatestSnapshot,
  sanitizeSegment,
} from "./_lib/export-snapshot-locator";
import type { StorageReader } from "./_lib/storage-readers/types";

export interface ExportTableInput {
  name: string;
  fields: { name: string; type: string }[];
}
export interface ExportBaseInput {
  name: string;
  tables: ExportTableInput[];
}
export interface ExportSpaceInput {
  name: string;
  bases: ExportBaseInput[];
}
export interface ExportArchiveInput {
  org: { name: string; slug: string };
  format: ExportFormat;
  spaces: ExportSpaceInput[];
}

/** One file placed into the archive. */
export interface ArchiveEntry {
  /** Archive-relative path, e.g. "Ops/ProjectsDB/Tasks.csv" or "manifest.json". */
  path: string;
  /** UTF-8 text content. */
  content: string;
}

/**
 * The archive container the orchestration writes to. Task 2.4 (deferred)
 * implements a streaming ZIP-backed sink that writes out through
 * resolveStorageWriter; tests use a recording fake.
 */
export interface ArchiveSink {
  addEntry(entry: ArchiveEntry): Promise<void>;
  /** Close the archive; returns the delivery locator and its byte size. */
  finalize(): Promise<{ location: string; bytes: number }>;
}

export interface ExportArchiveProgressEvent {
  spaceName: string;
  baseName: string;
  basesCompleted: number;
  totalBases: number;
}

export interface ExportArchiveDeps {
  /** Read-side of the snapshot store; only listKeys + readFile are needed. */
  reader: Pick<StorageReader, "listKeys" | "readFile">;
  sink: ArchiveSink;
  /** Injected clock (workerd/test constraint) — never Date.now(). */
  generatedAt: Date;
  /** Fire-and-forget per-base progress; a throw never fails the run. */
  postProgress?: (event: ExportArchiveProgressEvent) => Promise<void>;
  /** Best-effort completion notification to the initiator. */
  notify?: (result: ExportArchiveResult) => Promise<void>;
  /** Override the CSV re-emitter (default reguardCsv). Test/format seam. */
  guardCsv?: (raw: string | Buffer) => ReguardedCsv;
}

export type ExportArchiveStatus = "succeeded" | "failed";

export interface ExportArchiveResult {
  status: ExportArchiveStatus;
  spacesProcessed: number;
  basesProcessed: number;
  basesWithSnapshot: number;
  basesWithoutSnapshot: number;
  /** Tables for which a snapshot CSV was located and bundled. */
  tablesProcessed: number;
  /** Total data rows across all bundled tables. */
  recordsProcessed: number;
  manifest: ExportManifest;
  /** Delivery locator from the sink (storage key / handle). */
  location: string;
  /** Archive size in bytes, from the sink. */
  bytes: number;
  errorMessage?: string;
}

export async function runExportArchive(
  input: ExportArchiveInput,
  deps: ExportArchiveDeps,
): Promise<ExportArchiveResult> {
  const guard = deps.guardCsv ?? reguardCsv;
  const totalBases = input.spaces.reduce((n, s) => n + s.bases.length, 0);

  const manifestSpaces: ManifestSpaceInput[] = [];
  let basesProcessed = 0;
  let basesWithSnapshot = 0;
  let basesWithoutSnapshot = 0;
  let tablesProcessed = 0;
  let recordsProcessed = 0;

  for (const space of input.spaces) {
    const manifestBases: ManifestBaseInput[] = [];

    for (const base of space.bases) {
      const located = await locateLatestSnapshot(deps.reader, {
        orgSlug: input.org.slug,
        spaceName: space.name,
        baseName: base.name,
      });

      const manifestTables: ManifestTableInput[] = [];

      if (located) {
        basesWithSnapshot += 1;
        const keySet = new Set(located.keys);
        for (const table of base.tables) {
          const key = `${located.prefix}${sanitizeSegment(table.name)}.csv`;
          let recordCount = 0;
          if (keySet.has(key)) {
            const raw = await deps.reader.readFile(key);
            const guarded = guard(raw);
            recordCount = guarded.recordCount;
            await deps.sink.addEntry({
              path: `${sanitizeSegment(space.name)}/${sanitizeSegment(
                base.name,
              )}/${sanitizeSegment(table.name)}.csv`,
              content: guarded.content,
            });
            tablesProcessed += 1;
            recordsProcessed += recordCount;
          }
          manifestTables.push({
            name: table.name,
            fields: table.fields,
            recordCount,
          });
        }
      } else {
        basesWithoutSnapshot += 1;
        // Honest about what is missing: the base still appears in the manifest
        // with snapshot: null and zero-count tables (design D2).
        for (const table of base.tables) {
          manifestTables.push({
            name: table.name,
            fields: table.fields,
            recordCount: 0,
          });
        }
      }

      manifestBases.push({
        name: base.name,
        snapshot: located ? located.snapshotAt : null,
        tables: manifestTables,
      });

      basesProcessed += 1;
      // Fire-and-forget (design D4 / backup-run lifecycle): a progress transport
      // failure must never fail the export — /complete is authoritative.
      if (deps.postProgress) {
        try {
          await deps.postProgress({
            spaceName: space.name,
            baseName: base.name,
            basesCompleted: basesProcessed,
            totalBases,
          });
        } catch {
          // swallow — completion is authoritative
        }
      }
    }

    manifestSpaces.push({ name: space.name, bases: manifestBases });
  }

  const manifest = buildManifest({
    org: input.org,
    format: input.format,
    generatedAt: deps.generatedAt,
    spaces: manifestSpaces,
  });
  await deps.sink.addEntry({
    path: "manifest.json",
    content: JSON.stringify(manifest, null, 2) + "\n",
  });

  const { location, bytes } = await deps.sink.finalize();

  const result: ExportArchiveResult = {
    status: "succeeded",
    spacesProcessed: input.spaces.length,
    basesProcessed,
    basesWithSnapshot,
    basesWithoutSnapshot,
    tablesProcessed,
    recordsProcessed,
    manifest,
    location,
    bytes,
  };

  if (deps.notify) {
    try {
      await deps.notify(result);
    } catch {
      // best-effort completion notification
    }
  }

  return result;
}
