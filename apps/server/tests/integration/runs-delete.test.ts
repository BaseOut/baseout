// Pure-function tests for the run-delete orchestration (Phase C.1 of
// openspec/changes/shared-backup-run-delete).
//
// Mirrors the cancel pattern: validation + state transitions are extracted
// into processRunDelete(input, deps); tests inject vi.fn() deps for every
// side-effect.
//
// State machine:
//   <terminal> → deleting (engine route writes deleting, then triggers
//                          delete-run-files task; row hard-DELETEs on the
//                          task's /delete-complete callback)
//   queued | running | cancelling → 409 run_not_terminal
//   deleting → 409 delete_in_progress
//
// Routing tests (401 missing token, 405 non-POST, 400 invalid UUID) live
// in runs-delete-route.test.ts.

import { describe, expect, it, vi } from "vitest";
import { processRunDelete } from "../../src/lib/runs/delete";

const RUN_ID = "33333333-3333-3333-3333-333333333333";
const PREFIX_A = "org-1/space-1/Base A/2026-05-22T12-00-00Z/";
const PREFIX_B = "org-1/space-1/Base B/2026-05-22T12-00-00Z/";
const STORAGE_TYPE = "r2_managed";

interface DepsBag {
  fetchRunForDelete: ReturnType<typeof vi.fn>;
  computeRunPrefixes: ReturnType<typeof vi.fn>;
  markRunDeleting: ReturnType<typeof vi.fn>;
}

function makeDeps(): DepsBag {
  return {
    fetchRunForDelete: vi.fn(async () => ({
      id: RUN_ID,
      status: "succeeded",
    })),
    computeRunPrefixes: vi.fn(async () => ({
      prefixes: [PREFIX_A, PREFIX_B],
      storageType: STORAGE_TYPE,
    })),
    markRunDeleting: vi.fn(async () => true), // CAS won
  };
}

describe("processRunDelete — happy paths", () => {
  it.each([
    "succeeded",
    "failed",
    "cancelled",
    "trial_complete",
    "trial_truncated",
  ])("flips a %s run to 'deleting' and returns prefixes + storageType", async (status) => {
    const deps = makeDeps();
    deps.fetchRunForDelete = vi.fn(async () => ({ id: RUN_ID, status }));

    const result = await processRunDelete({ runId: RUN_ID }, deps);

    expect(result).toEqual({
      ok: true,
      prefixes: [PREFIX_A, PREFIX_B],
      storageType: STORAGE_TYPE,
    });
    expect(deps.fetchRunForDelete).toHaveBeenCalledWith(RUN_ID);
    expect(deps.computeRunPrefixes).toHaveBeenCalledWith(RUN_ID);
    expect(deps.markRunDeleting).toHaveBeenCalledWith(RUN_ID);
  });

  it("returns ok with empty prefixes when no bases are joined to the run", async () => {
    // Edge case: config bases changed after the run started, so the join
    // returns nothing. The row should still flip to 'deleting' so the
    // task can POST /delete-complete and DELETE the metadata.
    const deps = makeDeps();
    deps.computeRunPrefixes = vi.fn(async () => ({
      prefixes: [],
      storageType: STORAGE_TYPE,
    }));

    const result = await processRunDelete({ runId: RUN_ID }, deps);

    expect(result).toEqual({
      ok: true,
      prefixes: [],
      storageType: STORAGE_TYPE,
    });
    expect(deps.markRunDeleting).toHaveBeenCalledWith(RUN_ID);
  });
});

describe("processRunDelete — error gates", () => {
  it("returns run_not_found when fetchRunForDelete resolves to null", async () => {
    const deps = makeDeps();
    deps.fetchRunForDelete = vi.fn(async () => null);

    const result = await processRunDelete({ runId: RUN_ID }, deps);

    expect(result).toEqual({ ok: false, error: "run_not_found" });
    expect(deps.computeRunPrefixes).not.toHaveBeenCalled();
    expect(deps.markRunDeleting).not.toHaveBeenCalled();
  });

  it.each(["queued", "running", "cancelling"])(
    "returns run_not_terminal when status is %s",
    async (status) => {
      const deps = makeDeps();
      deps.fetchRunForDelete = vi.fn(async () => ({ id: RUN_ID, status }));

      const result = await processRunDelete({ runId: RUN_ID }, deps);

      expect(result).toEqual({ ok: false, error: "run_not_terminal" });
      expect(deps.computeRunPrefixes).not.toHaveBeenCalled();
      expect(deps.markRunDeleting).not.toHaveBeenCalled();
    },
  );

  it("returns delete_in_progress when status is already 'deleting' (double-click)", async () => {
    const deps = makeDeps();
    deps.fetchRunForDelete = vi.fn(async () => ({
      id: RUN_ID,
      status: "deleting",
    }));

    const result = await processRunDelete({ runId: RUN_ID }, deps);

    expect(result).toEqual({ ok: false, error: "delete_in_progress" });
    expect(deps.computeRunPrefixes).not.toHaveBeenCalled();
    expect(deps.markRunDeleting).not.toHaveBeenCalled();
  });

  it("returns delete_in_progress when CAS to 'deleting' loses the race", async () => {
    // Two concurrent delete calls. The first wins; the second's
    // markRunDeleting UPDATE matches no rows (WHERE status IN (<terminal>))
    // and returns false. Map that to delete_in_progress.
    const deps = makeDeps();
    deps.markRunDeleting = vi.fn(async () => false);

    const result = await processRunDelete({ runId: RUN_ID }, deps);

    expect(result).toEqual({ ok: false, error: "delete_in_progress" });
  });

  it("computes prefixes BEFORE marking 'deleting' so a DB failure leaves the row unchanged", async () => {
    // If computeRunPrefixes throws (transient DB blip), the run stays in
    // its terminal status — no state change. The thrown error bubbles up
    // to the route, which maps to a 500.
    const deps = makeDeps();
    deps.computeRunPrefixes = vi.fn(async () => {
      throw new Error("db_offline");
    });

    await expect(processRunDelete({ runId: RUN_ID }, deps)).rejects.toThrow(
      "db_offline",
    );
    expect(deps.markRunDeleting).not.toHaveBeenCalled();
  });
});
