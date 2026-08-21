# D19 — One status and verb vocabulary (**COMPLETE**, 2026-08-14)

**Rule:** A state has exactly one word, used in the badge, the facet and the copy; a verb is a
button, never a badge; semantic colours are reserved (error red = failed/broken only); one act has
one verb; and an exception-only status column is a *declared* pattern, not an accident.

## Why this option

The journeys found the vocabulary splitting at every seam: `Reconnect` is a status badge on one
screen and a button on the next; one comment state has three names ("In the last capture" /
"Active" / nothing); "Required" wears failure-red in two files; one connect act carries three verbs
in one drawer family. Each instance is small; together they are exactly the "learn this surface
separately" tax the charter names. The rejected alternative — X08 later, nothing now — would leave
settled instances open; X08 will finish the census and the master state-word table.

## The concrete changes

1. **States are nouns/adjectives, verbs are buttons**: `/sources`' badge says `Reconnect required`
   (matching the detail page); the row gains a real `Reconnect` action. (J03-F8)
2. **Comment status vocabulary** — the founder's words everywhere: **Active / Deleted / Record
   deleted**. Facet options renamed; row badges keep their icons + tooltips. (J06-F10b)
3. **Exception-only status column — ACCEPTED and declared** (lead ruling): blank = Active is
   deliberate and argued in-file (18 identical badges otherwise); the catalog records the pattern
   and its conditions (exception-only, icon + `role="img"` + aria-label + tooltip, header must not
   promise a usually-empty column — use the tooltip'd icon header). (J06-F10a)
4. **Colour reservations**: "Required" is neutral (or warning at most) — error red stays failure:
   `IntegrationsSetupWizard.astro:236,399` + `DestinationAddView.astro:54` (merged J01-F14/J08-F18).
   The renamed/updated badge-colour split between the changelogs resolves with D10.
5. **One act, one verb**: the connect drawer family picks its verbs once ("Connect …" to start,
   "Save …" to commit; "Test & create" only where a test runs). (J01-F13, J08's `Test & create`)
6. **Status ≠ time**: `Last backup` holds a time or `—`; the failed state lives in Status.
   (J03-F13)
7. **Absences are worded and demoted**, never dressed as values: "Author not captured" in the
   muted-italic register (D11); "the terms and privacy policy" becomes a real link (J01-F17); the
   wizard review names the bases, not just a count (J01-F20).

## Surfaces changed

`SourcesView` · `SourceDetailView` · `DataComments` · `IntegrationsSetupWizard` ·
`DestinationAddView` · `WelcomeView`.

## storybook.ts

`badge`: add the colour-reservation table and the declared exception-only-column pattern with its
conditions (this is the ACCEPT record for J06-F10a). X08 adds the app-wide state-word table when
its census completes.

## Not changing

The soft+semantic badge rule itself · the refusal to invent identities or actors (twice praised;
this decision must not become a licence to synthesise names).

## Verify

Grep for `badge.*Reconnect[^ ]` finds only `Reconnect required`; the Comments facet reads Active;
no `badge-error` string means anything but failure; the catalog carries the exception-only entry.


---

## AMENDMENT 2026-08-14 — **D19 remains INTERIM. The block is now exact.**

X08's census ran. It did not unblock this decision; it made the blocker precise. The deliverable —
the app-wide state-word table — cannot be written until three rulings exist.

**What the census found.** 28 status registries live in `apps/web/src`. Across them the app uses
**12 distinct words for "it succeeded"** (`Succeeded` · `Backed up` · `Done` · `Resolved` · `Healthy`
· `OK` · `No issues` · `Green` · `Valid` · `Trial run` · `Trial complete` · `succeeded (trial)`),
**10 for "it failed"** (`Failed` · `Failure` · `Failed to generate` · `Auth failed` · `Broken` ·
`Disconnected` · `Lost access` · `Red` · `Needs attention` · `Invalid`) and **7 for
in-progress/queued**. Five words also change *colour* between surfaces — `Running`, `Paused`,
`Removed`/`Deleted`, `Updated`, `Cancelled`.

**The three rulings.**

| # | ruling | who | status |
|---|---|---|---|
| 1 | Is `Badge.astro` the component every status passes through, or is the raw class string RATIFIED and `Badge` demoted from "reference"? | **Oleh** | **BOUND, 2026-08-14** — `Badge.astro` is the only path. Body written as **D44**; the lead binds the sub-clause (it takes a registry entry; the two zero-caller variants are deleted). |
| 2 | Is `Running` **primary** (the catalog, **0** adopters) or **warning** (8 live sites)? | **Oleh only** | **OPEN.** `decision-density-sm-is-default`'s precedent says the shipped surfaces win and the catalog changes. The cost: amber already carries paused, degraded, stale, removed and tier-gate, so making `Running` amber leaves the app with **no in-progress colour distinct from degraded** — amber comes to mean "not green", which is not a meaning. The alternative costs 8 sites and contradicts nothing measured. **This is taste with a real trade in it and the lead will not bind it.** |
| 3 | Do the badge entry's ~10 prose rules become regex checks in `.claude/hooks/ds-checks.mjs`? | **Oleh only** — it is his gate, and switching the banned-pair check on turns `ds-lint` red in three files nobody is touching | **OPEN.** Lead recommendation: **yes**, for the two mechanically-detectable rules. X08-F6 is a stated ban live in three files with every gate green; prose in the catalog is not enforcement. |

**Consequence, stated plainly:** the state-word table's **word** column is writable today; its
**colour** column waits on ruling 2. D19 does not close until it does.

**What was carved OUT of D19 so it could ship without them.** Two things that were tangled into this
decision are now separate and are **not blocked**:

- **The fallback contract → D43.** A registry that meets a state it does not know renders `Unknown`
  in neutral; it never guesses, never throws, never blanks. That contract is orthogonal to which word
  a *known* state gets, and holding an **S1** (three logs labelling an unknown status `Cancelled`)
  behind a colour ruling would have been the wrong trade.
- **The vessel → D44.**

**One member added here:** **X01-F14 (S3)** — two labels for one control, `Clear filters` (10 sites)
vs `Clear` (3, `BaseSelectionTable.astro:457`). D19 item 5 ("one act, one verb") already governs it;
this is its instance list, and it ships with the copy sweep, not with the colour ruling.


---

## AMENDMENT 2026-08-14 — **D19 IS COMPLETE. The colour column is written.**

All three blocking rulings exist. Ruling 1 (`Badge.astro` is the only path) was bound on 2026-08-14
and lives as **D44**. Ruling 3 (regex checks in `.claude/hooks/ds-checks.mjs`) is **ENABLE**, filed as
register row **X-M20**. Ruling 2 — the one that held this decision interim — is answered:

### `Running` is **PRIMARY (blue)**. Oleh, 2026-08-14.

**The catalog's reading wins over the shipped one, and the precedent is deliberately not followed.**
`decision-density-sm-is-default` says shipped surfaces win and the catalog changes; **that precedent
is set aside here because its cost is a colour losing its meaning.** Amber already carries paused,
degraded, stale, removed and tier-gate, so an amber `Running` makes amber mean "not green", which is
not a meaning. **In-progress gets its own colour.**

**Eight live sites change, and the eighth is not the word `Running` — lead-verified today:**

| site | current | note |
|---|---|---|
| `BackupsListView.astro:45` | `running: { label: 'Running', badge: 'badge-soft badge-warning' }` | list registry |
| `BackupRunDetailView.astro:183` | same | run registry |
| `BackupRunDetailView.astro:199` | same | base-level registry in the same file |
| `BackupRunBaseView.astro:103` | same | |
| `BackupRunBaseView.astro:111` | same | second registry in the same file |
| `RestoreHistoryView.astro:60` | same | |
| `RestoreView.astro:534` | inline `badge badge-soft badge-warning` + spinner | not a registry — a hand-written badge |
| **`ReportDefinitionView.astro:235`** | inline `badge-soft badge-warning`, label **`Generating`** | **the in-progress word on Reports is a different word in the same amber; the ruling covers the STATE, not the string** |

### The state-word table — both columns now writable

The word column was always writable; this is the colour column that was not. It belongs in
`storybook.ts` on the `badge` entry, as the registry `Badge.astro` reads (D44).

| state | one word | colour | note |
|---|---|---|---|
| succeeded | **Succeeded** | success | replaces 12 words (`Backed up` · `Done` · `Resolved` · `Healthy` · `OK` · `No issues` · `Green` · `Valid` · `Trial run` · `Trial complete` · `succeeded (trial)`) |
| failed | **Failed** | error | replaces 10 (`Failure` · `Failed to generate` · `Auth failed` · `Broken` · `Disconnected` · `Lost access` · `Red` · `Needs attention` · `Invalid`) |
| **in progress** | **Running** | **primary** | **the ruling.** `Generating` folds into it |
| queued | **Queued** | neutral (`badge-ghost`) | not started is not in progress |
| paused | **Paused** | warning | |
| degraded / stale / at-risk | keep the distinct words | warning | amber's remaining job, and the reason `Running` could not have it |
| cancelled | **Cancelled** | neutral | **only when a person actually cancelled** — D43 governs the fallback, and the S1 it fixes is exactly this word being guessed |
| removed / deleted | **Removed** | neutral | |
| unknown | **Unknown** | neutral | D43. Never guessed, never thrown, never blank |
| tier-gated | not a state | — | D14. It is a capability, and it must leave the status slot (X08-F9) |

**Ships with:** ship-order **item 15** (`Badge.astro`), because the colour lives in the registry the
component reads, not in eight view files. **Do not do the eight amber edits by hand ahead of it** —
that is the same edit twice, and the second one deletes the first.

**One member added by the consolidation pass:** nothing. D19 gains no new rows; it loses its blocker.

---

## `info` IS RETIRED — ruled 2026-08-14, and it follows from the `Running` ruling

Two batches met the same blocker from opposite ends on the same day: one **removed** `badge-info`
from `lib/backups/format.ts` as *"a seventh semantic colour used at one site"*, and another **asked
for it back** as a `Badge.astro` variant to unblock five sites. Both cannot be right.

**Ruling: no `info` variant. The five sites take `badge-ghost`.**

1. **`info` is blue, and blue is now `Running`.** Oleh's ruling of 2026-08-14 gave `Running` primary
   precisely so in-progress would have a colour of its own. A second blue meaning "an informational
   aside" re-creates the failure that ruling avoided — the one where amber came to mean "not green",
   which is not a meaning.
2. **The palette already has an owner for every meaning here.** Amber carries paused · degraded ·
   stale · removed · tier-gate. Ghost carries neutral and unknown. Blue carries in-progress.
3. **Read what these five badges actually say** — *"Not seen in the latest capture — it may still
   exist"*, *"We hold this view, but not which table it belongs to"*, `Config changed`, a pending
   invite. Every one is a statement about **what we do not know**, not about **what is wrong**.
   That is D43's territory verbatim: a registry that meets a state it does not understand says so
   **neutrally rather than guessing a severity**. Amber would assert a problem that may not exist —
   the same class of untruth as labelling an unknown status `Cancelled`.

Applied at `SchemaBrowse.astro:349,392,430` · `changelogTypes.ts` · `schemaReadBody.ts:735` ·
`AuthAssociationView.astro:68`. **`Badge.astro` deliberately gains no `info` variant**, so the
option cannot be taken again without re-opening this.
