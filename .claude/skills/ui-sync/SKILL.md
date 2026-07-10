---
name: ui-sync
description: Sync UI/UX designs from the ui-only fork into apps/design and promote them into apps/web with real data wiring. Use when the user asks to pull/sync ui-only, apply Dan's designs, promote a redesigned view, or drop new UI into apps/web.
---

# ui-sync — pull ui-only designs, land them in design, promote them to web

The design fork `github.com/BaseOut/ui-only` (git remote `ui-only`) has
**unrelated history**. Its views work, but on static fixture data. This skill
moves that work into the monorepo in three stages and wires the real data
layer, without recreating widgets that already exist.

**The prime directive (Dan, 2026-07):** repurpose existing, functional
Storybook-cataloged widgets — never recreate them from scratch. Design
consistency and working functionality beat pixel-fidelity shortcuts.

## Preconditions

1. Read `shared/internal/ui-sync.md` (the ledger) FIRST — mapping table,
   last-synced hash, promotion matrix, known traps. Update it in the SAME
   change as any sync/promotion (CLAUDE.md §3.7 discipline).
2. `git fetch ui-only`.
3. Working tree must be clean for every file the sync will touch. Run
   `pnpm ui:sync-status` — it flags dirty targets. Never sync over a dirty
   target; commit or set aside the in-flight work first.

## Stage 0 — Status & scoping

Run `pnpm ui:sync-status`. Group the pending files by surface (schema panels,
export, inbox, app shell, docs, …) and classify each surface:

- **sync-only** — still churning upstream (an `overview/pending-plan-*.md`
  with open questions counts as churning) or no backend exists yet. Lands in
  apps/design; promotion is a later run. FLAG these to the user.
- **promotable** — settled design + a data layer exists (or the gap can be
  gated "soon"). Default stance per the promotion pattern: promote — don't
  over-defer. UI can land with an empty/soon-gated data source when the
  backend is the only gap.
- **never-sync** — fork-local tooling and config: `.claude/**` (hooks,
  settings), root `package.json`/lockfile, CI, fork asset deletions,
  `research/**/shots/*.png` binaries. These NEVER cross.

STOP and confirm scoping with the user when a surface is ambiguous or an
upstream plan doc has open client questions.

## Stage 1 — Sync → apps/design (one commit)

- Copy files VERBATIM at the pinned `ui-only/main` hash
  (`git show ui-only/main:<path> > <target>` or `git checkout ui-only/main --
  <path>` + move). Verbatim keeps the next sync diffable.
- The ONLY permitted edits are import-path rewrites per the ledger's mapping
  table (`@web/views` → relative, `@web/components/schema` → local, the
  `src/lib/ui.ts` shim). Leave upstream strict-tsc quirks verbatim — the
  design build is the gate, not tsc.
- `apps/design/src/lib/storybook.ts` is the standing exception: it usually
  needs a 3-way reconcile (local entries vs upstream entries). Note the
  reconcile in the ledger.
- Import upstream `openspec/changes/<x>/` as `openspec/changes/web-<x>/`
  (or per §3.6 naming), preserving task state; annotate backend-blocked
  tasks.
- Commit: `chore(design): sync ui-only@<hash> …` with a §3.8 Verification
  section, INCLUDING the ledger update.
- Verify: `pnpm --filter @baseout/design build` green; dev-render the synced
  surfaces; `pnpm --filter @baseout/web audit:components` still green
  (design references resolve).

## Stage 2 — Promote → apps/web (one openspec change per surface)

File `web-<topic>` per surface (`opsx:propose`). Then, per view/component:

1. **Repurpose, don't recreate** — intake order is mandatory:
   a. an existing Storybook component (`src/components/ui/*`,
      `src/components/patterns/*`) — map the ui-only markup onto it;
   b. daisyUI markup directly — only when no cataloged component covers it;
   c. never a hand-rolled custom component. If neither (a) nor (b) covers
      the need, STOP and surface it.
   Name the `SB_ENTRIES` catalog entries being repurposed in the allowlist
   rationale.
2. Keep markup and `<script>` blocks **verbatim where possible, DOM ids
   unchanged** — existing lazy-load hooks, pollers, and data flows key off
   them.
3. Split monoliths (shell + tab modules, per the round-3 pattern); extract
   pure logic into tested `.ts` modules (`src/lib/…` + vitest).
4. Governance: register every new `.astro` view in
   `src/components/raw-markup-audit-allowlist.json` with a rationale; add or
   extend stories for any `ui/*` change; CSS goes into `global.css`
   prefixed; retarget `/styleguide` references.
5. Replaced views become `*.legacy.astro` (rollback target).
6. Blocking gate: `pnpm --filter @baseout/web audit:components` green.

## Stage 3 — Data wiring

- SSR pages fetch via `createBackupEngine()`
  (`apps/web/src/lib/backup-engine.ts`; service binding + INTERNAL_TOKEN —
  never public HTTP, token never client-side).
- Design fixtures and SSR loaders share the same TS interfaces from
  `backup-engine.ts` — the shared view must accept identical props mock or
  real. If the upstream design added props, extend the interface, then the
  loader, then the fixture — in that order.
- Where the backend doesn't exist yet: mount the UI with an empty feed +
  designed zero-state, gate actions "soon", and file the paired `server-*`
  change (§3.6 cross-reference). Swapping in real data must touch the data
  source only, not the UI.

## Functionality-preservation checklist (every promotion)

- [ ] Backup live-status polling still updates without refresh
      (`src/stores/backup-runs.ts` + widget lifecycle — the recurring
      "must refresh" regression; any view swap that re-mounts the widget
      drops it).
- [ ] Lazy-load hooks keyed on DOM ids still fire (ids unchanged).
- [ ] Middleware auth gating unchanged for touched routes.
- [ ] Server-waiting interactions keep `setButtonLoading` spinners (§4.5).
- [ ] Theme swap + mobile header behavior at <375/<768/<1024.
- [ ] `pnpm --filter @baseout/web test:unit` targeted + `typecheck` + build.

## Never-do list

- Never `git merge` ui-only — unrelated history.
- Never edit synced design files beyond path rewrites — breaks diffability.
- Never sync fork-local tooling/config (never-sync list above).
- Never promote a surface whose upstream plan doc has open questions
  without flagging it to the user first.
- Never push or open PRs — human-tested local-commit loop.
