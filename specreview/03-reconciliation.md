## Spec drift — items needing reconciliation

> **Note (2026-05-13 update):** §1, §3, §6, §9 are partly or fully resolved by the pulled changes. New drift introduced (R2 removal vs proposals still naming R2). See [05-update-2026-05-13b.md](./05-update-2026-05-13b.md) §New drift items.



These are places where the OpenSpec change docs and the real repo no longer agree. Worth resolving before the next big push so future work isn't built on stale assumptions.

### 1. Six-Worker vs two-Worker layout (BIG)

**Spec says:** `baseout-backup/proposal.md` describes six independently versioned and deployed Workers:

- `baseout-web`
- `baseout-backup`
- `baseout-webhook-ingestion`
- `baseout-inbound-api`
- `baseout-sql-rest-api`
- `baseout-admin`

**Reality (`CLAUDE.md` §2):** two real Workers (`apps/web` + `apps/server`) plus skeleton stubs (`apps/admin`, `apps/api`, `apps/sql`, `apps/hooks`).

**Implication:** capabilities the spec assigns to `webhook-ingestion` (Airtable HMAC verification, public webhook receiver) and `inbound-api` (validated inbound payloads from automations / interfaces / synced tables / custom metadata) now collapse into `apps/server`. That breaks `CLAUDE.md` §5.2's "public surface = only `/api/health`" rule — the webhook receiver needs to be public.

**Resolution options:**

- **A.** Rewrite `baseout-backup` proposal to target `apps/server` with the collapse explicit, and re-scope `CLAUDE.md` §5.2 to permit the webhook + inbound public surfaces.
- **B.** Genuinely split `apps/hooks` (`baseout-webhook-ingestion`) and `apps/api` (`baseout-inbound-api`) into deployed Workers before the webhook/inbound work begins. Service-binding from each into `apps/server` for the heavy lifting.
- **C.** Defer all webhook/inbound work until V1 ships static + dynamic backup; revisit the layout after revenue is in.

**Recommendation:** **A**, scoped tightly. The collapse is already implicit in the repo. Document the additional public routes (`/api/webhooks/airtable/...`, `/api/inbound/...`) with their HMAC gates as first-class exceptions to the §5.2 rule.

### 2. `web-client-isolation` partial adoption

**Spec says:** browser talks to exactly one origin (`apps/web`). All cross-app calls server-side via service binding. WebSocket progress proxied via `apps/web` to a cross-Worker DO namespace binding. Run/restore triggers via `apps/web` proxies. Data reads (health, schema, restore bundles) all via `apps/web`.

**Reality:** `whoami` probe goes through service binding. Nothing else does — because nothing else exists yet. Risk: when WebSocket progress / Run-Now / data reads land, it would be tempting to wire them browser-direct for speed.

**Resolution:** archive `web-client-isolation` proposal as accepted-principle. When `apps/web` proposes `run-now` / `websocket-progress` / `data-views`, the wire shape must be the proxy shape. Bake this into the change template / review checklist.

### 3. Storage destination Connections (schema shape)

**Spec says:** Storage destination OAuth lives alongside Airtable Connections under the same `connections` table.

**Reality:** schema today has `connections` shaped around Airtable. Storage destination OAuth has not been built — first delivery will need either schema migration (add `platform`-discriminator columns) or a separate `storage_destinations` table.

**Resolution:** make this an explicit design call in the future `baseout-web-byos-storage` proposal. Don't decide ahead of need.

### 4. `@baseout/db-schema` extraction timing

**Spec says:** `packages/db-schema/` is the canonical Drizzle schema, published as `@baseout/db-schema`, pinned by every runtime repo.

**Reality:** schema is duplicated — canonical in `apps/web/src/db/schema/`, mirrored in `apps/server/src/db/schema/` with header comments naming the canonical source. The mirror approach was a deliberate stopgap (see `oauth-refresh` tasks 7.1 follow-up).

**Resolution choices:**

- Extract now (before backup MVP) — paid up front, schema parity is automatic from then on.
- Extract after backup MVP — mirror works fine for 5 tables; pain compounds as more tables are mirrored (`space_databases`, `airtable_webhooks`, `notification_log`, `credit_transactions`, `cleanup_runs`, `organization_restore_usage`, `organization_credit_balance`, `change_log`, `schema_diffs`, `health_scores`, `schema_diff_runs`, etc.).

**Recommendation:** **extract now**. Server backup MVP touches `backup_runs`, `backup_run_bases`, `attachments`, `space_databases`, `notification_log` — that's 5 new mirrored tables on the engine side. Extracting before the MVP saves the mirror-drift tax.

### 5. Mailgun vs Resend vs Cloudflare Email

**Spec says:** Mailgun + React Email everywhere (per `baseout-backup` proposal). `baseout-web/proposal.md` says Resend.

**Reality:** **Cloudflare Email Workers** `send_email` binding in `apps/web` — NOT Resend, NOT Mailgun. `src/lib/email/send.ts` calls `env.email.send({...})`. `wrangler.jsonc.example` declares `"send_email"` bindings per env. `EMAIL_FROM` env var is the verified sender. Dev branch logs to terminal instead of sending. The `baseout-web/STATUS.md` claim of "Resend" is itself stale; Resend was the pre-port plan and the implementation went with the native Cloudflare binding.

**Resolution:** decide which target wins, then update the stale specs:

- **A. Keep Cloudflare Email** — zero added vendor, minimal config, native to the runtime. Limits: less control over deliverability metrics, no template engine, simpler bounce/complaint handling. Update `baseout-web/STATUS.md` to say Cloudflare Email; update `baseout-backup` proposal to use Cloudflare Email for backup-engine emails too (or accept two transports).
- **B. Migrate to Mailgun + React Email** — matches the spec, gives templating + transactional reliability for the high-volume server-side emails (audit reports, dead-conn cadence, quota alerts). Coordinate via `baseout-web-mailgun` change. Update `baseout-web/STATUS.md` after migration.
- **C. Hybrid** — Cloudflare Email for `apps/web` transactional (magic-link, password reset, team invite) where volume is low and templating need is small; Mailgun for `apps/server` audit/cadence emails. Update both proposals to reflect.

**Recommendation:** **A** for MVP. Cloudflare Email works; migrating mid-launch adds risk. Revisit when audit reports + dead-conn cadence ship and the templating gap becomes painful. The reconciliation here is mostly documentation cleanup — both the `baseout-web/STATUS.md` line claiming Resend AND the `baseout-backup` proposal claiming Mailgun need to update to reflect the actual choice.

### 6. Trigger.dev as the work queue

**Spec says:** Trigger.dev v3 owns long-running backup jobs (one per base, unlimited concurrency).

**Reality:** `trigger.config.ts` + `backup-base.task.ts` scaffold exists in `apps/workflows/` (split out from `apps/server/` 2026-05). Real workload not wired. Spec assumes per-environment Trigger.dev projects + concurrency cost validation pre-launch.

**Resolution:** keep on plan. Validate concurrency cost during Phase 6 (pre-launch hardening) as the tasks file says.

### 7. Background services: which ones live in `apps/server`?

**Spec says:** seven background-service crons (webhook renewal, OAuth refresh, dead-conn cadence, trial expiry, quota usage, smart cleanup, connection lock).

**Reality:** OAuth refresh cron is the only one live. Other six are commented in `wrangler.jsonc`. `CLAUDE.md` §5 implies all live in `apps/server`.

**Resolution:** no drift here — the spec and reality agree that these all live in `apps/server`. Each cron should get its own `opsx:propose <change>` rather than land as one big change, mirroring how OAuth refresh was scoped.

### 8. `/ops` console placement

**Spec says:** `baseout-admin` is a separate Worker.

**Reality:** `/ops/*` routes live in `apps/web` today (admin-gated by `users.user_role = 'admin'`). `apps/admin/` skeleton stub exists.

**Resolution:** consciously decide. Two paths:

- **A.** Promote `/ops` UI work to `apps/admin` once it gets non-trivial. `apps/web` keeps user-facing surfaces; staff console isolates blast radius.
- **B.** Keep `/ops` in `apps/web` indefinitely; retire `apps/admin/` stub.

**Recommendation:** **B** until the staff console reaches >5 distinct pages or needs a different auth shape. Then revisit.

### 9. PRD v1.1 lock vs proposal age

**Spec says:** PRD v1.1 from 2026-03-25 is scope-locked authoritative source.

**Reality:** several proposals predate the PRD lock — `baseout-backup`, `baseout-db-schema`, `web-client-isolation`, `baseout-web` were drafted against earlier scoping. Worth a line-by-line reconciliation pass.

**Resolution:** flag this as a follow-up audit. Not blocking, but each time a proposal is re-opened for implementation, re-read against PRD v1.1 first.
