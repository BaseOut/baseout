## ADDED Requirements

### Requirement: Instant frequency unlocked with poll-interval control

The FrequencyPicker SHALL enable the Instant option when the Space's tier is Pro+ AND its dynamic DB is ready, and SHALL otherwise show it locked with the tier/dynamic-DB reason. Selecting Instant SHALL expose a poll-interval control bound to `backup_configurations.webhook_poll_interval_seconds`, client-constrained to the tier's platform minimum with server-side validation authoritative.

#### Scenario: Pro Space with dynamic DB selects Instant

- **WHEN** a Pro+ Space with `space_databases.status='ready'` selects Instant and saves
- **THEN** the config PATCH succeeds, webhook registration is triggered, and the picker shows the active interval

#### Scenario: Below-minimum interval

- **WHEN** the server rejects the PATCH with `webhook_poll_interval_below_minimum`
- **THEN** the UI surfaces the tier minimum inline without losing the user's other edits

#### Scenario: Webhook cap reached

- **WHEN** registration fails with `airtable_webhook_cap_reached`
- **THEN** the UI reverts the frequency selection and explains that the base is already webhook-connected by the maximum number of organizations

### Requirement: Webhook-run affordances in history

Backup-history rows with `triggered_by='webhook'` SHALL display a ⚡ glyph, and their detail view SHALL show created/updated/deleted counts, plus `reconciled_records` when a reconciliation pass contributed changes.

#### Scenario: Webhook run in history

- **WHEN** a webhook-triggered run appears in the history widget
- **THEN** the row carries the ⚡ glyph and the accordion reads "Source: Webhook · N created · N updated · N deleted"

### Requirement: pending_reauth attention banner

When any of a Space's subscribed webhooks has `status='pending_reauth'`, the Space's backups view SHALL show a banner stating webhook backups are paused pending reconnection, linking to the Reconnect flow. `notifications_disabled` SHALL NOT be surfaced to customers (it self-heals via the renewal cron while the daily safety sweep keeps data flowing).

#### Scenario: Webhook deleted upstream

- **WHEN** a subscribed webhook transitions to `pending_reauth`
- **THEN** the banner appears on the Space's backups view until reconnection restores an active webhook
