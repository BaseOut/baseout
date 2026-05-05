## ADDED Requirements

### Requirement: Templates and senders

Front SHALL implement React Email templates and Mailgun sends for: Magic Link, Password Reset, 2FA setup confirmation, Trial Welcome, Migration Welcome, Upgrade Confirmation, Payment Failed (dunning), Team Invitation.

#### Scenario: Magic Link send

- **WHEN** a user requests a magic link
- **THEN** the Magic Link template is rendered via React Email and sent via Mailgun within 30 seconds

### Requirement: Sending domain and key isolation

Sends SHALL use sending domain `mail.baseout.com` (DKIM/SPF/DMARC). Front's Mailgun API key SHALL be a separate key from back's, held in Cloudflare Secrets.

#### Scenario: Independent dispatch

- **WHEN** front sends Trial Welcome
- **THEN** Mailgun is called directly using front's key without coordination with back

### Requirement: No internal email-dispatch endpoint

There SHALL NOT be an internal "send-email" endpoint exposed to back. Back calls Mailgun directly for its own templates.

#### Scenario: Back attempts cross-call

- **WHEN** back needs to send Backup Failure
- **THEN** back invokes Mailgun directly with back's key, not via front

### Requirement: Migration Welcome on first login

The Migration Welcome email SHALL be sent the first time a migrated user (`has_migrated=false → true`) signs in and completes the "Complete Your Migration" UX.

#### Scenario: Migrated user completes UX

- **WHEN** a migrated user finishes the migration flow
- **THEN** `has_migrated=true` is persisted and the Migration Welcome email is sent
