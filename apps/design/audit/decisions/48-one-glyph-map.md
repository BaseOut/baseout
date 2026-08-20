# D48 — One glyph map

**Rule:** An entity's glyph and its concept colour come from `schema/entityIcon.ts` and nowhere else;
the colour rule attaches to the class `entityIcon` emits (`.concept-ic-*`), never to a Lucide icon
name, so a glyph used as navigation never wears an entity colour.

## Why this option, and what was rejected

`entityIcon.ts:6-17` says, in the file, *"This replaced FIVE copies … do not write a sixth."*
**Twenty files now decide an entity's glyph outside it, and six of them import it and hand-roll a
second mapping in the same file.** Only `EntityPanel`'s field-type case is a documented exception.
The module is not the problem — it is a model of how to retire variance: it names what it replaced,
lists the five files, and records the record-glyph decision *with the four rejected candidates and
why each was already spoken for*. The problem is that twenty files never got the memo.

**The defect a user meets is a contradiction on one screen.** On the Attachments tab, `base` is blue
in the group headers (`concept-ic-base`) and uncoloured in the refine panel — **both visible at
once** — because `refineFacetIcons.ts:46-52` picks the glyph and omits the class. A colour that means
"base" in one half of a screen and nothing in the other cannot be read as meaning anything, which
costs the concept-colour system its entire value. `entityIconClass('base')` cannot omit the class;
that is the fix and it is why delegation beats copying the class string.

**The colour rule is attached to the wrong thing.** `global.css:2538` colours **every**
`.iconify.lucide--table-2` green at specificity (0,2,0), under a comment asserting that `table-2` is
used only as the table-entity icon. It is also the **Records tab** icon, the wizard's **Bases step**
icon and the **"Airtable copy" tab** icon — three navigation controls wearing an entity colour — and
it out-specifies `RestoreView.astro:345,643`'s `text-base-content/45`, a (0,1,0) utility in a
Tailwind layer, so Restore's muted-icon intent is almost certainly not painted. Moving the rule onto
`.concept-ic-table` fixes the contradiction and the override in one line, and it makes the
justifying comment true.

**Rejected: adding `date` to `entityIcon`.** Two calendar glyphs for one concept on one page
(`lucide--calendar` vs `lucide--calendar-days`) exist because `entityIcon` has no `date` kind — but a
date is not an entity, and widening the entity map to hold non-entities is how the map stops meaning
anything. **Pick one glyph and put it on a stated non-entity glyph list** in the catalog instead.

## The concrete changes

1. **The fourteen non-importers call `entityIconClass()` / `entityIconMarkup()`**: `SchemaDocs:49,644`
   · `schemaChat.ts:30` · `SchemaChat:69,124` · `SchemaRelationships:89` · `schemaRelationships.ts:45`
   · `SchemaBrowse:405` · `typeaheadItems.ts:53` · `recordReadBody:343` · `refineFacetIcons:47` ·
   `SchemaCanvas.tsx:422` · `ReportBodyKpi:59` · `SchemaAutomations:303` · `SchemaInterfaces` ·
   `entityPanelController.ts`.
2. **The six in-file twins delete**: `QuickAskDock:71` · `SchemaHealth:176` · `schemaReadBody.ts:564`
   · `DataComments:812` · `DataMedia:1230`. Only `EntityPanel`'s documented field-type exception
   survives.
3. **`refineFacetIcons`' `BY_CONCEPT` delegates to `entityIconClass`**, so the refine panel and the
   group headers cannot disagree.
4. **The colour rule moves from `.iconify.lucide--table-2` onto `.concept-ic-table`** (and the same
   for every other concept rule at `global.css:2538-2563`). The three navigation controls lose the
   entity colour; Restore's muted intent starts painting.
5. **One calendar glyph**, on a stated non-entity glyph list.

## Surfaces changed

`SchemaDocs` · `SchemaChat` + `schemaChat.ts` · `SchemaRelationships` + `schemaRelationships.ts` ·
`SchemaBrowse` · `SchemaHealth` · `SchemaAutomations` · `SchemaInterfaces` · `SchemaCanvas.tsx` ·
`QuickAskDock` · `schemaReadBody.ts` · `entityPanelController.ts` · `DataComments` · `DataMedia` ·
`recordReadBody.ts` · `typeaheadItems.ts` · `refineFacetIcons.ts` · `ReportBodyKpi` ·
`global.css:2534-2563`. **Batch: `global.css` + `refineFacetIcons` first — that is items 3 and 4, two
files, and it fixes the one-screen contradiction and the Restore override together. Then Schema, then
Data.**

## storybook.ts

Add the rule to the entry that carries `decision-entity-glyphs`: **the concept colour attaches to
`.concept-ic-*`, never to a Lucide class name**, with the `table-2` case as the worked example of why
— including that the old rule's own justifying comment had become false. Add the non-entity glyph
list (calendar, and whatever else the sweep surfaces).

## Not changing

`entityIcon.ts` itself — **do not rewrite it; import it.** Its rejected-candidates record and its one
documented exception are exactly right. · `airtableFieldIcons.ts`: 31 vendored icons, a regeneration
script, a stated scoped exception to the Lucide-only rule, a "never blank" fallback, 17 importers and
**zero bypasses**. This is what X09 should look like everywhere. · `airtableGlyph.ts` (8 call sites,
all `currentColor`). · The icon sizing floor: `size-4` 455 · `size-3.5` 305 · `size-3` 45 · `size-5`
13 · `size-6` 12 · `size-7` 4, nothing below 12px in 834 sized uses, and the two dominant sizes map to
a real distinction. The **73 unsized `.iconify` spans are DEFERRED to D21** — trigger: any measured
icon below 12px.

## Verify

`grep -rn "lucide--table-2\|lucide--database\|lucide--columns" apps/web/src` returns only
`entityIcon.ts` and the non-entity list · `grep -rn "concept-ic-" apps/web/src/styles/global.css`
shows the colour rules keyed on the concept class, not on an icon name · **and the measurement, which
nobody has taken:** one `getComputedStyle(el).color` on `/restore`'s table icons — muted before the
fix means the finding was wrong, green means it was right.
