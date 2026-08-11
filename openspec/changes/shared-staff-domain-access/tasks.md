# Tasks

## 1. Decide the approach (security-posture choice)

- [x] 1.1 Approach: **BOTH** (user, 2026-07-15) — gate-time `isStaff` at both gates (a) AND persist `role='super'` for internal users (b). Recorded in design.md S1.
- [x] 1.2 S2: **hardcode**, reusing the existing `@openside.com` precedent — web reuses `isInternalEmail`/`INTERNAL_EMAIL_DOMAINS`; admin keeps a byte-identical lockstep copy (cross-app import out of scope). No new env var (avoids `.dev.vars` drift surface). Promote-to-config is a noted follow-up.

## 2. Shared staff predicate (regression-first)

- [x] 2.1 **Red:** `isStaff` tests in `apps/admin/src/lib/admin-session.test.ts` — grants super; grants verified @openside.com; DENIES `evil-openside.com`, `openside.com.evil.net`, `sub.openside.com`, external, null-email; case-insensitive. (Verified failing before impl.)
- [x] 2.2 **Green:** `isStaff({role, email})` = `role === 'super' || isInternalEmail(email)`. In web on `apps/web/src/lib/capabilities/internal-access.ts` (reuses `isInternalEmail`); in admin a lockstep copy in `admin-session.ts` (`endsWith('@openside.com')`, `@`-anchored).

## 3. Apply at both gates

- [x] 3.1 `apps/admin`: `GateRow` now carries `email`; middleware passes it in; `decideAccess` routes through `isStaff`; reason `not-super` → `not-staff` (meaning broadened). Gate tests updated (23 pass; full admin suite 130 pass).
- [x] 3.2 `apps/web`: `/api/admin/handoff` gates on `isStaff` (deps `fetchRole` → `fetchStaff` returning `{role, email}`). Approach (b): a staff-by-domain non-super user is persisted to `role='super'` via a best-effort `promoteToStaff` (a failed write never blocks access). Admin stays read-only on auth (§6A) — persistence lives only in web. Handoff tests updated (36 web tests pass).

## 4. Verification

- [x] 4.1 `pnpm --filter @baseout/admin exec vitest run` (130 pass) + web handoff/capabilities suites (36 pass); `tsc` clean both apps (0 errors).
- [ ] 4.2 **Deployed smoke on `baseout-admin-dev` (human step)**: a real @openside.com account WITHOUT `role='super'` completes web-login → handoff → admin and lands on the tracker; a non-staff external account still gets the 403 "Staff only". Requires deploying web + admin.
- [ ] 4.3 **Security review sign-off** on the four points in proposal §Impact (exact-domain match — covered by the lookalike tests; verified-session-only; role-persistence posture accepted by user via "both"; admin still read-only on sessions). Cite in the commit `Verification` section (§3.8).

## 5. Notify Dan

- [ ] 5.1 Once deployed-dev access is confirmed, notify Dan and ask him to re-test admin access (the sync's `[Autumn] Notify Dan` step).
