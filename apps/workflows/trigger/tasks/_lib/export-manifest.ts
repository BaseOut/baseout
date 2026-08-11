// Versioned manifest.json builder for the portable export archive
// (shared-data-portability task 2.2, design D3).
//
// manifest.json is the archive's root, machine-readable descriptor: it makes
// the export self-describing so a customer can open and understand it WITHOUT
// Baseout. Per Space → per Base → per Table it carries the field list + types,
// the record count, and the source snapshot timestamp; plus top-level org
// identity, generation time, format, and a schema version for the manifest
// itself (so future manifest-shape changes are detectable by consumers).
//
// Pure: `generatedAt` is INJECTED, never Date.now() (workerd/test constraint,
// matching the house style — cf. exportFilename's injected `date` in
// apps/web/src/lib/csv.ts).

/** Manifest schema version. Bump on any breaking shape change. */
export const MANIFEST_VERSION = 1 as const;

/** Record formats the archive can carry (design D6). */
export type ExportFormat = "csv" | "csv+json";

export interface ManifestField {
  name: string;
  type: string;
}

export interface ManifestTableInput {
  name: string;
  fields: ManifestField[];
  recordCount: number;
}

export interface ManifestBaseInput {
  name: string;
  /**
   * Source snapshot instant, or null for a base with no completed snapshot
   * (design D2). Accepts a Date or a pre-formatted ISO string; normalized to
   * an ISO string in the output.
   */
  snapshot: Date | string | null;
  tables: ManifestTableInput[];
}

export interface ManifestSpaceInput {
  name: string;
  bases: ManifestBaseInput[];
}

export interface BuildManifestInput {
  org: { name: string; slug: string };
  format: ExportFormat;
  /** Injected clock — the builder never calls Date.now(). */
  generatedAt: Date;
  spaces: ManifestSpaceInput[];
}

// ── Output shape ──

export interface ManifestTable {
  name: string;
  fields: ManifestField[];
  recordCount: number;
}

export interface ManifestBase {
  name: string;
  snapshot: string | null;
  tables: ManifestTable[];
}

export interface ManifestSpace {
  name: string;
  bases: ManifestBase[];
}

export interface ExportManifest {
  manifestVersion: typeof MANIFEST_VERSION;
  org: { name: string; slug: string };
  generatedAt: string;
  format: ExportFormat;
  spaces: ManifestSpace[];
}

function normalizeSnapshot(snapshot: Date | string | null): string | null {
  if (snapshot === null) return null;
  return snapshot instanceof Date ? snapshot.toISOString() : snapshot;
}

/** Assemble the versioned manifest object. Pure — safe to JSON.stringify. */
export function buildManifest(input: BuildManifestInput): ExportManifest {
  return {
    manifestVersion: MANIFEST_VERSION,
    org: { name: input.org.name, slug: input.org.slug },
    generatedAt: input.generatedAt.toISOString(),
    format: input.format,
    spaces: input.spaces.map((space) => ({
      name: space.name,
      bases: space.bases.map((base) => ({
        name: base.name,
        snapshot: normalizeSnapshot(base.snapshot),
        tables: base.tables.map((table) => ({
          name: table.name,
          fields: table.fields.map((f) => ({ name: f.name, type: f.type })),
          recordCount: table.recordCount,
        })),
      })),
    })),
  };
}
