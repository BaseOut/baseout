// Pure tests for the hourly Airtable webhook-renewal pass
// (server-cron-webhook-renewal). No DB, no DO — deps injected with a frozen
// `now` and stubbed Airtable fetch, per the house cron pattern
// (cron-dispatch.test.ts / oauth-refresh-sweep). Placed under
// tests/integration/** so the server test runner picks it up.

import { describe, expect, it, vi } from "vitest";
import {
  refreshAirtableWebhook,
  toggleAirtableWebhookNotifications,
} from "../../src/lib/airtable-webhook-renewal";
import {
  runWebhookRenewalPass,
  type WebhookRenewalPassDeps,
} from "../../src/lib/cron/webhook-renewal";

// ── RPC wrappers ──────────────────────────────────────────────────────────

const EXPIRATION = "2026-07-28T00:00:00.000Z";

function stubFetch(status: number, body?: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

describe("refreshAirtableWebhook", () => {
  it("POSTs the refresh endpoint with a bearer token and returns the new expiry", async () => {
    const fetchImpl = stubFetch(200, { expirationTime: EXPIRATION });
    const outcome = await refreshAirtableWebhook(
      "appBase1",
      "achWebhook1",
      "tok_secret",
      fetchImpl,
    );
    expect(outcome).toEqual({
      kind: "success",
      expiresAt: new Date(EXPIRATION),
    });
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(
      "https://api.airtable.com/v0/bases/appBase1/webhooks/achWebhook1/refresh",
    );
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer tok_secret");
  });

  it("maps 404 to not_found", async () => {
    const outcome = await refreshAirtableWebhook("app1", "ach1", "t", stubFetch(404, {}));
    expect(outcome).toEqual({ kind: "not_found" });
  });

  it.each([401, 403])("maps %i to unauthorized", async (status) => {
    const outcome = await refreshAirtableWebhook("app1", "ach1", "t", stubFetch(status, {}));
    expect(outcome).toMatchObject({ kind: "unauthorized" });
  });

  it("maps 429 to rate_limited", async () => {
    const outcome = await refreshAirtableWebhook("app1", "ach1", "t", stubFetch(429, {}));
    expect(outcome).toMatchObject({ kind: "rate_limited" });
  });

  it("maps 5xx to transient", async () => {
    const outcome = await refreshAirtableWebhook("app1", "ach1", "t", stubFetch(503, {}));
    expect(outcome).toMatchObject({ kind: "transient", reason: "http_503" });
  });

  it("maps a network error to transient", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("socket hang up");
    }) as unknown as typeof fetch;
    const outcome = await refreshAirtableWebhook("app1", "ach1", "t", fetchImpl);
    expect(outcome).toMatchObject({ kind: "transient" });
  });

  it("a 200 without a parseable expirationTime still succeeds with expiresAt null", async () => {
    const outcome = await refreshAirtableWebhook("app1", "ach1", "t", stubFetch(200, {}));
    expect(outcome).toEqual({ kind: "success", expiresAt: null });
  });
});

describe("toggleAirtableWebhookNotifications", () => {
  it("POSTs enableNotifications with {enable} and maps 200 to success", async () => {
    const fetchImpl = stubFetch(200, {});
    const outcome = await toggleAirtableWebhookNotifications(
      "appBase1",
      "achWebhook1",
      true,
      "tok_secret",
      fetchImpl,
    );
    expect(outcome).toEqual({ kind: "success" });
    const [url, init] = (fetchImpl as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe(
      "https://api.airtable.com/v0/bases/appBase1/webhooks/achWebhook1/enableNotifications",
    );
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer tok_secret");
    expect(JSON.parse(init.body)).toEqual({ enable: true });
  });

  it("maps 404 / 401 / 429 / 5xx like the refresh wrapper", async () => {
    expect(
      await toggleAirtableWebhookNotifications("a", "w", true, "t", stubFetch(404, {})),
    ).toEqual({ kind: "not_found" });
    expect(
      await toggleAirtableWebhookNotifications("a", "w", true, "t", stubFetch(401, {})),
    ).toMatchObject({ kind: "unauthorized" });
    expect(
      await toggleAirtableWebhookNotifications("a", "w", true, "t", stubFetch(429, {})),
    ).toMatchObject({ kind: "rate_limited" });
    expect(
      await toggleAirtableWebhookNotifications("a", "w", true, "t", stubFetch(500, {})),
    ).toMatchObject({ kind: "transient", reason: "http_500" });
  });
});

// ── Renewal pass orchestration ────────────────────────────────────────────

const NOW = new Date("2026-07-21T12:00:00.000Z");
const NEW_EXPIRY = new Date("2026-07-28T12:00:00.000Z");

const EXPIRING_ROW = {
  id: "wh1",
  connectionId: "conn1",
  baseId: "appBase1",
  airtableWebhookId: "achWebhook1",
};
const DISABLED_ROW = {
  id: "wh2",
  connectionId: "conn2",
  baseId: "appBase2",
  airtableWebhookId: "achWebhook2",
};

function makeDeps(over: Partial<WebhookRenewalPassDeps> = {}): WebhookRenewalPassDeps & {
  log: ReturnType<typeof vi.fn>;
  persistRenewal: ReturnType<typeof vi.fn>;
  persistStatus: ReturnType<typeof vi.fn>;
  refresh: ReturnType<typeof vi.fn>;
  toggle: ReturnType<typeof vi.fn>;
} {
  return {
    listExpiring: vi.fn(async () => []),
    listNotificationsDisabled: vi.fn(async () => []),
    getConnectionToken: vi.fn(async () => "tok_ok"),
    refresh: vi.fn(async () => ({ kind: "success", expiresAt: NEW_EXPIRY }) as const),
    toggle: vi.fn(async () => ({ kind: "success" }) as const),
    persistRenewal: vi.fn(async () => {}),
    persistStatus: vi.fn(async () => {}),
    log: vi.fn(),
    now: () => NOW,
    ...over,
  } as never;
}

describe("runWebhookRenewalPass", () => {
  it("refreshes an expiring active webhook and persists expiry + last_renewed_at", async () => {
    const deps = makeDeps({ listExpiring: vi.fn(async () => [EXPIRING_ROW]) });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toEqual({
      scanned: 1,
      refreshed: 1,
      reenabled: 0,
      pendingReauth: 0,
      transientFailures: 0,
    });
    expect(deps.refresh).toHaveBeenCalledWith("appBase1", "achWebhook1", "tok_ok");
    expect(deps.persistRenewal).toHaveBeenCalledWith("wh1", NEW_EXPIRY, NOW);
    expect(deps.persistStatus).not.toHaveBeenCalled();
  });

  it("re-enables a notifications_disabled webhook back to active", async () => {
    const deps = makeDeps({
      listNotificationsDisabled: vi.fn(async () => [DISABLED_ROW]),
    });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toMatchObject({ scanned: 1, reenabled: 1, refreshed: 0 });
    expect(deps.toggle).toHaveBeenCalledWith("appBase2", "achWebhook2", true, "tok_ok");
    expect(deps.persistStatus).toHaveBeenCalledWith("wh2", "active");
  });

  it("404 from refresh marks the row pending_reauth (no renewal persisted)", async () => {
    const deps = makeDeps({
      listExpiring: vi.fn(async () => [EXPIRING_ROW]),
      refresh: vi.fn(async () => ({ kind: "not_found" }) as const),
    });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toMatchObject({ scanned: 1, pendingReauth: 1, refreshed: 0 });
    expect(deps.persistStatus).toHaveBeenCalledWith("wh1", "pending_reauth");
    expect(deps.persistRenewal).not.toHaveBeenCalled();
  });

  it("401/403 from refresh marks the row pending_reauth", async () => {
    const deps = makeDeps({
      listExpiring: vi.fn(async () => [EXPIRING_ROW]),
      refresh: vi.fn(async () => ({ kind: "unauthorized", reason: "http_401" }) as const),
    });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toMatchObject({ scanned: 1, pendingReauth: 1 });
    expect(deps.persistStatus).toHaveBeenCalledWith("wh1", "pending_reauth");
  });

  it("transient refresh failure leaves the row unchanged and logs the event", async () => {
    const deps = makeDeps({
      listExpiring: vi.fn(async () => [EXPIRING_ROW]),
      refresh: vi.fn(async () => ({ kind: "transient", reason: "http_503" }) as const),
    });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toMatchObject({ scanned: 1, transientFailures: 1, pendingReauth: 0 });
    expect(deps.persistStatus).not.toHaveBeenCalled();
    expect(deps.persistRenewal).not.toHaveBeenCalled();
    expect(
      deps.log.mock.calls.some(
        ([e]: [Record<string, unknown>]) => e.event === "webhook_renewal_failed_transient",
      ),
    ).toBe(true);
  });

  it("transient toggle failure keeps the row notifications_disabled for the next pass", async () => {
    const deps = makeDeps({
      listNotificationsDisabled: vi.fn(async () => [DISABLED_ROW]),
      toggle: vi.fn(async () => ({ kind: "transient", reason: "http_500" }) as const),
    });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toMatchObject({ scanned: 1, reenabled: 0, transientFailures: 1 });
    expect(deps.persistStatus).not.toHaveBeenCalled();
  });

  it("an unavailable connection token counts as transient (row unchanged, retried next pass)", async () => {
    const deps = makeDeps({
      listExpiring: vi.fn(async () => [EXPIRING_ROW]),
      getConnectionToken: vi.fn(async () => null),
    });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toMatchObject({ scanned: 1, transientFailures: 1 });
    expect(deps.refresh).not.toHaveBeenCalled();
    expect(deps.persistStatus).not.toHaveBeenCalled();
  });

  it("a throwing dep counts as transient and never aborts the pass", async () => {
    const deps = makeDeps({
      listExpiring: vi.fn(async () => [
        { ...EXPIRING_ROW, id: "boom" },
        EXPIRING_ROW,
      ]),
      refresh: vi
        .fn()
        .mockRejectedValueOnce(new Error("exploded"))
        .mockResolvedValueOnce({ kind: "success", expiresAt: NEW_EXPIRY }),
    });
    const result = await runWebhookRenewalPass(deps);
    expect(result).toMatchObject({ scanned: 2, refreshed: 1, transientFailures: 1 });
  });

  it("no eligible rows → no-op with the no-eligible-rows event, Airtable never contacted", async () => {
    const deps = makeDeps();
    const result = await runWebhookRenewalPass(deps);
    expect(result).toEqual({
      scanned: 0,
      refreshed: 0,
      reenabled: 0,
      pendingReauth: 0,
      transientFailures: 0,
    });
    expect(deps.refresh).not.toHaveBeenCalled();
    expect(deps.toggle).not.toHaveBeenCalled();
    expect(
      deps.log.mock.calls.some(
        ([e]: [Record<string, unknown>]) => e.event === "webhook_renewal_no_eligible_rows",
      ),
    ).toBe(true);
  });
});
