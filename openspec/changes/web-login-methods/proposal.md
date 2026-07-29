# login-methods — Proposal

## Why

Login is a single magic-link email field today. The main repo is adding optional TOTP two-factor and "Continue with Airtable" SSO (founder direction, 2026-07-25 — Baseout stays **passwordless**; the earlier password direction was withdrawn). The login surface, the 2FA flows, and a new-user association screen need UI.

## What Changes

- **Login page**: magic link stays the primary, pre-focused path; a **"Continue with Airtable"** button sits above the form (brand-compliant mark) with microcopy "Uses your Airtable account email — doesn't connect your data." No password field anywhere.
- **2FA challenge step**: a dedicated post-login step — 6-digit code input (auto-advancing, paste-tolerant), "Use a backup code" swap, "Trust this device for 30 days" checkbox, human error and lockout states.
- **Domain-association screen** (new-user signups — **magic link AND SSO**, founder direction 2026-07-25): when the main repo's association logic finds an existing Organization for the user's company domain — "We found an existing Baseout organization for `acme.com`" with **Request to join** and **Create my own account** actions; a pending-request state that never blocks proceeding independently; the admin-side approval appears in the existing notifications surface. One screen, both entry paths.
- **Account security settings panel**: 2FA enrollment flow (QR + manual secret → verify code → backup codes shown once with copy/download and a save-confirmation gate), 2FA status + code-gated disable, backup-code regeneration with invalidation warning, linked Airtable identity row (linked/unlinked).
- **Fixtures** for every state: challenge (fresh/wrong-code/lockout/backup-code/trusted), enrollment mid-flow, SSO error, association offer/pending, linked/unlinked identity.

## Capabilities

### New Capabilities

- `login-methods`: SSO-augmented login surface, 2FA challenge + enrollment UI, and the domain-association screen.

### Modified Capabilities

None — the existing magic-link flow keeps its default position and behavior.

## Impact

- `apps/web/src/views/` login view + challenge + association screens; account settings security panel; small composed pieces (code input, backup-code list) from catalog primitives
- `apps/design` fixtures + harness page (`?state=challenge|enroll|locked|sso-error|assoc|assoc-pending`)
- No backend/DB detail in this repo — UI only. Pairs with baseout `web-auth-2fa`, `web-auth-airtable-sso`, and `web-signup-domain-association` (the shared fork both signup paths invoke).
