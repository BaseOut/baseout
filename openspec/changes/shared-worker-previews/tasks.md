# shared-worker-previews — tasks

Config/scripts/docs only — no runtime code, so no new Vitest surface (§3.4 n/a). Verification = render + `wrangler preview settings update` dry confirmation + human smoke on the preview URLs.

## 1. Template promotion (rendered → committed)

- [x] 1.1 `apps/server/wrangler.jsonc.example`: promote rendered Aug-24 state (live Hyperdrive/R2/vars, top-level crons, `previews` block) with `{{DATABASE_URL}}` placeholders; drop `env.staging` stub. — _also corrected env.dev `PUBLIC_APP_URL` back to `https://baseout.local:4331` (the rendered file's blanket Aug-24 edit had pointed local report links at the preview domain)._
- [x] 1.2 `apps/admin/wrangler.jsonc.example`: promote rendered `previews` block + `env.production` + routes comment.
- [x] 1.3 Re-render both (`launch.mjs render-config` / `deploy` path) and diff rendered vs pre-existing rendered — zero behavioral delta expected. — _verified: diffs are comments-only apart from the two intentional deltas (env.staging removal, env.dev PUBLIC_APP_URL); all ids shape-checked via JSONC parse._

## 2. apps/web template

- [x] 2.1 `env.production` rewritten to mirror the deployed `baseout-console` version (name, live Hyperdrive `62a17f…`, KV `962f82…`, service binding, prod vars); stale `baseout` name + placeholders removed.
- [x] 2.2 `env.production.previews` block added (dev Hyperdrive `ba2652…`, dev KV, service binding, EMAIL, preview vars incl. `console.baseout.dev` / `admin.baseout.dev` / `E2E_TEST_MODE`).
- [x] 2.3 `env.staging` removed; header comments updated (deploy targets, previews model).

## 3. Sync scripts

- [x] 3.1 `preview:sync` npm script in each of web / server / admin (render first, then `wrangler preview settings update` with the per-app flags from design.md D1; `-y`).

## 4. Push + secrets (human-approved, mutates deployed state)

- [x] 4.1 Run `preview:sync` for server. — _DONE 2026-08-25 after root-causing 10013: a secretless HYPERDRIVE row stored in previews_base_config (Aug-24 import) made EVERY worker-object PATCH fail validation; healed by re-stating the binding WITH the `password` secret, then preview:sync ran green._
- [x] 4.2 Run `preview:sync` for web. — _DONE 2026-08-25. The 10024 hyperdrive gate is solved: the required secret is the origin DB `password` field on the binding (undocumented; wrangler never sends it) — seeded once via raw API, after which preview:sync ran green. Console previews complete on both preview_defaults + previews_base_config._
- [x] 4.3 Run `preview:sync` for admin. — _DONE 2026-08-25, same heal as 4.1 (poisoned hyperdrive row), then preview:sync green: BACKUP_ENGINE, HYPERDRIVE(dev), SESSION(dev), WEB_APP_URL=console.baseout.dev._
- [x] 4.4 Mint fresh `ADMIN_HANDOFF_SECRET` on BOTH console + admin previews. — _DONE 2026-08-25 post-heal: one fresh value set on both via `wrangler preview secret put` (byte-identical pair)._

## 5. Runbooks (same change)

- [x] 5.1 `shared/internal/cloudflare-env-separation.md`: beta-docs URLs, previews-block model, wrangler-overrides-dashboard rule, sync scripts, D5 service-binding gap, D6 Access decision.
- [x] 5.2 `shared/internal/oauth-setup.md`: §3 preview-origin gap rows + §4 checklist (register `https://console.baseout.dev/...` callbacks per provider) — registration itself is human/provider-console work. — _also remapped oauth-setup §1 env table (baseout-staging/baseout rows were fictional; prod=console.baseout.com on baseout-console, preview=console.baseout.dev) and removed the dead `deploy-staging` CI job (if:false-gated, called the deleted npm script)._

## 6. Smoke (human)

- [ ] 6.1 Human smoke after Dan sets `console.baseout.dev` Enable for **Preview** only: open `https://console.baseout.dev` (not `staging.console.baseout.dev`), magic-link login works. Until that dashboard flip, apex `.dev` is production — do not preview:sync origin vars. Server preview `staging-baseout-server…/api/health` 200; admin preview still on workers.dev (`admin.baseout.dev` has no DNS).
- [ ] 6.2 Airtable Connect on the preview stays `status='active'` (proves encryption-key pairing, D4-2) — register callbacks for `https://console.baseout.dev`, not `staging.console.baseout.dev`.
- [ ] 6.3 Regroup with Dan (Aug-26) — now approvals only: D5 executed as token partition (option B staged if engine flows wanted in previews); D6 mostly moot (console previews ALREADY Access-gated — only ask: gate admin previews too?); D7 resolved empirically; D5 service-binding gap, D6 Cloudflare Access, PLUS Cloudflare feedback (all self-healed, docs/product gaps): undocumented hyperdrive `password` requirement wrangler never sends; a stored secretless hyperdrive row bricking worker-object PATCH as generic 10013; dashboard import creating those poisoned rows. Details in cloudflare-env-separation.md 2026-08-25 section.
