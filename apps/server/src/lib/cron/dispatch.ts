// Cron dispatch router (server-oauth-refresh-cron-health).
//
// scheduled() receives the FIRING cron expression on event.cron; this pure
// map turns it into job ids so each background service owns one entry and
// future crons (server-run-reconciliation, webhook renewal, …) plug in here
// without touching each other's handlers. Unknown cron strings resolve to []
// — the call site logs the no-op so a config/env drift is visible.

export const OAUTH_REFRESH_CRON = "*/15 * * * *";
// Daily keep-alive (shared-oauth-refresh-keepalive): refreshes connections
// approaching the 60-day refresh-token idle-expiry. Runs at a fixed off-peak
// hour; per-connection cadence is ~monthly, so daily granularity is ample.
export const KEEPALIVE_CRON = "0 13 * * *";

export type CronJob =
  | "oauth-refresh-sweep"
  | "run-reconciliation"
  | "oauth-keepalive"
  | "connection-auto-invalidate";

const CRON_JOBS: Record<string, CronJob[]> = {
  [OAUTH_REFRESH_CRON]: ["oauth-refresh-sweep", "run-reconciliation"],
  [KEEPALIVE_CRON]: ["oauth-keepalive", "connection-auto-invalidate"],
};

export function resolveCronJobs(cron: string): CronJob[] {
  return CRON_JOBS[cron] ?? [];
}
