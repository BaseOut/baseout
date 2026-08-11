// Webhook lifecycle orchestration (server-instant-webhook Phase E) — PURE,
// deps injected, following the runWebhookRenewalPass / processRunStart house
// pattern. Route handlers in pages/api/internal/spaces/{register,unregister}-
// webhooks.ts wire the production DB/Airtable/crypto deps.
//
// Register (find-or-create per included base):
//   - active-ish (status != 'inactive') (org, base) row → subscription INSERT
//     only; NO Airtable call (webhooks are org-level, Airtable caps 2 per
//     base per OAuth integration).
//   - inactive row → the UNIQUE (organization_id, base_id) slot is occupied
//     by a dead registration: drop it (its subscriptions are gone by
//     definition — 'inactive' is set on last-unsubscribe) and create fresh.
//   - no row → pre-generate the row uuid, embed it in the notificationUrl,
//     Airtable-create, encrypt + INSERT the row FIRST (the MAC secret is
//     returned only at creation), then subscribe. If the row INSERT fails
//     after a successful create, compensate with an Airtable DELETE rather
//     than leaking an unverifiable orphan.
//
// Unregister: delete the Space's subscriptions; when a webhook's LAST
// subscription goes, delete it at Airtable and set status='inactive' (row
// retained for audit; the hooks receiver 410s its pings). Deactivation
// proceeds even when the Airtable delete can't run (dead token) — an orphan
// webhook's pings are harmless and cleanup is operational.

import type {
  AirtableWebhookCreateOutcome,
  AirtableWebhookDeleteOutcome,
} from "./airtable-webhook-api";

/** Public receiver base (change `hooks`) — the row uuid is the path token. */
export const NOTIFICATION_URL_BASE =
  "https://hooks.baseout.com/webhooks/airtable/";

export interface WebhookRegistryRowLike {
  id: string;
  status: string;
  airtableWebhookId: string;
  connectionId: string;
}

export interface RegisterWebhooksDeps {
  fetchSpace: (
    spaceId: string,
  ) => Promise<{ id: string; organizationId: string } | null>;
  fetchConfigId: (spaceId: string) => Promise<string | null>;
  fetchIncludedBases: (configId: string) => Promise<Array<{ atBaseId: string }>>;
  /** The org's active Airtable Connection — its token creates webhooks. */
  fetchActiveConnection: (
    organizationId: string,
  ) => Promise<{ id: string } | null>;
  /** Any-status (org, base) registry row — the UNIQUE slot holder. */
  findWebhook: (
    organizationId: string,
    baseId: string,
  ) => Promise<WebhookRegistryRowLike | null>;
  deleteWebhookRow: (webhookRowId: string) => Promise<void>;
  /** Valid access token via the ConnectionDO /token gate; null = unavailable. */
  getConnectionToken: (connectionId: string) => Promise<string | null>;
  createWebhook: (
    baseId: string,
    notificationUrl: string,
    accessToken: string,
  ) => Promise<AirtableWebhookCreateOutcome>;
  /** Compensating delete when the row INSERT fails after a create. */
  deleteWebhook: (
    baseId: string,
    airtableWebhookId: string,
    accessToken: string,
  ) => Promise<AirtableWebhookDeleteOutcome>;
  /** AES-256-GCM via lib/crypto.ts + env.BASEOUT_ENCRYPTION_KEY. */
  encryptSecret: (plaintext: string) => Promise<string>;
  insertWebhookRow: (row: {
    id: string;
    organizationId: string;
    connectionId: string;
    baseId: string;
    airtableWebhookId: string;
    macSecretBase64Enc: string;
    expiresAt: Date | null;
  }) => Promise<void>;
  /** ON CONFLICT (webhook_id, space_id) DO NOTHING — idempotent re-enable. */
  insertSubscription: (webhookId: string, spaceId: string) => Promise<void>;
  generateWebhookId: () => string;
  log: (event: Record<string, unknown>) => void;
}

export type RegisterBaseOutcome = "reused" | "created" | "recreated";

export type RegisterWebhooksResult =
  | { ok: true; results: Array<{ baseId: string; outcome: RegisterBaseOutcome }> }
  | {
      ok: false;
      error:
        | "space_not_found"
        | "config_not_found"
        | "no_bases_selected"
        | "no_active_connection"
        | "token_unavailable"
        | "airtable_webhook_cap_reached"
        | "airtable_error"
        | "registry_insert_failed";
      baseId?: string;
    };

export async function registerWebhooksForSpace(
  input: { spaceId: string },
  deps: RegisterWebhooksDeps,
): Promise<RegisterWebhooksResult> {
  const space = await deps.fetchSpace(input.spaceId);
  if (!space) return { ok: false, error: "space_not_found" };

  const configId = await deps.fetchConfigId(input.spaceId);
  if (!configId) return { ok: false, error: "config_not_found" };

  const bases = await deps.fetchIncludedBases(configId);
  if (bases.length === 0) return { ok: false, error: "no_bases_selected" };

  const connection = await deps.fetchActiveConnection(space.organizationId);
  if (!connection) return { ok: false, error: "no_active_connection" };

  // The token is only needed when a base actually requires an Airtable
  // create — resolved lazily so pure-reuse passes work with a dead token.
  let token: string | null | undefined;

  const results: Array<{ baseId: string; outcome: RegisterBaseOutcome }> = [];
  for (const base of bases) {
    const baseId = base.atBaseId;
    const existing = await deps.findWebhook(space.organizationId, baseId);

    if (existing && existing.status !== "inactive") {
      await deps.insertSubscription(existing.id, input.spaceId);
      results.push({ baseId, outcome: "reused" });
      continue;
    }

    if (token === undefined) {
      token = await deps.getConnectionToken(connection.id);
    }
    if (token == null) {
      return { ok: false, error: "token_unavailable", baseId };
    }

    // An inactive row still holds the UNIQUE (org, base) slot — free it. Its
    // subscriptions are gone (inactive is set on last-unsubscribe), so the
    // delete cascades nothing meaningful.
    if (existing) {
      await deps.deleteWebhookRow(existing.id);
    }

    const rowId = deps.generateWebhookId();
    const created = await deps.createWebhook(
      baseId,
      `${NOTIFICATION_URL_BASE}${rowId}`,
      token,
    );
    if (created.kind === "cap_reached") {
      return { ok: false, error: "airtable_webhook_cap_reached", baseId };
    }
    if (created.kind !== "success") {
      deps.log({
        event: "webhook_register_create_failed",
        baseId,
        outcome: created.kind,
        reason: "reason" in created ? created.reason : undefined,
      });
      return { ok: false, error: "airtable_error", baseId };
    }

    // Persist the row — encrypted secret first — before ANYTHING else can
    // fail. The MAC secret is unrecoverable after this response.
    const macSecretBase64Enc = await deps.encryptSecret(created.macSecretBase64);
    try {
      await deps.insertWebhookRow({
        id: rowId,
        organizationId: space.organizationId,
        connectionId: connection.id,
        baseId,
        airtableWebhookId: created.airtableWebhookId,
        macSecretBase64Enc,
        expiresAt: created.expiresAt,
      });
    } catch (err) {
      // Compensating action: never leak an Airtable webhook we can't verify.
      const compensated = await deps.deleteWebhook(
        baseId,
        created.airtableWebhookId,
        token,
      );
      deps.log({
        event: "webhook_register_insert_failed",
        baseId,
        airtableWebhookId: created.airtableWebhookId,
        compensatingDelete: compensated.kind,
        reason: err instanceof Error ? err.message : String(err),
      });
      return { ok: false, error: "registry_insert_failed", baseId };
    }

    await deps.insertSubscription(rowId, input.spaceId);
    results.push({ baseId, outcome: existing ? "recreated" : "created" });
  }

  return { ok: true, results };
}

export interface SpaceSubscriptionRowLike {
  subscriptionId: string;
  webhookId: string;
  baseId: string;
  airtableWebhookId: string;
  connectionId: string;
}

export interface UnregisterWebhooksDeps {
  /** The Space's subscriptions joined to their webhook rows. */
  listSpaceSubscriptions: (
    spaceId: string,
  ) => Promise<SpaceSubscriptionRowLike[]>;
  deleteSubscription: (subscriptionId: string) => Promise<void>;
  /** Remaining subscriptions for a webhook AFTER this Space's delete. */
  countSubscriptions: (webhookId: string) => Promise<number>;
  getConnectionToken: (connectionId: string) => Promise<string | null>;
  deleteWebhook: (
    baseId: string,
    airtableWebhookId: string,
    accessToken: string,
  ) => Promise<AirtableWebhookDeleteOutcome>;
  markWebhookInactive: (webhookRowId: string) => Promise<void>;
  log: (event: Record<string, unknown>) => void;
}

export interface UnregisterWebhooksResult {
  ok: true;
  removedSubscriptions: number;
  deactivatedWebhooks: number;
}

export async function unregisterWebhooksForSpace(
  input: { spaceId: string },
  deps: UnregisterWebhooksDeps,
): Promise<UnregisterWebhooksResult> {
  const subscriptions = await deps.listSpaceSubscriptions(input.spaceId);

  let removedSubscriptions = 0;
  let deactivatedWebhooks = 0;

  for (const sub of subscriptions) {
    await deps.deleteSubscription(sub.subscriptionId);
    removedSubscriptions += 1;

    const remaining = await deps.countSubscriptions(sub.webhookId);
    if (remaining > 0) continue;

    // Last subscription gone → tear down at Airtable + deactivate the row.
    // Deactivation happens even when the delete can't run/fails — an orphan
    // webhook keeps pinging hooks (which 410s inactive rows); harmless, and
    // the row's status makes the state visible for operational cleanup.
    const token = await deps.getConnectionToken(sub.connectionId);
    if (token != null) {
      const outcome = await deps.deleteWebhook(
        sub.baseId,
        sub.airtableWebhookId,
        token,
      );
      if (outcome.kind !== "success" && outcome.kind !== "not_found") {
        deps.log({
          event: "webhook_unregister_delete_failed",
          webhookId: sub.webhookId,
          baseId: sub.baseId,
          outcome: outcome.kind,
        });
      }
    } else {
      deps.log({
        event: "webhook_unregister_token_unavailable",
        webhookId: sub.webhookId,
        baseId: sub.baseId,
      });
    }
    await deps.markWebhookInactive(sub.webhookId);
    deactivatedWebhooks += 1;
  }

  return { ok: true, removedSubscriptions, deactivatedWebhooks };
}
