## ADDED Requirements

### Requirement: Templates and senders

`baseout-web` SHALL implement React Email templates and Mailgun sends for: Magic Link, Password Reset, 2FA setup confirmation, Trial Welcome, Migration Welcome, Upgrade Confirmation, Payment Failed (dunning), Team Invitation.

#### Scenario: Magic Link send

- **WHEN** a user requests a magic link
- **THEN** the Magic Link template is rendered via React Email and sent via Mailgun within 30 seconds

### Requirement: Sending domain and key isolation

Sends SHALL use sending domain `mail.baseout.com` (DKIM/SPF/DMARC). `baseout-web`'s Mailgun API key SHALL be a separate key from any other repo's, held in Cloudflare Secrets.

#### Scenario: Independent dispatch

- **WHEN** `baseout-web` sends Trial Welcome
- **THEN** Mailgun is called directly using `baseout-web`'s key without coordination with any other repo

### Requirement: No internal email-dispatch endpoint

There SHALL NOT be an internal "send-email" endpoint exposed by `baseout-web` to any other repo. Each email-sending repo (`baseout-web`, `baseout-backup`) calls Mailgun directly with its own key.

#### Scenario: baseout-backup sends its own email

- **WHEN** `baseout-backup` needs to send Backup Failure
- **THEN** `baseout-backup` invokes Mailgun directly with its own key, not via `baseout-web`

### Requirement: Migration Welcome on first login

The Migration Welcome email SHALL be sent the first time a migrated user (`has_migrated=false → true`) signs in and completes the "Complete Your Migration" UX.

#### Scenario: Migrated user completes UX

- **WHEN** a migrated user finishes the migration flow
- **THEN** `has_migrated=true` is persisted and the Migration Welcome email is sent
