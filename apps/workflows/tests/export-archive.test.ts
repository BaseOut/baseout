// TDD (CLAUDE.md §3.4) — RED first: the pure export-archive orchestration
// (shared-data-portability task 2.5, design D4).
//
// Mirrors the backup-run house style (runBackupBase in backup-base.ts): a pure
// async function with fully INJECTED deps — a storage reader, an archive sink,
// progress + completion callbacks, and the timestamp — so it is unit-testable
// with fakes and no Trigger.dev runtime. The thin task wrapper (task 2.6,
// deferred) builds the real deps from process.env and calls this.
//
// It enumerates the org's Spaces/Bases, locates each base's latest snapshot,
// re-emits each table CSV through the human-safe guard (task 2.1), computes
// record counts, emits manifest.json (task 2.2), and hands every entry to the
// sink. Progress is fire-and-forget (a throw never fails the run).

import { describe, expect, it, vi } from "vitest";
import {
  runExportArchive,
  type ArchiveEntry,
  type ExportArchiveInput,
} from "../trigger/tasks/export-archive";
import { reguardCsv } from "../trigger/tasks/_lib/export-csv-guard";

const GENERATED_AT = new Date("2026-08-05T10:30:00.000Z");
const SNAP = "acme/Ops/ProjectsDB/2026-05-02T12-00-00Z";

// pageToCsv-style UNGUARDED snapshot content (a formula cell is verbatim).
const TASKS_CSV = '"Name","Formula"\r\n"Alice","=danger()"\r\n"Bob","ok"\r\n';
const PEOPLE_CSV = '"Full Name"\r\n"Carol"\r\n';

function fakeReader(files: Record<string, string>) {
  const readCalls: string[] = [];
  return {
    readCalls,
    listKeys: async (prefix: string) =>
      Object.keys(files)
        .filter((k) => k.startsWith(prefix))
        .sort(),
    readFile: async (key: string) => {
      readCalls.push(key);
      const content = files[key];
      if (content === undefined) throw new Error(`missing key ${key}`);
      return content;
    },
  };
}

function fakeSink() {
  const entries: ArchiveEntry[] = [];
  return {
    entries,
    addEntry: async (e: ArchiveEntry) => {
      entries.push(e);
    },
    finalize: async () => ({ location: "r2://exports/acme/export.zip", bytes: 4096 }),
  };
}

function twoSpaceInput(): ExportArchiveInput {
  return {
    org: { name: "Acme Inc", slug: "acme" },
    format: "csv",
    spaces: [
      {
        name: "Ops",
        bases: [
          {
            name: "ProjectsDB",
            tables: [
              {
                name: "Tasks",
                fields: [
                  { name: "Name", type: "singleLineText" },
                  { name: "Formula", type: "formula" },
                ],
              },
              { name: "People", fields: [{ name: "Full Name", type: "singleLineText" }] },
            ],
          },
        ],
      },
      {
        // No snapshot exists for this space's base.
        name: "Sales",
        bases: [
          { name: "LeadsDB", tables: [{ name: "Leads", fields: [{ name: "Company", type: "singleLineText" }] }] },
        ],
      },
    ],
  };
}

const filesWithOpsSnapshot = () => ({
  [`${SNAP}/Tasks.csv`]: TASKS_CSV,
  [`${SNAP}/People.csv`]: PEOPLE_CSV,
});

describe("runExportArchive", () => {
  it("bundles located snapshots into per-Space/per-Base CSV entries + manifest.json", async () => {
    const reader = fakeReader(filesWithOpsSnapshot());
    const sink = fakeSink();

    const result = await runExportArchive(twoSpaceInput(), {
      reader,
      sink,
      generatedAt: GENERATED_AT,
    });

    // One guarded CSV per located table, at the DateTime-less archive path.
    const csvEntries = sink.entries.filter((e) => e.path.endsWith(".csv"));
    expect(csvEntries.map((e) => e.path)).toEqual([
      "Ops/ProjectsDB/Tasks.csv",
      "Ops/ProjectsDB/People.csv",
    ]);
    // The CSV is re-emitted through the guard: the formula is neutralized.
    const tasks = csvEntries.find((e) => e.path === "Ops/ProjectsDB/Tasks.csv")!;
    expect(tasks.content).toBe(reguardCsv(TASKS_CSV).content);
    expect(tasks.content).toContain("\"'=danger()\"");

    // manifest.json is present and parses to the returned manifest.
    const manifestEntry = sink.entries.find((e) => e.path === "manifest.json")!;
    expect(manifestEntry).toBeDefined();
    expect(JSON.parse(manifestEntry.content)).toEqual(result.manifest);
  });

  it("computes counts and stamps the snapshot timestamp per base", async () => {
    const reader = fakeReader(filesWithOpsSnapshot());
    const sink = fakeSink();
    const result = await runExportArchive(twoSpaceInput(), {
      reader,
      sink,
      generatedAt: GENERATED_AT,
    });

    expect(result.status).toBe("succeeded");
    expect(result.spacesProcessed).toBe(2);
    expect(result.basesProcessed).toBe(2);
    expect(result.basesWithSnapshot).toBe(1);
    expect(result.basesWithoutSnapshot).toBe(1);
    expect(result.tablesProcessed).toBe(2); // only tables with a located CSV
    expect(result.recordsProcessed).toBe(3); // Tasks 2 + People 1
    expect(result.location).toBe("r2://exports/acme/export.zip");
    expect(result.bytes).toBe(4096);

    // Manifest carries the per-table counts and the reconstructed ISO snapshot.
    const ops = result.manifest.spaces[0]!.bases[0]!;
    expect(ops.name).toBe("ProjectsDB");
    expect(ops.snapshot).toBe("2026-05-02T12:00:00Z");
    expect(ops.tables).toEqual([
      {
        name: "Tasks",
        fields: [
          { name: "Name", type: "singleLineText" },
          { name: "Formula", type: "formula" },
        ],
        recordCount: 2,
      },
      { name: "People", fields: [{ name: "Full Name", type: "singleLineText" }], recordCount: 1 },
    ]);
    expect(result.manifest.generatedAt).toBe("2026-08-05T10:30:00.000Z");
    expect(result.manifest.org).toEqual({ name: "Acme Inc", slug: "acme" });
  });

  it("represents a base with no completed snapshot as snapshot: null and emits no CSV for it", async () => {
    const reader = fakeReader(filesWithOpsSnapshot());
    const sink = fakeSink();
    const result = await runExportArchive(twoSpaceInput(), {
      reader,
      sink,
      generatedAt: GENERATED_AT,
    });

    const sales = result.manifest.spaces[1]!.bases[0]!;
    expect(sales.name).toBe("LeadsDB");
    expect(sales.snapshot).toBeNull();
    expect(sales.tables).toEqual([
      { name: "Leads", fields: [{ name: "Company", type: "singleLineText" }], recordCount: 0 },
    ]);
    // No archive entry was created for the base with no snapshot.
    expect(sink.entries.some((e) => e.path.startsWith("Sales/"))).toBe(false);
  });

  it("fires progress per base and notifies on completion (both best-effort)", async () => {
    const reader = fakeReader(filesWithOpsSnapshot());
    const sink = fakeSink();
    const postProgress = vi.fn(async () => {});
    const notify = vi.fn(async () => {});

    const result = await runExportArchive(twoSpaceInput(), {
      reader,
      sink,
      generatedAt: GENERATED_AT,
      postProgress,
      notify,
    });

    expect(postProgress).toHaveBeenCalledTimes(2); // one per base
    expect(postProgress).toHaveBeenLastCalledWith(
      expect.objectContaining({ basesCompleted: 2, totalBases: 2 }),
    );
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(result);
  });

  it("does not fail the run when progress throws (fire-and-forget)", async () => {
    const reader = fakeReader(filesWithOpsSnapshot());
    const sink = fakeSink();
    const postProgress = vi.fn(async () => {
      throw new Error("progress transport down");
    });

    const result = await runExportArchive(twoSpaceInput(), {
      reader,
      sink,
      generatedAt: GENERATED_AT,
      postProgress,
    });

    expect(result.status).toBe("succeeded");
    expect(postProgress).toHaveBeenCalledTimes(2);
  });
});
