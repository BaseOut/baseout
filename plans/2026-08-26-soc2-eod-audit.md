# SOC2 EOD audit — prod / staging / local (2026-08-26)

**Constraint:** SOC2 demo today needs a production-shaped console + an isolated staging/preview, not the entire PRD Must Have list. Full V1 per PRD §9–§10 is months of work (restore writes, all BYOS, D1→PG migration jobs, SQL API, inbound API, On2Air migration, dedicated PG, BYODB, Slack/Teams, etc.).

**Env model (Dan Aug-25, not PRD §18 as written):** one Cloudflare account; one Worker per app (`baseout-console`, `baseout-server`, `baseout-admin`); Production vs Worker Previews. Not separate Cloudflare accounts. Not Cloudflare Pages. Staging = Previews, not a `baseout-staging` script.

---

## Dan — need in this meeting (blocks EOD)

These cannot be finished from Autumn’s Flagship role / this repo alone.

1. **Mint two durable tokens** (or Super Admin so Autumn can mint):
   - `CLOUDFLARE_D1_API_TOKEN` — Account → D1 → Edit (engine Worker only).
   - R2 S3 API tokens — Object Read/Write **and CreateBucket** for managed backups (Trigger.dev Node runner; not Worker bindings). Account API token UI is hidden from Autumn.
2. **Put those R2 creds in Trigger.dev** Production + preview/dev envs: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, plus bucket names (prod bucket ≠ preview/dev bucket).
3. **Register OAuth redirect URIs** (Airtable already 400s on prod):
   - `https://console.baseout.com/api/connections/airtable/callback`
   - `https://console.baseout.dev/api/connections/airtable/callback` (and Drive/Box/Dropbox/OneDrive when those are in the demo).
   - Preview needs **separate** OAuth client secrets on the Worker (`wrangler preview secret`) — do not copy prod secrets.
4. **Master DB on live Hyperdrive:** run frontend migrations (incl. `0039` D1 locator columns). Hyperdrive origin password is write-only in the dashboard; DO login has been broken — Dan has to apply or paste `DATABASE_URL` for `db:migrate`.
5. **Decide staging hostname for the demo:** Enable for Preview on `.dev` only publishes `<name>.console.baseout.dev`. Apex `console.baseout.dev` still answers like production. Wrangler cannot pin a Preview to the apex. Either demo `staging.console.baseout.dev` today or Cloudflare binds the apex before the SOC2 walkthrough.
6. **Preview must not write the live engine DB.** Service bindings from Previews hit **production** `baseout-server`. Without a preview-only `INTERNAL_TOKEN` (fail closed) or a preview engine Worker, a staging backup can mutate live.

---

## What already exists (code)

| Slice | Status |
|---|---|
| Auth (magic-link, better-auth), org/space model, dashboard, backup UI | Shipped |
| Engine DOs, Trigger.dev `backup-base`, CSV writers | Shipped |
| Managed R2 **writer code** + per-org `ensureAccountBucket` helper | Code yes; **live creds/buckets no** (runbook still ❌ MISSING) |
| D1 provision + schema-sync/read | Code yes; **deployed token no** (local smoke 2026-08-25 with wrangler OAuth bearer) |
| New Spaces still default **`managed_pg`**, storage default **`r2_managed`** | Defaults ≠ PRD entry tier (D1) until token + posture flip |
| Restore UI + task | Code; **Airtable write scopes + target-base creation gated** — not a live restore |
| Worker Previews `previews {}` + `preview:sync` | Templates landed; Hyperdrive password heal done |
| Admin foundation | Local + `baseout-admin-dev`; prod admin is partial |
| Local: `pnpm --filter @baseout/web dev` + Hyperdrive `baseout-dev-pg` | Works |

**V1 Must Haves not demo-ready today:** live R2 backups, live D1 Spaces, restore-to-Airtable, Instant webhooks as default, Frame.io/S3 as dest, SQL REST + direct SQL, inbound API, DB tier migration job, On2Air `dynamic_locked`, most notification templates, PRD §18 separate CF accounts.

---

## EOD implementation plan (SOC2 slice)

### Production (`console.baseout.com` / `baseout-console` + `baseout-server`)

1. Dan tokens + Trigger.dev `R2_*` → **prod bucket only** (e.g. `baseout-backups-prod` or per-org CreateBucket).
2. `db:migrate` on live PG.
3. Engine secret `CLOUDFLARE_D1_API_TOKEN` on **production** `baseout-server`; redeploy.
4. Airtable (and any demo BYOS) callback URIs on `.com`.
5. Smoke: magic-link → Connect Airtable → Run backup → CSV (+ attachments if time) in **prod R2** → run shows succeeded. Do **not** use preview console for this smoke.

### Staging (Worker Previews, isolated)

1. Preview Hyperdrive stays **`baseout-dev-pg`** (the DB Autumn already migrates) — never `baseout-live-pg`.
2. Preview R2 = **`baseout-backups-dev`** (or a dedicated preview bucket), separate S3 token.
3. Preview `INTERNAL_TOKEN` ≠ prod (D5) so engine calls 401 instead of writing live — **or** bind a preview `baseout-server` if Dan chooses that in the meeting.
4. Preview OAuth secrets + `.dev` (or `staging.console…`) callback URIs.
5. Do **not** `preview:sync` `PUBLIC_AUTH_BASE_URL=https://console.baseout.dev` until the apex actually serves a Preview (or accept `staging.console.baseout.dev` for today).
6. Smoke on the **real preview host** only: login, connect, backup into **dev** R2/D1.

### Local (Dan: not in the dashboard)

Match staging/prod **shape**, not their data:

| Piece | Local |
|---|---|
| Web | `pnpm --filter @baseout/web dev` → `https://baseout.local:4331` |
| Engine | `wrangler dev` / `pnpm --filter @baseout/server dev` — **local DOs** |
| Master DB | `DATABASE_URL` → same **dev** PG as preview Hyperdrive (`baseout-dev-pg` origin) |
| R2 | `apps/workflows/.env` `R2_*` → **dev bucket only**; `npx trigger.dev dev` |
| D1 | durable token in `apps/server/.dev.vars` after Dan mints it |
| Secrets | never copy prod `BETTER_AUTH_SECRET` / encryption key / OAuth clients |

Builds (Workers Builds container): `DATABASE_URL` secret for migrate — Hyperdrive is not available at build time (Dan Aug-25).

---

## After the meeting (Autumn, same day)

Order: tokens in → migrate live → engine/web secret sync → Trigger.dev R2 → OAuth URIs confirmed → prod backup smoke → preview token-partition + preview smoke → local `.env` mirrors preview/dev.

If Dan cannot mint tokens in the meeting, **stop** and show SOC2 a **production-shaped UI on live console** without claiming managed R2/D1 isolation — that would be a false demo.
