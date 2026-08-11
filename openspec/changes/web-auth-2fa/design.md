# web-auth-2fa — Design

## Decision 1 — 2FA without passwords is coherent, and challenges every method

Magic link is a single factor (email possession). A user who enrolls 2FA is saying that's not enough — so the challenge applies to **all** first factors equally: magic link and Airtable SSO. Challenging selectively would leave a bypass through the unchallenged method. Trade-off (magic link + TOTP means two proofs on every fresh sign-in) is softened by the 30-day trusted-device option. better-auth's `twoFactor` plugin challenges on sign-in generically — configuration, not custom code.

## Decision 2 — Plugin-native everything; no custom crypto

better-auth built-ins only: TOTP implementation, backup-code generation, trusted-device handling, rate limiting. One addition: **TOTP secrets encrypted at rest** with the existing master key via the plugin's storage hooks — same posture as OAuth tokens. We configure, we don't invent.

## Decision 3 — Backup codes are the only recovery path; support is the backstop

Losing the authenticator with unspent backup codes = self-service. Losing both = support-assisted identity verification (manual, deliberate — an automated weak recovery path would undo the factor). Settings UX (ui-only) makes the codes' importance loud at enrollment.

## Decision 4 — Optional now; org-enforced later

2FA is per-user opt-in. The natural Business/Enterprise follow-up — an Organization policy requiring members to enroll — is noted for the capability matrix (a clean paid-tier governance gate) but not built here.

## Open questions

1. Trusted-device duration — 30 days proposed; confirm with Dan.
2. Should the 2FA challenge also gate the admin-console handoff (`/api/admin/handoff`)? Recommend yes for `role='super'` users once enrolled — cheap hardening; confirm scope.
