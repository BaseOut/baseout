# limit-enforcement

Warn at 90%, enforce at 100%, never fail mid-job — with deduplicated notification skeletons.

## ADDED Requirements

### Requirement: Evaluation runs wherever usage changes land

After every usage write (rollup ingestion, point-of-use metering, reconciliation sweep) the system SHALL evaluate `used / effective_limit` for the affected (organization, feature) pairs against the resolved effective limit (plan ± override + add-ons). Evaluation SHALL be part of the sync flow, not a separate polling loop.

#### Scenario: Crossing 90% is detected at ingestion

- **WHEN** a run's usage report takes an Organization's file storage from 88% to 92% of its effective limit
- **THEN** the evaluation runs in that ingestion path and the warning transition fires

### Requirement: Notification state machine deduplicates alerts

The system SHALL persist per (organization, feature, period) notification state — `ok → warned_90 → warned_100 → enforced` — transitioning forward as usage crosses thresholds, and resetting at period rollover or when usage drops back below a threshold (with hysteresis so oscillation at a boundary does not re-alert). Notifications SHALL fire only on state transitions, never on re-evaluation of an unchanged state.

#### Scenario: Repeated syncs do not spam

- **WHEN** ten consecutive usage reports arrive while an Organization sits at 93% of its records limit
- **THEN** exactly one warning notification was sent (on the ok→warned_90 transition)

### Requirement: Notifiers send a simple email

The notifier functions — `notifyLimitWarning(org, feature, used, limit, pctOfLimit)` on warning transitions and `notifyLimitEnforced(org, feature, used, limit, overagePct)` on enforcement — SHALL send a basic email (existing Mailgun + React Email stack) to the Organization's owner naming the feature, current usage, the effective limit, the percentage, and a link to the matching add-on or upgrade. Sends SHALL be structured-logged. Content/design polish and additional channels are future work; the signatures, call sites, and delivery are final.

#### Scenario: Enforcement email carries the detail

- **WHEN** an Organization hits 100% of its call allowance
- **THEN** the owner receives an email naming the call limit, usage, overage percent, and the +50K-calls add-on link, and the send is visible in structured logs

### Requirement: Enforcement behavior follows the lever class

At 100% of the effective limit: **background meters** (records, file GB, database GB) SHALL pause *new* backup runs at the next job boundary — the scheduler checks enforcement state before enqueuing, in-flight runs always complete, and existing data is never deleted; **interactive meters** (AI credits, API/MCP/SQL calls) SHALL refuse the over-limit operation at point of use with an error payload naming the limit and the matching add-on; **creation caps** SHALL block the creating action only, leaving existing items untouched. Restores SHALL never be blocked by any other lever's enforcement. Enforcement SHALL be globally toggleable by config flag (off until cutover).

#### Scenario: Background pause at job boundary

- **WHEN** an Organization is at 100% of file storage and a scheduled backup is running
- **THEN** the in-flight run completes and is stored; the *next* scheduled run is not enqueued while enforcement holds

#### Scenario: Interactive refusal offers the fix

- **WHEN** an API call arrives after the call allowance is exhausted
- **THEN** it is rejected (429) with a body identifying the limit and the +50K-calls add-on

#### Scenario: Restore immune to unrelated enforcement

- **WHEN** an Organization is enforced on file storage
- **THEN** a restore within its own restore allowance still executes

#### Scenario: Clearing the limit resumes automatically

- **WHEN** an enforced Organization purchases the matching add-on (or the period rolls over for a flow meter)
- **THEN** the next evaluation clears the enforcement state and paused scheduling resumes without manual action
