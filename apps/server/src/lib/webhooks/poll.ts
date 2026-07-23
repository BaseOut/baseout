// Webhook cadence-poll decision logic (server-instant-webhook Phase C) — PURE.
//
// A Space with frequency='instant' discovers dirty bases by comparing the
// org-level registry's `airtable_webhooks.last_ping_at` (stamped by apps/hooks
// on each verified ping) against its own subscription watermark
// `last_polled_at`. These functions own the decisions; the SpaceDO injects
// `now`/`random` and performs the side effects (run INSERT, task enqueue,
// watermark stamp). No I/O here.
//
// Semantics pinned by tests/integration/webhooks/poll-decision.test.ts:
//   - dirty:        last_ping_at > COALESCE(last_polled_at, 'epoch')
//   - safety sweep: COALESCE(last_polled_at, 'epoch') < now - 24h — every
//                   subscription polls at least daily even if pings are lost.
//   - reconcile:    last_reconciled_at NULL or older than 7 days → the task
//                   runs the modifiedTime catch-all after the payload pass.
//   - in-flight:    a non-terminal webhook run for the same (space, base)
//                   suppresses a second enqueue this tick. The watermark is
//                   NOT stamped on a skip, so the next tick re-checks.
//   - paused:       webhook rows in 'pending_reauth' / 'inactive' don't poll
//                   (token dead / unsubscribed). 'notifications_disabled'
//                   still polls — Airtable keeps generating payloads while
//                   pings are muted; the renewal cron re-enables pings.

/** Mirrors the canonical DB default on backup_configurations (migration 0030). */
export const DEFAULT_WEBHOOK_POLL_INTERVAL_SECONDS = 900;

/** Poll every subscription at least this often, ping or no ping. */
export const SAFETY_SWEEP_MS = 24 * 60 * 60 * 1000;

/** Reconciliation cadence — matches the 7-day Airtable payload retention. */
export const RECONCILE_CADENCE_MS = 7 * 24 * 60 * 60 * 1000;

/** Jitter fraction added to the interval (0..10%) — thundering-herd guard. */
export const POLL_JITTER_FRACTION = 0.1;

/** backup_runs statuses that count as "still in flight" for the guard. */
export const IN_FLIGHT_RUN_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "running",
]);

/** Webhook registry statuses whose subscriptions poll. */
const POLLABLE_WEBHOOK_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "notifications_disabled",
]);

/** One row of the SpaceDO's dirty-check join (subscription ⋈ webhook). */
export interface PollSubscription {
  subscriptionId: string;
  webhookId: string;
  /** Airtable base ID (app…). */
  baseId: string;
  /** The Connection whose token created the webhook (payload-poll auth). */
  connectionId: string;
  /** airtable_webhooks.status. */
  webhookStatus: string;
  /** The Space's position in the payload stream (starts at 1). */
  payloadCursor: number;
  lastPingAt: Date | null;
  lastPolledAt: Date | null;
  lastReconciledAt: Date | null;
}

/**
 * The dirty-check predicate — dirty OR safety-sweep due. Mirrors the SQL
 * WHERE in the production dep (COALESCE(last_polled_at, 'epoch') semantics:
 * a never-polled subscription is always due).
 */
export function isSubscriptionDue(
  sub: Pick<PollSubscription, "lastPingAt" | "lastPolledAt">,
  now: Date,
): boolean {
  const polledMs = sub.lastPolledAt?.getTime() ?? 0;
  const dirty = sub.lastPingAt != null && sub.lastPingAt.getTime() > polledMs;
  const sweepDue = polledMs < now.getTime() - SAFETY_SWEEP_MS;
  return dirty || sweepDue;
}

/** True when the modifiedTime reconciliation catch-all should ride this run. */
export function needsReconcile(
  lastReconciledAt: Date | null,
  now: Date,
): boolean {
  return (
    lastReconciledAt == null ||
    lastReconciledAt.getTime() < now.getTime() - RECONCILE_CADENCE_MS
  );
}

/**
 * Next poll fire in unix-ms: now + interval + jitter(0..10% of interval).
 * `random` returns [0, 1) — injected so tests are deterministic.
 */
export function computeNextWebhookPollMs(
  intervalSeconds: number,
  nowMs: number,
  random: () => number,
): number {
  const intervalMs = intervalSeconds * 1000;
  return nowMs + intervalMs + Math.floor(random() * POLL_JITTER_FRACTION * intervalMs);
}

export type WebhookPollDecision =
  | { action: "enqueue"; subscription: PollSubscription; reconcile: boolean }
  | { action: "skip_in_flight"; subscription: PollSubscription }
  | { action: "skip_paused"; subscription: PollSubscription };

/**
 * Per-subscription poll decisions for one alarm tick. Clean subscriptions
 * (not due) are dropped entirely — the production SQL already filters them;
 * re-applying the predicate here keeps the semantics in one tested place.
 */
export function decideWebhookPolls(input: {
  subscriptions: PollSubscription[];
  /** Base IDs with a non-terminal webhook run (DO in-flight map ∩ run rows). */
  inFlightBaseIds: ReadonlySet<string>;
  now: Date;
}): WebhookPollDecision[] {
  const decisions: WebhookPollDecision[] = [];
  for (const subscription of input.subscriptions) {
    if (!isSubscriptionDue(subscription, input.now)) continue;
    if (!POLLABLE_WEBHOOK_STATUSES.has(subscription.webhookStatus)) {
      decisions.push({ action: "skip_paused", subscription });
      continue;
    }
    if (input.inFlightBaseIds.has(subscription.baseId)) {
      decisions.push({ action: "skip_in_flight", subscription });
      continue;
    }
    decisions.push({
      action: "enqueue",
      subscription,
      reconcile: needsReconcile(subscription.lastReconciledAt, input.now),
    });
  }
  return decisions;
}
