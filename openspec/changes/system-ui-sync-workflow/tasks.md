# system-ui-sync-workflow — Tasks

## 1. Skill

- [x] 1.1 Write `.claude/skills/ui-sync/SKILL.md` — preconditions, Stage 0–3,
      repurpose directive + intake order, functionality-preservation
      checklist, never-do list, STOP points.

## 2. Runbook ledger

- [x] 2.1 Write `shared/internal/ui-sync.md` — remote + mechanism, path
      mapping table, never-sync list.
- [x] 2.2 Seed the sync ledger with the historical rows (f0f9171/789727e,
      round-2/6d4c698, d97c777/53110f8) and the promotion matrix with the
      already-promoted surfaces (round-3 shell 09949d3).
- [x] 2.3 Document known traps (must-refresh polling, verbatim tsc errors,
      storybook.ts 3-way reconcile, Header/Inbox app-shell entanglement).

## 3. Status script

- [x] 3.1 Write `scripts/ui-sync-status.mjs` (zero-dep node; last-hash parse,
      fetch, pending delta bucketed by surface, dirty-target flags).
- [x] 3.2 Add `"ui:sync-status": "node scripts/ui-sync-status.mjs"` to root
      `package.json`.
- [x] 3.3 Run it and confirm it reports the real pending state
      (d97c777..ui-only/main) and flags the currently-dirty targets.

## 4. CLAUDE.md rule

- [x] 4.1 Extend §3.7 with the ui-sync runbook rule (read first, update
      same-change, invoke `/ui-sync`).

## 5. Verification

- [x] 5.1 `pnpm ui:sync-status` output sane; no other pnpm scripts broken.
- [ ] 5.2 Commit per §3.8 (docs+tooling — one-line Verification form is NOT
      sufficient here since a script ships: Demo = run the script).
