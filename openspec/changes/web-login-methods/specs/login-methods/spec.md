# login-methods

## ADDED Requirements

### Requirement: The login page adds SSO without disturbing the magic-link default

The login page SHALL keep magic link as the primary pre-focused form and SHALL show a brand-compliant "Continue with Airtable" button with microcopy clarifying it does not connect data. No password input SHALL exist anywhere on the surface.

#### Scenario: Default view

- **WHEN** the login page renders
- **THEN** the magic-link field is focused, the Airtable button is visible above it, and no password affordance exists

### Requirement: The 2FA challenge is a dedicated step

After any sign-in method for a 2FA-enrolled user, a full-screen challenge SHALL render: auto-advancing 6-digit input, a backup-code swap, a bounded "trust this device" checkbox, and human-readable error and lockout states.

#### Scenario: Challenge after SSO

- **WHEN** the fixture renders the post-SSO challenge state
- **THEN** the code input, backup-code link, and trust checkbox render, and a wrong-code state shows the human error copy

#### Scenario: Lockout

- **WHEN** the lockout fixture renders
- **THEN** the wait time is displayed and inputs are disabled without a dead end

### Requirement: New-user domain association is a non-blocking fork on every signup path

When any signup path — magic link or SSO — detects an existing Organization for the user's company domain, the same association screen SHALL present two equal-weight choices — request to join (explaining admin approval) or create their own account — and a pending join request SHALL render as a banner while the user proceeds independently.

#### Scenario: Known-domain fork

- **WHEN** the association fixture renders for `acme.com`
- **THEN** both cards render with the join card naming the organization and explaining approval

#### Scenario: Same screen from magic link

- **WHEN** the association fixture renders in the magic-link signup variant
- **THEN** the identical screen renders (entry path changes nothing about the fork)

#### Scenario: Pending never blocks

- **WHEN** the user requests to join and continues
- **THEN** onboarding proceeds in their own account with a pending banner visible

### Requirement: Security settings cover the 2FA lifecycle and linked identity

The account security panel SHALL offer: a 3-step 2FA enrollment wizard (scan → verify → save backup codes with copy/download and a save-confirmation gate), 2FA status with code-gated disable, backup-code regeneration with an invalidation warning, and the linked Airtable identity row in linked and unlinked states.

#### Scenario: Enrollment abandoned mid-wizard

- **WHEN** the user leaves after scanning but before verifying
- **THEN** the panel shows 2FA still off (verify-to-activate)

#### Scenario: Backup codes shown once

- **WHEN** enrollment completes
- **THEN** codes render once with copy/download and dismissal requires the save confirmation
