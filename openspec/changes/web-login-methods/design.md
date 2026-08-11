# login-methods — Design

## Context

The login page (specs/03-login.md) is deliberately minimal and stays passwordless. Two additions must not disturb the calm default: an SSO button and (for enrolled users) a challenge step. The association screen is the one genuinely new surface.

## Goals / Non-Goals

- **Goals:** calm default preserved; SSO one click; 2FA flows a non-technical admin can complete; association choice that's obvious and never blocking; every state fixture-rendered.
- **Non-Goals:** password UI of any kind (withdrawn); auth logic; standard SSO providers; org-enforced 2FA policy UI (noted follow-up).

## Decisions

1. **SSO button above the magic-link form, no method tabs.** Two paths, visually ranked: recognized-identity click vs. type-your-email. Nothing is hidden because there are only two things.
2. **The 2FA challenge is its own step, not a modal.** Survives refresh, gives lockout/backup-code states room. Code input: 6 boxes, auto-advance, paste-tolerant.
3. **The association screen is a fork, not a gate.** Two equal-weight cards — "Request to join acme's organization" / "Create my own account" — with the join card explaining admin approval. Choosing join shows a pending banner and continues into own-account onboarding anyway (matching the engine rule: never blocked on a pending request). Approval later surfaces via the notifications inbox.
4. **Backup codes are shown exactly once** at enrollment with copy + download and an "I saved these" confirmation gate. Regeneration invalidates the old set with an explicit warning.
5. **Enrollment is a 3-step inline wizard** (scan → verify → save codes) in settings; abandoning mid-flow leaves 2FA off (verify-to-activate contract).
6. **Errors are human**: "That code didn't work — codes refresh every 30 seconds"; lockouts show the wait, not a dead end; SSO cancellation reads as a shrug, not a failure.

## Where this changes the existing UI

Login view (button), two new screens (challenge, association), settings gains a Security panel.

## Risks / Trade-offs

- The association fork adds a screen to first-run SSO for known-domain users — acceptable; it replaces a worse outcome (silently split orgs or silently merged strangers).
- Static fixture QR for the harness (no live secret) — fine for design purposes.

## Component reuse

Catalog inputs/buttons/alerts/cards; code-input composed from existing input primitives; badge/list patterns for backup codes and linked identity. New pattern component only if the code input earns a second call site.
