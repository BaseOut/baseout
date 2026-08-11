## ADDED Requirements

### Requirement: Templates and senders

`web` SHALL implement React Email templates and dispatch via the Cloudflare Workers `send_email` binding (see [`apps/web/src/lib/email/send.ts`](../../../../../apps/web/src/lib/email/send.ts)) for: Magic Link, Password Reset, 2FA setup confirmation, Trial Welcome, Migration Welcome, Upgrade Confirmation, Payment Failed (dunning), Team Invitation.

#### Scenario: Magic Link send

- **WHEN** a user requests a magic link
- **THEN** the Magic Link template is rendered via React Email and dispatched via the Cloudflare Workers `send_email` binding within 30 seconds

### Requirement: Sending domain and binding isolation

Sends SHALL use sending domain `mail.baseout.com` (DKIM/SPF/DMARC). `web`'s `send_email` binding SHALL be a separate per-Worker binding from any other app's, so revocation of one Worker's send-from privileges doesn't affect the other.

#### Scenario: Independent dispatch

- **WHEN** `web` sends Trial Welcome
- **THEN** the Cloudflare Email Workers binding scoped to `web` is called directly without coordination with any other app

### Requirement: No internal email-dispatch endpoint

There SHALL NOT be an internal "send-email" endpoint exposed by `web` to any other app. Each email-sending app (`web`, `server`) calls its own `send_email` binding directly.

#### Scenario: server sends its own email

- **WHEN** `server` needs to send Backup Failure
- **THEN** `server` invokes its own Cloudflare Workers `send_email` binding, not via `web`

### Requirement: Migration Welcome on first login

The Migration Welcome email SHALL be sent the first time a migrated user (`has_migrated=false → true`) signs in and completes the "Complete Your Migration" UX.

#### Scenario: Migrated user completes UX

- **WHEN** a migrated user finishes the migration flow
- **THEN** `has_migrated=true` is persisted and the Migration Welcome email is sent
