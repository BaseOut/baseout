// Hourly Airtable webhook-renewal pass — PURE orchestration, deps injected
// (server-cron-webhook-renewal), following the runOauthRefreshSweep pattern.
//
// Two lanes per pass:
//   1. status='active' rows expiring within 24h → refresh RPC → persist the
//      returned expires_at + last_renewed_at.
//   2. status='notifications_disabled' rows (Airtable muted pings after
//      ~13 failed retries) → toggle-notifications(enable) → back to 'active'.
//      No catch-up machinery: payload generation continued while muted; the
//      next Space poll resumes from each subscription's stored cursor.
//
// Outcome policy (per the change spec):
//   not_found (404)        → status='pending_reauth', no further retries —
//                            reconnect re-creates via server-instant-webhook
//                            Phase E.
//   unauthorized (401/403) → status='pending_reauth' (Connection needs reauth).
//   rate_limited / transient / thrown dep / token unavailable → row unchanged,
//     logged `webhook_renewal_failed_transient`, retried next hourly pass.
//     (Token-unavailable is deliberately NOT pending_reauth: a transient DO
//     failure must not permanently kill a webhook the spec says we stop
//     retrying.)
//
// Sequential awaits at MVP scale (a handful of rows per pass); one bad row
// never aborts the pass.

import type {
  WebhookRefreshOutcome,
  WebhookToggleOutcome,
} from "../airtable-webhook-renewal";

export interface RenewableWebhookRow {
  id: string;
  connectionId: string;
  baseId: string;
  airtableWebhookId: string;
}

export interface WebhookRenewalPassDeps {
  /** status='active' AND expires_at within the next 24h. */
  listExpiring: () => Promise<RenewableWebhookRow[]>;
  /** status='notifications_disabled'. */
  listNotificationsDisabled: () => Promise<RenewableWebhookRow[]>;
  /** Valid access token for the webhook's owning Connection; null = unavailable. */
  getConnectionToken: (connectionId: string) => Promise<string | null>;
  refresh: (
    baseId: string,
    airtableWebhookId: string,
    accessToken: string,
  ) => Promise<WebhookRefreshOutcome>;
  toggle: (
    baseId: string,
    airtableWebhookId: string,
    enable: boolean,
    accessToken: string,
  ) => Promise<WebhookToggleOutcome>;
  /** Persist a successful refresh: expires_at + last_renewed_at. */
  persistRenewal: (
    webhookId: string,
    expiresAt: Date | null,
    renewedAt: Date,
  ) => Promise<void>;
  persistStatus: (
    webhookId: string,
    status: "active" | "pending_reauth",
  ) => Promise<void>;
  log: (event: Record<string, unknown>) => void;
  now: () => Date;
}

export interface WebhookRenewalPassResult {
  scanned: number;
  refreshed: number;
  reenabled: number;
  pendingReauth: number;
  transientFailures: number;
}

type RowOutcome = "ok" | "pending_reauth" | "transient";

export async function runWebhookRenewalPass(
  deps: WebhookRenewalPassDeps,
): Promise<WebhookRenewalPassResult> {
  const expiring = await deps.listExpiring();
  const disabled = await deps.listNotificationsDisabled();

  const result: WebhookRenewalPassResult = {
    scanned: expiring.length + disabled.length,
    refreshed: 0,
    reenabled: 0,
    pendingReauth: 0,
    transientFailures: 0,
  };

  if (result.scanned === 0) {
    deps.log({ event: "webhook_renewal_no_eligible_rows" });
    return result;
  }

  const transient = (row: RenewableWebhookRow, lane: string, reason: string): RowOutcome => {
    deps.log({
      event: "webhook_renewal_failed_transient",
      webhookId: row.id,
      baseId: row.baseId,
      lane,
      reason,
    });
    return "transient";
  };

  const mapFailure = async (
    row: RenewableWebhookRow,
    lane: "refresh" | "reenable",
    outcome: Exclude<WebhookToggleOutcome, { kind: "success" }>,
  ): Promise<RowOutcome> => {
    if (outcome.kind === "not_found" || outcome.kind === "unauthorized") {
      await deps.persistStatus(row.id, "pending_reauth");
      return "pending_reauth";
    }
    // rate_limited / transient: leave the row alone, retry next pass.
    return transient(
      row,
      lane,
      "reason" in outcome ? outcome.reason : outcome.kind,
    );
  };

  const processRow = async (
    row: RenewableWebhookRow,
    lane: "refresh" | "reenable",
  ): Promise<RowOutcome> => {
    const token = await deps.getConnectionToken(row.connectionId);
    if (token == null) return transient(row, lane, "token_unavailable");

    if (lane === "refresh") {
      const outcome = await deps.refresh(row.baseId, row.airtableWebhookId, token);
      if (outcome.kind === "success") {
        await deps.persistRenewal(row.id, outcome.expiresAt, deps.now());
        return "ok";
      }
      return mapFailure(row, lane, outcome);
    }

    const outcome = await deps.toggle(row.baseId, row.airtableWebhookId, true, token);
    if (outcome.kind === "success") {
      await deps.persistStatus(row.id, "active");
      return "ok";
    }
    return mapFailure(row, lane, outcome);
  };

  const runLane = async (
    rows: RenewableWebhookRow[],
    lane: "refresh" | "reenable",
  ): Promise<void> => {
    for (const row of rows) {
      try {
        const outcome = await processRow(row, lane);
        if (outcome === "ok") {
          if (lane === "refresh") result.refreshed += 1;
          else result.reenabled += 1;
        } else if (outcome === "pending_reauth") {
          result.pendingReauth += 1;
        } else {
          result.transientFailures += 1;
        }
      } catch (err) {
        transient(row, lane, err instanceof Error ? err.message : String(err));
        result.transientFailures += 1;
      }
    }
  };

  await runLane(expiring, "refresh");
  await runLane(disabled, "reenable");

  deps.log({ event: "webhook_renewal_pass", ...result });
  return result;
}
