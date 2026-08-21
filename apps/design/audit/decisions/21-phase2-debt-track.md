# D21 — Phase-2 debt track (the one DEFER for code-level debt)

**Rule:** Code-level debt that no user can see is one named track, deferred to Phase 2 as a whole —
never individual register rows — and each item on the track has the trigger that pulls it forward.

~~**This file is the DEFER record for `ds-audit`'s standing red**: exit 1, "ds-lint: 295
design-system issue(s), across 193 file(s)" (run 2026-08-07).~~ **CORRECTED 2026-08-14 — see the
amendment at the foot of this file. The 295 no longer exist.**

## The track

| item | source | trigger that pulls it forward |
|---|---|---|
| `rem`-fraction / 4px-grid codemod across the tree (the 295) | ds-audit; J04-F16 (`RestoreView` spacing); J08-F22 (`.add-*`/`.src-*`/`.dst-*`) | Phase 2 opens; or any listed file is edited for another reason — then that file conforms in the same PR |
| `.src-*` ≡ `.dst-*` duplicate CSS families (×4 files) | J08-F22 | the D12 unification collapses them — do not fix separately |
| Attachments table's 2px clearance + four hand-tuned caps | J06-F15 | any column/panel width change on that surface → re-derive with `minmax()` floors per D15; the 2px is recorded in the catalog entry so the next person measures first |
| Third status vocabulary in `lib/backups/format.ts` (+4 unrenderable statuses) | J02-F15 | wiring the real run-list endpoint, or the orphan-views pass |
| Eight orphan views with no importer (`IntegrationsView.*`, `DashboardView`, `ConnectAirtableModal`, …) | CLAUDE.md census; J01/J02 | delete-vs-revive pass at Phase 2 start — the 12 ds-audit findings inside the four dead views resolve with it |
| Dead v1 report code (`windowLabel` orphan aside — D13 wires it; `reportSchedules`, v1 types) | J07-F22 | v2 migration declared complete |
| `RunBackupNowModal` rendered with no opener on unconfigured Home | J01-F27 | any work on `SpaceHomeView`'s unconfigured branch |
| Breadcrumbs computed for 302'd paths, rendered nowhere | J01-F28 | the D20 route cleanup |
| Sidebar ordering pushes Sources/Destinations out of the scroll region at short viewports | J03-F17 | any sidebar or nav-ordering work |
| Cross-changelog shape checks (gate-blind divergences) | J05-F19 | the D10 consolidation makes a shared-shape check cheap |
| Visualize change/diff overlay (cheap interim: highlight a changelog row's entity on the canvas) | J05-F16 | first client request for snapshot comparison, or `SchemaCanvas` mode work |
| `icon-*` → `size-*` sweep (24 minority uses) | J08-F23 | the ProfileView port (D20) removes the largest cluster; sweep the rest in Phase 2 |

## Why this option

The audit's outcome is variance reduction; spending register rows on invisible debt buys no
variance reduction and buries the 35 S1s. Each item above is real, is written down once, and has a
concrete reopening condition — which is what DEFER means in this charter.

## Not changing

Nothing user-visible is on this track. If an item turns out to have user impact (as the "271px
overflow" once did), it leaves this file and gets a register row.

## Verify

Phase 2's opening checklist starts from this table; until then, `ds-audit` red at ~295 is the
known baseline and any *increase* on changed files is caught by `ds-lint` per normal task
discipline.


---

## AMENDMENT 2026-08-14 — **the baseline this file is built on no longer exists** (register row X-D)

This decision was written around "`ds-audit` exit 1, **295** design-system issues across **193**
files", and its first track item is the `rem`-fraction codemod that made up almost all of them.
**Commit `ed8b03b` retired that debt.**

Lead-run today, verbatim:

```
ds-lint: 6 design-system issue(s), across 208 file(s). Fix them or mark a line `ds-ok`. A UI task is NOT done until this is clean.
[ELIFECYCLE]  Command failed with exit code 1.
```

Bare re-run for the code: **exit 1**. **Six issues across 208 files, and none of the six is a `rem`
fraction.** One of them — `NotFoundView.astro:50 unsized control = md` — is already a product row
(S36-F6, under X-B/D17), so the residue is five.

**Why this matters enough to be a register row.** A deferral record whose premise is wrong by two
orders of magnitude will be cited as cover for work that is already done, and "the 295" appears in
audit prose in several places. **The `rem`-fraction line is struck from the track.** The rest of the
table stands.

**Members added to the track by the sixth wave, each with its trigger:**

| item | source | trigger |
|---|---|---|
| Six near-identical private `getValue` closures for `data-sort-<n>`, plus the same explanatory comment | X01-F16 | the seventh copy, **or** D40's sort work opening any of the six files — then `tableSort.ts` takes a default extractor and all six delete |
| `cursor: pointer` declared **154** times while `.row-clickable` supplies it once for the row family | X07-F13 | the next variance census, or D46 opening a listed file |
| **73** `class="iconify lucide--*"` spans with no size utility, inheriting 1em | X09-F5 | **any measured icon below 12px.** The mechanism is `global.css:1503` — the mask is 1em, so it needs a computed `font-size` per site, not a reading |

**Verify (replaces the old closing line):** Phase 2's opening checklist starts from this table. Until
then the known `ds-audit` baseline is **6 issues / 208 files, exit 1** — not 295 — and any *increase*
on changed files is caught by `ds-lint` per normal task discipline. **Re-read this number before
citing it; it moved once already.**


---

## AMENDMENT 2026-08-14 — the instrument defect, and two triggers rewritten

### New member: X-M19 (S3) — two NUL bytes that disable every census tool in the repo

`apps/web/src/components/data/DataBrowse.astro:936` writes its array-join separator as a **literal NUL
byte** instead of the escape `'\0'`:

```js
a.colOrder.join('<NUL>') === b.colOrder.join('<NUL>')
```

The idiom is sound — join on a separator that cannot occur in the data, then compare the strings. The
**encoding** is the defect: one character, and the file becomes *binary* to every tool that classifies
by content. `file(1)` calls it "Java source, Unicode text, UTF-8 text, with very long lines", which is
why it never looked suspicious. **It is the only NUL-bearing file in `apps/web/src`, `apps/design/src`,
`specs/` and `.claude/`: 1 file, 2 bytes, whole tree.**

**What it silently subtracted from this audit** (same tree, same second, lead-reproduced):

| pattern | shimmed `grep` (`ugrep -I`) | `/usr/bin/grep -a` | in this one file |
|---|---|---|---|
| `cursor: pointer` | 154 | **167** | **13** |
| `role="alert"` | 78 | **79** | 1 |
| `toLocale` | 46 | **47** | 1 |
| `badge-soft` | 175 | **176** | 1 |
| `<th`-declaring files | 24 | **25** | 1 |
| `.tbl-colhead` files | 18 | **19** | 1 |

154 + 13 = 167 exactly. **This is the `<th` 23→24→25 and `.tbl-colhead` 17→18→19 drift the sixth wave
reported and could not explain: one scout used a tool that reads the file and another used one that
does not.** It also hid an **8th `document`-level Escape listener** (`DataBrowse.astro:1313`), which no
pass in this audit could see and which the lead found today only by re-running with `-a`.

**The fix is two characters and runtime behaviour is byte-identical.** It is real `apps/web` code, so
it ships as a client PR — paired with ship item 8, because every census in every later item depends on
it. **STATUS: it has LANDED in the working tree**, applied by a concurrent implementer while this
amendment was being written; `HEAD` still carries both bytes. Lead-verified: working tree `NUL count:
0`, `HEAD` `NUL count: 2`, and the shimmed `grep` now reads the file. **All figures in this audit are
pinned to `HEAD` (`61d121e`); anything counted after that commit lands must be re-counted, because
the tool's population changed.** **`CLAUDE.md` already prescribes `-a` for `git grep`; it was right about the symptom and vague
about the cause, and the warning applies to the bare `grep` in this shell too.**

**The standing instruction this earns:** any count that will be quoted as evidence comes from
`/usr/bin/grep -a`, `command grep`, or a direct file read. A binary-skipped file costs a silent
undercount **with a green exit code**, which reads exactly like a complete answer.

### Trigger rewritten: X09-F5, the unsized-icon sweep

The old trigger — *"any measured icon below 12px"* — **fired, on a mechanism the finding was not
about.** Measured: 22 of 24 routes are ≥ 12px, and an "unsized" span is almost always sized by a
bespoke component rule to 12/13/14/16/20px, **not** inheriting a bare `1em` from `global.css:1503` as
this row claimed. The three real breaches are *explicitly* sized below the floor in `rem` literals and
are now D23's members (X-M15). **New trigger, which the measurement can falsify: an unsized `.iconify`
whose NEAREST `font-size` rule is absent.** Census corrected: **75 occurrences on 73 lines across 31
files** (`/usr/bin/grep -a`); the old 73 was `git grep -c`, i.e. lines. **15 of the 73 lines were never
measured** — runtime HTML strings inside states nobody opened.

### Count corrected: X07-F13, `cursor: pointer`

**167, not 154**, per the table above. The finding is unaffected; the number is not.

### Baseline restated

`ds-audit` is **6 issues / 208 files, exit 1** — and **all six are `unsized control = md`, so Oleh's
ruling 1 (one button height, D23) takes this track's headline number to 0.** The 295/193 figure this
file was originally written around has been dead since `ed8b03b`.
