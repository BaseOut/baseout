# shared-staff-domain-access — Design

## Context

The admin console has no login of its own — it reuses web's better-auth session and gates on `users.role === 'super'` (CLAUDE.md §6A). Two enforcement points exist on the deployed path: web's `/api/admin/handoff` (mints the 60s handoff token, gated on `role='super'`) and admin's `decideAccess` ([admin-session.ts:56](../../../apps/admin/src/lib/admin-session.ts#L56)). Dan (@openside.com, not `super`) is rejected at the first. Web already trusts the @openside.com domain for capability resolution (`resolveCapabilities`, per the auto-memory), so extending domain-trust to staff-console access is consistent — but it must hold at **both** gates or the deployed handshake still fails.

## Goals / Non-Goals

**Goals:** a verified @openside.com user reaches the admin console with no manual role bump; the rule is enforced identically on the web handoff mint and the admin gate; the domain match is unspoofable; admin stays read-only on sessions.

**Non-Goals:** Google Workspace SSO (admin umbrella); per-action authorization; issuing/mutating sessions from admin; unverified-email access.

## Decisions

1. **Trust the domain only on an already-verified session.** Baseout is magic-link only — an active session means the email was verified at magic-link time. The domain check therefore rides on a verified identity; there is no path that trusts an unverified email.
2. **Exact match on the domain part, case-insensitive.** Extract the substring after the final `@`, lowercase, compare `=== 'openside.com'`. Never `email.includes('openside.com')` (spoofable by `x@openside.com.evil.net`). This is the single security-critical line; it gets its own test.
3. **Approach (a) — resolve staff status from the domain at both gate points — is recommended over (b) auto-promoting `role='super'`.** Rationale: (a) keeps the privileged `super` role as an explicit, human-granted attribute and makes the domain rule a *console-access policy* rather than a persisted privilege escalation; it is also purely additive and trivially reversible. (b) (writing `role='super'` at login for @openside.com) is simpler downstream (every existing `super` check just works) but persists a privileged role as a side effect of logging in, which is a heavier security posture. Record the chosen approach here before implementing; if (a), both `decideAccess` and the handoff mint gain the same `isStaff(role, email)` helper.
4. **Single shared predicate.** Implement one pure `isStaff({ role, email })` (grants on `role === 'super'` OR verified `@openside.com`) and call it from both gates so they cannot drift. If a shared package isn't warranted for one function, duplicate the *tested* predicate with a header-comment cross-reference rather than importing across apps.
5. **`GateRow` must carry the email.** `decideAccess` currently only sees `{ role, expiresAt }`; the session→user lookup must also select the email so the gate can apply the domain rule. Additive to the query.

## Risks / Trade-offs

- **[Widening a privileged surface]** → bounded to exact `@openside.com` on a verified session; lookalike domains and external domains explicitly tested as denied. This is the security-review crux (proposal §Impact).
- **[Two gates drifting]** → mitigated by the single shared predicate (Decision 4).
- **[Approach (b) persists role escalation]** → mitigated by recommending (a); if (b) is chosen, document the reversal path.
- **[Local dev already works via shared cookie]** → the deployed handoff path is where Dan is blocked; verify against `baseout-admin-dev`, not just local.

## Migration Plan

Additive on both gates — no data migration under approach (a). Ship web handoff-mint change + admin gate change together (a half-fix still fails the deployed handshake). Rollback: remove the domain branch from `isStaff` — behavior returns to role-only. Verify on `baseout-admin-dev` with a real @openside.com non-`super` account.

## Open Questions

| # | Question | Default answer |
|---|----------|----------------|
| S1 | Approach (a) gate-time domain check vs (b) auto-`super` at login? | **RESOLVED 2026-07-15 (user): BOTH.** Implement the gate-time `isStaff` predicate at both gates (a) AND auto-assign `role='super'` to verified @openside.com users at login (b). (b) makes the deployed handoff-mint + gate pass via the existing `super` checks; (a) is defense-in-depth for sessions whose persisted role hasn't yet been updated. User accepted (b)'s persisted-role posture. |
| S2 | Should the domain be config-driven (`STAFF_EMAIL_DOMAIN`) vs hardcoded `openside.com`? | **RESOLVED: hardcode**, reusing the existing `INTERNAL_EMAIL_DOMAINS`/`isInternalEmail` precedent (web) with a byte-identical lockstep copy in admin. A new env var means new `.dev.vars` surface across two apps (drift risk the auto-memory warns about) for a value that hasn't changed. Promote-to-config is a follow-up if staging/prod ever needs a different domain. |
| S3 | Does any non-@openside.com person need staff access today? | If yes, they get an explicit `role='super'` — the domain rule is additive, not a replacement. |
