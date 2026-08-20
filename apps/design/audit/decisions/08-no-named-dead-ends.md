# D08 — No named dead ends: cross-surface seams

**Rule:** A surface that *names* a count, consequence, entity or destination links to the surface
that holds it — copy may not mention what the UI will not open.

Merged per lead ruling: **J05-F1 + J06-F2 are one decision** (with J04-F14, J05-F5, J05-F6 and
J03-F5). The evidence differs — two sections vs two tabs — but the rule and the fix mechanism
(carry the join key, emit a link) are identical, and the reference precedent is the same:
`ReportBodyKpi.astro:185`, where a reference surface detects a problem inside a result and offers
the repair inline.

## Why this option

The rejected alternative is treating each missing link as a feature request. The journeys show
copy that already *promises* the destination: the Schema panel says "a restore can recover it" with
zero `/restore` links; the Relationships explainer says "they matter for restores"; a warning
counts "12 records" it cannot show; a paperclip counts 3 files it will not open. When the words
name the destination, the missing link is a defect, not a roadmap item.

## The concrete links

1. **Schema ⇄ Data**: a schema change stating a record consequence gets "Show the N records" into
   `/data` filtered to table + run window; a Data run row whose window contains schema changes gets
   an "N schema changes" chip into `/schema?tab=changelog` filtered to the range. (J05-F1)
2. **Attachments ⇄ Comments**: the `Comment` origin chip opens the record panel focused on that
   comment (`focus:'comments', commentId` — the contract exists, `RecordPanel.astro:406`); the
   paperclip count opens Attachments filtered to that record. (J06-F2)
3. **Discovery → Restore**: the mass-delete row and a removed table/field get a `Restore…` action
   carrying run + scope. (J04-F14) The mass-delete panel opens on the tab its flag points at
   (Deleted, not Created). (J04-F12)
4. **Health → Changelog**: "-4 since last backup" becomes a control opening the Changelog filtered
   to that window; issues gain "First seen". (J05-F5)
5. **In-use-by → the Space**: rows point at the Space's own route, not the decommissioned
   `/integrations?space=` redirect. (J03-F5 / J08-F7)
6. **Dependencies surface** (product-level, flag to Dan): "Referenced by N" counts on changelog
   rows and Health issues; adopt Airtable's own noun "Dependencies". Airtable gates this behind
   Enterprise; we hold it free and hide it two clicks deep. (J05-F6,
   `research-airtable-dependencies-reverse-direction`)

**Blocking prerequisite:** one entity-id namespace across Schema/Data/Health fixtures (today
`b-sales` vs `baseCRM` vs invented tables) — a harness fix, listed in the register's harness
section. The links are `apps/web` code and hold regardless.

## Surfaces changed

`SchemaChangelog` · `schemaReadBody` · `DataChangelog` · `DataMedia` · `DataComments` ·
`SchemaHealth` · `SourceDetailView` · fixtures (shared ids).

## storybook.ts

`pattern-changelog-timeline` + `pattern-data-changelog`: add the seam rule and the two link shapes.
New usage note wherever `Referenced by` lands ("Dependencies — count on the row, list in the
panel").

## Not changing

The Schema change panel itself (the best answer in the product) · the anti-fabrication stance (no
actor, no invented identities) · the ⚠/attention detectors.

## Verify

From the Jun 20 type-change: reach the 12 records in two clicks. From `run_del99`: reach the schema
window and reach Restore. From Health's delta: reach the changelog filtered to the window. No copy
names a surface it does not link.


---

## AMENDMENT 2026-08-14 — one member from the X14 lens

**X14-F2 (S2).** `Retry` tells the user the result *"will appear in History"* — **while the button
itself is rendered inside History** (`ReportDefinitionView.astro:268`, in the History table; the toast
at `:807-808`), on a row that is not updated. It names a destination the user is already standing in,
which is verbatim what D08 forbids, and it promises a *future* in a toast whose own pattern
(`pattern-undo-toast`) states outcomes in the past tense.

**Fix:** the toast names the outcome, and the History row updates — or the toast says plainly that it
will not. Do not keep a sentence whose only content is a direction the user cannot travel.
