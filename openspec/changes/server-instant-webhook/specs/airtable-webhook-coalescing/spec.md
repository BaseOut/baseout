## ADDED Requirements

### Requirement: Single-alarm coexistence with cron schedule

The per-Space DurableObject SHALL support BOTH a cron alarm (scheduled snapshots, set by `server-schedule-and-cancel`) AND a webhook-debounce alarm (this change) using a single underlying DO alarm. State for both fire times SHALL persist in DO storage; the alarm SHALL fire at the minimum of the two.

#### Scenario: Cron fire while webhook events buffered

- **WHEN** the DO's cron alarm fires for a scheduled monthly backup while `webhook_events_since_last_fire > 0`
- **THEN** the alarm handler SHALL fire the cron run AND SHALL NOT fire the webhook run unless `webhook_debounce_until_ms <= now`

### Requirement: Burst-trigger threshold

When `webhook_events_since_last_fire` reaches the configured `webhook_threshold` (default 100), the DO SHALL fire the incremental run immediately, bypassing the debounce timer. Burst fires SHALL still respect the regular run state machine (`backup_runs` INSERT, etc.).

#### Scenario: 100th event triggers immediately

- **WHEN** the 100th `/webhook-tick` arrives at the DO since the last fire
- **THEN** the DO SHALL fire the webhook run immediately and reset `webhook_events_since_last_fire` to 0

### Requirement: Configurable debounce thresholds

The thresholds `webhook_debounce_seconds` (default 300) and `webhook_event_threshold` (default 100) SHALL be persisted in `backup_configurations` and SHALL be readable by the SpaceDO. Lower-tier customers SHALL NOT be able to set values below platform-enforced minimums.

#### Scenario: Pro+ adjusts debounce

- **WHEN** a Pro Space PATCHes `backup_configurations.webhook_debounce_seconds=60`
- **THEN** the PATCH SHALL be accepted and the SpaceDO SHALL read the new value on next `/webhook-tick`

#### Scenario: Below-minimum value rejected

- **WHEN** a Pro Space PATCHes `webhook_debounce_seconds=5` and the platform minimum is 30
- **THEN** the route SHALL return 400 `{ error: 'webhook_debounce_below_minimum', minimum: 30 }`
