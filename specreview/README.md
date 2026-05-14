## Spec Review — 2026-05-13

Snapshot of `apps/server` and `apps/web` spec-vs-code alignment. Intended as a working doc for the user to iterate against the OpenSpec changes before kicking off the next round of implementation.

### Files

- [00-summary.md](./00-summary.md) — TL;DR + decisions needed
- [01-server.md](./01-server.md) — `apps/server` (backup/restore engine) state
- [02-web.md](./02-web.md) — `apps/web` (Astro SSR app) state
- [03-reconciliation.md](./03-reconciliation.md) — spec drift + items needing user decision
- [04-recommendations.md](./04-recommendations.md) — proposed next-step ordering
- [05-update-2026-05-13b.md](./05-update-2026-05-13b.md) — **delta after the latest pull** (R2 removal, 9 new openspec proposals, schedule-and-cancel Phase A shipped). Read this FIRST after the earlier files.

### Source material consulted (initial review at HEAD `0d3529d`)

- `CLAUDE.md` (repo root)
- `shared/Baseout_PRD.md` / `Baseout_Features.md` / `Baseout_Implementation_Plan.md` (referenced via OpenSpec changes)
- `openspec/changes/baseout-backup/{proposal,tasks}.md`
- `openspec/changes/baseout-web/{proposal,STATUS,tasks}.md`
- `openspec/changes/baseout-server-cron-oauth-refresh/{proposal,tasks}.md`
- `openspec/changes/baseout-web-server-service-binding{,-staging-prod}/proposal.md`
- `openspec/changes/baseout-web-space-scoped-interior/proposal.md`
- `openspec/changes/baseout-backup-history-live-status/proposal.md`
- `openspec/changes/web-client-isolation/proposal.md`
- `openspec/changes/baseout-db-schema/proposal.md`
- `apps/server/src/**` and `apps/web/src/**` directory inventories
- Recent git log on `autumn/server-setup`

### Source material added in 05-update (HEAD `cddff0c`)

- `openspec/changes/baseout-backup-schedule-and-cancel/{proposal,tasks}.md`
- `openspec/changes/baseout-backup-attachments/proposal.md`
- `openspec/changes/baseout-backup-byos-destinations/proposal.md`
- `openspec/changes/baseout-backup-dynamic-mode/proposal.md`
- `openspec/changes/baseout-backup-instant-webhook/proposal.md`
- `openspec/changes/baseout-backup-retention-and-cleanup/proposal.md`
- `openspec/changes/baseout-backup-trial-quota-enforcement/proposal.md`
- `openspec/changes/baseout-backup-manual-quota-and-credits/proposal.md`
- `openspec/changes/baseout-backup-automations-interfaces-docs/proposal.md`
- `openspec/changes/baseout-server-spacedo-alarm-test-isolation-fix/proposal.md`
- `openspec/changes/baseout-web-smooth-theme-swap/proposal.md`
- Commit `8fc1f61` (R2 removal) diff stat
- Updated `apps/server/src/**` tree post-pull
- Updated `apps/web/drizzle/` migration list (0006, 0007 added)
