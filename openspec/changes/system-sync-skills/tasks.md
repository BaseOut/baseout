# system-sync-skills — tasks

## Status

IN PROGRESS — 2026-08-11. Phase 1 (Thrust A) + most of Phase 2 (B & C) built and
**smoke-verified against live repo state**. Deferred: promotion-matrix parse
(5.2), content-level drift + fixture tests (documented follow-ups). Operational
scripts are verified by run (the `ui-sync-status.mjs` precedent — that change's
Non-Goals also declined script unit tests), not by fixture tests.

## Phase 1 — Thrust A: bidirectional drift + reverse-sync

### 1. `scripts/sync-drift.mjs` (mechanical, zero-dep)

- [x] 1.1 Resolves the last DESIGN-SYNC point — prefers `chore(design): sync
      ui-only@<hash>` subjects over later web PROMOTION commits that cite the
      same hash (the bug the first smoke caught). Reuses the `ui-sync-status.mjs`
      marker convention.
- [x] 1.2 `git fetch ui-only` (`--no-fetch` to skip); `--path <prefix>` scopes to
      one surface. NEVER_SYNC + surface rules mirror `ui-sync-status.mjs` / §2.
- [x] 1.3 Four-verdict classification (`in-sync` / `forward-pending` /
      `reverse-pending` / `diverged`). FORWARD = fork changes mapped to local;
      REVERSE = `apps/design/**` local changes since the sync (verbatim mirror
      only — web changes are promotions, not reverse candidates). Grouped +
      counted output.
- [x] 1.4 Root `package.json`: `ui:sync-drift`.
- [~] 1.5 Fixture test — **deferred**: verified by live smoke instead
      (`--path apps/design/src/components/schema` → EntityPanel correctly
      `diverged`, 4 reverse-pending, 12 forward-pending; unscoped 32/8/149).
      Matches the `ui-sync-status.mjs` precedent (no script unit test).

### 2. `.claude/skills/sync-reconcile/SKILL.md` (procedure)

- [x] 2.1 Minimal frontmatter (`name` + reverse/drift-triggered `description`);
      no `allowed-tools`. Registered (appears in the skills list).
- [x] 2.2 Body: preconditions (ledger-first, `ui:sync-drift`); the reverse
      procedure (diff since sync, invert §2 import rewrites, emit
      `patches/ui-only/<path>.patch`); explicit STOP before any push and for
      every `diverged` file (which-side-wins, per file); ledger-update step.
      Includes the EntityPanel `diverged` worked example.
- [x] 2.3 Never-do carry-over (no auto-push, no `git merge ui-only`, no
      hand-edit beyond rewrite inversion, no auto-resolve of `diverged`).

### 3. Wire into the existing trio

- [x] 3.1 `.claude/skills/ui-sync/SKILL.md` Stage 0 — reverse/drift pointer to
      `/sync-reconcile` + `pnpm ui:sync-drift`.
- [x] 3.2 `shared/internal/ui-sync.md` §1 — documented the reverse path, the four
      verdicts, `ui:sync-drift`/`ui:sync-check`/`storybook:reconcile`.
- [x] 3.3 `CLAUDE.md` §3.7 — one line noting `/sync-reconcile` + `ui:sync-drift`
      (and `/spec-sync`) alongside the forward runbook.

### 4. Phase-1 exit — first real use

- [x] 4.1 `ui:sync-drift --path apps/design/src/components/schema` confirms the
      `design-descriptions-readonly` EntityPanel edit is caught — it shows
      **diverged** (the fork also advanced the panel), so it is NOT a clean
      reverse patch: reconcile per `/sync-reconcile` Step 3.
- [x] 4.2 The drift check paid off immediately: EntityPanel came back `diverged`,
      and inspecting the fork side revealed `ui-only@7502f81` ("Airtable goes
      read-only, and writing gets its own section", Oleh 2026-08-07) had ALREADY
      implemented the boss's request — more completely, and named **Actions**.
      So there is nothing to reverse-sync UP; the resolution is a forward-sync of
      `7502f81` that supersedes the hand-edit. This directly reshaped the product
      work (`web-agents` → `web-actions`, promoting the fork's canonical view) —
      the tool caught a duplicate + a naming conflict BEFORE any commit. Its most
      valuable possible first run.

## Phase 2 — Thrust B: harden the forward pipeline

- [x] 5.1 `scripts/ui-sync-status.mjs --check` (+ `ui:sync-check`) — fails if a
      `chore(design): sync ui-only@…` tip didn't also touch
      `shared/internal/ui-sync.md`. No-ops on non-sync tips (smoke: OK).
- [~] 5.2 Promotion-matrix parse — **deferred**: the §4 cells are multi-line and
      free-form (no machine-readable surface→paths mapping), so a reliable parse
      needs a small ledger-format change first. Filed as a follow-up.
- [x] 5.3 `scripts/storybook-reconcile.mjs` (+ `storybook:reconcile`) — resolves
      the fork path (design→web fallback) and prints fork-side + local-side
      diffs/diffstats for the §2 3-way. Smoke: fork +1504/-143, local +1762/-303.
- [x] 5.4 Folded into `/ui-sync` Stage 0 + ledger §1 (see 3.1/3.2).

## Phase 2 — Thrust C: OpenSpec ↔ code sync

- [x] 6.1 `scripts/spec-sync-status.mjs` (+ `spec:sync-status`) — archive-ready
      (all tasks `[x]`/`[~]`, unarchived) + stale path-token refs for archive-ready
      changes only (skips globs / `...` elisions / not-yet-created in-progress
      files). Smoke: found 20 archive-ready + real drift (the `workflows` change
      still cites `apps/server/trigger/…` paths that moved to `apps/workflows/`).
- [x] 6.2 `.claude/skills/spec-sync/SKILL.md` — triage procedure (archive via
      `/opsx:archive`, fix/flag stale refs); minimal frontmatter; registered.
- [~] 6.3 Fixture test — **deferred**: verified by live smoke (real archive-ready
      + stale-ref output). Same operational-script precedent as 1.5.

## Gates

- [x] 7.1 All four scripts run zero-dep under repo node; each has a usage header
      + exit-code contract; all smoke-verified.
- [x] 7.2 `lat check` clean (exit 0) — no app runtime code touched; doc/skill/
      script edits only.

## Deferred follow-ups

- [ ] Content-level 3-way drift (baseline `git show ui-only/<hash>:<path>` with
      import-rewrite-aware normalization) — v1 is file-level.
- [ ] Machine-readable §4 promotion matrix (5.2) — needs a ledger-format tweak.
- [ ] Symbol-level (not just path-token) stale-ref detection for specs.
- [ ] Fixture tests for the four scripts if the repo adopts a scripts/ test suite.
- [ ] Split Thrusts B/C into their own `system-*` changes if desired (independent).
