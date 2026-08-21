# Auth

Admin currently has no login runtime of its own. It reuses `apps/web`'s
better-auth session, either via the shared local cookie or a deployed handoff
token from web.

Local dev reads the shared `better-auth.session_token` cookie, while deployed
dev receives a short-lived AES-GCM handoff token from web's
`/api/admin/handoff` and stores the same session value in
`baseout_admin_session`.

Access is gated by the shared staff predicate: `users.role === 'super'` OR a
verified exact-domain `@openside.com` email. The web handoff mint and admin
middleware both apply this rule so the deployed path cannot pass one gate and
fail the other. Web also best-effort promotes verified `@openside.com` users to
`role='super'`; admin remains read-only on sessions and user rows.

## Staff Predicate

Staff identity check happens in middleware via `decideAccess`:

- Session lookup joins Better Auth's `sessions` row to the linked `users` row.
- Expired or missing sessions are denied.
- `role === 'super'` is granted.
- Otherwise, email is lowercased and must end with the exact suffix
  `@openside.com`; lookalikes such as `@openside.com.evil.net` are denied.

Google Workspace SSO remains deferred to the broader admin umbrella change.

## CSRF

All mutating forms in `apps/admin` use better-auth CSRF helpers, the same way `apps/web` does. Raw POST handlers without a CSRF token are forbidden.

## Where to Look

Pointers to root rules and the related auth surface.

- Root security model: [root security-model](../../../lat.md/security-model.md)
- Frontend auth (for comparison): [apps/web auth](../../web/lat.md/auth.md)
- Admin session gate: [src/lib/admin-session.ts](../src/lib/admin-session.ts)
- Web handoff mint: [apps/web handoff](../../web/src/pages/api/admin/handoff.ts)
