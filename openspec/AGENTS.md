# OpenSpec — Agent conventions and handoff index

This file is the entry point for any agent (or human) picking up work in this repo. Read it before claiming a change. Then read the change folder you're claiming.

The May 7, 2026 cutover plan ([plans/2026-05-07-monorepo-cutover-day.md](../plans/2026-05-07-monorepo-cutover-day.md) §6.1) commits this file as the source of truth for the parallel-agent workflow; conventions here override anything older.

---

## 1. Repo & app layout

- `apps/web` — frontend (Astro SSR; auth, OAuth Connect, dashboard, settings, marketing pages, `/ops` admin).
- `apps/server` — backup/restore engine (Workers + Durable Objects + Trigger.dev). Headless. Reads/writes the master DB owned by `apps/web`.
- `apps/{admin,api,sql,hooks}` — scaffolds; flesh out per their own changes.
- `packages/{db-schema,shared,ui}` — shared workspace packages.
- `openspec/changes/<change-name>/` — each change is a folder. Standard files: `proposal.md`, `design.md`, `tasks.md`, optional `STATUS.md`, optional `specs/<capability>/spec.md`.
- `openspec/changes/archive/<name>/` — historical changes preserved for reference; not live work.

## 2. Pickup protocol

### Where to look for the active change

Each app has a symlink at `apps/<app>/openspec/` that points at its currently active openspec change folder.

- `apps/web/openspec` → `../../openspec/changes/baseout-web` (today's web umbrella).
- `apps/server/openspec` → `../../openspec/changes/<rotating>`. The target rotates as server features get fleshed out. Today the symlink points at [`openspec/changes/airtable-client/`](changes/airtable-client/) — the first server change ready for an agent to claim.

**Rotation is driven by `apps/server/.openspec-target`** — a single-line, gitignored file consumed by `scripts/fix-symlinks.js` (postinstall). To rotate the active server change, write its name to that file and re-run `pnpm install` (or `pnpm fix:symlinks`).

### Branch & worktree convention

- One branch per change: `change/<change-name>` (e.g. `change/airtable-client`).
- Multi-agent flow uses git worktrees so branches coexist on disk:

  ```bash
  git worktree add ../bo-<change-name> -b change/<change-name>
  cd ../bo-<change-name> && pnpm install   # postinstall repairs symlinks
  ```

- One PR per change folder. PR body MUST link to the change folder (CI rejects otherwise — see §7).

## 3. Serialization rules (parallel-agent safety)

Most changes parallelize freely. The two exceptions:

- **Only one in-flight change at a time** may modify [`packages/db-schema/src/`](../packages/db-schema/src/).
- **Only one in-flight change at a time** may modify [`packages/ui/src/`](../packages/ui/src/).

Everything else — `apps/<x>/`, `packages/shared/`, `openspec/`, `scripts/`, root configs — is fair game for concurrent changes.

If your change needs to touch one of the serialized surfaces, check `git log --all packages/db-schema/src/` (or `packages/ui/src/`) and the open PRs list before starting; coordinate with whoever holds the lock.

## 4. Locked cross-app contracts

These are the wire formats both apps MUST agree on. Each row points at the canonical spec — treat that spec as authoritative; do not deviate without proposing a v2 contract.

| Contract | Canonical source | Status |
|---|---|---|
| Airtable client (OAuth + Records + Attachments + Enterprise + refresh) | [openspec/changes/airtable-client/specs/airtable-client/spec.md](changes/airtable-client/specs/airtable-client/spec.md) | Active server change. |
| Run enqueue request envelope (`POST /api/internal/runs/start`) | [openspec/changes/baseout-web-run-now-contract/specs/web-run-now-contract/spec.md](changes/baseout-web-run-now-contract/specs/web-run-now-contract/spec.md) | Web side: contract-only stub returning 501 until `baseout-server-engine-core` lands. |
| Backup-progress WebSocket frame envelope | [openspec/changes/baseout-web-websocket-progress-contract/specs/web-websocket-progress-contract/spec.md](changes/baseout-web-websocket-progress-contract/specs/web-websocket-progress-contract/spec.md) | Web side: token-mint stub + frame schema; WSS endpoint hosted by server. |
| Capability resolution HTTP surface (`GET /api/me/capabilities`) | [openspec/changes/baseout-web-capability-api/specs/web-capability-api/spec.md](changes/baseout-web-capability-api/specs/web-capability-api/spec.md) | Live on web; server side does not consume but tier values originate in the same Stripe metadata both apps read via the master DB. |
| `INTERNAL_TOKEN` header (`x-internal-token`) | [apps/server/src/middleware.ts](../apps/server/src/middleware.ts) | Constant-time comparison. Must match between `apps/web`'s `BACKUP_ENGINE_INTERNAL_TOKEN` env and `apps/server`'s `INTERNAL_TOKEN` env. |
| AES-256-GCM token encryption (`BASEOUT_ENCRYPTION_KEY`) | PRD §20.2; helper at [apps/web/src/lib/crypto.ts](../apps/web/src/lib/crypto.ts) (extracting to `packages/shared/crypto.ts` per `airtable-client`). | Same key value in both apps' `wrangler.jsonc` per env. |

## 5. Dependency graph — what blocks what

```
airtable-client (active, ready)
├─ blocks: baseout-server-engine-core, baseout-server-durable-objects, baseout-server-cron-oauth-refresh
├─ depends: (none)
└─ web-side blocker: see "Pre-flight checks" below

baseout-server-durable-objects (stub)
├─ blocks: baseout-server-engine-core, baseout-server-websocket-progress
├─ depends: airtable-client

baseout-server-engine-core (stub)
├─ blocks: all baseout-server-storage-*, baseout-server-restore-core
├─ depends: airtable-client, baseout-server-durable-objects, baseout-web-run-now-contract

baseout-server-websocket-progress (stub)
├─ blocks: future baseout-web-backup-run-page (web /backups/[runId])
├─ depends: baseout-server-durable-objects, baseout-web-websocket-progress-contract

baseout-server-cron-oauth-refresh (stub)
├─ blocks: (none — independent cadence work)
├─ depends: airtable-client (refresh helper extraction)

baseout-server-cron-webhook-renewal (stub)
├─ blocks: (none)
├─ depends: airtable-client (Enterprise scope detection)

baseout-server-storage-{r2,googledrive,dropbox,box,onedrive,s3,frameio} (stubs)
├─ blocks: (each unblocks its tier in the UI)
├─ depends: baseout-server-engine-core

baseout-server-restore-core (stub)
├─ blocks: future baseout-web-restore-now (web /restore page wiring)
├─ depends: baseout-server-engine-core
└─ web-side gap: baseout-web-restore-now-contract — NOT YET WRITTEN; first server agent on this change should propose it.

baseout-server-dynamic-backup (stub)
├─ blocks: (V1.5 — not on launch path)
├─ depends: baseout-server-engine-core, baseout-server-storage-*

baseout-server-schema-diff (stub)
├─ blocks: future baseout-web-schema-ui
├─ depends: airtable-client (Metadata API client) only — independent of engine-core
```

## 6. Pre-flight checks

### `connections.is_enterprise` is JSON-nested, not a top-level column

The `airtable-client` change references `connections.is_enterprise` in its tasks. That column does **not** exist as a top-level column in the master schema. The data lives in `connections.platform_config` (jsonb) under the key `is_enterprise_scope` (boolean).

- Source: [apps/web/src/db/schema/core.ts](../apps/web/src/db/schema/core.ts) (search "platformConfig").
- Web-side reader: [apps/web/src/lib/integrations.ts](../apps/web/src/lib/integrations.ts) — `Boolean(cfg.is_enterprise_scope)`.

Two paths:

- (a) **Read it from `platform_config.is_enterprise_scope`** (current convention, zero schema churn). **Recommended for V1**.
- (b) Propose `baseout-db-schema-airtable-enterprise` to promote it to a top-level column. Cleaner long-term but serializes against any other `packages/db-schema/` work.

### Master DB connection: per-request, not pooled

`apps/server` middleware creates a fresh postgres-js client per request via `createMasterDb()`. Don't reuse `sql` connections across requests — workerd forbids reusing I/O objects across requests. Always wrap teardown with `ctx.waitUntil(sql.end({ timeout: 5 }))`. Same rule applies to `apps/web` middleware.

### Hyperdrive vs. direct connection

Both apps use `env.HYPERDRIVE.connectionString` in deployed envs and `process.env.DATABASE_URL` in local `wrangler dev`. The branch is gated on `import.meta.env.DEV` so Vite tree-shakes the dead branch from the deployed bundle.

## 7. PR rule

Every PR body MUST include a link to the change folder driving it. Recommended template at the top of the PR body:

```markdown
## Change folder
- openspec/changes/<change-name>/
```

CI (when the lint job from the cutover plan §6.4 lands) will reject PRs that touch `apps/` or `packages/` without a change-folder reference. Until then, this is enforced by review.

For doc-only or hotfix PRs that legitimately have no change folder, add `Skip-Spec: <reason>` to the PR body — see `plans/2026-05-07-monorepo-cutover-day.md` D7.

## 8. Where to ask questions

The PRD and Features documents are authoritative. Cross-reference your change against the relevant section before opening a PR:

- [shared/Baseout_PRD.md](../shared/Baseout_PRD.md) — especially §4 (Architecture), §5 (Data model), §13 (Auth), §14 (Testing), §17 (Third-party services), §20 (Security), §21 (DB schema).
- [shared/Baseout_Features.md](../shared/Baseout_Features.md) — especially §1 (naming dictionary), §5.5 (capability resolution), §10–§14 (per-capability matrices).
- [shared/Baseout_Implementation_Plan.md](../shared/Baseout_Implementation_Plan.md) — phased build order.

When the user asks for something that conflicts with a spec section, **flag the conflict with the citation** rather than silently picking. Open Questions in the PRD are explicit — use them.

## 9. Engineering rules in force

These are the project-wide rules every change must respect. Full text in [CLAUDE.md](../CLAUDE.md) at the repo root.

- TDD for non-trivial code (PRD §14). Backend logic 80% unit, UI 60% unit, critical flows E2E.
- No `console.*` or `debugger` in committed code (CLAUDE.md §3.5).
- Use canonical naming dictionary from Features §1 — never invent synonyms.
- Don't refactor what works (CLAUDE.md §3.2). Match blast radius to problem size.
- Security-first (CLAUDE.md §3.3). Encrypt tokens at rest, parameterize SQL, server-side input validation, principle of least privilege.
- One change per PR; commit hygiene per CLAUDE.md §3.5.

## 10. Quick "where do I start?" reference

| If you are… | Read these, in order |
|---|---|
| A server agent claiming the active server change | This file (§4 contracts, §6 pre-flight) → `apps/server/openspec/proposal.md` (currently `airtable-client`) → `apps/server/openspec/design.md` → `apps/server/openspec/tasks.md`. |
| A web agent claiming a deferred web change | This file → [openspec/changes/baseout-web/tasks.md](changes/baseout-web/tasks.md) §3 → the specific change's folder. |
| Anyone implementing engine-core or websocket-progress | This file → §4 contracts (run-now, websocket-progress) → server change folder. The contract specs are authoritative. |
| Reviewing a PR | This file §7 → the linked change folder → the diff. |
