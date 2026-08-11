# design-descriptions-readonly — Airtable description tab becomes read-only; drop the faked write-back

## Status

PROPOSED — 2026-08-11. Single-app (`apps/design`) + the ui-sync ledger. Pairs
with [web-agents](../web-agents/proposal.md) (stands up the section that future
write-actions belong to) and depends on
[system-sync-skills](../system-sync-skills/proposal.md) to propagate this
removal **up** to the `ui-only` fork. Source: the boss's walkthrough
("…if you could just make that change here and then create that landing page").

## Why

The boss recorded the walkthrough against the `apps/design` harness
(ui.baseout.dev) believing it was the product. In that harness,
`components/schema/EntityPanel.astro` shows a field's **Descriptions** with two
tabs — **Airtable** and **Internal** — where the Airtable tab is *editable* and
carries a **"Publish to Airtable"** button. That write-back is a **client-side
fake** (comment at EntityPanel.astro:963–964 "Write-back is faked client-side";
Publish runs a `setTimeout` then `toast('Published to Airtable')` at :1779 — no
`fetch`, no `/api`, seeded by the `airtableDraft` / `airtableExternallyChanged`
fixture on `Deals ▸ Stage`).

It is the one "scary" affordance the boss wants gone so the product is provably
read-only ("we don't modify your system"). Two supporting facts:

- **Nothing real is lost.** No backend write path exists anywhere in the repo,
  and `AIRTABLE_SCOPES` is read-only (no `schema.bases:write`). The fake is the
  only "write-back" that exists.
- **Live `apps/web` is already correct.** `src/views/schema/BrowseTab.astro`
  renders all three descriptions read-only; `EntityPanel` was never promoted
  (ui-sync.md §4: "STAGED — web mount deliberately deferred"). So this change
  touches the harness only.

Removing it also **corrects a V2 scope leak** — Airtable write-back is deferred
(PRD §10; Backlog V2.7/V2.10) — and aligns the harness with both the live app
and the boss's vision.

**The ledger catch:** `apps/design` is synced *verbatim* from `ui-only` at a
pinned hash (ui-sync.md §2). Editing EntityPanel directly in the monorepo
creates an intentional divergence; without a ledger note, the **next forward
`/ui-sync` run would re-import the fake write-back**. This change therefore
records the divergence and hands upstream propagation to the reverse-sync skill.

## What Changes

- **`apps/design/src/components/schema/EntityPanel.astro`** — make the
  Descriptions **Airtable** tab display-only, keep **Internal** editable:
  - Gate the editor (`editor()`, :990–1016), **Save** (`data-ep-desc-save`,
    :1765) and **Discard** (`data-ep-desc-discard`, :1783) to the **Internal**
    (`extended`) tab only; render the **Airtable** (`airtable`) tab as read-only
    text plus its existing meta line ("Shown to everyone in Airtable · the only
    synced copy," `atMeta` :1019) and the "Synced with Airtable" state
    indicator (:1067) shown as **status, not an editable control**.
  - Remove the **"Publish to Airtable"** button (:1062) and its confirm + faked
    publish flow (:1769–1782, incl. the `setTimeout`/`toast('Published to
    Airtable')` at :1779).
  - Remove the write-back demo scaffolding: the `airtableDraft` /
    `airtableExternallyChanged` fixture seeding and the `descStates` overlay
    that drives the "externally changed / draft" states for the Airtable tab.
    Keep `commitField()` / `schema:descChanged` (:882–889) wired for the
    **Internal** tab.
  - **Keep unchanged:** the AI-description generate flow (`aiState`,
    `canGen`/`canGenExt`, "10 credits" — :36–37, :984–988). AI descriptions are
    Baseout-only (never Airtable), so they stay; with Publish gone they are
    plainly local suggestions.
- **Fixtures** — drop `airtableDraft` / `airtableExternallyChanged` seeds from
  the `Deals ▸ Stage` schema-lab fixture that only existed to demo write-back.
- **`shared/internal/ui-sync.md`** — record the divergence:
  - §4 promotion matrix: update the EntityPanel row to note "Airtable
    description read-only; write-back removed (design-descriptions-readonly);
    diverged from `ui-only` pending reverse-sync."
  - §5 known traps: add "EntityPanel is intentionally ahead of `ui-only` for the
    write-back removal — a forward sync of `components/schema/EntityPanel.astro`
    MUST NOT re-import the Airtable-tab editor / Publish button; reconcile via
    the reverse-sync skill (system-sync-skills)."
- **Upstream propagation to `ui-only`** is **out of this change's edits** — it is
  performed with the reverse-sync skill from `system-sync-skills` (human-approved
  push; never auto). Tracked as a task/dependency here.

## Capabilities

### Modified Capabilities

- `schema-entity-panel`: the field/table Descriptions panel presents the Airtable
  description read-only (display + synced-state indicator) and confines editing to
  the Baseout-only Internal description. No affordance in the harness implies or
  simulates writing to Airtable.

## Non-Goals

- **No `apps/web` change.** BrowseTab is already read-only; EntityPanel is not
  mounted in web. (If EntityPanel is later promoted, it inherits this posture.)
- **No removal of the AI-generate flow** — Baseout-only, stays.
- **No new backend, route, scope, or migration** — this is a UI removal.
- **No direct push to `ui-only` inside this change** — deferred to the
  reverse-sync skill so the mechanism is reusable, not a one-off.

## Impact

- **`apps/design`**: `src/components/schema/EntityPanel.astro`; the
  `schema-lab` fixture that seeded the write-back demo.
- **`shared/internal/ui-sync.md`**: §4 + §5 divergence notes (CLAUDE.md §3.7:
  update the ledger in the same change that diverges from the fork).
- **`apps/design/src/lib/storybook.ts`** — if the `/styleguide` entry for
  EntityPanel narrates the "Publish to Airtable" guarded write-back
  (storybook.ts:~4300), trim that line to match (respect the standing 3-way
  reconcile exception).
- No server/DB/secret/scope change. Blast radius: the design harness only;
  a known, ledger-tracked divergence from `ui-only` until reverse-sync lands.
