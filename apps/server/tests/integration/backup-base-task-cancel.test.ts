// Cancel-during-task test (Phase 8.cancel A.2.5).
//
// Trigger.dev v3 cancels a running task by injecting an AbortError (or
// equivalent throw) at the next await point. The pure runBackupBase
// function awaits at many points; we simulate cancellation by throwing
// from inside the airtableClient at a chosen await boundary and assert
// the `finally` block in runBackupBase still fires the unlock POST.
//
// This is the contract the engine's cancel route depends on: when
// `runs.cancel(triggerRunId)` returns and the task aborts mid-flight,
// the ConnectionDO lock must still be released so the next run for that
// connection can acquire it. Otherwise the cancel route's "flip to
// cancelled" hides a stuck lock that only the DO's 60s alarm would
// recover.

import { describe, expect, it, vi } from "vitest";
import { runBackupBase } from "../../trigger/tasks/backup-base";
import type {
  AirtableSchema,
  AirtableRecordsPage,
} from "../../trigger/tasks/_lib/airtable-client";

const ENGINE = "https://engine.example.com";
const TOKEN = "internal-token";

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function makeFetchMock(): {
  fetchMock: typeof fetch;
  calls: CapturedCall[];
} {
  const calls: CapturedCall[] = [];
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      calls.push({ url, init: init ?? {} });

      if (url.endsWith("/lock")) {
        return new Response(JSON.stringify({ acquired: true }), { status: 200 });
      }
      if (url.endsWith("/unlock")) {
        return new Response(JSON.stringify({ released: true }), { status: 200 });
      }
      if (url.endsWith("/token")) {
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        return new Response(
          JSON.stringify({ accessToken: `plaintext-${body.encryptedToken}` }),
          { status: 200 },
        );
      }
      if (url.includes("/upload-csv")) {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ error: "unexpected_url" }), {
        status: 500,
      });
    },
  );
  return { fetchMock: fetchMock as unknown as typeof fetch, calls };
}

const BASE_INPUT = {
  runId: "run-1",
  connectionId: "conn-1",
  atBaseId: "appXYZ",
  isTrial: false,
  encryptedToken: "cipher-A",
  orgSlug: "acme",
  spaceName: "MySpace",
  baseName: "ProjectsDB",
  runStartedAt: new Date("2026-05-12T12:00:00Z"),
};

const SCHEMA: AirtableSchema = {
  tables: [
    {
      id: "tbl1",
      name: "Tasks",
      primaryFieldId: "fld1",
      fields: [{ id: "fld1", name: "Name", type: "singleLineText" }],
    },
  ],
};

const FIRST_PAGE: AirtableRecordsPage = {
  records: [{ id: "rec1", createdTime: "2026-05-12", fields: { Name: "foo" } }],
};

describe("runBackupBase — cancellation mid-flight (Trigger.dev abort injection)", () => {
  it("releases the ConnectionDO lock via finally when the runner throws mid-loop", async () => {
    const { fetchMock, calls } = makeFetchMock();
    let listRecordsCalls = 0;
    const client = {
      listBases: vi.fn(),
      getBaseSchema: vi.fn(async () => SCHEMA),
      // First page returns normally; the second is where Trigger.dev's
      // cancellation injection would land in real life. Throwing here
      // mirrors the wire behaviour the wrapper's outer try/catch turns
      // into a structured failure.
      listRecords: vi.fn(async () => {
        listRecordsCalls += 1;
        if (listRecordsCalls === 1) {
          // Force a second page so the loop continues into the abort point.
          return { records: FIRST_PAGE.records, offset: "page-2" };
        }
        const abort = new Error("AbortError: cancelled");
        abort.name = "AbortError";
        throw abort;
      }),
    };

    // The outer wrapper's try/catch is the producer of the
    // status='failed' result; runBackupBase itself does NOT swallow the
    // throw — it lets the finally unlock fire and re-throws. Mirror the
    // wrapper's catch here so we can assert both invariants.
    let captured: unknown = null;
    try {
      await runBackupBase(BASE_INPUT, {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
      });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).name).toBe("AbortError");

    // The unlock POST must fire even though the task threw mid-loop —
    // this is the contract the cancel route relies on.
    const unlockCalls = calls.filter((c) => c.url.endsWith("/unlock"));
    expect(unlockCalls.length).toBe(1);

    // Lock acquired before unlock: positional invariant.
    const lockIdx = calls.findIndex((c) => c.url.endsWith("/lock"));
    const unlockIdx = calls.findIndex((c) => c.url.endsWith("/unlock"));
    expect(lockIdx).toBeGreaterThanOrEqual(0);
    expect(unlockIdx).toBeGreaterThan(lockIdx);
  });

  it("swallows a thrown unlock so the abort error still propagates", async () => {
    // The finally tries unlock + catches its own transport error. The
    // original abort is the one that bubbles out of runBackupBase.
    const calls: CapturedCall[] = [];
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.href
              : input.url;
        calls.push({ url, init: init ?? {} });

        if (url.endsWith("/lock")) {
          return new Response(JSON.stringify({ acquired: true }), {
            status: 200,
          });
        }
        if (url.endsWith("/unlock")) {
          throw new Error("network");
        }
        if (url.endsWith("/token")) {
          return new Response(
            JSON.stringify({ accessToken: "plaintext-cipher-A" }),
            { status: 200 },
          );
        }
        return new Response("nope", { status: 500 });
      },
    ) as unknown as typeof fetch;

    const client = {
      listBases: vi.fn(),
      getBaseSchema: vi.fn(async () => SCHEMA),
      listRecords: vi.fn(async () => {
        const abort = new Error("AbortError: cancelled");
        abort.name = "AbortError";
        throw abort;
      }),
    };

    let captured: unknown = null;
    try {
      await runBackupBase(BASE_INPUT, {
        engineUrl: ENGINE,
        internalToken: TOKEN,
        fetchImpl: fetchMock,
        airtableClient: client,
        sleepImpl: async () => undefined,
      });
    } catch (err) {
      captured = err;
    }

    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).name).toBe("AbortError");

    // unlock was attempted (and threw); the run still surfaces the abort.
    const unlockAttempts = calls.filter((c) => c.url.endsWith("/unlock"));
    expect(unlockAttempts.length).toBe(1);
  });
});
