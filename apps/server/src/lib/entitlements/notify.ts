/**
 * Limit-notification skeletons (shared-entitlements task 4.2, design D7).
 *
 * The two notifier functions fire on notification-state TRANSITIONS only:
 *   - notifyLimitWarning  — on → warned_90 and → warned_100
 *   - notifyLimitEnforced — on → enforced
 *
 * These are SKELETONS: bodies are structured-logged no-ops (log + TODO). The
 * signatures and the call sites (the usage-enforcement evaluation) are the
 * contract; task 5.1 replaces the body with a real Mailgun + React Email send to
 * the Organization owner. To keep the engine free of raw `console.*`
 * (CLAUDE.md §3.5), the structured event is emitted through an injected sink —
 * the route passes the engine's logger; tests pass a capturing sink; the default
 * is a no-op (delivery lands in 5.1).
 *
 * The design's positional signature `notify…(org, feature, used, limit, pct)` is
 * carried here as a single typed payload — the five pieces of data are the
 * contract, not the arg order.
 */

export interface LimitNotification {
  organizationId: string;
  featureSlug: string;
  /** Current-period usage that triggered the transition. */
  used: number;
  /** Effective limit; `null` = fair use (never triggers, included for shape). */
  limit: number | null;
  /** used / limit — the warning percentage / overage the email will name. */
  pct: number;
}

export interface LimitNotifier {
  notifyLimitWarning(n: LimitNotification): Promise<void>;
  notifyLimitEnforced(n: LimitNotification): Promise<void>;
}

/** Structured event a skeleton notifier emits. `kind` names the transition class. */
export interface LimitNotificationEvent extends LimitNotification {
  event: "limit_notification";
  kind: "warning" | "enforcement";
  /** Marks the placeholder body until task 5.1 wires the real email send. */
  todo: "shared-entitlements-5.1-real-email";
}

export type NotificationLogSink = (event: LimitNotificationEvent) => void;

const noopSink: NotificationLogSink = () => {};

/**
 * The skeleton notifier: emits a structured event per transition through `log`
 * and does nothing else. Swap for the real email sender in task 5.1 without
 * touching the call sites.
 */
export function createSkeletonNotifier(
  log: NotificationLogSink = noopSink,
): LimitNotifier {
  const emit = (kind: "warning" | "enforcement", n: LimitNotification) => {
    log({
      event: "limit_notification",
      kind,
      todo: "shared-entitlements-5.1-real-email",
      ...n,
    });
  };
  return {
    async notifyLimitWarning(n) {
      emit("warning", n);
    },
    async notifyLimitEnforced(n) {
      emit("enforcement", n);
    },
  };
}
