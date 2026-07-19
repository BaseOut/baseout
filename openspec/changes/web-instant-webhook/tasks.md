# Implementation tasks

## 1. FrequencyPicker

- [ ] 1.1 Enable Instant when tier ≥ Pro AND `space_databases.status='ready'`; locked state shows the reason.
- [ ] 1.2 Poll-interval control bound to `webhook_poll_interval_seconds`; client hint of tier minimum; render `webhook_poll_interval_below_minimum` server rejection inline.
- [ ] 1.3 `setButtonLoading` on save (registration round-trips to Airtable).
- [ ] 1.4 Extend the FrequencyPicker Storybook story: unlocked, locked-by-tier, locked-by-dynamic-db, interval-error states.

## 2. Config PATCH response handling

- [ ] 2.1 Handle `airtable_webhook_cap_reached`: revert selection + explanatory message.
- [ ] 2.2 Tests for the PATCH flow branches (happy, below-minimum, cap).

## 3. History affordances

- [ ] 3.1 ⚡ glyph on `triggered_by='webhook'` rows in the history widget.
- [ ] 3.2 Detail accordion: "Source: Webhook · created/updated/deleted" + `reconciled_records` when present.
- [ ] 3.3 Extend the history-widget story.

## 4. Attention banner

- [ ] 4.1 Space backups view banner when a subscribed webhook is `pending_reauth`, linking to Reconnect; no surfacing of `notifications_disabled`.
- [ ] 4.2 Test: banner presence/absence per webhook status.

## 5. Verification

- [ ] 5.1 `pnpm --filter @baseout/web typecheck && pnpm --filter @baseout/web test:unit` — green; Storybook coverage test green.
- [ ] 5.2 Mobile check at <375px / <768px / <1024px for the picker + banner.
