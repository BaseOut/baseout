# D07 — Addressable state: one URL contract, one identity

**Rule:** Every thing has one address (`?id=`), every position is in the URL (`?tab=`, `?step=`,
filters), every instance page is titled by its identity, and every "go see it" link lands on the
thing — never on the list that contains it.

## Why this option

The app already has the reference implementations: `sectionTabs.ts` writes `?tab=` with
`history.replaceState` (documented in the catalog), and Reports addresses a run by id and rebuilds
the crumb chain from it (`pages/reports/run/[runId].astro:22`). The rejected alternative —
accepting per-surface URL dialects — is what produced three contracts for one run page
(`?id=` / `?state=` / both, J02-F6), a wizard that loses four steps on reload (J01-F8), a found
attachment that cannot be linked to a colleague (J06-F7), and the only unlinkable tabs in the app
(J07-F11).

## The concrete changes

1. **Runs are addressed by `?id=` only**; status is a property of the run, not the URL.
   `detailHref` (`BackupsListView.astro:66-75`) collapses to one branch. (J02-F6)
2. **Run pages are titled by identity**: "Backup run · Aug 6, 10:14 PM" in h1, crumb and tab
   title; id stays in the foot. Reports' pattern is the template. (J02-F8)
3. **The wizard writes `?step=`** (replaceState, as sectionTabs does) so reload and Back behave.
   (J01-F8) The wizard route also marks its sidebar item active. (J01-F25)
4. **Data tabs put query/facets/group in the URL**, and the located *item* is linkable
   (`?asset=` / `?comment=` opening the panel via the existing `data:open*` contracts). (J06-F7)
5. **Report tabs read/write `?tab=`**. (J07-F11)
6. **"Go see it" links carry the id**: first-run links → the run, not `/backups`; inbox "View log"
   → the run; Data-Changelog "Jump to this backup" → the run. (J01-F4 + instances)

## Surfaces changed

`BackupsListView` · `BackupRunDetailView` · `IntegrationsSetupWizard` · `DataMedia` ·
`DataComments` · `ReportDefinitionView` · `SpaceHomeView` links · `DataChangelog:217` · inbox
fixtures · harness: `backups/run.astro` must honour `?id=` (prerequisite).

## storybook.ts

`pattern-section-tabs`: extend the rule from tabs to all view state — "position, filters and the
selected item are in the query string; `replaceState` so Back leaves the section." Note the run
`?id=` contract on `pattern-audit-table`.

## Not changing

Back semantics on the run→base drill (already round-trips correctly) · Reports' breadcrumb model
(the reference).

## Verify

Reload any wizard step, filtered Data view, or report tab → same view. Share a failed run's URL →
the failed run opens. Every history/inbox link opens the specific run it names.


---

## AMENDMENT 2026-08-14 — how much of D07 has actually arrived (X12-F3, absorbing X01-F13)

The contract is written, argued and shipped — **twice**. `sectionTabs.ts` and `viewState.ts` together
are the best-argued pair of modules in the repo: `replaceState` not `pushState` with the "Back must
leave the section" reasoning written down (`sectionTabs.ts:16-18`, `viewState.ts:17-20`); a default
value **deleted** from the URL rather than written empty ("the address of an untouched page is the
bare page", `:19-20`); a param naming something this page does not have **skipped**, so a stale link
degrades to a working page rather than an empty one (`sectionTabs.ts:72-78`, `viewState.ts:103-105`);
selected-not-hidden in the facet encoding, because a recipient's data may differ (`:79-87`). **Every
clause is load-bearing. Do not "simplify" any of it.**

**The measurement: it is applied to 2 of 15 filterable surfaces.** `FacetFilter` is rendered by
`DataBrowse` · `DataChangelog` · `DataComments`✓ · `DataMedia`✓ · `SchemaBrowse` · `SchemaChangelog` ·
`SchemaAutomations` · `SchemaInterfaces` · `SchemaRelationships` · `SchemaCanvas` · `ReportBodyKpi` ·
`BackupsListView` · `ReportsView` · `RestoreHistoryView` · `inbox-client`. Only the two ✓ import
`wireViewState`. So a colleague can be sent `/schema?tab=health` but not "Health, filtered to the two
bases with issues".

**Absorbed here, one finding not two: X01-F13** — no list's *sort* or *page* is addressable either.
`wireTableSort` holds `col`/`dir` in a closure (`tableSort.ts:30-31`) and `page` is ephemeral by
written contract, across 13 paged and 14 sortable surfaces. It is consistent and deliberate, which is
why it is one decision and not thirteen rows.

**Ruling, split by cost.** **ADOPT** for Schema's nine tabs and the three Data tabs — the contract
already half-exists there and the sections are where multi-facet filtering actually happens.
**DEFER** the remaining surfaces; **trigger: the surface gains a second filter, or the first support
request that needs a shareable filtered list.** Sort and page join the deferred half: `pageSize`
persisting while `page` resets is a deliberate, correct asymmetry and stays.

**Correction to the worklist, verified in source:** *"Schema's nine tabs are not addressable by any
query param"* is **no longer true**. `SchemaView.astro:382-394` wires `wireSectionTabs` and all nine
`data-tab` keys resolve. What remains is the gate gap — eight of the nine are requested by no smoke
variant (X12-F4, D33).


---

## AMENDMENT 2026-08-14 — one new member, deferred: a console whose MODE is not in the URL

**X-M18 (S3, DEFER).** `listSheet.ts:49` — `const OVERLAY_BELOW = 964` — and `:149` measures the
**section column**, not the viewport. So a list console **silently changes from a column into a page
overlay** at a width that nothing records: `?tab=` is in the URL, the sheet's mode is not.

Two consequences, and the second is the reason this is filed at all:

1. **It is D07's subject.** A state that changes what the page *is* and cannot be linked to is
   precisely what this decision exists to fix. It folds into ship item 34 (`wireViewState` on Schema's
   nine tabs and the three Data tabs) at near-zero marginal cost.
2. **It invalidates a whole class of future measurement.** At viewport 1440 the section column is
   **1136** and **zero** elements in the document carry `is-list-overlay` — so the co-open state
   X06-F8 was filed against **is unreachable at 1440** and only appears near viewport 900 (column
   876). **A scout doing a 1440 pass will wrongly conclude the overlay does not exist.** Anyone
   reproducing ship item 29 must do it at a section column ≤ 964.

**Trigger: ship item 29, or any work on `wireViewState`.** Deferred rather than adopted because on its
own it is one query key on one console; inside item 34 it is free.
