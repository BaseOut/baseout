## ADDED Requirements

### Requirement: Email-first start without verification

The survey SHALL ask for the respondent's email on a dedicated first screen before any survey question, stating that it is used to send the report and to save progress. Submitting the email SHALL start an unverified (anonymous) session and proceed immediately to the first question — the respondent MUST NOT be required to click a verification or magic-link email to continue.

#### Scenario: First-time start

- **WHEN** a new visitor enters a valid email on the start screen
- **THEN** a session cookie is issued, a progress row is created for that email, and the first survey question renders with no email round-trip

#### Scenario: Invalid email

- **WHEN** the visitor submits a malformed email
- **THEN** an inline validation error shows and the survey does not start

### Requirement: Server-side progress autosave

From the email step onward, the app SHALL upsert the respondent's answers and current step position to the server (D1) on every step transition, keyed to the session's progress row. Local storage MAY cache answers, but the server copy is authoritative for resume. Autosave failures MUST NOT block the respondent from advancing.

#### Scenario: Step answered

- **WHEN** a respondent answers a question and clicks Next
- **THEN** the progress row's answers and step index reflect that answer without interrupting navigation

### Requirement: Seamless same-session resume

While the session cookie is valid, revisiting the survey SHALL restore the respondent's saved answers and land them on the step after their last answered question, without any login step.

#### Scenario: Return within session lifetime

- **WHEN** a respondent with a valid session cookie reopens /survey
- **THEN** their answers hydrate from the server and the renderer opens at their saved position

### Requirement: Magic-link resume after session loss

When no valid session exists, the respondent SHALL be able to request a magic-link email (better-auth) by entering the email they started with; following the link SHALL sign them in and attach the progress row matching their verified email, resuming at the saved step. Progress belonging to an email MUST only be readable through a session that verified that email (or the original anonymous session that created it).

#### Scenario: Cold return on a new device

- **WHEN** a respondent with no session enters their email on the resume screen and clicks the emailed link
- **THEN** they are signed in and the survey resumes from the step after their last saved answer

#### Scenario: Unverified email cannot claim existing progress

- **WHEN** a new anonymous visitor enters an email that already has saved progress
- **THEN** the existing progress is not exposed to them; they may only proceed via the magic-link path to resume it

### Requirement: Resume entry point on the splash

The splash page SHALL offer a "Resume your survey" affordance alongside Start; for visitors with a valid session it SHALL route directly back into the survey, otherwise it SHALL present the email → magic-link request flow with a sent-confirmation state.

#### Scenario: Resume link requested

- **WHEN** a visitor without a session uses Resume and submits their email
- **THEN** a magic-link email is dispatched and the page confirms it was sent

### Requirement: Completion closes the progress row

On final submit, the app SHALL mark the progress row completed and hand off to the existing response-capture flow (`/api/submit` → completion token → thanks). The start-step email SHALL be used as the response's report-delivery email without asking again. A completed progress row SHALL NOT resume into the question flow.

#### Scenario: Finished respondent returns

- **WHEN** a respondent who already completed the survey revisits /survey with a valid session
- **THEN** they are routed to the thank-you state rather than the question flow
