# web-signup-domain-association — Proposal

## Why

Two signup paths now exist (magic link, and Airtable SSO via [`web-auth-airtable-sso`](../web-auth-airtable-sso/proposal.md)), and both face the same question the moment a new user arrives from a company domain that already has a Baseout Organization: silently give them a lonely separate account (splitting a team across orgs), or be smart about association. Founder direction (2026-07-25): offer the choice on **both paths** — request to join the existing organization, or continue in your own account. This change owns the method-agnostic association machinery both consume.

## What Changes

- **Known-domain resolution:** an Organization's domains derive from its members' verified email domains, excluding a maintained **public-email-provider denylist** (gmail, outlook, etc.); an explicit **`organization_domains`** override table handles edge cases (multi-domain orgs; domains an org wants ignored).
- **The association fork at account creation:** when a new user's verified email domain is non-public and matches an existing Organization's known domains, signup — **magic-link and SSO alike** — SHALL offer *request to join* alongside *create my own account*. Join requests notify the org's admins (approve/decline, bounded expiry); a pending request **never blocks** the user, who proceeds in their own account meanwhile; approval converts to membership with notification. **Auto-join is rejected** (domain possession ≠ authorization — the approval step is the takeover safeguard).
- **Join-request lifecycle:** request rows (requester, target org, status, expiry ~7 days), admin approve/decline actions, audit rows, notifications via existing channels.
- **Unknown or public domains:** unchanged behavior — new account + Organization, standard onboarding.

## Capabilities

### New Capabilities

- `signup-domain-association`: known-domain resolution, the join-or-create fork on every signup path, and the join-request lifecycle.

### Modified Capabilities

None — existing signup outcomes are preserved for unknown/public domains; this adds a consensual path where a silent split used to be the only option.

## Impact

- **App:** `apps/web` only — migration (`organization_domains`, join-request rows), derivation query, fork hook in both signup flows, admin approve/decline routes, notifications.
- **Consumers:** magic-link signup (this change wires it) and [`web-auth-airtable-sso`](../web-auth-airtable-sso/proposal.md) (its resolution ladder's no-match branch delegates here — that change's spec references this capability rather than owning it).
- **UI:** the fork screen + pending banner live in ui-only `login-methods` (shared across both paths).
- **Security review points (§3.3):** email-verification precondition on both paths (magic link verifies by possession; SSO by Airtable), denylist maintenance, join-approval as the anti-squatting gate, audit coverage.
