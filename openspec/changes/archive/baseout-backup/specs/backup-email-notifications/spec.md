## ADDED Requirements

### Requirement: Templates and senders

`baseout-backup` SHALL implement React Email templates and Mailgun sends for the following categories from the handler that detects the trigger: Backup Audit Report, Monthly Backup Summary, Backup Failure Alert, Backup Warning Alert, Trial Cap Hit, Trial Expiry Warning, Trial Expired, Dead Connection Warning ×4, Quota Warning (75/90/100%), Overage Started, Overage Cap Reached, Schema Change Notification, Health Score Change, Restore Complete, Webhook Renewal Failure.

#### Scenario: Backup failure email

- **WHEN** a backup run reaches `status='failed'`
- **THEN** the Backup Failure Alert email renders via React Email and sends via Mailgun within 1 minute

### Requirement: Sending domain and key isolation

Sends SHALL use sending domain `mail.baseout.com` (DKIM/SPF/DMARC). `baseout-backup`'s Mailgun API key SHALL be a separate key from `baseout-web`'s, held in Cloudflare Secrets.

#### Scenario: Independent dispatch

- **WHEN** `baseout-backup` sends a Quota Warning email
- **THEN** Mailgun is called directly using its own key without going through `baseout-web` or any other repo

### Requirement: Single template directory

`baseout-backup`'s templates SHALL live in a single directory `baseout-backup/src/emails/` and SHALL be imported by whichever handler (HTTP, cron, Trigger.dev workflow callback) detects the trigger. They SHALL NOT be shared with `baseout-web` — `baseout-web` owns its own templates per the `web-email-notifications` spec.

#### Scenario: Cron handler imports template

- **WHEN** the quota-usage cron handler needs to send Quota Warning
- **THEN** it imports `baseout-backup/src/emails/QuotaWarning.tsx` directly and renders it via React Email

#### Scenario: HTTP handler imports same template

- **WHEN** an HTTP handler also needs Quota Warning (e.g., on-demand resend from the admin surface)
- **THEN** it imports the same `baseout-backup/src/emails/QuotaWarning.tsx` — no duplication

### Requirement: Recipient resolution

Recipients SHALL be resolved per the Org's `notification_channels` and `notification_preferences` configuration. The email send is one of multiple channels (others: Slack, Teams, webhook, PagerDuty) and SHALL be skipped if email is disabled for the notification type.

#### Scenario: Email disabled for Schema Change

- **WHEN** an Org has Schema Change Notification email disabled in preferences
- **THEN** no email is sent; in-app notification still surfaces if its channel is enabled
