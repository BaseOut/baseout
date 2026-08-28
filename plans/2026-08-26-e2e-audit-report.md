# Baseout end-to-end audit — PRD alignment, prod/staging infra, local dev

**Date:** 2026-08-26. **Companion:** [2026-08-26-soc2-eod-audit.md](./2026-08-26-soc2-eod-audit.md) (the EOD SOC 2 slice + Dan meeting asks — this report is the full audit behind it).
**Method:** three parallel audits (PRD/Features vs code; live Cloudflare/Trigger.dev state, read-only CLI; local-dev design from Dan's Aug-25 call), reconciled against the runbooks.

**Framing:** the SOC 2 bar (walkthroughs Aug-28 + Sept-5, Type II window opens Sept 1) is a **hosted production env + live DB + demoable controls** — NOT PRD feature-completeness. Full V1 per PRD is months of work. The EOD plan targets the SOC 2 slice; this report is the honest full picture.

---

## 1. Executive summary

- **The platform core is real and large**: web (~140 API routes), engine (83 internal routes, 2 DOs, 3 crons), 13 Trigger.dev tasks, admin console, public read API, hooks receiver. Backup capture (schema/records/attachments/comments/automations/interfaces/media), reports, retention core, restore core, per-Space D1+PG data plane, entitlement resolution, magic-link auth + 2FA, admin append-only audit log — all implemented with tests (473 test files).
- **The environment model is now correct and mostly wired**: one Worker per app, production + Worker Previews (staging), preview base configs complete on all three Workers (Aug-25), live Hyperdrive on prod, dev Hyperdrive on previews.
- **What actually blocks a truthful production demo** is a short list of *credentials, registrations, and decisions* — almost all human/Dan actions — plus a handful of genuine implementation gaps (top-10 below), of which the most dangerous for the demo are: **no R2 write path in ANY env** (S3 tokens never minted), **zero OAuth callbacks registered for console.baseout.com**, and **quota enforcement being advisory**.

---

## 2. PRD / Features vs implementation — verdicts

### App inventory

| App | State |
|---|---|
| web / server / workflows / admin / api / hooks | **Real** (hooks minimal by design) |
| **sql** | **STUB** — placeholder response only (`apps/sql/src/index.ts`) |
| embed | Partial scaffold (no built blocks) |
| support | Thin (contact + roadmap) |

### Top-10 production-blocking gaps (ranked)

1. **SQL REST API is a placeholder** (`apps/sql`, change `sql` 0/37) — the stated value exchange for dynamic tiers (PRD §3.5/§7.4).
2. **Quota/entitlement enforcement not wired** (`server-trial-quota-enforcement` 0/46, `server-manual-quota-and-credits` 0/54, `shared-entitlements` 9/33) — tier limits are advisory; unbounded R2/D1 consumption is a cost + availability risk.
3. **No end-user (tenant-visible) audit log** — admin-side append-only log exists; nothing customer-visible covering backup/restore/destination/permission changes. **Direct SOC 2 CC7.2 gap.**
4. **Amazon S3 destination missing** despite PRD §7.2 "V1 dev-complete" — no writer module; type referenced in gating/schema (selectable-but-broken risk).
5. **Frame.io destination referenced but unimplemented** — same selectable-but-broken risk (in `storage-writers/index.ts`, run UI).
6. **Slack notifications entirely absent** (PRD §2.5/§7.5 V1 for higher tiers).
7. **Email templates: 3 of the §19.1 V1 set** — no backup-failure / run-summary / quota-warning emails ⇒ **backup-failure alerting is effectively email-less** — worst reliability-signal gap for a backup product.
8. **Dedicated-PG (Business) + BYODB (Enterprise) provisioners don't exist** — only shared-cluster schema-per-Space; D1→PG migration path exists but unrehearsed on real data.
9. **E2E coverage = 2 Playwright specs** vs §14.5's minimum V1 list; CI has no deploy/promotion gates (§18.3) — thin SOC 2 CC8 change-management evidence.
10. **No encryption-key rotation procedure** for `BASEOUT_ENCRYPTION_KEY` (shared web/server/hooks; `*_enc` columns) — PRD §20.1 claims rotation support; no re-wrap tooling exists. **SOC 2 CC6.1.**

**Runners-up:** public API rate limiting is shadow-mode (not enforcing); R2 bucket topology (`system-r2-bucket-topology` 2/15) leaves per-account isolation unfinished; Automations/Interfaces tier gating contradictory (PRD §2.9 Growth vs Features §4.2/§6.3/§9.1 Launch — unreconciled); `openspec/specs/` (3 dirs) can't serve auditors as a shipped-state record vs ~190 in-flight changes; restore lacks the specced per-entity reconciliation report; websocket-progress contract change 0/23 though DO progress ships.

### Solid areas (implemented, minor tails)

Backup engine + scheduling + rediscovery; CSV export; MCP capture (views/automations/interfaces); attachments + media index; webhook incremental (design diverges from PRD text — annotated; 7-day replay window is an unmitigated edge if polling stalls); reports (strongest area, 100% across three changes); retention core (multi-window policy tiers = the unfinished half, `server-retention-and-cleanup` 25/53); per-Space D1 provisioning + data plane (smoke-tested 2026-08-25); Data Browse; schema viz/health/chat; notifications inbox; auth/2FA; AES-GCM encryption at rest; admin audit log (append-only, tested).

**V2 correctly absent** (one line per CLAUDE.md): MCP-for-AI-clients (read transport actually ships early in apps/api), RAG, Governance, connectors, outbound webhooks, CLI, plugins, migration/cloning, offline mode, record-level restore.

---

## 3. Live infrastructure state (verified read-only, 2026-08-26)

**Inventory:** R2 = `baseout-backups-dev` + `baseout-live` only. KV complete, no dangling refs. D1 = none (token-gated). Preview base configs COMPLETE on all three Workers.

### Production gaps

| Gap | Owner |
|---|---|
| **R2 S3 write token never minted (ANY env)** → backups land on LocalFsWriter fallback everywhere; Trigger.dev has no `R2_*` vars in any env | **Dan** (token UI hidden from Autumn) → Autumn enters vars |
| Bucket decision: Dan bound `BACKUPS_R2 → baseout-live` (Aug-24) vs r2-setup.md's `baseout-backups-prod` | Dan decision + doc reconcile |
| `CLOUDFLARE_D1_API_TOKEN` (Account→D1:Edit) missing on prod engine → per-Space D1 501s (code proven; local smoke green Aug-25 via OAuth-bearer workaround) | **Dan** |
| **OAuth: ZERO callbacks registered for `console.baseout.com`** → prod Connect flows 100% broken (Airtable 400s confirmed) | Airtable owner; Dan (Google/Dropbox/Azure); Autumn (Box) |
| Trigger.dev prod env: `backup-base` IS deployed (v20260511.1) but `BACKUP_ENGINE_URL`/`INTERNAL_TOKEN`/`R2_*` unrecorded/unset | Autumn (dashboard) |
| Email sender conflict: PRD says `mail.baseout.com`; everything (incl. working prod login) sends from `mail.baseout.dev` | Dan bless-or-flip |
| Apex `console.baseout.dev` serves production until "Enable for: Preview" flip | **Dan** |
| Live-DB migrations (incl. 0039) — Hyperdrive origin password write-only; DO login flaky | **Dan** (run or paste DATABASE_URL once) |

### Staging (previews) gaps

Preview base configs done; token-partition live (staging engine calls fail closed instead of writing live — Dan to bless or choose a preview engine). Missing: preview OAuth callbacks (Dropbox only today; 2 wrong-path Google URIs to remove), staging R2 bucket decision (reuse dev vs `baseout-backups-staging`), Access on admin previews (console previews already gated), preview-usable email sender confirmation. Previews intentionally share the **dev** DB (settled Aug-24; ops-setup's staging sections are stale) — a *dedicated* staging DB is a Dan decision if ever wanted; dev PG's ~19-conn ceiling is the risk if previews get real traffic.

### Doc drift to sweep (Autumn, no cloud access needed)

r2-setup.md §3.1 header-vs-checklist contradiction + `baseout-live` absence; ops-setup.md §1/§2 staging/production sections describing never-created workers; oauth-setup.md §1/§3 prod rows predating `console.baseout.com`.

---

## 4. Local dev environment — design + plan (per Dan's Aug-25 model)

Dan's model: Cloudflare shows only production + previews; **local dev = `wrangler dev` mimicking the infra locally** (local DOs/KV/R2/D1 via Miniflare state) on dev settings, shaped like staging/prod.

**Already works (don't rebuild):** `BACKUP_LOCAL=1` local web↔engine loop via dev registry; server `wrangler dev --env dev` with local DOs; astro-dev email short-circuit + E2E link retrieval; `{{DATABASE_URL}}`→Hyperdrive localConnectionString in all three launch.mjs; Trigger.dev local worker; baseout.local + mkcert; admin local.

**The gap is narrow — 4½ days phased:**

- **P1 (≤1d): local magic-link email.** `EMAIL_MODE=log` runtime var set ONLY in the gitignored local render (same pattern as the BACKUP_LOCAL strip); `sendEmail` logs the link. Unit-test the branch. This is the single reason `--remote` is the default today.
- **P2 (≤1d): flip web default to fully local** (`BACKUP_REMOTE=1` becomes the opt-in); root `pnpm dev` composite = web local + engine local (8787) + trigger worker. May incidentally fix the 8–10s nav latency (measure only).
- **P3 (≤1d): OAuth policy + parity.** Local = Airtable only (registered for baseout.local); Google/Box/Dropbox/OneDrive = preview-only by policy (Google rejects `.local` — external constraint). oauth-setup §3/§5 updated same-change. AI binding keeps its remote-proxy mode.
- **P4 (≤1d): retire deployed dev workers** (`baseout-dev`, `baseout-admin-dev`) — ONLY after preview OAuth URIs are registered per provider (hard sequencing: they carry OAuth/E2E/real-email today). Clean `deploy:dev`/`secrets:sync:dev` + runbook rows.
- **P5 (≤½d): docs** — ops-setup, CLAUDE.md dev-topology inversion, lat.md; file as OpenSpec `system-local-dev`.

**Risks:** Miniflare fidelity (crons don't self-fire locally — document); dev-PG connections (local-first *reduces* pressure); Trigger.dev dev-task 10m TTL unchanged.

---

## 5. Implementation plan

### Today (SOC 2 slice — see companion EOD plan for the ordered runbook)

1. Dan meeting outputs: two tokens (D1, R2-S3), Trigger.dev R2 vars, prod OAuth registrations, live-DB migrate, hostname + bucket + sender decisions, D5/D6 blessings.
2. Then (Autumn, same day, in order): engine prod secret `CLOUDFLARE_D1_API_TOKEN` → Trigger.dev prod+dev env vars → prod smoke (magic-link → Connect Airtable → run backup → CSV in prod R2 → run succeeded) → preview smoke on the real preview host (login, connect, backup into dev R2/D1) → local `.env` mirrors dev.
3. **Fallback if tokens don't land in the meeting:** demo the production-shaped UI on live console *without* claiming managed R2/D1 isolation — never a faked demo.

### This week (SOC 2 evidence hardening — from the top-10)

- **Tenant audit log** (top-10 #3, CC7.2): new `shared-tenant-audit-log` change — append-only table (reuse the admin pattern + its append-only test), events for backup/restore/destination/entitlement changes, minimal viewer page.
- **Key-rotation procedure** (#10, CC6.1): documented re-wrap runbook + `scripts/` re-encrypt tool for `*_enc` columns (`system-key-rotation`).
- **Backup-failure email** (#6/#7 minimal slice): one `backup-failed` template + trigger from `runs/complete` — the single highest-value alerting fix.
- **E2E gap** (#9): add restore + destination-connect Playwright specs; CI promotion gate note.
- Doc-drift sweep (r2-setup/ops-setup/oauth-setup) + the stale-spec-archive note for auditors.

### Post-audit roadmap (file as OpenSpec changes; sized rough-order)

| Gap | Change | Size |
|---|---|---|
| SQL REST API | `sql` (exists, 0/37) | weeks |
| Quota enforcement | `server-trial-quota-enforcement` + `shared-entitlements` completion | 1–2 wk |
| S3 destination | `workflows-s3-writer` (+ hide from UI until shipped) | days |
| Frame.io | implement or REMOVE from selectable enums (decide with Dan) | days either way |
| Slack + email template set | `shared-notifications-channels` | ~1 wk |
| Dedicated-PG / BYODB provisioners | `server-dedicated-pg`, `server-byodb` | weeks |
| Retention policy tiers tail | `server-retention-and-cleanup` (25/53) | days |
| Rate-limit enforcement flip | `api-rest-read` tail | ~1 d |
| Tier-gating contradiction (Automations/Interfaces) | spec reconcile, Features §-cite | hours |
| Local dev P1–P5 | `system-local-dev` | ~4½ d |
