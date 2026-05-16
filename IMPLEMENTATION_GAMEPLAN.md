# Baseout Implementation Gameplan

> Derived from the 2026-05 dependency audit across 43 active OpenSpec changes. See [openspec/changes/](openspec/changes/) for source. Re-run `pnpm openspec:changes <prefix>` (or `openspec list`) to refresh current task counts.

## TL;DR

- **43 active changes**: 8 single-app parent umbrellas + 27 in-flight follow-ups + 4 cross-cutting (`shared-*`) + 2 system/decision (`system-*`) + 2 paired-sibling pairs already partially shipped.
- **9 changes have non-trivial task progress already**: ranging from 17/24 (shared-client-isolation) to 31/43 (web-workspace-rediscovery). Finish these before opening new fronts.
- **The critical path is gated by one piece**: `system-r2-stance` → `server-byos-destinations` Phase 0 (R2 binding restoration). Four downstream changes are phase-blocked behind it.
- **Paired-sibling rule**: every workflows-side change has a server-side counterpart. Ship the server side **first**, then the workflows side — otherwise enqueued tasks hit a 404 on the engine callback.

## Critical path (the single longest blocking chain)

```
system-r2-stance                           Phase 1 — decision/docs only
   │
   ▼
server-byos-destinations Phase 0           Phase 2 — re-add BACKUPS_R2 binding to apps/server
   │                                       (single highest-leverage ship)
   ├──→ server-byos-destinations Phase B   StorageWriter interface
   │       │
   │       ├──→ server-attachments Phase B+ (download path)
   │       ├──→ server-retention-and-cleanup execution path (DELETE)
   │       └──→ workflows-byos-destinations
   │              │
   │              ├──→ workflows-attachments
   │              └──→ workflows-retention-and-cleanup
   │
   └──→ workflows-byos-destinations (above)
```

Until R2 is back, **attachments and retention cleanup are paused after their schema phase.**

---

## Phase 0 — Finish what's nearly done

Close out partly-shipped changes before opening new fronts. Each is independent of the others; can ship in parallel.

| Change | Progress | Remaining work | Blocks |
|---|---|---|---|
| `server-cron-oauth-refresh` | 25/33 | 8 tasks (final verification + secrets) | (foundational — many soft deps land downstream) |
| `web-workspace-rediscovery` | 31/43 | UI polish + a11y + tests | paired with `server-workspace-rediscovery` |
| `workflows` (parent) | 31/37 | Phase 5.5 fork-spawn + Phase 6 verification | (umbrella; lands when sub-changes archive) |
| `server-schedule-and-cancel` | 21/52 | Phase 3+ (apps/web cancel button, tests) | unblocks Phase 6 |
| `shared-client-isolation` | 19/24 | wait for `shared-websocket-progress` to archive | archive trigger |
| `web` (parent) | 18/46 | per-capability follow-ups; track via STATUS.md | (umbrella) |
| `shared-server-service-binding` | 17/32 | final secrets + smoke + archive trigger (8.3) | unblocks staging+prod variant |
| `web-history-live-status` | 17/26 | Playwright regression + final verification | (web-only polish) |
| `server-workspace-rediscovery` | 17/28 | engine-side rescan endpoint + tests | paired with `web-workspace-rediscovery` |
| `server-spacedo-alarm-test-isolation-fix` | 11/14 | last 3 tasks | unblocks `server-schedule-and-cancel` Phase 3 |

**Phase 0 exit criteria:** every change above is archived OR has a clear ship date.

---

## Phase 1 — Lock cross-cutting decisions

| Change | Why first | Notes |
|---|---|---|
| `system-r2-stance` | Decision-only; lock before any storage-touching change starts. | Many downstream changes already cite this. Ensure all "Depends on" links are in place. |
| `system-db-schema` (decide: extract now vs. defer) | Choice gates every new server-side schema mirror. | Recommendation: extract immediately after Phase 2 (storage foundation) and before Phase 7 (dynamic mode, which adds 5+ new tables). |

**Phase 1 exit criteria:** R2 stance is committed in writing; db-schema decision documented (extract date or "defer indefinitely").

---

## Phase 2 — Storage foundation (HIGHEST LEVERAGE)

**This is the single biggest unblocker in the whole roadmap.** Until Phase 0/A/B of `server-byos-destinations` lands, attachments and retention are stuck at schema-only.

### Phase 2A: R2 binding back

- `server-byos-destinations` Phase 0 — re-add `BACKUPS_R2` to `apps/server/wrangler.jsonc.example`, env.d.ts, and provision the prod bucket.

### Phase 2B: schema + interface (parallel-safe with 2A)

- `server-byos-destinations` Phase A — `storage_destinations` master DB table.
- `server-byos-destinations` Phase B — `StorageWriter` interface + R2-managed strategy.
- `server-attachments` Phase A — `attachments` + dedup index migration (schema-only; parallel-safe).
- `server-retention-and-cleanup` Phase A — `backup_retention_policies` + `backup_runs.deleted_at` (schema-only; parallel-safe).

**Phase 2 exit criteria:** R2 binding is live; `makeStorageWriter()` returns an R2-managed writer; three schema migrations are merged.

---

## Phase 3 — Service binding staging + production

Independent of Phase 2; can ship in parallel.

- `shared-server-service-binding-staging-prod` — ship after `apps/server` staging + prod Workers are deployed (the deploy ordering is the "pre-req").

---

## Phase 4 — Storage-dependent features

Unlocked by Phase 2B.

### Phase 4A: BYOS providers + workflows-side adoption (parallel)

- `workflows-byos-destinations` — consumes the `StorageWriter` interface.
- `server-byos-destinations` Phase C — first provider end-to-end. Recommend **Google Drive** (highest demand, best-documented SDK).
- Subsequent providers (S3, Dropbox, Box, OneDrive, Frame.io) are smaller workstreams — same shape, different SDK. Can ship one per week.

### Phase 4B: Attachments + retention (paired pairs)

- `server-attachments` Phase B+ + `workflows-attachments` (paired)
- `server-retention-and-cleanup` execution path + `workflows-retention-and-cleanup` (paired)
- `server-cron-webhook-renewal` — independent; can ship anytime, but only matters once `server-instant-webhook` (Phase 7) registers webhooks to renew.

**Phase 4 exit criteria:** every snapshot writes to a real destination (managed R2 or BYOS); attachment dedup works; expired snapshots are deleted on the hourly cron.

---

## Phase 5 — Quota + trial enforcement

Resolves several TODOs left behind by earlier phases (attachments byte-tracking, manual-cleanup credit charge).

### Phase 5A: trial gate

- `server-trial-quota-enforcement` + `workflows-trial-quota-enforcement` (paired)

### Phase 5B: credit ledger + alerts

- `server-manual-quota-and-credits` + `workflows-manual-quota-and-credits` (paired)
- Resolves credit-charge TODO inside `server-retention-and-cleanup` Phase D and the attachment-byte tracking in `server-attachments` Phase D.

**Phase 5 exit criteria:** trial caps enforced at the pre-flight gate (not just runtime); credit ledger writes on every billable op; threshold-crossing emails dispatched.

---

## Phase 6 — Live progress + cancel polish

### Phase 6A: cancel state machine

- `server-schedule-and-cancel` (finish Phase 0 work first) + `workflows-schedule-and-cancel`
- `server-spacedo-alarm-test-isolation-fix` — should already be done by end of Phase 0.

### Phase 6B: WebSocket fan-out

- `shared-websocket-progress` — replaces 2s polling with a `SpaceDO` WebSocket fan-out.
- After ship: archive `shared-client-isolation` (its archive trigger is "after WebSocket ships").

**Phase 6 exit criteria:** browser receives sub-second progress updates; cancel button works end-to-end; both `shared-*` archives merged into `openspec/specs/`.

---

## Phase 7 — Dynamic mode + instant backup

Big architectural lift. Sequenced: dynamic mode first, instant webhook on top.

### Phase 7A: dynamic mode

- `server-dynamic-mode` + `workflows-dynamic-mode` (paired). Provisioning task + per-tier dispatcher (D1 / Shared PG / Dedicated PG / BYODB). Schema diff persistence.

### Phase 7B: instant backup (depends on 7A)

- `server-instant-webhook` + `workflows-instant-webhook` (paired). Per-Space DO coalescing + Airtable webhook → incremental backup → dynamic DB write.
- Without dynamic mode, instant backup has nowhere to write incrementally.

### Phase 7C: schema metadata extras

- `server-automations-interfaces-docs` + `workflows-automations-interfaces-docs` (paired). Soft dep on `server-dynamic-mode` (uses the `_baseout_<type>` tables it creates).

**Phase 7 exit criteria:** Airtable webhook → DO → workflows task → dynamic DB upsert in under 30 seconds end-to-end.

---

## Phase 8 — Restore engine

- `server-restore` + `workflows-restore` (paired). Mirror of the backup-run shape file-for-file (`restores/start.ts` ↔ `runs/start.ts`).
- Restore-progress events extend the WebSocket fan-out from Phase 6.

**Phase 8 exit criteria:** restore from a managed-R2 snapshot to a fresh Airtable base, end-to-end.

---

## Phase 9 — Connection-health crons

Operational hardening. Independent of Phases 5–8.

- `server-cron-connection-lock-manager` — 15-min stale-lock audit (belt to the DO alarm's suspenders).
- `server-cron-dead-connection-cadence` — daily T+24h/72h/7d/14d/21d email cadence + auto-`invalid`. Soft dep on `server-cron-oauth-refresh` (only flips `pending_reauth` rows it produces).

**Phase 9 exit criteria:** no stale ConnectionDO locks survive longer than 30 min; dead Connections get the 4-touch cadence and auto-invalidate.

---

## Phase 10 — Other surfaces

These are the public-facing or non-data-plane apps. None are required for the data-plane MVP.

- `admin` — defer per `specreview/03-reconciliation.md` §8 (keep `/ops` in apps/web until >5 distinct pages).
- `api` — public Inbound API. Build when first external integrator asks.
- `sql` — Direct SQL access. Build alongside Phase 7 (depends on dynamic-mode providing a client DB to read from).
- `hooks` — Airtable webhook receiver. Build alongside Phase 7 (`server-instant-webhook` needs an inbound HMAC-verified receiver).

---

## Phase 11 — UX polish

- `web-smooth-theme-swap` — Astro ClientRouter integration for theme transitions.
- `web-space-scoped-interior` — soft dep on `web-smooth-theme-swap` (uses the ClientRouter wiring).

Ship whenever; not blocking any data-plane work.

---

## Parallelization snapshot

If you have 2–3 devs working in parallel **after Phase 0 is clean**, here's where they can split without stepping on each other:

**Dev A — Storage track**
Phase 1 (R2 stance) → Phase 2 (BYOS Phase 0/A/B) → Phase 4A (Google Drive) → Phase 4B server-attachments + server-retention.

**Dev B — Workflows-side track**
Wait one beat for Dev A to clear Phase 2B → ship `workflows-byos-destinations` → `workflows-attachments` + `workflows-retention-and-cleanup`.

**Dev C — Quota + live progress track**
In parallel with A+B: Phase 5 (trial + credits) → Phase 6 (cancel + WebSocket).

**After Phases 2–5 land**, the team converges on Phase 7 (dynamic mode + instant), the largest single architecture lift.

---

## Risk callouts

1. **Phase 2 is the single highest-leverage unblocker.** Until the R2 binding returns and `StorageWriter` exists, four downstream changes are stuck at schema-only. If only one thing ships in the next two weeks, it should be this.

2. **`system-db-schema` extraction is deferred.** Every new server-side change that touches a new table grows the mirror tax. Recommend extracting immediately after Phase 2 and before Phase 7 (which adds 5+ new tables: `space_databases`, `audit_history`, `_baseout_automations`, etc.). If we wait until after Phase 7, the extraction touches the post-Phase 7 mirror set, which is significantly larger.

3. **Paired siblings are a silent failure mode.** A workflows-side change shipping without its server-side sibling produces a Trigger.dev task that 404s on the engine callback. Always:
   - Ship server-side first (start route, callback handlers, schema mirrors).
   - Smoke the server side standalone (manual `tasks.trigger()` via Trigger.dev dashboard, expect server logs but no business outcome).
   - Then ship the workflows-side and verify end-to-end.

4. **Phase 7 (dynamic mode + instant) is the highest-uncertainty work.** Multiple new DB engines (D1, Shared PG, Dedicated PG, BYODB), schema-diff edge cases, webhook coalescing, gap detection + replay. Plan for two-week buffer beyond the per-phase estimate.

5. **Phase 0 stragglers can block Phase 6.** `server-schedule-and-cancel` is 21/52; it must finish before WebSocket progress can broadcast cancel events. Don't skip Phase 0 thinking it's "just cleanup."

---

## Maintenance

- This document is a **snapshot** of the 2026-05 audit. Re-run `pnpm openspec:changes <prefix>` for current task counts.
- When you ship a phase, archive the relevant changes (`opsx:archive <name>`) and update the phase header here with a strikethrough or ship date.
- For new proposals, fit them into the right phase based on their declared `Depends on` / `Pre-req` lines.
- If a change moves between phases (e.g. a dependency materializes that wasn't there before), update the phase header in this doc and add a "Why moved" line so future-you understands the shift.
