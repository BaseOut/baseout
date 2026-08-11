# design-descriptions-readonly — tasks

## Status

IN PROGRESS — 2026-08-11. Code + fixture + storybook + ledger done; design
`build` green. Human smoke (6.3) + upstream reverse-sync (7.1) pending.

## 1. Confirm the seam before editing

- [x] 1.1 Read `apps/design/src/components/schema/EntityPanel.astro` around the
      Descriptions block (tab bar :1089–1094; `atMeta` :1019 / `extMeta` :1020;
      `editor()` :990–1016; synced state :1067; Publish :1062 + :1769–1782;
      Save :1765 / Discard :1783; `commitField` :882–889). Determine whether the
      editor/Save/Discard are shared across tabs (switch by active tab) or
      per-tab — this decides "gate to Internal" vs "delete the Airtable editor
      branch." Line numbers are pre-change; re-locate by `data-ep-desc-*` hooks.

## 2. Airtable tab → read-only; Internal stays editable

- [x] 2.1 Airtable (`airtable`) tab now renders read-only text + `atMeta`; the
      whole multi-state branch (edit/publish/draft/confirm/busy/synced-status)
      collapsed to `const at = box(<value|—>) + atMeta`. No input, no buttons.
- [x] 2.2 Confined `editor()` + **Save**/**Cancel** + `commitField()` to the
      **Internal** (`extended`) tab (`editor` is Internal-only now; `genOn =
      canGenExt`). `extMeta` kept.
- [x] 2.3 Removed the **"Publish to Airtable"** button + its confirm/faked-publish
      flow (publish / publish-cancel / publish-confirm / discard handlers), the
      faked `toast()` helper (its only caller), and `descConfirmId`/`descBusyId`.
- [x] 2.4 Removed the write-back demo state (`out`/`busy`/`confirming`/`canGen`
      render locals, the `airtableExternallyChanged` stale-warning, the draft
      flag). AI-generate (`aiState`/`canGenExt`/credits) untouched. The now-inert
      `data-ep-toast` element + `.ep-toast` CSS left in place (harmless).

## 3. Fixtures

- [x] 3.1 Removed the `airtableDraft` / `airtableExternallyChanged` seeds from the
      `Deals ▸ Stage` `schema-lab` fixture; rest of the fixture intact.

## 4. Styleguide catalog

- [x] 4.1 Trimmed the storybook.ts `pattern-entity-panel` entry (description +
      2 usageDo lines) to the read-only-Airtable reality (write-back → Agents).
      Left the generic `pattern-annotation-field` entry (~:4367) + its demo as
      the reusable draft→publish pattern for the FUTURE Agents write-back —
      flagged in the ledger, not rewritten (honors the 3-way reconcile rule).

## 5. Ledger — record the divergence (same change)

- [x] 5.1 `shared/internal/ui-sync.md` §4 — EntityPanel row updated: Airtable
      read-only; faked Publish + `airtableDraft`/`externallyChanged` seed removed;
      diverged from `ui-only` pending reverse-sync.
- [x] 5.2 §5 known traps — added the "forward sync of EntityPanel.astro (or the
      Deals ▸ Stage fixture / storybook entity-panel entry) MUST NOT re-import the
      Airtable editor / Publish button; reconcile via reverse-sync" trap.

## 6. Gates + smoke

- [x] 6.1 `pnpm --filter @baseout/design build` green (`[build] Complete!`).
- [x] 6.2 N/A — apps/design has no `audit:components` script (build is its gate,
      green). EntityPanel edits are content-only; no component added/reclassified.
- [ ] 6.3 Human smoke: `pnpm --filter @baseout/design dev` → Schema → click a
      field → Descriptions: **Airtable** tab shows the description read-only with
      the synced indicator and **no** editor/Save/Publish; **Internal** tab still
      edits + Saves; AI "Generate" still present. Check `Deals ▸ Stage` no longer
      shows the "externally changed / publish" demo.

## 7. Upstream — SUPERSEDED by the fork (7502f81)

- [x] 7.1 Ran `pnpm ui:sync-drift` (the first real use of `system-sync-skills`).
      Result: `EntityPanel.astro` is **diverged** because the fork ALREADY did
      this removal, more completely, in `ui-only@7502f81` ("Airtable goes
      read-only, and writing gets its own section", Oleh 2026-08-07). So there is
      **nothing to reverse-sync UP** — the resolution is a FORWARD-sync of
      `7502f81` that supersedes this hand-edit. This change stands as a buildable
      interim; the paired live-app landing already shipped via `web-actions`
      (also promoted from `7502f81`). Ledger §4/§5 updated to reflect this.
- [ ] 7.2 Forward-sync the fork's canonical read-only `EntityPanel` (+ controller
      + Browse tree + both type sets) via `/ui-sync` to replace this interim —
      deferred (a diverged, cascading schema forward-sync; do with a browser).

## Deferred follow-ups

- [ ] If/when EntityPanel is promoted to `apps/web`, it inherits the read-only
      Airtable posture — no re-derivation.
- [ ] Viewer-role gating of the Internal editor (flow-registry.ts:1271/1365
      "needs a capability flag from the host") — separate, needs a backend.
