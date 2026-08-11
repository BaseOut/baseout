## ADDED Requirements

### Requirement: The OAuth refresh sweep runs on a schedule

The engine SHALL fire the Airtable OAuth refresh sweep from a configured schedule (cron trigger dispatched by `event.cron`, or an equivalent Trigger.dev schedule if the design records that choice), such that an `active` Connection's access token is proactively refreshed before expiry without requiring an on-demand `/token` call.

#### Scenario: Token nearing expiry with no traffic

- **WHEN** a Connection's `token_expires_at` is within the refresh lookahead and no backup or user activity touches it
- **THEN** the next scheduled sweep refreshes it and `token_expires_at` moves forward — a token never sits expired for days while `status='active'`

### Requirement: A dead schedule is detectable

The engine SHALL expose a staleness signal — the count of `active` connections whose `token_expires_at` is in the past — via an internal probe, and each sweep SHALL log scanned/refreshed/failed/pending-reauth counts, so schedule failures surface as an observable non-zero gauge instead of silent token rot.

#### Scenario: Clock stops firing

- **WHEN** the cron stops running (misconfig, deploy regression)
- **THEN** the staleness gauge climbs above zero within one token lifetime and the absence of sweep log lines is diagnosable
