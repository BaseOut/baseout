// TDD (CLAUDE.md §3.4) — RED first: the versioned manifest.json builder
// (shared-data-portability task 2.2, design D3).
//
// The archive's root manifest.json makes the export self-describing: openable
// and understandable WITHOUT Baseout. Per Space → per Base → per Table it
// carries the field list + types, the record count, and the source snapshot
// timestamp; plus top-level org identity, generation time, format, and a
// manifest schema version.
//
// `generatedAt` is INJECTED (a Date arg) — the builder never calls Date.now().
// That keeps it pure and deterministic under test, and is required under the
// Trigger.dev/workerd time constraints the house style follows.

import { describe, expect, it } from "vitest";
import {
  buildManifest,
  MANIFEST_VERSION,
} from "../trigger/tasks/_lib/export-manifest";

const GENERATED_AT = new Date("2026-08-05T10:30:00.000Z");

describe("buildManifest", () => {
  it("stamps the schema version, org identity, generatedAt (ISO), and format", () => {
    const manifest = buildManifest({
      org: { name: "Acme Inc", slug: "acme" },
      format: "csv",
      generatedAt: GENERATED_AT,
      spaces: [],
    });
    expect(manifest.manifestVersion).toBe(MANIFEST_VERSION);
    expect(manifest.org).toEqual({ name: "Acme Inc", slug: "acme" });
    expect(manifest.generatedAt).toBe("2026-08-05T10:30:00.000Z");
    expect(manifest.format).toBe("csv");
    expect(manifest.spaces).toEqual([]);
  });

  it("does NOT call Date.now — output depends only on the injected date", () => {
    const spy = () => {
      throw new Error("Date.now must not be called");
    };
    const original = Date.now;
    Date.now = spy as unknown as typeof Date.now;
    try {
      const manifest = buildManifest({
        org: { name: "Acme", slug: "acme" },
        format: "csv",
        generatedAt: GENERATED_AT,
        spaces: [],
      });
      expect(manifest.generatedAt).toBe("2026-08-05T10:30:00.000Z");
    } finally {
      Date.now = original;
    }
  });

  it("carries per-Space → per-Base → per-Table schema, types, and counts", () => {
    const manifest = buildManifest({
      org: { name: "Acme", slug: "acme" },
      format: "csv+json",
      generatedAt: GENERATED_AT,
      spaces: [
        {
          name: "Ops",
          bases: [
            {
              name: "ProjectsDB",
              snapshot: "2026-05-02T12:00:00Z",
              tables: [
                {
                  name: "Tasks",
                  recordCount: 3,
                  fields: [
                    { name: "Name", type: "singleLineText" },
                    { name: "Done", type: "checkbox" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    expect(manifest.format).toBe("csv+json");
    const table = manifest.spaces[0]!.bases[0]!.tables[0]!;
    expect(table).toEqual({
      name: "Tasks",
      recordCount: 3,
      fields: [
        { name: "Name", type: "singleLineText" },
        { name: "Done", type: "checkbox" },
      ],
    });
    expect(manifest.spaces[0]!.bases[0]!.snapshot).toBe("2026-05-02T12:00:00Z");
  });

  it("represents a base with no completed snapshot as snapshot: null (design D2)", () => {
    const manifest = buildManifest({
      org: { name: "Acme", slug: "acme" },
      format: "csv",
      generatedAt: GENERATED_AT,
      spaces: [
        {
          name: "Ops",
          bases: [{ name: "NeverBackedUp", snapshot: null, tables: [] }],
        },
      ],
    });
    expect(manifest.spaces[0]!.bases[0]!.snapshot).toBeNull();
  });

  it("accepts a Date snapshot and normalizes it to an ISO string", () => {
    const manifest = buildManifest({
      org: { name: "Acme", slug: "acme" },
      format: "csv",
      generatedAt: GENERATED_AT,
      spaces: [
        {
          name: "Ops",
          bases: [
            {
              name: "B",
              snapshot: new Date("2026-05-02T12:00:00.000Z"),
              tables: [],
            },
          ],
        },
      ],
    });
    expect(manifest.spaces[0]!.bases[0]!.snapshot).toBe("2026-05-02T12:00:00.000Z");
  });

  it("serializes to stable JSON (round-trips through JSON.parse)", () => {
    const manifest = buildManifest({
      org: { name: "Acme", slug: "acme" },
      format: "csv",
      generatedAt: GENERATED_AT,
      spaces: [],
    });
    expect(JSON.parse(JSON.stringify(manifest))).toEqual(manifest);
  });
});
