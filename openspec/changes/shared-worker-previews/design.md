# shared-worker-previews — design

## D1. Where the `previews` block lives per app

Wrangler 4.116 accepts `previews` both at top level (`RawConfig`) and inside env blocks (`RawEnvironment`). Placement follows each app's existing top-level meaning:

| App | Top-level name | `previews` placement | Sync command |
| --- | --- | --- | --- |
| web | `baseout-dev` (dev loop) | inside `env.production` | `wrangler preview settings update -e production -y` |
| server | `baseout-server` (production) | top level | `wrangler preview settings update -y` |
| admin | `baseout-admin-dev` (dev loop) | top level (targets prod script) | `wrangler preview settings update --worker-name baseout-admin -y` |

Web nests under `env.production` so `-e` resolves the worker name (`baseout-console`) naturally. Admin keeps the top-level block it already has (rendered, Aug-24) and pins the target with `--worker-name` — moving it under `env.production` would also work but churns the rendered-file promotion diff for no behavior change.

Rationale for not unifying all three shapes: top-level meaning differs historically (server's top level IS production since Aug-24; web/admin top level is the local dev loop that must not churn — §3.2 blast-radius rule).

## D2. Mirror-the-dashboard discipline

Because a pushed wrangler config **overrides** dashboard-set values for the same key (2026-08-25 call; secrets survive), every block that can reach a deployed script must contain the full binding set that script actually runs with. Production truth was read via `wrangler versions view <latest> --name baseout-console` and `wrangler preview settings --worker-name <n> --json` on 2026-08-25 — the config mirrors those, it does not invent. `ASSETS`/`IMAGES` are adapter/dashboard-managed on web (the Astro adapter emits assets; images stays dashboard-side) — admin's `env.production` already mirrors `images` and keeps it.

## D3. What previews deliberately do NOT get

- **No wrangler `routes`**: preview custom domains (`console.baseout.dev`, `admin.baseout.dev`) are attached in the dashboard (Dan). Declaring them in config would fight that ownership.
- **No Workers Builds settings**: branch pinning and build-time `DATABASE_URL` are dashboard build-config, already done (Aug-25 call).
- **No live resources**: previews pin the dev Hyperdrive (`ba2652…`), dev KV, `baseout-backups-dev` R2. Durable Objects are auto-isolated per preview (beta docs `/resources/`) — the DO binding is restated, isolation is free.
- **No `E2E_TEST_MODE` / `ADMIN_APP_URL` leakage into production vars** (standing rule in the web template comments).

## D4. Secrets

- Preview base-config secrets for `baseout-console` and `baseout-server` already exist in the dashboard (verified via `preview settings --json`: full `secret_text` rosters). Values are unreadable by design; they are assumed re-entered correctly by Dan except where a **pairing invariant** exists.
- Pairing invariants that must hold and cannot be verified read-only:
  1. ~~web-preview `BACKUP_ENGINE_INTERNAL_TOKEN` == **production** server `INTERNAL_TOKEN`~~ — superseded 2026-08-25 by D5 option A: this pair is now DELIBERATELY broken (fresh shared preview-only token on web/admin previews' `BACKUP_ENGINE_INTERNAL_TOKEN` + server preview's `INTERNAL_TOKEN`), so preview engine calls 401 at the prod gate instead of cross-writing DBs.
  2. web-preview `BASEOUT_ENCRYPTION_KEY`: previews share the **dev** DB, so it must equal the dev encryption key (the key that encrypted `*_enc` rows in `baseout-dev-pg`) or Airtable connections in previews flip `status='invalid'` (the recurring drift failure mode).
  3. web-preview `ADMIN_HANDOFF_SECRET` == admin-preview `ADMIN_HANDOFF_SECRET` — admin's preview config is empty, so this pair is set fresh on both sides in this change.
- Only (3) is executed here. (1) and (2) are listed as smoke checks — if the preview magic-link → dashboard → Airtable flow works, (2) holds; if a preview backup enqueue works, (1) holds.

## D5. Known gap: service bindings resolve to production

Beta docs (`/resources/`, verbatim): *"Service bindings from a Preview currently resolve to the bound Worker's production deployment rather than another Worker's matching Preview."* `ctx.exports` only helps same-Worker calls. Consequence: preview web/admin (dev DB) call live `baseout-server` (live DB) — run rows created by a preview won't exist in the DB the server reads.

**Options explored 2026-08-25 (probes + code reading), ranked:**

- **A — token partition (EXECUTED 2026-08-25, zero code).** A fresh random token was set as web+admin previews' `BACKUP_ENGINE_INTERNAL_TOKEN` AND server preview's `INTERNAL_TOKEN` (one shared value). Effect today: engine calls from previews fail the production server's token gate cleanly (401 → degraded UI) instead of cross-writing databases. Bonus: the value pre-stages option B — preview web ↔ preview server already share a token if the HTTP fallback lands.
- **B — HTTP fallback to the server's own staging preview (full engine flows in previews, small refactor).** `lib/backup-engine.ts` takes any `Fetcher`-shaped `binding` and always fetches `https://engine${path}`, so a URL-rewriting shim (`{fetch: (u,i) => fetch(u.replace('https://engine', base), i)}`) works without touching the 2000-line client. Cost: `env.BACKUP_ENGINE` is read directly at ~10 call sites (layouts + API routes) — they'd consolidate behind a `getEngineBinding(env)` helper that prefers a `BACKUP_ENGINE_URL` var when set (previews only). Target URL: the server's stable per-branch preview, `https://staging-baseout-server.openside.workers.dev` — **live and healthy as of 2026-08-25** (`/api/health` 200; seeded via `wrangler preview --name staging`; not Access-gated, so task callbacks and the fallback can reach it), sharing the preview `INTERNAL_TOKEN` set under option A.
- **C — preview-to-preview service bindings from Cloudflare.** The docs' *"currently"* implies roadmap. Probes showed the worker-object API stores arbitrary extra fields on service bindings (`preview_name`, `environment`, even junk) without validating semantics — nothing usable today, and that passthrough is itself feedback (it's how invalid configs linger). Ask in the beta channel whether/when it lands.

Decision at the Aug-26 regroup: A now, B if/when preview engine flows are wanted, C as the eventual native fix. The config keeps `BACKUP_ENGINE → baseout-server` (matches the dashboard) under A.

## D6. Open decision (flagged, not implemented) — with a ready-to-execute plan

Preview URLs are public by default; beta docs (verbatim): *"Preview URLs are public, so protect them with Cloudflare Access before sharing Previews that use real secrets or sensitive data."* Previews serve dev-DB data behind real auth (better-auth still gates the app), so exposure is bounded — but preview secrets include real OAuth client credentials.

**Explored 2026-08-25 — then OBSERVED LIVE: console previews are ALREADY Access-gated.** Probing the seeded staging preview showed `staging.console.baseout.dev` and `staging-baseout-console.openside.workers.dev` both 302 to `openside.cloudflareaccess.com` — a Zero Trust org exists and gates console's preview URLs (the account-level `GET /access/apps` returning empty was misleading; the gate is presumably the beta's per-Worker preview-Access integration or a zone-level app). Server + admin preview URLs are NOT Access-gated (server needs it open for Trigger.dev callbacks/HTTP fallback; admin still enforces its own staff session). Open question for Dan shrinks to: should admin previews also get the Access gate?
- The beta docs confirm Access covers the whole preview surface: *"Access applies to workers.dev URLs, Deployment URLs, and custom domain URLs"* — so one Access app can gate both `*.console.baseout.dev` previews and the `<name>-baseout-console.openside.workers.dev` URLs.
- The workers.dev *"Production and Preview URLs are toggled separately"* (the `subdomain.previews_enabled` flag on the worker object) — an alternative/complement is turning workers.dev preview URLs off so the custom preview domain is the only surface.
- Remaining ask (if wanted): extend the same gate to `baseout-admin` previews — admin's own staff-session gate already protects it, so this is defense-in-depth, not urgent.

## D7. Preview hostname catch (found 2026-08-25 — affects auth + OAuth)

**CONFIRMED EMPIRICALLY 2026-08-25** by seeding real `staging` previews of all three Workers via `wrangler preview --name staging` (no git push needed):
- Preview origin is **`https://staging.console.baseout.dev`** (Access-gated). Bare `console.baseout.dev` serves the **production** build (asset hashes identical to console.baseout.com — Dan enabled that domain for production too).
- Admin's staging preview: `https://staging-baseout-admin.openside.workers.dev` (admin.baseout.dev not attached as a preview domain yet; becomes `staging.admin.baseout.dev` when it is). Server's: `https://staging-baseout-server.openside.workers.dev` (health 200).
- Preview vars were CORRECTED accordingly and re-synced: web `PUBLIC_AUTH_BASE_URL=https://staging.console.baseout.dev`, `ADMIN_APP_URL=https://staging-baseout-admin.openside.workers.dev`; server `PUBLIC_APP_URL` and admin `WEB_APP_URL` → `https://staging.console.baseout.dev`. All three staging previews redeployed with the corrected values.
- **OAuth callbacks can now be registered for the confirmed origin** `https://staging.console.baseout.dev<callback path>` (oauth-setup.md §4 HOLD lifted).
