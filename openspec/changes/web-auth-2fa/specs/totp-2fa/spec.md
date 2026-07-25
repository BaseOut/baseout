# totp-2fa

## ADDED Requirements

### Requirement: Users can optionally enroll an authenticator app

The system SHALL offer optional TOTP enrollment via better-auth's `twoFactor` plugin: a QR code + manual secret, activation ONLY after the user verifies a current code, and 10 single-use backup codes issued at activation. TOTP secrets SHALL be encrypted at rest with the master encryption key. Enrollment and disablement SHALL write audit rows and send notification emails; disabling SHALL require a valid current code or backup code. No password credential SHALL be introduced by this capability.

#### Scenario: Enrollment requires proof

- **WHEN** a user scans the QR but never submits a valid code
- **THEN** 2FA is not active and sign-in behavior is unchanged

#### Scenario: Disable requires a factor

- **WHEN** a user attempts to disable 2FA without a valid code or backup code
- **THEN** the request is rejected

### Requirement: 2FA challenges every sign-in method

When 2FA is enabled, completing a magic-link or Airtable-SSO sign-in SHALL land on a TOTP challenge before a full session is issued. A valid backup code SHALL satisfy the challenge and be consumed. The user MAY mark a device trusted (bounded duration), skipping the challenge on that device until expiry. Challenge attempts SHALL be rate-limited.

#### Scenario: Magic link challenges

- **WHEN** a 2FA-enabled user completes a magic-link sign-in on an untrusted device
- **THEN** a TOTP challenge is required before the session is usable

#### Scenario: SSO challenges

- **WHEN** a 2FA-enabled user completes Airtable SSO on an untrusted device
- **THEN** the same challenge step is required

#### Scenario: Backup code consumption

- **WHEN** a backup code satisfies a challenge
- **THEN** that code is invalidated, the remaining count is surfaced, and an audit row is written

#### Scenario: Trusted device skips

- **WHEN** a user signs in on a device trusted within the bounded window
- **THEN** no challenge is presented
