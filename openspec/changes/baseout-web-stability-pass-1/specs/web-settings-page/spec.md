## ADDED Requirements

### Requirement: Settings page renders V1 essentials
The `/settings` page SHALL render four cards: trial-state badge, sign-out button, organization info (read-only), and account-deletion request CTA. The page MUST be accessible to any authenticated user via the existing sidebar navigation.

#### Scenario: Authenticated user lands on /settings
- **WHEN** an authenticated user navigates to `/settings`
- **THEN** the page SHALL render the trial-state card
- **AND** the page SHALL render the sign-out button
- **AND** the page SHALL render the organization info card
- **AND** the page SHALL render the account-deletion request card

#### Scenario: Unauthenticated user is blocked from /settings
- **WHEN** an unauthenticated request hits `/settings`
- **THEN** the existing middleware SHALL redirect to `/login`
- **AND** no settings markup SHALL be returned

### Requirement: Trial-state card shows accurate countdown
The trial-state card SHALL display the user's organization tier and, when the organization is in a trial, a human-readable countdown to `trial_ends_at`. The card MUST use soft-tinted badges per the design system: warning tint when ≤ 2 days remain, primary tint otherwise.

#### Scenario: Organization in active trial with 5 days remaining
- **WHEN** `account.organization.trial_ends_at` is 5 days in the future
- **THEN** the card SHALL display "Trial expires in 5 days"
- **AND** the badge SHALL use `badge-soft badge-primary` styling

#### Scenario: Organization in active trial with 1 day remaining
- **WHEN** `account.organization.trial_ends_at` is 1 day in the future
- **THEN** the card SHALL display the countdown
- **AND** the badge SHALL use `badge-soft badge-warning` styling

#### Scenario: Organization on a paid plan
- **WHEN** the organization has a non-trial tier (Pro / Growth / Business)
- **THEN** the card SHALL display the plan name as a `badge-soft badge-primary`
- **AND** no countdown SHALL render

### Requirement: Sign-out button terminates the session
The sign-out button SHALL invoke `authClient.signOut()`, clear all user-scoped nanostores (`$account`, `$spaces`, `$integrations`), and redirect the browser to `/login`. The button MUST show a loading spinner during the round-trip per the project's loading-state discipline.

#### Scenario: User clicks sign-out from /settings
- **WHEN** the user clicks the sign-out button
- **THEN** the button SHALL show a loading spinner
- **AND** `authClient.signOut()` SHALL be called
- **AND** `$account`, `$spaces`, `$integrations` SHALL be reset to null
- **AND** the browser SHALL navigate to `/login`

### Requirement: Account-deletion request opens a confirm modal
The account-deletion request CTA SHALL open a modal that requires explicit confirmation before any request is sent. The modal MUST use `setButtonLoading` on the confirm button while the POST is in flight. If the underlying `deletion_requests` schema is not yet present in the master database, the page MAY render the CTA as disabled with a tooltip explaining the temporary state, deferring the live POST to a follow-up change.

#### Scenario: User clicks "Request account deletion"
- **WHEN** the user clicks the deletion CTA
- **THEN** a modal SHALL open requiring explicit confirmation
- **AND** the confirm button SHALL be styled as a destructive action

#### Scenario: User confirms deletion request and schema is present
- **WHEN** the user confirms in the modal
- **AND** the `deletion_requests` table is available in the master DB
- **THEN** a POST SHALL be sent to `/api/account/delete-request`
- **AND** the confirm button SHALL show a loading spinner during the request
- **AND** on success the modal SHALL close and a success toast SHALL render

#### Scenario: deletion_requests schema is not yet provisioned
- **WHEN** the page renders and the master-DB schema lacks `deletion_requests`
- **THEN** the deletion CTA MAY be rendered disabled
- **AND** a tooltip SHALL explain that the feature is pending
- **AND** no POST SHALL be made
