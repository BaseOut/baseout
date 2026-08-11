# Tasks

> **Status 2026-07-18:** built (§1, §2.1/2.3, §3). Remaining: 4.1 framed-harness
> smoke (needs the running app — human loop), 4.2 full `astro check` (blocked by
> the checkout's pre-existing ungenerated-wrangler-types errors, which also hit
> untouched files).
>
> **Update:** 2.2's forged-POST CSRF integration test is now written
> (`tests/integration/auth-csrf-origin.test.ts`). It exercises the real
> better-auth stack via `seedAuthedUser`. It could NOT be run in the authoring
> environment (no Docker/local Postgres) — run it on the human loop:
> `pnpm --filter @baseout/web test:db:up && pnpm --filter @baseout/web test:integration`.

## 1. Protocol package (packages/embed-protocol)

- [x] 1.1 Scaffold `@baseout/embed-protocol` (pure TS, zero runtime deps, vitest node runner) and register it in the workspace.
- [x] 1.2 Types + envelope: `PROTO='baseout-embed/1'`, message catalog types, `EmbedContext`, envelope encode/parse with malformed/unknown-input tolerance. Tests first. → `src/messages.ts`, 8 tests.
- [x] 1.3 Allowlist parser/matcher: exact origin, `https://*.sub` single-level wildcard, `chrome-extension://<id>` and `chrome-extension://*`; origin-only matching. Tests: match table incl. apex/multi-level non-matches. → `src/origins.ts` (+ `frameAncestorsValue` mapping `chrome-extension://*` → the CSP scheme-source `chrome-extension:`), 16 tests.
- [x] 1.4 `createChildBridge`: ready-beacon loop, `hello` origin validation + lock, ack, post-handshake send/receive on locked origin, context-update callback, `status`/`resize`/`open-external` senders. Tests with delivery-order permutations. → `src/child.ts`.
- [x] 1.5 `createHostBridge`: iframe wiring, `hello` retry-until-ack with configured child origin, exact-origin inbound validation, context push, `open-external` same-origin/allowlist refusal. → `src/host.ts`. Suite total: 32 tests green; `tsc --noEmit` clean; tsup build clean.

## 2. Web: headers + cookies

- [x] 2.1 Middleware: `frame-ancestors 'self' <allowlist>` on HTML responses from `PUBLIC_EMBED_ALLOWED_ANCESTORS` (protocol parser); no `X-Frame-Options`. → `src/lib/embed/frame-headers.ts` applied via `sequence()` wrapper in middleware.ts (all return paths covered, immutable-response clone fallback, never clobbers an existing CSP). Tests: frame-headers.test.ts + middleware suite (28) green.
- [x] 2.2 better-auth cookie attributes → `SameSite=None; Secure` via `resolveCookieAttributes` in `auth-factory.ts` (local-dev plain-cookie mode stays Lax — None-without-Secure is browser-dropped). Unit tests added. Forged cross-site POST CSRF regression test added in the integration suite (real better-auth stack): `tests/integration/auth-csrf-origin.test.ts` — asserts a cookie-bearing sign-out POST from an untrusted origin (and one with no Origin header) is rejected 403 with the session row intact, while the trusted first-party origin succeeds (session revoked). Pins `defaultCookieAttributes` to SameSite=None so the guard can't silently lose its subject. **Run on the human loop — no Docker/PG in the authoring env** (`pnpm --filter @baseout/web test:db:up && test:integration`). §3.3 security-review points recorded in the design (Decision 9).
- [x] 2.3 Documented `PUBLIC_EMBED_ALLOWED_ANCESTORS` in `wrangler.jsonc.example` vars (dev value: airtable.com + *.airtableblocks.com + chrome-extension://*). It is a var, not a secret — `.dev.vars` intentionally untouched.

## 3. Web: embed entry + context

- [x] 3.1 `src/stores/embed.ts`: `$embed` nanostore + sessionStorage persistence (`hydrateEmbedFromSession`/`setEmbedState`), `resetEmbed()` wired into the AppShellSidebar logout handler.
- [x] 3.2 `src/lib/embed/resolve-route.ts`: pure `resolveEmbedRoute` (known base → `/schema?baseId=…`, known-but-excluded/unknown → `/sources?unbackedBase=…`, no base → `/`). 4 tests.
- [x] 3.3 `/embed` page + client bootstrap (`src/lib/embed/client.ts`): boots child bridge, stores context, navigates on pathname change only (param-level context moves update the store — no reload churn); page-load singleton guards the double-boot (embed page + Layout both import it); Layout re-boots the bridge after full-page navigations and re-stamps `data-embed` on astro:after-swap. `/embed` added to middleware PUBLIC_PATHS.
- [x] 3.4 Unauthenticated path: minimal sign-in prompt on `/embed`; action sends `child:open-external` (standalone sign-in URL) with a window.open fallback when unframed; bridge reports `authenticated` in the hello-ack.

## 4. Verification

- [ ] 4.1 Local harness page (scratch, not shipped) framing `https://baseout.local:4331/embed` from an allowlisted origin: handshake completes, context navigates, headers present. **Human loop — needs the dev app running.**
- [x] 4.2 Test suites green: protocol package 32, web unit suite 1161 (104 files) incl. new frame-headers/resolve-route/auth-factory/middleware coverage. `astro check` carries only the checkout's pre-existing ungenerated-wrangler-types error class (hits untouched files like SidebarLayout.astro identically); no new error types introduced.
- [x] 4.3 Cross-reference: paired with `openspec/changes/embed/` (proposals link both ways). oauth-setup.md needs no update — no redirect-URI changes (sign-in is always top-level; recorded in proposal Impact).
