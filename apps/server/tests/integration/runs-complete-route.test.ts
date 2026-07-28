// Routing-layer tests for POST /api/internal/runs/:runId/complete.
//
// Pure-function logic is covered in runs-complete.test.ts. This file pins:
//   - Method gate (only POST)
//   - URL UUID guard (400 invalid_request on malformed runId)
//   - Token gate (401 from middleware on missing x-internal-token)
//   - Body validation (400 invalid_request on missing/malformed fields)
//
// Full DB-touching paths (with masterDb queries) are exercised at the
// human-checkpoint smoke step (curl against a hand-seeded backup_runs row),
// matching the runs-start convention.

import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { parseRunCompleteBody } from "../../src/pages/api/internal/runs/complete";

const TEST_TOKEN = "test-only-internal-token-min-32-chars-aaaa";
const RUN_ID = "11111111-1111-1111-1111-111111111111";

const VALID_BODY = {
  triggerRunId: "run_aaaaaaaaaaaaaaaaaaaaaaaa",
  atBaseId: "appAAA111",
  status: "succeeded",
  tablesProcessed: 3,
  recordsProcessed: 42,
  attachmentsProcessed: 0,
};

describe("POST /api/internal/runs/:runId/complete — routing layer", () => {
  it("returns 401 without the internal token (middleware gate)", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(VALID_BODY),
      },
    );
    expect(res.status).toBe(401);
  });

  it("returns 405 on non-POST methods", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "GET",
        headers: { "x-internal-token": TEST_TOKEN },
      },
    );
    expect(res.status).toBe(405);
  });

  it("returns 400 invalid_request when runId is not a UUID", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/not-a-uuid/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify(VALID_BODY),
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 invalid_request when body is not valid JSON", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: "not json",
      },
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("invalid_request");
  });

  it("returns 400 invalid_request when triggerRunId is missing", async () => {
    const { triggerRunId: _, ...rest } = VALID_BODY;
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify(rest),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when status is not one of the four allowed values", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...VALID_BODY, status: "running" }),
      },
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 invalid_request when a count field is negative", async () => {
    const res = await SELF.fetch(
      `http://test/api/internal/runs/${RUN_ID}/complete`,
      {
        method: "POST",
        headers: {
          "x-internal-token": TEST_TOKEN,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...VALID_BODY, recordsProcessed: -1 }),
      },
    );
    expect(res.status).toBe(400);
  });
});

// workflows-instant-webhook 4.2 / server-instant-webhook D.3: the incremental
// completion body (kind:'incremental') parses against a widened contract —
// counters mapped, fallback_to_full accepted, subscription stamp metadata
// surfaced. Unit-tested directly against the exported parser (the DB-touching
// handler paths stay smoke territory, per this file's convention).
describe("parseRunCompleteBody — incremental shape", () => {
  const INCREMENTAL_BODY = {
    kind: "incremental",
    triggerRunId: "run_bbbbbbbbbbbbbbbbbbbbbbbb",
    atBaseId: "appAAA111",
    status: "succeeded",
    created: 3,
    updated: 5,
    deleted: 1,
    reconciledRecords: 2,
    driftCount: 1,
    finalCursor: 42,
    subscriptionId: "22222222-2222-2222-2222-222222222222",
    reconcileRan: true,
  };

  it("legacy (snapshot) bodies parse exactly as before — no incremental meta", () => {
    const parsed = parseRunCompleteBody(VALID_BODY);
    expect(parsed).not.toBeNull();
    expect(parsed!.input).toMatchObject({
      triggerRunId: VALID_BODY.triggerRunId,
      status: "succeeded",
      tablesProcessed: 3,
      recordsProcessed: 42,
      attachmentsProcessed: 0,
    });
    expect(parsed!.incremental).toBeUndefined();
  });

  it("maps the incremental counters: records = created+updated+deleted+reconciled, tables/attachments 0", () => {
    const parsed = parseRunCompleteBody(INCREMENTAL_BODY);
    expect(parsed).not.toBeNull();
    expect(parsed!.input).toMatchObject({
      triggerRunId: INCREMENTAL_BODY.triggerRunId,
      atBaseId: "appAAA111",
      status: "succeeded",
      tablesProcessed: 0,
      recordsProcessed: 11, // 3+5+1+2
      attachmentsProcessed: 0,
    });
    expect(parsed!.incremental).toEqual({
      status: "succeeded",
      subscriptionId: "22222222-2222-2222-2222-222222222222",
      reconcileRan: true,
    });
  });

  it("fallback_to_full is accepted and finalizes as failed with a composed errorMessage", () => {
    const parsed = parseRunCompleteBody({
      ...INCREMENTAL_BODY,
      status: "fallback_to_full",
      fallbackReason: "cursor_expired",
      reconcileRan: false,
    });
    expect(parsed).not.toBeNull();
    expect(parsed!.input.status).toBe("failed");
    expect(parsed!.input.errorMessage).toBe("fallback_to_full: cursor_expired");
    expect(parsed!.incremental!.status).toBe("fallback_to_full");
  });

  it("fallback without a reason still composes a message; an explicit errorMessage wins", () => {
    const noReason = parseRunCompleteBody({ ...INCREMENTAL_BODY, status: "fallback_to_full" });
    expect(noReason!.input.errorMessage).toBe("fallback_to_full: unknown");
    const explicit = parseRunCompleteBody({
      ...INCREMENTAL_BODY,
      status: "fallback_to_full",
      errorMessage: "stream unreadable",
    });
    expect(explicit!.input.errorMessage).toBe("stream unreadable");
  });

  it("incremental failed passes through with its errorMessage", () => {
    const parsed = parseRunCompleteBody({
      ...INCREMENTAL_BODY,
      status: "failed",
      errorMessage: "boom",
    });
    expect(parsed!.input.status).toBe("failed");
    expect(parsed!.input.errorMessage).toBe("boom");
  });

  it("subscription stamp metadata is optional (older wrappers)", () => {
    const { subscriptionId: _s, reconcileRan: _r, ...withoutMeta } = INCREMENTAL_BODY;
    const parsed = parseRunCompleteBody(withoutMeta);
    expect(parsed).not.toBeNull();
    expect(parsed!.incremental).toEqual({ status: "succeeded" });
  });

  it("rejects malformed incremental bodies (bad counter, bad status, bad kind payload)", () => {
    expect(parseRunCompleteBody({ ...INCREMENTAL_BODY, created: -1 })).toBeNull();
    expect(parseRunCompleteBody({ ...INCREMENTAL_BODY, status: "running" })).toBeNull();
    expect(parseRunCompleteBody({ ...INCREMENTAL_BODY, finalCursor: "later" })).toBeNull();
    expect(parseRunCompleteBody({ ...INCREMENTAL_BODY, reconcileRan: "yes" })).toBeNull();
    // Legacy counters do NOT satisfy the incremental shape (kind wins).
    expect(parseRunCompleteBody({ ...VALID_BODY, kind: "incremental" })).toBeNull();
  });

  // NOTE: no handler-level request with this body — a valid body proceeds to
  // the DB-touching path, which this harness deliberately doesn't exercise
  // (no live PG; see the file header). The parser tests above pin exactly the
  // pre-fix failure (hard 400 before any DB access); the full path is the
  // smoke drill.
});
