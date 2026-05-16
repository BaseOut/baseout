## ADDED Requirements

### Requirement: Trial-email cron runs daily
A Trigger.dev scheduled task `trial-email-cron` SHALL run once daily and POST a trial-email trigger event for every Org with a trial expiring in {7, 3, 1, 0} days that hasn't already been notified for that window.

#### Scenario: enumerate + dispatch
- **WHEN** the daily cron fires
- **THEN** the task SHALL `GET /api/internal/trials/expiring?in=7,3,1,0` with `x-internal-token`
- **AND** for each returned row SHALL POST `/api/internal/orgs/:id/trial-email` with `{ daysRemaining }`
- **AND** SHALL emit `event: 'trial_email_dispatched'` per send

#### Scenario: idempotency from server side
- **WHEN** the server has already recorded a send for the same Org × threshold (`trial_expiry_warning_sent_at` / `trial_expired_email_sent_at`)
- **THEN** the engine endpoint SHALL no-op on the second POST
- **AND** the task SHALL receive a 200 with `{ status: 'already_sent' }` rather than duplicate the email
