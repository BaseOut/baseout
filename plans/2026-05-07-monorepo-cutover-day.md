# Monorepo cutover day — Thu May 7, 2026

**Goal:** Get `apps/web` verified end-to-end, the spec/doc layer consistent, the monorepo pushed to `github.com/baseout/baseout`, **and** kick off `apps/server` engine work in parallel via a per-feature openspec change. Two tracks running concurrently.

## Tracks

- **Track A — Web cutover (drives the public push).** Blocks 1–5 + the small infra in 6.1, 6.3–6.5.
- **Track B — Server engine kickoff (parallel agent).** Blocks 6.2 + 7. Starts as soon as 6.2 produces a usable change folder.

Track A blocks the public push. Track B can keep moving even if Track A hits issues — the server agent works in its own worktree on its own branch.

## Decisions resolved

- **D5:** Decompose only `baseout-backup` tomorrow. Admin/api/sql/hooks stay as single-change scaffolds.
- **D6:** Archive `baseout-backup` to `openspec/changes/archive/baseout-backup/` (historical reference). Create per-feature `baseout-server-<feature>` changes. Naming follows the app, not the legacy "backup" label.
- **D7:** Hard-fail CI on missing openspec link, with `Skip-Spec: <reason>` PR-body escape hatch for hotfixes / doc-only changes.

D1, D2, D3, D4 still need your call before kickoff.

---

## Where things stand at end-of-day May 6

- ✅ Skeleton imported (`apps/`, `packages/`, `openspec/`, `scripts/`, `shared/`, root configs).
- ✅ `pnpm install` ran successfully.
- ✅ `apps/web/` ported from `baseout-starter@29dfb5b`, engine-wiring stripped (per `openspec/changes/baseout-web/tasks.md` §1.1–1.8).
- ✅ `apps/server/` PoC scaffold landed: `INTERNAL_TOKEN` middleware, `ConnectionDO`/`SpaceDO` stubs, integration tests via workers-pool.
- ✅ `.npmrc` already in env-var form.
- ✅ OpenSpec workflow wired in (commands, skills, `openspec/` structure, symlink script).
- ⏳ `apps/web` verification gates (§1.9–1.13) — not yet run; this is the highest-value next step.
- ⏳ `apps/{admin,api,sql,hooks}` and `packages/{db-schema,shared,ui}` are bare scaffolds.
- ⏳ Repo not pushed to `github.com/baseout/baseout` yet.
- ⚠️ Two CLAUDE.md files have inconsistent doc references (root → `shared/`, `apps/web/.claude/` → `docs/` which doesn't exist).
- ⚠️ Root `BaseOut_PRD_v2.md` says v1.1 internally; Implementation Plan source line says V1.4 — naming inconsistent.
- ⚠️ `shared/` has duplication between yesterday's v1.1 imports and the skeleton's newer Features/Schema/Pricing docs.
- ⚠️ Fontawesome token rotation status unknown — required before public push.

---

## Sequence

### Block 1 — apps/web verification gate (~90 min)

Drive the open boxes in `openspec/changes/baseout-web/tasks.md` §1.9–1.13. Each is a concrete pass/fail.

1. `pnpm install` from root again, watching for `scripts/fix-symlinks.js` postinstall errors.
2. `pnpm --filter @baseout/web build` — fix monorepo-resolution issues (likely culprits: `@opensided/theme` `file:` dep paths, vendored modules under `apps/web/vendor/`, the `dist/server/wrangler.json` deploy output).
3. `pnpm --filter @baseout/web exec astro check` — expect 0 errors before moving on.
4. `grep -rn "backup-engine-client\|BACKUP_ENGINE" apps/web/src apps/web/tests` — must return nothing.
5. `pnpm dev:web` — confirm `/login`, `/integrations`, `/backups` (placeholder), `/ops` all render against local Postgres.

If any step fails, fix in place — these are blockers. If a fix needs more than ~30 min, file a TODO and move on; the gate is "good enough to push," not "everything perfect."

### Block 2 — Doc layer reconciliation (~60 min)

6. **PRD canon (D1).** Pick one of: rename `BaseOut_PRD_v2.md` → `BaseOut_PRD.md` and bump its `Version:` line to whatever is actually current. Delete `shared/Baseout_PRD.md` (older v1.1 copy).
7. **Implementation Plan rewrite.** `Baseout_Implementation_Plan.md` at root still talks about `baseout-ui`, `baseout-backup-engine`, `baseout-background-services` as separate repos. Rewrite the Repo Map and Phase tables to use `apps/web`, `apps/server`, `packages/ui`, etc. Background services fold into `apps/server`'s cron handlers per the README.
8. **CLAUDE.md reconciliation (D2).** Recommendation: keep both. Trim root CLAUDE.md to monorepo-meta only, pointing to `apps/*/.claude/CLAUDE.md` for per-app rules. Fix `apps/web/.claude/CLAUDE.md`'s broken `docs/` references → `shared/` or `../../shared/`.
9. **`shared/` cleanup (D3).** Keep: `Baseout_Features.md` (newer 63KB), `Master_DB_Schema.md`, `Pricing_Credit_System.md`, `internal/`. Decide on `Baseout_Backlog.md` and `Baseout_Backlog_MVP.md` (~650KB combined) — canonical or working?

### Block 3 — Operational follow-ups (~45 min)

From `openspec/changes/baseout-web/tasks.md` §4:

10. Rotate the leaked Fontawesome token (`9A19FB16-…`) at fontawesome.com; export `FONTAWESOME_TOKEN` in shell rc. **Hard requirement before the repo goes public.**
11. Hyperdrive + KV provisioning for staging/prod can wait until first deploy. Note as outstanding.
12. `wrangler secret put` per env can wait until first deploy.

### Block 4 — Push to github.com/baseout/baseout (~30 min)

13. Verify the GitHub repo `baseout/baseout` exists and is empty.
14. `git remote add origin git@github.com:baseout/baseout.git`.
15. Single commit (or rebase WIP commits for tidy history) and `git push -u origin main`. **Confirm before pushing — the repo goes public and Block 3.10 must be done first.**
16. Wire Cloudflare Workers Builds (per README "Deployment" section) for buildable apps — likely just `apps/web` for now. Other apps added one-by-one as they leave scaffold state.

### Block 5 — Archive the baseout-web change (stretch, ~30 min)

If verification (Block 1) passed cleanly:

17. `opsx:archive baseout-web` — moves proposal/design/tasks into `openspec/changes/archive/baseout-web/`, merges spec into `openspec/specs/`. Converts "what we ported" into the live spec, unlocking future `opsx:propose <capability>` changes for the deferred items in §3.

Skip if verification surfaced anything significant — better to fix and re-archive than archive a known-broken state.

### Block 6 — Parallel-agent enablement (~90 min, partially stretch)

Goal: every major feature lives in its own `openspec/changes/<change-name>/` folder, sized so one agent can complete it in one session. Independent changes can be worked in parallel via git worktrees. Shared-surface changes (`packages/db-schema`, `packages/ui`) serialize.

#### 6.1 Write `openspec/AGENTS.md` (~20 min)

A short conventions doc — drop in the repo so any agent (or human) can read it cold. Cover:

- **Naming:** `baseout-<app>-<feature>` for app-scoped changes; `<cross-cutting-name>` for cross-app (e.g. existing `web-client-isolation`).
- **Scope rule:** one change should be completable in ≤ 1 working session by 1 agent. If a proposal has more than ~20 tasks across multiple subsystems, split it.
- **Branch convention:** `change/<change-name>` (one branch per change, one agent per branch).
- **Worktree workflow:** `git worktree add ../bo-<change-name> change/<change-name>` so multiple branches coexist on disk without checkout thrash. `pnpm install` per worktree (postinstall repairs symlinks).
- **Serialization rules:** any change touching `packages/db-schema/src/` or `packages/ui/src/` blocks until merged — no two parallel changes may modify these. All other surfaces parallelizable.
- **Cross-change contracts:** when one change depends on another (e.g. `baseout-web-run-now` depends on `apps/server` providing `POST /runs/{id}/start`), document the wire contract in both proposals and lock it before either side starts coding.
- **PR rule:** every PR links to its `openspec/changes/<name>/` folder. CI rejects PRs that touch `apps/` or `packages/` without a linked change.

#### 6.2 Decompose `baseout-backup` (~60 min) **— Track B's critical-path unlock**

The current `openspec/changes/baseout-backup/tasks.md` is 13KB and spans backup engine, restore engine, all six storage destinations, dynamic backup, background services, schema diff, and health score. That's not parallelizable as-is — it's one massive blocking change. Until this is decomposed, no server agent can start.

Plan:
- Move `openspec/changes/baseout-backup/` → `openspec/changes/archive/baseout-backup/` (historical reference; not live).
- Update `scripts/fix-symlinks.js` so `apps/server/openspec` points at whichever per-feature change folder is currently in-flight (rotate the target as agents finish and pick up new work).
- Create per-feature `baseout-server-<feature>` change folders, each with a tight one-session scope:
  - `baseout-server-airtable-client` — OAuth holder, schema discovery, record fetch with pagination + 429 handling, attachment URL refresh, Enterprise variant. **First server task tomorrow** — no upstream deps.
  - `baseout-server-engine-core` — Trigger.dev job, R2 stream, file path layout, run lifecycle, attachment dedup, trial caps. Depends on airtable-client.
  - `baseout-server-durable-objects` — replace the PoC stubs with real `ConnectionDO` (rate-limit gateway, lock manager) + `SpaceDO` (state machine, scheduler).
  - `baseout-server-storage-r2` — R2 default destination
  - `baseout-server-storage-googledrive` — Drive OAuth + writer
  - `baseout-server-storage-dropbox` — Dropbox OAuth + proxy stream
  - `baseout-server-storage-box` — Box OAuth + proxy stream
  - `baseout-server-storage-onedrive` — OneDrive OAuth
  - `baseout-server-storage-s3` — IAM access (Growth+)
  - `baseout-server-storage-frameio` — Frame.io OAuth (Growth+)
  - `baseout-server-restore-core` — `POST /restores/{id}/start`, write order, post-restore verification
  - `baseout-server-cron-webhook-renewal` — daily renewal at 6-day threshold, 3-strike disable
  - `baseout-server-cron-oauth-refresh` — every 15 min, dead-connection cadence
  - `baseout-server-websocket-progress` — DO-emitted progress events; lock contract with `baseout-web-websocket-progress`
  - `baseout-server-dynamic-backup` — D1/Postgres provisioning, webhook-incremental backup
  - `baseout-server-schema-diff` — schema capture + changelog + health score
- For each: drop `proposal.md`, `design.md`, `tasks.md`, empty `specs/` folder. Pull the relevant tasks from the archived umbrella; cite the source PRD/Features sections (see 6.2.1 below).

**Tomorrow's scope: flesh out ONE change in full** (`baseout-server-airtable-client`), stub the rest as empty proposal folders. The first server agent picks up airtable-client immediately; subsequent agents flesh out and claim more from the stub list as they come online.

#### 6.2.1 Source citations for each per-feature change

When fleshing out per-feature proposals, cite directly:

- **`baseout-server-airtable-client`**: PRD §2.1 (Backup), §13.1 (Auth tokens), §17.4 (Airtable OAuth scopes); Features §10 (Backup capability matrix); archived `baseout-backup/tasks.md` §2.1–2.5.
- **`baseout-server-engine-core`**: PRD §2.1 (Backup), §7.2 (R2 streaming), §21.3 (`backup_runs` table); Features §10; archived `baseout-backup/tasks.md` §2.6–2.18.
- **`baseout-server-durable-objects`**: PRD §4 (Architecture), §5 (Data model); Features §10; archived `baseout-backup/tasks.md` §2.6–2.7.
- **`baseout-server-storage-*`**: PRD §7 (Storage destinations); Features §11 (Storage capability matrix); archived `baseout-backup/tasks.md` §3.10–3.17.
- **`baseout-server-restore-core`**: PRD §2.4 (Restore); Features §12 (Restore capability matrix); archived `baseout-backup/tasks.md` §3.1–3.9.
- (Pattern continues — every per-feature proposal must cite the PRD/Features sections it draws scope from. This is the "follow the PRD and feature docs" guardrail in machine-readable form.)

#### 6.3 Add `.github/PULL_REQUEST_TEMPLATE.md` (~10 min)

```markdown
## Change folder
<!-- Link the openspec change driving this PR -->
- openspec/changes/<change-name>/

## What's in this PR
<!-- 1-3 bullets: what changes, why, any non-obvious decisions -->

## Verification
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Tasks completed in change folder match the diff
- [ ] If touching packages/db-schema or packages/ui — confirmed no parallel change is blocked
```

#### 6.4 Add openspec validation to CI (~15 min)

In `.github/workflows/ci.yml`, add a job:

```yaml
- name: Validate openspec
  run: npx @fission-ai/openspec validate --all
```

Plus optional: a job that fails if a PR modifies `apps/` or `packages/` without a corresponding `openspec/changes/<name>/` link in the PR body. (Stretch — soft nudge first via the PR template, harden later if it's not landing.)

#### 6.5 Document the worktree-per-agent flow (~10 min)

Add a short section to `README.md` under "OpenSpec workflow":

```markdown
### Working in parallel (multiple agents)

Each in-flight change gets its own branch and worktree:

  git worktree add ../bo-<change-name> -b change/<change-name>
  cd ../bo-<change-name> && pnpm install   # postinstall repairs symlinks
  # agent works in this worktree; commits to change/<change-name>; opens PR

Independent changes parallelize freely. The two serialization rules:

- Only one change at a time may modify `packages/db-schema/src/`.
- Only one change at a time may modify `packages/ui/src/`.

Everything else is fair game.
```

### Block 7 — Track B: server agent kickoff (parallel to Track A from mid-morning)

Once Block 6.2 produces a fleshed-out `baseout-server-airtable-client/` change folder, dispatch a server agent (subagent or separate session) on it. Track B runs independently from this point — Track A's verification + push doesn't block the server agent's progress.

#### 7.1 Worktree setup
```bash
git worktree add ../bo-server-airtable-client -b change/baseout-server-airtable-client
cd ../bo-server-airtable-client && pnpm install   # postinstall repairs symlinks
```

#### 7.2 Agent brief (paste this into the agent's first prompt)

> Implement `openspec/changes/baseout-server-airtable-client/tasks.md` in `apps/server/`.
>
> **Source-of-truth anchors:** PRD §2.1 (Backup), §13.1 (Auth tokens), §17.4 (Airtable OAuth scopes); Features §10 (Backup capability matrix). When implementing scopes, rate-limit handling, or capability gates, cite the section in code comments and commit messages.
>
> **Constraints:**
> - Strict scope: only the tasks listed in this change folder. If you find yourself touching engine-core, DOs, or storage destinations, stop and surface it — that's a different change.
> - TDD per the engineering rules in CLAUDE.md: write the failing test first; integration tests via `@cloudflare/vitest-pool-workers`; mock Airtable HTTP at the boundary with `msw`.
> - No commits to `main`; commit to `change/baseout-server-airtable-client`. Open a PR linking to `openspec/changes/baseout-server-airtable-client/` when done.
> - Do not modify `packages/db-schema/` or `packages/ui/` (serialization rules — see `openspec/AGENTS.md`).
> - On encountering a missing dependency in `packages/shared` (encryption, HMAC tokens), flag it — don't inline the helper.

#### 7.3 Done criteria for `baseout-server-airtable-client`
- All tasks in `tasks.md` checked off
- Tests green (unit + integration); coverage ≥ 80% per the engineering rules
- PR opened against `main` linking the change folder
- Hand-off note: which task is the natural next pickup (likely `baseout-server-engine-core`)

---

## Decision points (still open)

- **D1 (Block 2.6):** PRD versioning — is the root file v1.1 or v1.4? (Internal version string and cross-reference disagree.)
- **D2 (Block 2.8):** Keep both CLAUDE.md files (recommended) or collapse to one root file?
- **D3 (Block 2.9):** `shared/Baseout_Backlog*.md` — canonical or working docs? If working, archive or delete.
- **D4 (Block 4.15):** Push timing — after Block 1 verification, after Block 3 token rotation, or separate review step?

---

## Explicit non-goals for tomorrow

- Track B does NOT cover `apps/{admin,api,sql,hooks}` — those stay as single-change scaffolds (per D5 resolution).
- No `packages/db-schema` extraction (deferred per `baseout-web` §3.17).
- No `packages/ui` migration (deferred per `baseout-web` §3.18).
- Track B starts only `baseout-server-airtable-client` tomorrow; subsequent server changes (engine-core, DOs, storage destinations) get fleshed out and picked up day 2 onward.
- No fleshing out the deferred web changes (`baseout-web-byos-storage`, `baseout-web-onboarding-wizard`, etc.) — also day 2 onward.

---

## Stretch (if everything above lands cleanly)

- Update memory note `project_monorepo_migration.md` to reflect: skeleton at planning HEAD (resolved), engine abandoned, `apps/web` ported from `29dfb5b` minus engine wire, monorepo pushed, parallel-agent flow live.
- Wire `pnpm typecheck` + `pnpm test` across the workspace into the CI matrix.
- Decompose 3-5 more big-scope changes per the Block 6.2 pattern (extending to `baseout-admin`, `baseout-api`, etc. if the bandwidth's there).
