# shared-staff-domain-access — Proposal

## Why

In the 2026-07-15 Dan/Autumn sync, Dan reported he **cannot access the deployed admin console** (`baseout-admin-dev`) even though the admin surfaces are live. Autumn's understanding of the intended design: staff access should be granted **automatically to users with an @openside.com email domain**, and the permission configuration is currently wrong.

Today the gate is role-only. [apps/admin/src/lib/admin-session.ts:56](../../../apps/admin/src/lib/admin-session.ts#L56) `decideAccess` returns `not-super` unless `users.role === 'super'`, and on the deployed path web's `/api/admin/handoff` mints the handoff token **only** for `role === 'super'` (CLAUDE.md §6A). Dan's account is not `super`, so both the handoff mint (web) and the gate (admin) reject him. This is consistent with the existing principle that @openside.com-owned orgs auto-resolve to enterprise capabilities in web (`resolveCapabilities`) — staff-console access should follow the same domain-trust rule but currently does not.

## What Changes

- **Grant admin/staff access to verified @openside.com accounts.** A user whose session belongs to a verified `@openside.com` email is treated as staff for the admin console, in addition to the explicit `role === 'super'`. Because Baseout is magic-link only, an established session already proves email ownership — the domain check rides on an already-verified identity.
- **Apply the rule on both deployed gates.** The handoff mint in `apps/web` (`/api/admin/handoff`) and the gate in `apps/admin` (`decideAccess`) must agree, or the deployed path still fails at the first gate. The design records whether this is done by (a) resolving staff status from the domain at both gate points, or (b) auto-resolving `role='super'` for @openside.com at login so the existing role checks pass unchanged — with a recommendation.
- **Exact-domain, case-insensitive match on the email's domain part only** (`…@openside.com`), never a substring — `evil-openside.com.attacker.net` must not pass. Tested explicitly.
- **Tests (regression-first).** A failing gate test: an @openside.com session without `role='super'` is currently denied; after the change it is granted, while an @openside.com-lookalike and a non-staff external domain are still denied.

## Capabilities

### New Capabilities

- `staff-domain-access`: a verified @openside.com session is granted staff access to the admin console, on both the web handoff-mint gate and the admin session gate, without a manual role bump.

## Impact

- **apps/admin** — `src/lib/admin-session.ts` `decideAccess` (+ the `GateRow` / session lookup must carry the user email); gate tests.
- **apps/web** — `/api/admin/handoff` mint gate (deployed path) and/or login-time role resolution, depending on the design choice.
- **Master DB** — read-only if approach (a); approach (b) writes `users.role` at login (no schema change, values already `customer | super`).
- **Security review points (CLAUDE.md §3.3):** this widens who can reach the staff console — a privileged surface. Review: (1) domain match is exact on the domain part of a verified email, not substring; (2) the email is trusted only because magic-link established the session (no unverified-email path); (3) whether persisting `role='super'` by domain (approach b) is acceptable vs an ephemeral gate-time check (approach a); (4) no change to how sessions are issued — admin still only *reads* the session table.

## Out of Scope

- **Real Google Workspace SSO** for admin — deferred to the `admin` umbrella change; this is the interim domain-trust rule on the existing better-auth session.
- **Per-surface admin authorization** (which staff can do which manual action) — separate concern (`shared-admin-actions`).
- Staging/prod enablement beyond dev — follows the admin umbrella / staging-prod service-binding change.
