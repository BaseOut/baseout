# D09 — One time system

**Rule:** One formatter module for the whole app; every timestamp carries a zone (printed once per
surface); every "last N days" control anchors on the **backup as-of** and prints its anchor; one
header word per column meaning; relative times carry an absolute `data-tip`; past-due schedules
have an overdue branch.

## Why this option

The journeys counted at least eight coexisting formats and three private formatter copies
(`SpaceHomeView:83`, `BackupsListView:30`, `BackupRunDetailView:90`), a column headed Date / When /
Time / Synced for one meaning, and — worst — the same "Last 7 days" control returning 0 rows on one
surface and 314 on its sibling at the same instant, because one reads the wall clock and one reads
the backup's as-of. The as-of anchor is chosen over the wall clock because the Data changelog
already wrote the reasoning down (`DataChangelog.astro:32-34`: "'last N days' is measured from the
data, not the live clock") and it is the honest choice for a backup product — but *either* choice
is only honest when the anchor is printed ("Last 7 days · to Jul 14").

## The concrete changes

1. One module (extend `lib/backups/format.ts` or a new `lib/time.ts`): day rule, row time,
   relative, absolute-with-zone, duration. Private copies deleted. (J02-F19, J05-F11, J06's two
   `fmtShort`s)
2. Zone: engine emits offsets; each surface prints "times in your local zone (GMT+3)" once.
   Production emission unverified — flag to the Baseout engineer. (J05-F12, J07-F8 + the schedule
   time input gains a zone label)
3. `now` anchor = backup as-of on Schema, Data, Attachments, Comments; anchor printed in the
   control. Attachments' `DateRangePicker` (with "Captured in last run") is the better control and
   both Data tabs use it. (J05-F4, J06-F6)
4. As-of stamps name their run: "As of run_… · Jul 14, 9:12 AM (GMT+3)" — same words on Schema and
   Data; when the halves differ, the later one says so. (J05-F2)
5. One header word for the run-time column across Backups/Home/Schema/Data (pick **When**; the
   absolute value in the tip). (J02-F19, J05-F10 part)
6. Panel change rows carry the time (orders same-day changes). (J05-F11)
7. `formatNextScheduledAt` gains the overdue branch (feeds D01). (J02-F10)
8. "Captured" qualifies itself: "In backup" / "Captured by Baseout", one panel line noting Airtable
   records no attachment date. (J06-F14)
9. Wizard uses the shared next-run formatter — "in 18d" and "Aug 7, 4:24 AM" stop coexisting.
   (J01-F21)

## Surfaces changed

`lib/backups/format.ts` (+ new module) · both changelogs · `DataMedia` · `DataComments` ·
`SpaceHomeView` · `BackupsListView` · `BackupRunDetailView` · `ReportDefinitionView` ·
`IntegrationsSetupWizard`.

## storybook.ts

New `pattern-time` entry (or a "Time" section under guides): the formatter table, the as-of-anchor
rule, the zone-once rule, the one-header-word rule. Cross-reference from both changelog entries.

## Not changing

`expandedTimestamp`'s existing behaviour where already correct · the honest "status reflects the
last successful check, not live" caveat.

## Verify

Grep: zero `toLocaleDateString`/`toLocaleTimeString` outside the module. At one instant, "Last 7
days" returns consistent sets on Schema/Data/Attachments/Comments and each control names its
anchor. Every surface shows its zone exactly once.


---

## AMENDMENT 2026-08-14 — three relative-time implementations, two of which disagree (X13-F3, X13-F5)

**The disagreement is provable without a browser.** An event **90 minutes** old prints **`2h ago`**
via `lib/time.ts:142 fmtRelative` (`Math.round(1.5)`) and **`1h`** via
`components/layout/inbox.ts:222 ago()` (`Math.floor(1.5)`) — lead-verified in both files. `inbox.ts`
also **drops the word "ago" entirely** and switches to `fmtDayShort` after 7 days, so `3d` in the
Inbox and `3d ago` on Home are the same fact in two grammars. **Home and the Inbox are read together,
and the Inbox is the surface that tells you a backup broke.**

The third is `ReportsView.astro:33-40` — a **character-for-character duplicate** of the reference, in
a reference surface.

`inbox.ts:232-235` carries a *correct* D09 note about locale pinning (*"`14 Jul` in review and
`Jul 14` for the US customer"*). **The module knows this exact class of bug exists and forked the
arithmetic anyway** — which is the argument for a rule rather than a comment.

**Changes:** `inbox.ts` and `ReportsView` call `fmtRelative`; if the Inbox genuinely needs the compact
form, it arrives as `fmtRelative(v, { compact: true })` in `time.ts`, not as a second function.

**Also under this decision, X13-F5 (S3):** **15 files call `toLocale*` directly** rather than
`lib/time.ts`, bypassing the pinned `LOCALE` — `DataChangelog` ×5 · `DataMedia` ×5 · `recordReadBody`
×5 · `ExportControl` ×4 · `tablePager` ×3 · `runReadBody` ×2 · `SchemaBrowse` ×2 · `SchemaDocs` ×2 ·
`DataComments` ×2 · `DataBrowse` · `MediaPanel` · `RecordPanel` · `StaticImport` · `schemaReadBody` ·
`pickerSearch`. **Which of the 15 omit the locale argument is `NEEDS-MEASUREMENT` and nobody has
measured it** — read each call site, or diff a render under `LANG=en-GB`. **Measure before sizing the
sweep:** if most already pass a locale, this is four files, not fifteen.

**Verify:** `grep -rn 'Math.floor' apps/web/src/components/layout/inbox.ts` → 0 in `ago()` ·
`grep -rn 'toLocale' apps/web/src | grep -v 'lib/time.ts'` → 0 · an event 90 minutes old reads
identically on Home and in the Inbox.


---

## AMENDMENT 2026-08-14 — the `toLocale*` half is a NUMBER defect, not a DATE defect

**X13-F5's mechanism was wrong and the correction makes the item cheaper, sharper and smaller.**
Measured from source with `/usr/bin/grep -a` plus a direct-read pass:

| figure | recorded | measured |
|---|---|---|
| `toLocale*` occurrences, tree-wide | "15 calls" | **57** |
| …inside `lib/time.ts` | — | **11** (10 calls + 1 prose mention) |
| …outside it | — | **46** = **45 real calls** + 1 prose mention |
| **files** outside `lib/time.ts` | 15 | **15 — the register was right; `SHIP-ORDER.md` compressed "15 files" into "15 calls" and the measurement request inherited that** |
| `Intl.*` constructors | not counted | **14** |
| `Intl.*` that omit the locale | not counted | **0** |

**Not one of the 45 calls formats a date.** Every one is `Number.prototype.toLocaleString()` on a count
— `.length`, `total`, `recordCount`, `run.counts[t]`, `rest`, `drawn` — and **zero take an argument**
(`/usr/bin/grep -roa --exclude=time.ts 'toLocale[A-Za-z]*'` returns `toLocaleString` only, 46 times).
**So the `14 Jul` / `Jul 14` reordering this decision cites from `inbox.ts:232` CANNOT happen from any
of them.** `toLocaleDateString` / `toLocaleTimeString` outside `lib/time.ts` = **0**, exactly as D09's
verification clause claims — **that claim still holds a week later.**

**What can happen is a thousands separator that changes by machine** — `1,240,000` on an `en-US` host,
`1.240.000` on a German one — **and the real defect is that the app already pins that separator in 13
places and leaves it floating in 45. One screen shows both:** `/backups` renders every row count
through `new Intl.NumberFormat('en-US')` (`BackupsListView.astro:28,62`) and the pager **40px below**
renders its total bare (`tablePager.ts:54,132`). Same pairing on `/backups/run/*`, `/reports/*` and
`/restore`.

**Severity: S3, and the S2 reading was considered and declined.** The S2 argument is right about the
*mechanism* (two number grammars on one screen is "one job, two ways"); the S3 reading is right about
the *observed* impact — `lib/time.ts:32-33` records Oleh's ruling that the customers are in the United
States, and on an `en-US` host all 45 render identically to the 13 and nothing is untrue. The exposed
populations are a non-US customer, a US customer with a non-US OS region, and **Oleh reviewing from
Ukraine — historically the reader who has caught this class of bug in this repo, and the reason
`time.ts` pins its own locale rather than trusting the audience.**

**Scope: closer to four files than fifteen.** There is **no shared number formatter in `lib/` to route
through** — the only exported one is `lib/reports/view.ts:9`, inside the reports domain, which is the
exact boundary problem `lib/time.ts:10-16` wrote down for dates. So:

1. add **`fmtCount`** as a sibling of `time.ts` — a module-level `Intl.NumberFormat('en-US')` **with
   the same kind of header comment stating why the locale is pinned**; `lib/time.ts` is the model and
   it already won this argument;
2. sweep the **five shared files** first — `tablePager.ts` (4 calls, **15 importers**; this alone
   corrects the pager total on every paged table in the app), `recordReadBody.ts`, `runReadBody.ts`,
   `schemaReadBody.ts`, `pickerSearch.ts`, `ExportControl.astro`;
3. then the ten leaf files;
4. then **delete the 13 duplicate `Intl.NumberFormat('en-US')` instances** — they are 13 copies of one
   decision with the **right value**. **Do not "fix" the value; delete the duplication.**

One PR, mechanical, no visual change on an `en-US` host.
