## 1. Foundation

- [x] 1.1 Nav in `src/layouts/Layout.astro`: `/` Organizations · `/subscriptions` · `/backups` · `/connections` · `/databases` · `/services` · `/migration`; active from `Astro.url.pathname`.

## 2. Surfaces (each: mirror cols + pure lib + tests + page)

- [x] 2.1 `/backups`: mirror `backupRuns`; `src/lib/backup-runs.ts` (`summarizeRuns` — 24h/7d counts, durations, badges) + tests; page joins spaces + organizations, last 100 runs, `?status=` filter.
- [x] 2.2 `/subscriptions`: extend mirrors (`organizations` +stripeCustomerId, `subscriptions` +stripeSubscriptionId/createdAt, `subscriptionItems` +billingPeriod/trial*/currentPeriod*/cancelledAt); `src/lib/subscriptions.ts` (trial-state derivation) + tests; stats + table page.
- [x] 2.3 `/connections`: mirror `connections`, `connectionSessions`, `storageDestinations`; `src/lib/connection-health.ts` (`classifyConnection`) + tests; page with health badges + storage-destination section + webhook-not-instrumented note.
- [x] 2.4 `/databases`: mirror `spaceDatabases` (exclude `byodb_connection_string_enc`); `src/lib/db-tracker.ts` + tests; page with errors-first ordering + last-run volume proxy.
- [x] 2.5 `/migration`: mirror `organizations` +dynamicLocked; `src/lib/migration.ts` (counts/percent) + tests; stats + pending-org table.
- [x] 2.6 `/services`: mirror `backupConfigurations` (schedule cols); `src/lib/service-health.ts` (`deriveServiceHealth` → ok/warning/unknown cards) + tests; page labeled "derived from data side-effects".

## 3. Definition of done

- [x] 3.1 `test:unit` + `typecheck` green; `astro build` succeeds.
- [ ] 3.2 Human smoke: every page renders with real dev-DB rows; empty states clean.
- [x] 3.3 Follow-up flagged (not bundled): retire `apps/web/src/pages/ops/`. Done 2026-07-15: page deleted (its `applyOpsGate` middleware gate had been removed, leaving cross-org backup runs visible to any signed-in customer); regression guard at `apps/web/src/pages/ops-retired.test.ts`; admin `/backups` is the replacement.
