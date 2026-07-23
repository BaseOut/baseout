// Webhook lifecycle orchestration — PURE, deps injected
// (server-instant-webhook Phase E).
//
// registerWebhooksForSpace: find-or-create per included base — reuse an
// active (org, base) row, recreate over an inactive one, else Airtable-create
// with the pre-generated row uuid in the notificationUrl; encrypt + persist
// the MAC secret immediately; compensating Airtable DELETE if the row INSERT
// fails; cap error mapped without partial state.
// unregisterWebhooksForSpace: drop the Space's subscriptions; Airtable DELETE
// + status='inactive' when the last subscription goes.

import { describe, expect, it, vi } from "vitest";
import {
  NOTIFICATION_URL_BASE,
  registerWebhooksForSpace,
  unregisterWebhooksForSpace,
  type RegisterWebhooksDeps,
  type UnregisterWebhooksDeps,
} from "../../../src/lib/webhooks/lifecycle";

const SPACE_ID = "11111111-1111-1111-1111-111111111111";
const ORG_ID = "22222222-2222-2222-2222-222222222222";
const CONFIG_ID = "33333333-3333-3333-3333-333333333333";
const CONN_ID = "44444444-4444-4444-4444-444444444444";
const ROW_ID = "55555555-5555-5555-5555-555555555555";
const NEW_ID = "66666666-6666-6666-6666-666666666666";
const SUB_ID = "77777777-7777-7777-7777-777777777777";
const BASE_A = "appAAAAAAAAAAAAAA";
const AT_WEBHOOK_ID = "achAAAAAAAAAAAAAA";
const EXPIRES = new Date("2030-01-22T14:23:00.000Z");

function registerDeps(
  overrides: Partial<RegisterWebhooksDeps> = {},
): RegisterWebhooksDeps {
  return {
    fetchSpace: vi.fn(async () => ({ id: SPACE_ID, organizationId: ORG_ID })),
    fetchConfigId: vi.fn(async () => CONFIG_ID),
    fetchIncludedBases: vi.fn(async () => [{ atBaseId: BASE_A }]),
    fetchActiveConnection: vi.fn(async () => ({ id: CONN_ID })),
    findWebhook: vi.fn(async () => null),
    deleteWebhookRow: vi.fn(async () => undefined),
    getConnectionToken: vi.fn(async () => "oaat-token"),
    createWebhook: vi.fn(async () => ({
      kind: "success" as const,
      airtableWebhookId: AT_WEBHOOK_ID,
      macSecretBase64: "c2VjcmV0",
      expiresAt: EXPIRES,
    })),
    deleteWebhook: vi.fn(async () => ({ kind: "success" as const })),
    encryptSecret: vi.fn(async (plain: string) => `enc(${plain})`),
    insertWebhookRow: vi.fn(async () => undefined),
    insertSubscription: vi.fn(async () => undefined),
    generateWebhookId: vi.fn(() => NEW_ID),
    log: vi.fn(),
    ...overrides,
  };
}

describe("registerWebhooksForSpace — find-or-create", () => {
  it("creates a webhook with the pre-generated uuid URL, persists secret-first, then subscribes", async () => {
    const deps = registerDeps();
    const result = await registerWebhooksForSpace({ spaceId: SPACE_ID }, deps);

    expect(result).toEqual({
      ok: true,
      results: [{ baseId: BASE_A, outcome: "created" }],
    });
    expect(deps.createWebhook).toHaveBeenCalledWith(
      BASE_A,
      `${NOTIFICATION_URL_BASE}${NEW_ID}`,
      "oaat-token",
    );
    expect(deps.encryptSecret).toHaveBeenCalledWith("c2VjcmV0");
    expect(deps.insertWebhookRow).toHaveBeenCalledWith({
      id: NEW_ID,
      organizationId: ORG_ID,
      connectionId: CONN_ID,
      baseId: BASE_A,
      airtableWebhookId: AT_WEBHOOK_ID,
      macSecretBase64Enc: "enc(c2VjcmV0)",
      expiresAt: EXPIRES,
    });
    expect(deps.insertSubscription).toHaveBeenCalledWith(NEW_ID, SPACE_ID);
    // Row persisted before the subscription (secret is unrecoverable later).
    const rowOrder = (deps.insertWebhookRow as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0]!;
    const subOrder = (deps.insertSubscription as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0]!;
    expect(rowOrder).toBeLessThan(subOrder);
  });

  it("reuses an active (org, base) row — no Airtable call, subscription only", async () => {
    const deps = registerDeps({
      findWebhook: vi.fn(async () => ({
        id: ROW_ID,
        status: "active",
        airtableWebhookId: AT_WEBHOOK_ID,
        connectionId: CONN_ID,
      })),
    });
    const result = await registerWebhooksForSpace({ spaceId: SPACE_ID }, deps);

    expect(result).toEqual({
      ok: true,
      results: [{ baseId: BASE_A, outcome: "reused" }],
    });
    expect(deps.createWebhook).not.toHaveBeenCalled();
    expect(deps.insertWebhookRow).not.toHaveBeenCalled();
    expect(deps.insertSubscription).toHaveBeenCalledWith(ROW_ID, SPACE_ID);
  });

  it("reuses a pending_reauth row too (status != inactive)", async () => {
    const deps = registerDeps({
      findWebhook: vi.fn(async () => ({
        id: ROW_ID,
        status: "pending_reauth",
        airtableWebhookId: AT_WEBHOOK_ID,
        connectionId: CONN_ID,
      })),
    });
    const result = await registerWebhooksForSpace({ spaceId: SPACE_ID }, deps);
    expect(result).toEqual({
      ok: true,
      results: [{ baseId: BASE_A, outcome: "reused" }],
    });
    expect(deps.createWebhook).not.toHaveBeenCalled();
  });

  it("recreates over an inactive row: drops the old row, creates fresh", async () => {
    const deps = registerDeps({
      findWebhook: vi.fn(async () => ({
        id: ROW_ID,
        status: "inactive",
        airtableWebhookId: "achOLD",
        connectionId: CONN_ID,
      })),
    });
    const result = await registerWebhooksForSpace({ spaceId: SPACE_ID }, deps);

    expect(result).toEqual({
      ok: true,
      results: [{ baseId: BASE_A, outcome: "recreated" }],
    });
    expect(deps.deleteWebhookRow).toHaveBeenCalledWith(ROW_ID);
    expect(deps.createWebhook).toHaveBeenCalledOnce();
    expect(deps.insertSubscription).toHaveBeenCalledWith(NEW_ID, SPACE_ID);
  });

  it("maps the Airtable cap error and leaves no partial registry state", async () => {
    const deps = registerDeps({
      createWebhook: vi.fn(async () => ({ kind: "cap_reached" as const })),
    });
    const result = await registerWebhooksForSpace({ spaceId: SPACE_ID }, deps);

    expect(result).toEqual({
      ok: false,
      error: "airtable_webhook_cap_reached",
      baseId: BASE_A,
    });
    expect(deps.insertWebhookRow).not.toHaveBeenCalled();
    expect(deps.insertSubscription).not.toHaveBeenCalled();
  });

  it("compensates with an Airtable DELETE when the row INSERT fails after create", async () => {
    const deps = registerDeps({
      insertWebhookRow: vi.fn(async () => {
        throw new Error("unique_violation");
      }),
    });
    const result = await registerWebhooksForSpace({ spaceId: SPACE_ID }, deps);

    expect(result).toEqual({
      ok: false,
      error: "registry_insert_failed",
      baseId: BASE_A,
    });
    expect(deps.deleteWebhook).toHaveBeenCalledWith(
      BASE_A,
      AT_WEBHOOK_ID,
      "oaat-token",
    );
    expect(deps.insertSubscription).not.toHaveBeenCalled();
  });

  it("registers every included base (second Space reuse rides findWebhook)", async () => {
    const BASE_B = "appBBBBBBBBBBBBBB";
    const deps = registerDeps({
      fetchIncludedBases: vi.fn(async () => [
        { atBaseId: BASE_A },
        { atBaseId: BASE_B },
      ]),
      findWebhook: vi.fn(async (_org: string, baseId: string) =>
        baseId === BASE_A
          ? {
              id: ROW_ID,
              status: "active",
              airtableWebhookId: AT_WEBHOOK_ID,
              connectionId: CONN_ID,
            }
          : null,
      ),
    });
    const result = await registerWebhooksForSpace({ spaceId: SPACE_ID }, deps);
    expect(result).toEqual({
      ok: true,
      results: [
        { baseId: BASE_A, outcome: "reused" },
        { baseId: BASE_B, outcome: "created" },
      ],
    });
    expect(deps.createWebhook).toHaveBeenCalledOnce();
  });

  it("fails preconditions cleanly: space / config / bases / connection / token", async () => {
    expect(
      await registerWebhooksForSpace(
        { spaceId: SPACE_ID },
        registerDeps({ fetchSpace: vi.fn(async () => null) }),
      ),
    ).toEqual({ ok: false, error: "space_not_found" });

    expect(
      await registerWebhooksForSpace(
        { spaceId: SPACE_ID },
        registerDeps({ fetchConfigId: vi.fn(async () => null) }),
      ),
    ).toEqual({ ok: false, error: "config_not_found" });

    expect(
      await registerWebhooksForSpace(
        { spaceId: SPACE_ID },
        registerDeps({ fetchIncludedBases: vi.fn(async () => []) }),
      ),
    ).toEqual({ ok: false, error: "no_bases_selected" });

    expect(
      await registerWebhooksForSpace(
        { spaceId: SPACE_ID },
        registerDeps({ fetchActiveConnection: vi.fn(async () => null) }),
      ),
    ).toEqual({ ok: false, error: "no_active_connection" });

    const tokenless = registerDeps({
      getConnectionToken: vi.fn(async () => null),
    });
    expect(await registerWebhooksForSpace({ spaceId: SPACE_ID }, tokenless)).toEqual(
      { ok: false, error: "token_unavailable", baseId: BASE_A },
    );
    // Reuse must not need a token at all.
    const reuse = registerDeps({
      getConnectionToken: vi.fn(async () => null),
      findWebhook: vi.fn(async () => ({
        id: ROW_ID,
        status: "active",
        airtableWebhookId: AT_WEBHOOK_ID,
        connectionId: CONN_ID,
      })),
    });
    expect(await registerWebhooksForSpace({ spaceId: SPACE_ID }, reuse)).toEqual({
      ok: true,
      results: [{ baseId: BASE_A, outcome: "reused" }],
    });
  });
});

function unregisterDeps(
  overrides: Partial<UnregisterWebhooksDeps> = {},
): UnregisterWebhooksDeps {
  return {
    listSpaceSubscriptions: vi.fn(async () => [
      {
        subscriptionId: SUB_ID,
        webhookId: ROW_ID,
        baseId: BASE_A,
        airtableWebhookId: AT_WEBHOOK_ID,
        connectionId: CONN_ID,
      },
    ]),
    deleteSubscription: vi.fn(async () => undefined),
    countSubscriptions: vi.fn(async () => 0),
    getConnectionToken: vi.fn(async () => "oaat-token"),
    deleteWebhook: vi.fn(async () => ({ kind: "success" as const })),
    markWebhookInactive: vi.fn(async () => undefined),
    log: vi.fn(),
    ...overrides,
  };
}

describe("unregisterWebhooksForSpace", () => {
  it("last unsubscribe deletes the Airtable webhook and deactivates the row", async () => {
    const deps = unregisterDeps();
    const result = await unregisterWebhooksForSpace({ spaceId: SPACE_ID }, deps);

    expect(result).toEqual({
      ok: true,
      removedSubscriptions: 1,
      deactivatedWebhooks: 1,
    });
    expect(deps.deleteSubscription).toHaveBeenCalledWith(SUB_ID);
    expect(deps.deleteWebhook).toHaveBeenCalledWith(
      BASE_A,
      AT_WEBHOOK_ID,
      "oaat-token",
    );
    expect(deps.markWebhookInactive).toHaveBeenCalledWith(ROW_ID);
  });

  it("keeps the webhook alive while other Spaces still subscribe", async () => {
    const deps = unregisterDeps({ countSubscriptions: vi.fn(async () => 1) });
    const result = await unregisterWebhooksForSpace({ spaceId: SPACE_ID }, deps);

    expect(result).toEqual({
      ok: true,
      removedSubscriptions: 1,
      deactivatedWebhooks: 0,
    });
    expect(deps.deleteWebhook).not.toHaveBeenCalled();
    expect(deps.markWebhookInactive).not.toHaveBeenCalled();
  });

  it("still deactivates when the Airtable webhook is already gone (404)", async () => {
    const deps = unregisterDeps({
      deleteWebhook: vi.fn(async () => ({ kind: "not_found" as const })),
    });
    const result = await unregisterWebhooksForSpace({ spaceId: SPACE_ID }, deps);
    expect(result.deactivatedWebhooks).toBe(1);
    expect(deps.markWebhookInactive).toHaveBeenCalledWith(ROW_ID);
  });

  it("deactivates even when no token is available (orphan pings 410 at hooks)", async () => {
    const deps = unregisterDeps({
      getConnectionToken: vi.fn(async () => null),
    });
    const result = await unregisterWebhooksForSpace({ spaceId: SPACE_ID }, deps);
    expect(deps.deleteWebhook).not.toHaveBeenCalled();
    expect(deps.markWebhookInactive).toHaveBeenCalledWith(ROW_ID);
    expect(result.deactivatedWebhooks).toBe(1);
  });

  it("no subscriptions → clean no-op", async () => {
    const deps = unregisterDeps({
      listSpaceSubscriptions: vi.fn(async () => []),
    });
    const result = await unregisterWebhooksForSpace({ spaceId: SPACE_ID }, deps);
    expect(result).toEqual({
      ok: true,
      removedSubscriptions: 0,
      deactivatedWebhooks: 0,
    });
  });
});
