# Implementation tasks

## 1. FrequencyPicker

- [x] 1.1 Enable Instant when tier ≥ Pro AND `space_databases.status='ready'`; locked state shows the reason. → New `apps/web/src/components/backups/FrequencyPicker.astro` (mounted on `/backups`); gating logic in `src/lib/backups/frequency-picker.ts` (`instantLockReason` / `lockReasonCopy`, tier wins over db; tier lock adds an Upgrade CTA). `pro` gained `'instant'` in `tier-capabilities.ts` per the PRD §2.2 ruling. NOTE: the schema's provisioned-terminal status is `'active'` (space_databases CHECK has no `'ready'`) — readiness = `status='active'`.
- [x] 1.2 Poll-interval control bound to `webhook_poll_interval_seconds`; client hint of tier minimum; render `webhook_poll_interval_below_minimum` server rejection inline. → ui/Select with presets clamped to `webhookPollMinSeconds` (new per-tier field: pro 900 / business 300 / enterprise 60 — PROVISIONAL pending Features §6.1, server-instant-webhook Phase G.3) + "Your plan's minimum…" hint; server 422 echoes `{ minimum }` and renders inline without reverting edits (`describeFrequencySaveError`).
- [x] 1.3 `setButtonLoading` on save (registration round-trips to Airtable). → Save handler wraps `saveBackupConfig` in `setButtonLoading` + `finally`.
- [x] 1.4 Extend the FrequencyPicker Storybook story: unlocked, locked-by-tier, locked-by-dynamic-db, interval-error states. → `FrequencyPicker.stories.ts` (new — no prior story existed) with exactly those four stories; classification entry added (`daisyui-direct-styleguide`); governance suites green.

## 2. Config PATCH response handling

- [x] 2.1 Handle `airtable_webhook_cap_reached`: revert selection + explanatory message. → Client: `describeFrequencySaveError` → revert + "already webhook-connected by the maximum number of organizations". Route: on the transition TO instant it calls the engine `register-webhooks` (new `registerWebhooks`/`unregisterWebhooks` on `lib/backup-engine.ts`; paths per server E.1/E.3), and a cap failure triggers a compensating upsert back to the previous cadence + 409. Other registration failures stay best-effort (daily safety sweep covers data). Transition AWAY calls `unregister-webhooks` best-effort. Route also gained a server-side `dynamic_db_not_ready` 422 guard for instant. Surgical additions to `backup-config.ts` noted for the server-instant-webhook E.5 owner.
- [x] 2.2 Tests for the PATCH flow branches (happy, below-minimum, cap). → 13 new handlePatch tests (instant-for-pro, db-not-ready, below-minimum w/ echoed minimum, interval upsert, register/unregister transitions, cap revert incl. no-prior-config fallback, best-effort failures, null deps) + 7 persist-policy tests + 6 save-config tests + 6 engine-client tests + 3 configure-save copy tests.

## 3. History affordances

- [x] 3.1 ⚡ glyph on `triggered_by='webhook'` rows in the history widget. → `triggerDisplayLabel` in `lib/backups/list-row.ts` (SSR row in BackupsListView + client `backupRowHtml`); `isWebhookRun` + ⚡ on the "Triggered by" line in BackupHistoryWidget (SSR + client renderer).
- [x] 3.2 Detail accordion: "Source: Webhook · created/updated/deleted" + `reconciled_records` when present. → `webhookSourceLine` in `lib/backups/format.ts`, rendered in BackupHistoryWidget's accordion (both render paths). GAP: `backup_runs` has no created/updated/deleted/reconciled columns yet — counts ride new OPTIONAL `BackupRunSummary` fields (`createdCount`/`updatedCount`/`deletedCount`/`reconciledRecords`) that the engine's completion payload will populate (server-instant-webhook); until then the line renders "Source: Webhook".
- [x] 3.3 Extend the history-widget story. → `BackupHistoryWidget.stories.ts` gained `WebhookRun` (counts + fallback rows; play opens the accordion).

## 4. Attention banner

- [x] 4.1 Space backups view banner when a subscribed webhook is `pending_reauth`, linking to Reconnect; no surfacing of `notifications_disabled`. → `webhookNeedsReauth` in `lib/backups/webhook-attention.ts`; `/backups` (backups.astro) joins `airtable_webhook_subscriptions`→`airtable_webhooks` for the Space and renders a ui/Alert "Webhook backups paused — reconnect required." with Reconnect → `/sources` (the app's canonical reconnect surface per lib/connection-health).
- [x] 4.2 Test: banner presence/absence per webhook status. → `webhook-attention.test.ts`: pending_reauth ⇒ banner; active/empty/inactive ⇒ none; notifications_disabled explicitly never banners.

## 5. Verification

- [x] 5.1 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — green; Storybook coverage test green. → `vitest run`: 1218 tests pass; the only 2 failing SUITES are pre-existing/environmental (`src/middleware.test.ts`, `src/lib/embed/frame-headers.test.ts` — unbuilt `@baseout/embed-protocol` dist from the embed change, untouched here). `astro check`: 10 errors, ALL pre-existing (4× embed-protocol module resolution, 6× `tests/integration/airtable-persist.test.ts` refreshExpiresIn) — zero in files this change touches. Governance suites (`stories-coverage`, `component-classification`) green.
- [ ] 5.2 Mobile check at <375px / <768px / <1024px for the picker + banner. → NOT browser-verified (no dev-server smoke in this pass). Picker uses stacked full-width radio rows, flex-wrap header, and 44px-min touch rows; banner is the standard responsive ui/Alert. Needs the human smoke pass.
