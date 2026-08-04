# trial-lifecycle

The 14-day trial deletion clock.

## ADDED Requirements

### Requirement: The clock starts at the backup, not the signup

A trial Organization's `trial_expires_at` SHALL be set to the completion of its first successful backup run + 14 days (the locked promise: data is deleted 14 days after the backup is performed). Trials that never run a backup have no deletion clock.

#### Scenario: Clock anchors to the run

- **WHEN** a trial signs up on day 0 and runs its one backup on day 5
- **THEN** the deletion date is day 19

### Requirement: Escalating deletion warnings

A daily server evaluation SHALL send "your backup will be deleted on {date}" emails at T-7, T-3, T-1, and day-of (deduplicated — each stage sends once), each linking to upgrade.

#### Scenario: Each stage fires once

- **WHEN** the daily evaluation runs twice while a trial is inside the T-3 window
- **THEN** exactly one T-3 email was sent

### Requirement: Expiry deletes trial data; upgrade cancels the clock

At expiry the deletion job SHALL remove the trial's stored backup data (via the existing cleanup machinery), record the deletion, and leave the account intact (sign-in, re-subscribe possible; `trial_ever_used` stands). Conversion to any paid plan at any point before expiry SHALL cancel the clock and retain the data.

#### Scenario: Upgrade rescues the data

- **WHEN** a trial upgrades to Lite on day 12 of its clock
- **THEN** no deletion occurs and the trial's backup remains available under the paid plan

#### Scenario: Expiry is clean

- **WHEN** a trial's deletion date passes without upgrade
- **THEN** stored backup data is deleted, the deletion is auditable, and the user can still sign in and subscribe later
