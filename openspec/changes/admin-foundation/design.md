## Context

`apps/admin` is a placeholder Cloudflare Worker. The parent [`admin`](../admin/) change specs the full operator console but is deferred and large. This slice makes `apps/admin` a real, runnable Astro SSR app with exactly one read-only surface, reusing as much of `apps/web`'s proven wiring as possible so the build is small and low-risk.

Constraints:
- **Must run locally today** on `baseout.local` — rules out Google SSO (rejects `.local`).
- **Must not touch customer/Airtable auth** — admin is a separate Worker; it only *reads* the session table, never issues or mutates sessions.
- **Match the PRD** for the chosen surface — PRD §5.4 / §16.1 → Organizations → Spaces tracker.
- **Don't yak-shave the schema** — `@baseout/db-schema` only holds `auth.ts` today; core tables live in `apps/web/src/db/schema/core.ts`. Mirror the few tables needed rather than blocking on extraction.

## Goals / Non-Goals

**Goals**
- `pnpm --filter @baseout/admin dev` serves a real Astro SSR app on `baseout.local`.
- A `role='super'` user who is logged into `apps/web` can open the admin URL and see every Org with its Spaces; a `customer` (or no session) gets a 403.
- Reuse `apps/web` patterns verbatim where possible (DB client, session-cookie parsing, `@baseout/ui`).

**Non-Goals**
- Google SSO, deploy/routing to `admin.baseout.com`, any write/mutating action, the audit trail, and the other 8 surfaces — all stay in `admin`.
- Extracting core tables into `@baseout/db-schema`.

## Decisions

### Astro SSR + `@astrojs/cloudflare`, mirroring `apps/web`
Reuse `apps/web`'s adapter, dev script (cert + `baseout.local` host), and `wrangler.jsonc` shape (Hyperdrive binding; local `DATABASE_URL` under the `import.meta.env.DEV` branch). A distinct dev port (e.g. 4332) on the same `baseout.local` host means the `better-auth.session_token` cookie (domain `baseout.local`, port-agnostic) set by `apps/web` is sent to admin automatically — this is *why* reusing the customer session runs locally.

### Auth gate by direct session lookup (no `better-auth` runtime in admin)
`src/middleware.ts`:
1. Parse `better-auth.session_token` from the Cookie header (helper copied from [`apps/web/src/lib/session-cache.ts`](../../../apps/web/src/lib/session-cache.ts) `extractSessionTokenCookie`). Better-auth's cookie value is `<token>.<signature>`; take the token portion before the first `.`.
2. `SELECT … FROM sessions JOIN users WHERE sessions.token = $1` (per-request Drizzle client). Reject if no row, if `expires_at <= now()`, or if `users.role !== 'super'`.
3. On reject → render a 403 page; on pass → stash `{ user }` on `context.locals` and continue.

Rationale: admin needs no login UI, no magic-link sender, no `better-auth` config — it trusts the session `apps/web` already issued. DB existence + expiry is the real check; HMAC signature verification against `BETTER_AUTH_SECRET` is a noted hardening follow-up (an attacker cannot forge a token that exists in the `sessions` table).

### Mirror only the tables this slice reads
`src/db/schema/` mirrors `organizations`, `spaces`, `space_platforms`, `subscription_items` (from `core.ts`) and re-uses `sessions`, `users` from `@baseout/db-schema/auth`. Each mirrored file carries a header comment: *"MIRROR of apps/web/src/db/schema/core.ts — canonical migration source. Keep in sync."* Same convention `apps/server` uses for `backup_runs`.

### Per-request Postgres client — via Hyperdrive (workerd)
Copy `apps/web/src/db/worker.ts` `createDb(connectionString)` (postgres-js, `prepare:false`, `search_path: 'baseout,public'`) and call it per-request. **`astro dev` runs SSR inside a workerd runner** (`@astrojs/cloudflare` + `@cloudflare/vite-plugin`), where a direct postgres-js TCP connection to the remote DB fails. So the connection string comes from the **Hyperdrive** binding (`env.HYPERDRIVE.connectionString`), miniflare-proxied to the `localConnectionString` that `scripts/dev.mjs` renders from `.env` — the same mechanism `apps/web` uses in its (wrangler-based) dev. `resolveDbUrl()` therefore always returns `env.HYPERDRIVE.connectionString`; there is no direct-`DATABASE_URL` branch.

### One page, `@baseout/ui` Table
`src/pages/index.ts`/`index.astro` queries Orgs with their Spaces + tier, renders with the shared `@baseout/ui` Table for visual consistency with `apps/web`.

## Risks / Trade-offs

- **[Risk] Reusing the customer session blurs the admin/customer auth boundary the parent design wants.** → Mitigated: read-only session lookup, separate Worker, separate deploy, no `better-auth` runtime; flagged as an explicit interim decision to be replaced by Google SSO in `admin`.
- **[Risk] Mirrored tables drift from `core.ts`.** → Header comments name the canonical source; the mirror covers only 4 read-only tables, small surface. The eventual `@baseout/db-schema` extraction (system-level change) supersedes this.
- **[Trade-off] No deploy today.** → Local-run is the agreed bar; `admin.baseout.com` routing + deploy is a fast follow-up once the slice is proven.

## Open Questions

| # | Question | Default |
|---|---|---|
| F1 | Verify session cookie token vs. signature split (does `sessions.token` store the pre-`.` portion?) | Confirm against a live session during implementation; fall back to matching the full value if better-auth stores it whole. |
| F2 | Admin dev port | 4332 (next to web's 4331), revisit if it collides. |
