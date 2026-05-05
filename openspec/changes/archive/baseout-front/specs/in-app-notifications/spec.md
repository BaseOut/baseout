## ADDED Requirements

### Requirement: Notifications panel

The dashboard SHALL include a notifications dropdown surfacing the most recent N rows from the `notifications` table for the Org, sorted by recency.

#### Scenario: Recent failure surfaced

- **WHEN** a backup failure writes a `notifications` row
- **THEN** the panel shows the row at the top with a click-through link to the run detail

### Requirement: Read state

Each notification SHALL be markable as read; the read state SHALL be per-user, per-notification.

#### Scenario: Mark as read

- **WHEN** a user clicks a notification
- **THEN** the notification's read state for that user is updated and the panel's unread count decrements

### Requirement: Channel preference UI

Settings SHALL include a per-type, per-channel preference UI driven by `notification_channels` and `notification_preferences`. Channels supported: Email, Slack, Teams, webhook, PagerDuty.

#### Scenario: Disable email for schema changes

- **WHEN** a user disables email for Schema Change Notification
- **THEN** `notification_preferences` is updated and back-side email dispatchers SHALL skip email for that notification type for that Org

### Requirement: Org-level channel scope (V1)

Notification channel configuration SHALL be Org-level for V1. Per-Space configuration SHALL be deferred unless user demand emerges.

#### Scenario: Org-level Slack channel

- **WHEN** an Org configures a Slack channel
- **THEN** the channel is applied to all Spaces in the Org
