# D17 — One empty-state model  ·  **COMPLETE 2026-08-14**

**Rule:** When a *section* has no data, the page degrades wholesale with one sentence of mechanism
and one real exit (Data's model: "Data appears after your first backup … Go to Backups"); when the
*page* has a snapshot but a *tab* has nothing, a tab-level card explains the mechanism; an empty
state never adds a second primary, and never at `btn-lg`.

## Why this option

Data's page-level degrade is the best empty state in the product and is what `specs/10-schema.md:
110-111` asks Schema to do; Schema instead keeps its chrome, offers no exit, and stamps an as-of
for a Space with no backups (D01). Meanwhile two surfaces double their primary in the empty state
(Backups at `btn-lg` 48px, the registries with two identical `Add source` buttons) and Reports'
empty states contradict themselves. The rejected alternative — a bespoke empty per surface — is
what produced all of this. The two conditions (empty section vs empty tab) are genuinely different
and both branches are kept.

## The concrete changes

1. Schema adopts the page-level degrade for the no-backup condition, with `Go to Backups`;
   tab-level cards remain for "snapshot exists, tab empty". (J05-F14, with D01's no-stamp rule)
2. Reports: the header `+ New report` is suppressed/disabled in the no-backups state (one primary:
   `Go to Backups`, at `btn-sm`); the `noreports` state is deleted or re-justified against the
   "default report always present" model rule. (J07-F14, F16)
3. Registries: one `Add source` primary — the header CTA hides when the empty card carries it (or
   vice versa). (J08-F17)
4. Backups empty: the duplicate `btn-lg` CTA drops (D16 batch 6). (J02-F12)

## Surfaces changed

`SchemaView` + tab components · `ReportsView` · `SourcesView` · `DestinationsView` ·
`BackupsListView`.

## storybook.ts

New `pattern-empty-state` entry (X05/X04 listed it as a known gap): the two conditions, the
anatomy (icon · title · one mechanism sentence · one exit), the one-primary rule, the no-`btn-lg`
rule. X04 completes the census across all 40 surfaces.

## Not changing

Data's degrade (the reference) · the tab-level empty copy on both changelogs and both Data tabs
("Changes appear once there are two backups to compare" — mechanism, not apology) · the
`md-nomatch` filter-specific explanations.

## Verify

`?fixture=empty` on Schema, Reports, Sources, Destinations, Backups: exactly one primary each, no
`btn-lg`, every section-empty state carries an exit, no stamp asserted anywhere.

---

## AMENDMENT 2026-08-14 — the vessel is **BOUND**, and three new members

Oleh's ruling of 2026-08-14: **`EmptyState.astro` is approved as the one vessel** for this decision
(with an alert vessel and `Badge.astro` for status badges; `Table.astro` is deferred — see D15).
D17 stops being interim on the vessel question; X04 still owes the 40-surface census.

Three members added from the S24–S40 wave, all of them the same defect in three registers:

- **S32-F1 (S1)** — Settings ▸ Space renders a **whole invented Space** for a user who has none:
  an empty name field, confident schedule/destination/retention defaults, a red **Delete Space**
  card, and an `Enrolled workspaces` list naming *Growth · 24 bases · checked 2h ago*, *Operations ·
  14*, *People & Finance · 9 · Auto-enrolled* with live toggles and Un-enroll buttons — under
  **both** `?fixture=trial` and `?fixture=empty`. Verified: `settingsCatalog.ts:513` is a module
  constant `ENROLLED_WORKSPACES`, rendered unconditionally at `SettingsView.astro:216` behind a
  guard on `current.id === 'space'` only. A category whose subject does not exist renders
  `EmptyState`; the workspace list derives from the connection store, never from a constant. This
  **corrects J08-F15** — see the register.
- **S28-F10 (S2)** — the standalone base picker has no zero-base state and its one empty sentence
  states the wrong fact (*"No bases match your filters"* over an account with no bases). The
  **wizard's** branch of the same step gets it right (*"The selected source didn't reveal any bases.
  Pick another source."*), so the model is hoisted into `BaseSelectionTable` and both hosts inherit
  it.
- **S32-F14 (S3)** — `This page is ready for content.` on `/help` and `/settings/billing`, both
  reachable from first-class sidebar nav. If a route must ship unbuilt it says what will live there
  and where to go meanwhile — which is `EmptyState`, not a `PlaceholderView`.

`.reg-empty`'s glyph is 22×22 under a comment claiming it is the optical match for the twin's 28px
`airtable.svg`; that is a two-character fix or a corrected comment, and it lands with the vessel.


---

## AMENDMENT 2026-08-14 (second) — **X04 has landed. D17 is COMPLETE and no longer interim.**

The census D17 was waiting on is done. Three things change here and the decision closes.

### 1 · The mechanism, which D17 never named and which is why it could not spread

**An Astro scoped style cannot cross a file boundary.** `.sch-empty`'s five rules are declared
**byte-identically in two view files** — lead-verified character for character,
`DataView.astro:330-334` ≡ `SchemaView.astro:353-357` — because a third adopter would need a third
copy. That mechanism, not carelessness, produced **28 empty-state families across 30 files**. It also
predicts the failure of the obvious alternative: `global.css` already carries two shared attempts
(`.cl-empty`, `.pk-empty`) and neither was adopted beyond its author.

**Therefore the deliverable is `components/ui/EmptyState.astro`** — approved by Oleh, 2026-08-14 —
whose scoped style travels with it. A sweep that re-types a corrected value into 26 view files is
explicitly rejected: it is the same work as last time, with the same outcome.

### 2 · The sentence cap is **BOUND to 46ch**

Seven values exist in the tree. Re-censused by the lead across every `max-width: *ch` declaration in
`apps/web/src`:

| cap | files | note |
|---|---|---|
| 42ch | `BackupsListView.astro:430` | 1 |
| 44ch | `DataView.astro:334`, `SchemaView.astro:357` | 2 — **and they are one copied block**, so this is one decision, not two |
| **46ch** | `SchemaRelationships.astro:559` · `SchemaDocs.astro:359` · `ReportDefinitionView.astro:1070` · `ReportsView.astro:504` · `RestoreView.astro:791` · `RestoreHistoryView.astro:383` | **6 — the plurality, six independent authors** |
| 48ch | `global.css:2929` (`.cl-empty-sub`), `DataChangelog.astro:513` | 2 |
| 52ch | `SchemaChat.astro:453`, `DataMedia.astro:787` | 2 |
| 56ch | `DataMedia.astro:780` | 1 |
| none | `SourcesView`/`DestinationsView` `.reg-empty` | 2 |

**Both current authorities are minority readings.** The catalog's "~44ch" has two files that are one
copy; S06-F10's 48ch has two. **46ch has six.** `EmptyState.astro` sets 46ch; the `pattern-empty-state`
entry's "~44ch" is amended to 46ch; **S06-F10's 48ch ruling for the Data section is superseded** and
that supersession must be written into the register row rather than left implicit.

*The painted line length is `NEEDS-MEASUREMENT` and was not measured by anyone.* What is proven is
the number of declared values, which is the finding: seven spellings of one measure.

### 3 · Four conditions, not two

D17 shipped with two (section degrade · tab card). The census found four. The component carries all
of them:

1. **Section degrade** — the page has no data at all. Reference copy: `DataView.astro:249-252`.
2. **Tab card** — the page has a snapshot, this tab has nothing.
3. **Unresolved id** — the route is fine, the object is not (X-B; `NotFoundView` carries both jobs).
4. **Capability gate** — *you do not have this*. **This is new (X04-F5).** Five vessels exist with no
   catalog entry governing their shape at all: `.au-gate` (a 999px circle tile), `.if-gate`,
   `.chat-gate` (3.2rem / 52ch), `.sec-gate`, `LockedTab.astro`. **D28 governs whether a gate tells
   the truth; nothing governed what it looks like.** Condition 4 is added to the entry.

### 4 · The anatomy is already agreed and only needs extracting

The **title** — `font-size: var(--t-16); font-weight: 650` — is reproduced **byte-identically in 13
independent declarations**. The anatomy converged by hand; only the vessel did not. The **tile** did
not converge and disagrees with both the catalog example and D23's card token in **14 of 15**
declarations: radius `.8rem` (12.8px) ×10 against the 12px token, `999px` ×2, `7px` ×1; fill
`base-100`+border ×7 against the reference's borderless `base-200` ×5; sizes `3rem` / `3.2rem` /
`2.75rem` / `48px`. The component sets **48px / 12px / `base-200` / no border**, and all fifteen
declarations delete.

### 5 · One further member

**X04-F4 (S2)** — `.reg-empty-ic` is **one class name with two contradicting declarations**, in the
two files D17 already named as one fix: `SourcesView.astro:210` sets `border-radius: 7px; opacity:
.8`; `DestinationsView.astro:200` sets `font-size: 1.4rem; color: …/.35` and carries a `ds-ok`.
Neither draws the 48px tile the anatomy requires and neither sets a cap. A reader who learns the
Sources empty state does not recognise its twin — which is D12's whole thesis, broken by two lines.

### storybook.ts, final list

`pattern-empty-state`: `reference: components/ui/EmptyState.astro` · **46ch** replacing "~44ch" ·
condition **4** (capability gate) added to the condition list · the tile spec (48/12/`base-200`/no
border) · the title spec (`--t-16` / 650) · and the existing title-copy ban kept and enforced —
`No documents yet`, `No backups yet`, `No Airtable source yet` all name the *absence* where the
reference names what will appear and when.

### Not changing, restated because the vessel work will be tempted

The mechanism sentences (`DataView.astro:252`, `SchemaView.astro:176`, `BackupsListView.astro:290`
and the Data-tab bodies) are **the best copy in the product** and the component must carry them
verbatim. The three comments recording the `btn-lg` removals stay. **Extract these; do not restyle
them.**

### Verify

`ls apps/web/src/components/ui/EmptyState.astro` · `grep -rn 'max-width: *[0-9]*ch' apps/web/src`
returns 46ch for every empty-state sentence · `grep -rn '\-empty' apps/web/src/**/*.astro` collapses
from 28 families toward the component · `grep -rn 'btn-lg' apps/web/src` stays at 0 call sites ·
`?fixture=empty` on Schema, Reports, Sources, Destinations, Backups. **Blocked measurement, recorded:
three of the 28 families have never been seen empty by anyone** — `/restore` ignores `?fixture=`,
`bases.astro` has no `empty` branch, `/settings` declares no fixture variant. That is a harness gap
(D33) and it must be closed before this decision can be verified at all.


---

## AMENDMENT 2026-08-14 — **46ch is bound, and it changes NO rendering. Record that, so nobody looks twice.**

The cap was measured, not argued. Five `?fixture=empty` routes rendered in same-origin iframes at
exactly 1440 and exactly 390 (`emulate`, not `resize_page`), line counts read via
`Range.getClientRects()` distinct `top` values — not estimated:

- **At 390 the cap never binds, 5 of 5.** Painted 300–316px against declared caps of 326–357px: the
  **centred shrink-to-fit container binds first, every time.** All seven values render identically.
- **At 1440 the cap binds exactly (painted == declared) in 5 of 5 — and no adjacent pair in the
  ladder changes anything. 42ch and 46ch produce identical line counts in 5 of 5 sentences.** Only the
  46-vs-56 gap moves a line, and only on 2 of 5.
- `1ch` measures **8.3701px** at `--t-14` = 14px (≥1280) and **7.7722px** at 13px (<1280), so every
  `ch` cap silently shrinks 7.1% below 1280 **on top of** never binding there.

**So: 46ch stands as bound, purely as variance reduction, with ZERO rendering payoff.** Seven numbers
for one job is exactly what this audit exists to remove — but **X04-F2 is re-severitied S3 → S4, it
must ship as a tidy inside the vessel, and it must never be bundled with work that claims a visual
difference, because there is none to find at any width.** This paragraph exists so the next reader does
not go looking for the improvement, fail to see one, and "fix" the cap a second time.

**The genuinely user-visible half is the one nobody filed:** at 390 these sentences are governed by a
container that nothing declares. If the vessel wants a narrow answer, that is where it is — not in the
`ch` value.

**Census scope, clarified.** This file's cap table counts the **empty-state population**. A tree-wide
`/usr/bin/grep -a` for `max-width: *ch` finds 46ch in **7** files — the seventh,
`DestinationAddView.astro`, is a form hint and not an empty state — and 56ch in 5. **The plurality
reading is unaffected; the numbers differ only because the populations differ.**

**Also good news, measured:** all five sentences render 2–3 lines at every cap. **Nobody has written
an empty state that wraps to five lines** — the copy is already the right length. Only the declared cap
was inconsistent.

**D17 is COMPLETE.** Its verification remains blocked on ship item 8 (three of the 28 families have
never been seen empty by anyone), which is a harness gap and not a decision gap.

---

## CORRECTION 2026-08-14 — the 46ch cap is invisible for EMPTY STATES, not for GATES

This decision records that binding the sentence cap to **46ch changes no rendering** — measured, at
390 the cap never binds (the centred container binds first, 5 of 5) and at 1440 42ch and 46ch give
identical line counts (5 of 5). That census covered the **empty-state** sentences.

**It does not hold for condition 4, the capability gate.** Measured while building the vessel: the
gate sentence is longer, and at 1440 it renders **52ch → 3 lines** against **46ch → 4 lines**. At 390
the cap still never binds (declared 357.5px, painted 316px, 4 lines either way), which confirms the
container-binds-first half.

So the "no rendering payoff" note is **scoped to empty-state sentences** and must not be read as
covering the whole decision: **migrating a gate onto the vessel is a visible one-line change.** The
catalog entry now says so at the point of use.
