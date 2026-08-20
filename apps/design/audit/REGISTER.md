# Audit register — INTERIM, covers J01–J08 and S06–S18

Compiled 2026-08-07 by audit-lead. The 40 S items and 16 X lenses have not run; rows and decisions
below will be extended, and four decisions (D15, D16, D17, D19) are **interim** — they resolve
journey evidence now and will be completed by X01/X04/X08/X13 evidence later.

**Extended 2026-08-12 by audit-lead:** the four Data-section composition items (S06 Records · S07
Comments · S08 Attachments · S09 Changelog) are adjudicated below — 30 new rows from 35 scout/lead
items after merges, two new decisions (D22, D23). S01–S05 findings files exist but are **not yet
registered**; the S-pass remains paused. See "S06–S09 adjudication" below for verification,
rulings, merges and status updates to J-pass rows.

**Extended 2026-08-12 (second wave) by audit-lead:** the four Schema-section composition items
(S10 Browse · S11 Visualize · S12 Relationships · S13 Changelog) are adjudicated below — **52 new
rows** from 51 scout findings (source-only) + 1 lead-filed cross-tab row (M1), 0 rejected, four
new decisions (**D24–D27**), seven extended. Full adjudication, verification log and the
under-audited list: `audit/waves/2026-08-12-s10-s13.md`.

**Extended 2026-08-12 (third wave) by audit-lead:** the five remaining Schema composition items
(S14 Health · S15 Docs · S16 Chat/Ask · S17 Automations · S18 Interfaces) are adjudicated below —
**55 new rows** from 62 scout findings (source-only; 5 twin-pairs merged, 2 instance-recorded on
existing rows, 0 rejected), four new decisions (**D28–D31**), thirteen extended. **The Schema
section is now fully audited (all nine tabs).** Full adjudication, verification log, ship-first
order and the under-audited list (headed by U1 — every panel-open scenario, unmeasured):
`audit/waves/2026-08-12-s14-s18.md`.

**CLOSED 2026-08-14 (SEVENTH pass — final consolidation) by `audit-lead`:** the nine
`NEEDS-MEASUREMENT` claims are measured, Oleh's ten rulings are applied, and the four late findings
files are absorbed — **13 new rows** (501 → **514**), **two severity moves on measured evidence**
(X04-F2 S3 → **S4**, X06-F8 S3 → **S2**), **one new S1** (`.ph-panels` has no width, so §8's
already-applied panel-width ruling is conditionally dead), and **nine in-place corrections** where a
measurement contradicted a row's stated mechanism without touching its verdict. **D17 and D19 are
COMPLETE; D15 stays DEFERRED behind a hard gate in `SHIP-ORDER.md`.** Every count carried forward
that could touch `DataBrowse.astro` was re-taken with `/usr/bin/grep -a` — see
"Final consolidation" below. Register total: **514**.

**Extended 2026-08-14 (SIXTH wave) by `audit-lead`:** the sixteen cross-cutting **X
lenses** are adjudicated below — **77 new rows** from 84 considered items across **five** findings
files, **ten new decisions (D40–D49)**, fourteen extended, **D17 completed and de-interimed**,
**D19 held interim with its three blocking rulings named**, **D21's stale `ds-audit` baseline
corrected**, **X-C superseded by X07-F4**. `audit/findings/X10-X11-X14.md` was **not** in the step's
input list and was adjudicated anyway. X16 was not lens-passed by instruction —
`specs/16-responsive.md` is its standard. **The audit's adjudication is now COMPLETE.**
Register total: **501**. Ship-first order, product-wide: `audit/SHIP-ORDER.md`.

**Extended 2026-08-14 (fifth wave) by `audit-lead`:** the seventeen remaining surface items
(S24 · S25 · S26 · S27 creation forms and Destinations · S28–S31 the Airtable connect flow ·
S32–S35 Settings/Billing/Profile/Help · S36–S40 Welcome/Login/Register/404/Styleguide) are
adjudicated below — **85 new rows** from 85 considered items (5 scout findings merged into 2 rows,
1 recorded as an instance, 1 split into 2, 2 rows lead-filed), **eight new decisions (D32–D39)**,
fourteen extended, **two register rows corrected in place** (J08-F15 and the S23 "no findings"
block), two scout severities lowered with the reason written down. **The 40-surface sweep is now
fully adjudicated; only the 16 X lenses remain.** Register total: **424**.

**Verification.** Every S1's load-bearing `file:line` citation was re-checked in source by the lead
and confirmed (36/36); ~18 S2 claims sampled, all confirmed. Two citation-path errors found (J08:
`connection-health-banner.ts` is in `apps/web/src/components/layout/`, not `lib/`;
`CadencePicker.astro` is in `apps/web/src/components/backups/`) — line numbers and substance correct
in both. Browser-measured geometry (computed px, `elementFromPoint`) was accepted where the source
mechanism confirms it (e.g. J05-F3's `minmax(0,1fr)` name track at `SchemaHealth.astro:714,717`).
Gates, run 2026-08-07: `ds-audit` → **exit 1**, "ds-lint: 295 design-system issue(s), across 193
file(s)"; `typecheck` → **exit 0**.

Raw scout findings: 163. After lead dedup (4 rows merged into cross-journey masters, 1 row split):
**160 register rows**.

## Counts

**Cumulative, all waves (updated 2026-08-14, after the FINAL CONSOLIDATION pass):**

| severity | count |
|---|---|
| S1 | 74 |
| S2 | 231 |
| S3 | 185 |
| S4 | 23 |
| (no severity — NOT-OURS questions) | 1 |
| **total** | **514** |

(J01–S18 297 · S19–S21 34 · S22–S24 8 · S24–S40 85 · X01–X15 77 · consolidation 13.)

**How the numbers moved from 501:** +13 new rows · X04-F2 S3 → S4 · X06-F8 S3 → S2. So
S1 73 → 74 (the panel-width row), S2 225 → 231 (+5 new, +1 from X06-F8), S3 181 → 185 (+6 new, −2
moved out), S4 21 → 23 (+1 new, +1 moved in).

The table below is the original J01–S18 compile, kept because the per-wave notes that follow are
written against it:

| severity | count |
|---|---|
| S1 | 52 |
| S2 | 131 |
| S3 | 103 |
| S4 | 11 |
| **total** | **297** |

(J01–J08: 160 rows · S06–S09: 30 rows — 34 scout findings + 1 lead-filed, minus 4 merged into 2
master rows and 1 demoted to a reference of J06-F8 · S10–S13: 52 rows — 51 scout + 1 lead-filed M1, none
rejected, S11-F7 raised S2→S1, S13-F2 demoted S2→S3 · S14–S18: 55 rows — 62 scout findings,
5 twin-pair merges + 2 instance-recordings, none rejected, no severity changes; S18-F3/S15-F9/S16-F8
held S2 with an UNVERIFIED-at-panel-widths flag pending U1.)

**Disposition — scope note.** The table below counts **J01–S18 only** (297 rows); the S19–S21 and
S22–S24 waves recorded dispositions per row but never a per-wave total, so a cumulative disposition
figure would be invented rather than counted. The S24–S40 wave's own disposition table (ADOPT 76 ·
RATIFY 2 · ACCEPT 2 · DEFER 5) is in its section below. **No row in any wave is undisposed.**

| disposition | count |
|---|---|
| ADOPT | 262 (3 of them harness-only: J08-F15 — **corrected 2026-08-14, its `/settings` half is now the product row S32-F1**; J08-F21, S09-F4; 2 already landed and lead-verified: S07-F1 `ed8b03b`, S09-F1 `c0aab03`) |
| RATIFY | 14 |
| ACCEPT | 4 |
| DEFER | 17 (every one carries a named trigger) |

## S06–S09 adjudication (2026-08-12)

**Verification.** All four scouts ran source-only (no browser, by design). The lead re-checked every
load-bearing `file:line` citation in all four files: **all confirmed** (`grep -a` required — plain
grep silently returns nothing on some `.astro` files, the binary-detection trap CLAUDE.md records
for `git grep`). Line numbers in `DataComments`/`DataChangelog` have drifted a few lines because two
fixes landed after the scouts ran (`c0aab03`, `ed8b03b`); substance intact in every case. The
orchestrator's browser pass supplied the missing geometry for S07-F1, S08-F3/F4 and S09-F1 (computed
grid tracks at 1280 and 500) — accepted as verified. **S06's four `NEEDS-MEASUREMENT` rows were NOT
in that pass and remain measurement-open** (see verdict note). Gates, run 2026-08-12: `typecheck` →
**exit 0**; `ds-audit` → **exit 1**, "ds-lint: 6 design-system issue(s), across 207 file(s)" — down
from 295/193 on 2026-08-07; the D21 rem-fraction debt is largely retired by `ed8b03b`.

**Lead rulings (severity), both requested by the orchestrator:**

1. **S07-F1 raised S2 → S1.** The charter's test is "states something untrue / cannot proceed". At
   1280 — a width the product designs for (the panel drawer is capped one below it) — the COMMENT
   track measured **5px** against 78px of content, and at 500 five of nine tracks were destroyed
   (COMMENT **0px**) with no sideways scroll: the content the tab is named for was silently absent,
   which is a misleading absence, not friction. Precedent binds it: J05-F3 (the identical
   `minmax(0,…)`-collapse mechanism on Schema Health) is S1 in this register. **The S08 overflow
   stays S2**: at 1280 the Attachments listing overflows 153px *inside* an `overflow-x: auto` frame
   — degraded (three clipped headers) but every column reachable by scrolling; nothing is destroyed
   and nothing lies. Same class, different blast radius, different severity.
2. **S09-F5 raised S2 → S1.** `Created 0` under a live `Created` heading, for a run that created
   2,340, is a false numeral — dimming to 40% is not a disclaimer, and the drill panel one click
   away answers the same filter by removing the tab. J03-F2 was S1 for printing `—` over real data;
   a wrong number is strictly worse than a placeholder. That the user set the filter themselves
   softens intent, not truth.

**Merges and demotions:**

- **S06-F10 + S07-F2 + S08-F2 + S09-F3 → one D17 row** (four tab-level empty anatomies in one
  section — one defect, four instances).
- **S07-F7 + S09-F7 → one D10 row** (the feed family exposes its column header two ways).
- **S06-F6 demoted to a reference of J06-F8 (D11)** — same ruling (cap + tooltip, one truncation
  unit), new instance: the record's own primary at a hardcoded 320px with no `title`/`data-tip`
  (`DataBrowse.astro:497`, three units on one surface: 320px / 15ch / 15rem). The J06-F8 fix must
  include this cell; no new row.
- **S06-F14 lead-filed** from S06 §4 (a catalog self-conflict the scout recorded without filing).

**Status updates to J-pass rows (no old row rewritten):**

- **J06-F7 (D07) is two-thirds closed**: `556189b` shipped `wireViewState` URL contracts for
  Comments, Attachments and the Data Changelog (lead-verified in source). The surviving member is
  Records/Browse — filed as S06-F5 under D07.
- **J06-F15 (D21, DEFER) — trigger FIRED, superseded by S08-F3 (ADOPT, D15)**: the
  `Captured`→`In backup` rename resized a header-sized column and the orchestrator measured 153px
  of inner overflow at 1280. The DEFER row stands for history; S08-F3 is the live row.
- **J06-F9 (D15) is two-thirds fixed**: Comments' header is no longer `aria-hidden` and now sorts on
  the shared `wireTableSort`. The surviving third — the feed loses its header on scroll — is owned
  by D22 (Comments/Data-Changelog lack `data-grid-fit`, so `global.css:2587` cannot fire).
- **D11 re-verified holding on both tabs** by S07/S08 line-by-line (search haystacks, location
  buttons, `DateRangePicker` + anchor, group cards, clip tooltips, worded absences). Nothing
  regressed.
- **D21's ds-audit baseline is stale**: 295/193 → **6/207** (2026-08-12); the six residuals are
  unsized `btn` variants in five files.
- **S08-F4/F3 fix observed in flight** (uncommitted working-tree change to `DataMedia.astro` adding
  `data-narrow-pan` + an `.md-th-when` class, seen 2026-08-12 during compilation) — the rows below
  bind against the last commit; re-verify on the next commit rather than re-filing.

## S10–S13 adjudication (2026-08-12)

**Verification.** All four scouts ran source-only (the shared-page race S09 recorded). The lead
personally re-checked every S1's load-bearing citation in source — S10-F2, S11-F1, S11-F2, S12-F2,
S12-F3, plus S11-F4, S10-F12, S13-F5 — **all confirmed**. The orchestrator's browser pass
(`audit/findings/S10-S13-measurements.md`, 1440×900 and 540×900) closed 8 of 10 scout
`NEEDS-MEASUREMENT` rows and retracted two of its own Part-1 false positives (rect-vs-clip; an
`opacity:0` tooltip rect) — neither was a scout finding. Gates, run 2026-08-12 by the lead:
`typecheck` → **exit 0**; `ds-audit` → **exit 1**, "ds-lint: 6 design-system issue(s), across 208
file(s)" — zero of the six in `SchemaCanvas.tsx`, which confirms S11-F5's claim that both gates
are structurally blind to JSX inline styles.

**Lead rulings (severity):**

1. **S11-F7 raised S2 → S1.** Measured: the flagship tab's default landing fit at 1440 is scale
   **0.162**, painting 16px node titles at **2.59px** — the job cannot be performed. This is
   Oleh's standing «Visualize зовсім не готова», reproduced: not blank, 2.6px. Fix is one line
   (D25 — the wide fit adopts the file's own derived 12/16 = 0.75 floor; overflow pans).
2. **S13-F2 demoted S2 → S3.** The measurement disproved the symptom (`.cl-c-attn` 128px vs 122px
   needed, identical at 0/1/2 open panels — panels overlay). The zero-floor track + the
   hand-duplicated seven-track template stand as D15 mechanism debt.
3. **S11-F2 stays S1, UNVERIFIED in browser** — mechanism lead-verified in source; the scripted
   pass could not drive the mode switch. First item on the wave's under-audited list.

**Merges:** the measurement pass's M3 (`.rl-ent-name` clips −11px, no tip) folded into S10-F8 as a
second instance; S10-F9 already carries its Relationships instance in-row; M1 lead-filed under D22.
No rejections — all 51 scout rows survived verification.

**Instances recorded, no rows:** D07 ×4 (each tab's sub-tab state is URL-invisible) · D23 (four
§10 censuses + Q1, the 11px-badge vs 12px-floor rule conflict — see Still open) · J08-F2 line
drift (`SchemaCanvas.tsx:2083` → `:2248`) · S06-F9's ninth `/`-hint spelling (`EntitySearch` — one
edit closes four surfaces).

## S14–S18 adjudication (2026-08-12, third wave)

**Verification.** All five scouts ran source-only (the shared-page race). The lead personally
re-checked every S1's load-bearing citation — S14-F1, S15-F1, S15-F2, S15-F3, S16-F1, S16-F2,
S17-F1/S18-F1, S17-F2, S17-F3/S18-F2 — **all confirmed, zero citation errors** (details in the
wave file). The orchestrator's partial browser pass (`audit/findings/S14-S18-measurements.md`)
answered A1 (no `aria-sort` anywhere on the Automations headers, before or after a click — folded
into S17-F9), A2/A3 (no clipping at 1440 with zero panels), withdrew its own A4 false positive
before filing, and marked **U1 — every panel-open scenario on S15/S17/S18 — UNMEASURED**; its
overlay hypothesis is recorded as a hypothesis, not a disproof, and the closing pass must also
test **split view** (`panel-split:schema`, persisted, known to reflow per J05-F3). Gates, run
2026-08-12 by the lead: `typecheck` → **exit 0**; `ds-audit` → **exit 1**, "ds-lint: 6
design-system issue(s), across 208 file(s)" — the same six residuals, none in this wave's files.

**Lead rulings:** the two write-surface S1s both HOLD — S15-F3 (the app's only authoring surface
has no save contract; the contract ships 60 lines away in `schemaReadBody.ts:305-314`) binds as
**D30**, and S16-F2 (the quick-ask composer is inert markup — a `<div>` input and a
primary-painted `<span>` send, zero `textarea` in the file) binds as **D31**. S18-F3, S15-F9 and
S16-F8 keep S2 with an UNVERIFIED flag rather than taking the S13-F2 demotion: their symptom is
unmeasured (U1), not measured-absent, and split view is a real persisted narrower that reflows.

**Merges:** S17-F1+S18-F1 · S17-F3+S18-F2 · S17-F6+S18-F7 · S17-F4+S18-F8 (twin tabs, one defect
each) · S15-F6+S16-F9 (the Knowledge cluster's three `window.prompt` sites). **Instances on
existing rows:** S18-F5 → S12-F7 (collapse survives filtering, second instance — one answer for
both tabs) · S17-F10 → S10-F8 (sixth listing without `mountClipTips`; desktop name floor → D15).

**Instances recorded, no rows:** D07 ×5 (no tab puts base/doc/thread/facets/collapse in the URL —
Docs is the sharpest: five surfaces deep-link in by event and only the address is missing) ·
D14 (Health's six upgrade elements in three treatments, already spot-named in the decision) ·
D23 (five more §10 censuses; Health and Docs are the section's positive outliers on type — both
fully on the `--t-*` ladder) · D21/D20 (Health's ~22 dead CSS rules; storybook's duplicate
`id: 'tooltip'` anchor, flagged once) · M1 (Health's fourth scroll model; Docs/Chat's shared
hard-coded 216px offset) · S11-F5 class (Health's three `--t-11` captions) · S10-F14's act gains
four spec-scope particulars (Docs is V2-out-of-scope per `specs/10-schema.md:154-157`; chat
unmentioned; the two register tabs have no intent doc) and must answer write-vs-derive for Docs.


## Lead rulings requested by scouts

1. **J06-F10 (icon-only comment status)** — **split.** The *exception-only* display (blank = Active)
   is ACCEPTED: the in-file argument (`DataComments.astro:357-369`, "marking the normal case put 18
   identical badges on screen") is sound and matches the app's own attention-flag convention. It must
   be recorded in the catalog (D19). The *vocabulary* is ADOPTED: one state, one word — the founder's
   own names **Active / Deleted / Record deleted** — in the facet, the tooltip and any doc; today the
   same state is "In the last capture" / "Active" / nothing. Rows J06-F10a (ACCEPT) + J06-F10b (ADOPT).
2. **J06-F2 vs J05-F1** — **merged into one system decision (D08)**, together with J04-F14, J05-F5
   and J03-F5/J08-F7. They are one rule: a surface that names a count, consequence or entity links to
   the surface that holds it. The rows keep their identity; the decision is one.
3. **Restore's position (J04)** — **settled by the lead, no client input needed.** The two documents
   answer different questions: `RestoreView.astro:5-11` is about *prominence in the value story*
   (rare, last-resort, not the headline); `specs/09-restore.md` is about *the rigor of the page
   itself* (anxious moment, explicit confirmation). They are compatible — rare **and** high-stakes.
   Every J04 S1 stands under either reading: a one-click unconfirmed write into a live Airtable base
   is wrong for a headline feature and for a last resort alike. All J04 S1s bind as ADOPT. The one
   item the "footnote" stance genuinely softens is records-only restore (J04-F10) → DEFER to Dan.
4. **No second user (J08-F1)** — **ADOPT single-operator for V1** (D18): the four teammate/invite
   copy strings come out, the `isAdmin` half-model and `Admin only` badges come out, and the catalog
   records the reason. Multi-user is DEFERred with the trigger "Dan states multi-user is V1 scope".
   Rationale: no spec commits multi-user to V1 (`specs/12-settings.md:67` says "will eventually");
   the cost asymmetry is ~1h of copy vs weeks across Backups/Restore/Reports/Data; the cheap option
   is fully reversible. **Needed from Oleh/Dan:** one sentence on V1 scope. A scout cannot settle
   this because both endings are coherent product positions — it is client intent, not evidence.
5. **Tier gating (J08-F2)** — the recorded `decision-no-tier-gating-default` **governs until Dan
   supersedes it in writing**. Interim ADOPT (D14): one gate recipe per `pattern-locked-tab`
   (capability wording, lock icon), and no gate ships pointing at the 12-line billing placeholder.
   **Needed from Oleh/Dan:** were the Schema-Health Pro+ gates client-requested (which would
   supersede the decision)? Provenance is not in the repo, so no scout could know.
6. **May a failed run be retried (J03 lens 1)** — the in-code client decision (run = immutable log,
   no run-level Retry, `BackupRunDetailView.astro:167-170`) is **respected**. The reconciliation
   (D03/D04): a failed run's next step is *start a new run* ("Run backup now") or *repair the cause*
   ("Reconnect") — never a retry of the log entry. Attachment-level "Retry failed" is a real
   capability and is wired or deleted (D02), with its scope in its label (J03-F9).

## Decisions index

| id | decision | resolves (primary members) |
|---|---|---|
| D01 | Trust claims are derived, never asserted | J01-F1 F3 · J02-F1 F5(mount) F10 F11 F14 F18 · J05-F13 · J08-F3 |
| D02 | Wire or delete: no rendered control without a handler | J02-F5(button) · J03-F1 · J07-F2(retry) · J08-F6 F9(handler) F13(auth) |
| D03 | Every operation has an ending | J01-F2 · J02-F4 · J03-F6 F11 · J04-F6 · J07-F2(surface) F18 |
| D04 | Failure states its scope, cause, and what was written | J02-F2 F3 F13 F17 · J03-F2 F3 F4 F9 F10 F14 F15 F16 · J07-F5 |
| D05 | The restore contract | J04-F1 F3 F4 F5 F7 F8 F10(DEFER) F13 F15(ACCEPT) |
| D06 | Destructive actions confirm and name the consequence | J01-F9 · J04-F2 F11 · J07-F3 · J08-F9(confirm) F16 |
| D07 | Addressable state: one URL contract, one identity | J01-F4 F8 F25 · J02-F6 F8 · J06-F7 · J07-F11 |
| D08 | No named dead ends: cross-surface seams | J03-F5 · J04-F12 F14 · J05-F1 F5 F6 · J06-F2 |
| D09 | One time system | J01-F21 · J02-F19 · J05-F2 F4 F11 F12 · J06-F6 F14 · J07-F8 |
| D10 | The two changelogs are one component family | J05-F8 F9 F10 F18 |
| D11 | Attachments and Comments converge | J06-F1 F3 F4 F5 F8 F11 F12 F13 |
| D12 | Sources and Destinations are one family; Edit edits | J08-F4 F5 F8 F10 F13 F25 |
| D13 | A report honours its definition | J07-F1 F4 F7 F12 F13 F19 |
| D14 | Tier gating: one recipe, one position | J08-F2 (instances: J05-F7, CadencePicker) |
| D15 | One table (interim → X01) | J02-F9 · J04-F9 · J05-F3 · J06-F9 · J07-F9 F10 F13 · J08-F20 |
| D16 | The catalog already rules: converge on existing entries | J01-F5 F6 F15 F16 F18 F19 F22 F23 F24 F26 · J02-F7 F12 F16 F20 · J03-F7 F12 · J05-F17 · J07-F6 F15 F16 F17 |
| D17 | One empty-state model (interim → X04) | J05-F14 · J07-F14 · J08-F17 |
| D18 | Single-operator V1 | J08-F1 F11 |
| D19 | One status and verb vocabulary (interim → X08/X13) | J01-F13 F14 F17 F20 · J03-F8 F13 · J06-F10a F10b F13 |
| D20 | Stale intent and dead surfaces | J01-F7 F10 F11 · J05-F15 · J07-F20 F21 F23 · J08-F14 F19 F23 F24 |
| D21 | Phase-2 debt track (one DEFER, named) | J01-F27 F28 · J02-F15 · J03-F17 · J04-F16 · J05-F16 F19 · J06-F15 · J07-F22 · J08-F22 + the ds-audit 295 · S06-F12 |
| D22 | One scroll model and one narrow form for every listing | S06-F3 · S07-F1 · S08-F4 · S09-F1 (+ J06-F9 surviving third) |
| D23 | Foundations: weights and radii (interim → S01/S04/S05) | S06-F13 (+ instances in S07/S08/S09/S10/S11/S12/S13 §10, + Q1) |
| D24 | One export contract: the count is the view, true in every projection | S10-F2 · S11-F1 · S12-F13 · S13-F4 |
| D25 | Visualize: legible by default, honest when empty | S11-F2 F3 F4 F7 F9 F10 F11 F12 F13 F14 F15 F16 F17 |
| D26 | One relationship detail, one row | S12-F1 F2 F3 F4 |
| D27 | One body, two projections: a view toggle changes layout, never facts | S10-F1 F6 · S12-F6 |
| D28 | Capability gates render the true state | S16-F1 · S17-F6+S18-F7 |
| D29 | The register speaks once: recorded, never observed | S17-F1+S18-F1 · S17-F2 · S17-F4+S18-F8 · S17-F5 · S18-F9 |
| D30 | One save contract | S15-F3 F4 |
| D31 | One assistant, two doors | S16-F2 F4 F5 F6 F7 F11 |

## Register

Evidence column is a pointer: full evidence (measurements, shots, comparison targets) lives in
`audit/findings/<journey>.md` under the same finding number. `✓` = lead re-verified the citation in
source. Merged instances are listed in the row.

### D01 — Trust claims are derived, never asserted

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F1 | S1 | ADOPT | "Your Space is protected." asserted while the first backup is still running | `SpaceHomeView.astro:126` ✓ |
| J01-F3 | S1 | ADOPT | `'this Space'` fallback rendered as if it were a name (h1, subtitle, path) | `SpaceHomeView.astro:51,311`; trial fixture `space: null` ✓ |
| J02-F1 | S1 | ADOPT | "Everything's backed up" derived from connection health alone; survives failed/running/stale | `SpaceHomeView.astro:237-244,65,70-73` ✓ |
| J02-F5 | S1 | ADOPT | Broken-state recovery is an inert button; documented connection-health banner mounted on no product route | `SpaceHomeView.astro:255` ✓ (no handler); `slot="app-banner"` only in demo route. Button half → D02 |
| J02-F10 | S2 | ADOPT | No freshness stamp, no Refresh, no overdue state on the entry screen | `SpaceHomeView.astro:83-93`; `format.ts:127-137` (no past branch). Overdue unreachable in harness — source-established |
| J02-F11 | S2 | ADOPT | Home can't distinguish schema-only runs; KPI attributes data to a schema run | `SpaceHomeView.astro:137-161` vs `BackupsListView.astro:145` ✓ |
| J02-F14 | S2 | ADOPT | Paused rail removes Last/Next backup exactly when staleness matters | `SpaceHomeView.astro:246-253` ✓ |
| J02-F18 | S3 | ADOPT | Home rail and Inbox contradict each other in one viewport; no shared derivation | J02 §9; `SidebarLayout.astro:58,96` |
| J05-F13 | S2 | ADOPT | "Schema as of Jun 22" asserted for a Space with no bases and no runs | J05 §6; shot `J05-08` |
| J08-F3 | S1 | ADOPT | Settings shows a hardcoded different person/org than the signed-in account | `SettingsView.astro:49,51,77,112` ✓ (`Reese Delgado`/`Acme Operations` literals; view takes no user prop) |
| S09-F5 | S1↑ | ADOPT | Filtering by change type prints a dimmed `Created 0` under a live heading for a run that created 2,340 — a false numeral — while the drill panel answers the same filter by removing the tab, and the honest sampling note is suppressed for exactly this filter (`dctype` excluded from `filteredCounts`). Raised S2→S1 by the lead (ruling 2 above). Fix per the scout: hide the whole column for a filtered-out type (the panel's answer) or keep the true total and mark it filtered | `DataChangelog.astro:625` ✓ (`hidden.dctype.has(t) ? 0 : …`) · `:598` ✓ · `:750` ✓ (`visibleTypes`) → `runReadBody.ts:94` |
| S14-F1 | S1 | ADOPT | A metric switched off still prints `15%` under "Contribution to the grade" while wearing `Not counted`; the ring holds its number and the counted weights sum to 85 with nothing on screen saying so — the user's own toggle contradicted by every number in front of them. Weight cell → `—` + "Excluded — will not count toward the next grade" tip + one counted-total line under the breakdown title; the recompute is NOT-OURS, what the UI says while waiting is ours | `SchemaHealth.astro:300-308` ✓ (badge + unchanged weight cell + toggle in one row) · `:769`, `:976-979` · fixture 20+20+25+20+15 with `Formula errors` off (`schema-lab.ts:516-521` ✓) |

### D02 — Wire or delete

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J03-F1 | S1 | ADOPT | "Retry failed" — solid `btn-primary` with no handler, in two views | `BackupRunDetailView.astro:326` + `BackupRunBaseView.astro:266` ✓; script wires only `[data-open-failed]` ✓ |
| J08-F6 | S2↓ | ADOPT | Every banner/pill repair CTA defaults to `href="#"`; no caller passes `reconnectHref` | `components/layout/connection-health-banner.ts:103` ✓ (path corrected from scout's `lib/`). Downgraded S1→S2: banner is mounted nowhere yet (J02-F5), so the dead CTA is latent — becomes S1 the moment D01 mounts it |
| J08-F9 | S2 | ADOPT | `Remove` (destructive) enabled and inert on both detail pages; no handler, no confirm | `SourceDetailView.astro:128`, `DestinationDetailView.astro:104-108` ✓. Confirm half → D06; row-keyboard half merged into J02-F7 |
| J08-F13 | S2 | ADOPT | Dead `Authorize Airtable` (`data-fake-auth`, zero handlers); no validation; Cancel → the page itself | `SourceAddView.astro:46` ✓ (grep: 1 hit, the markup). Validation half → D12 |
| S15-F1 | S1 | ADOPT | The empty state's only action — `New document` — is never wired: `wireDocs` returns at `if (!docView) return` (comment: "nothing to wire", over a rendered primary) before the delegate that handles `[data-dc-new]` 205 lines later — a zero-doc Space can never create a document. Move the wiring above the guard; check the sibling consoles (Chat, Data ▸ Records) for the same early-return construction | `SchemaDocs.astro:588-589` ✓ · `:794-797` ✓ · `:95-101` ✓; reachable `?fixture=thin&tab=docs` |
| S16-F12 | S3 | ADOPT | Thumbs up/down render on every reply with no handler and no acknowledged state (broken on the second click); the thread rail is a `role="tablist"` nested inside the section's tablist with a menu button inside it and restored rows missing `aria-selected`. Wire with `aria-pressed` + a catalog note, or delete the two buttons; rail → `list` + `aria-current` (executes beside S10-F9's family fix) | `SchemaChat.astro:84-85,140-149` · `schemaChat.ts:151` |
| S17-F11 | S3 | ADOPT | The `Tagged` cell is a ghost `btn` with a tooltip and no hook of its own — its only effect is the row's own click — and its `aria-label` never singularizes ("1 tagged tables/fields"). Labelled `<span>` keeping `data-tip`, or a real target (jump the panel to Touches via `data-ep-push`) | `SchemaAutomations.astro:147` · `schemaAutomations.ts:241-256,353` |

(J07-F2's dead Retry is a member here; row filed under D03 where its larger half lives.)

### D03 — Every operation has an ending

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F2 | S1 | ADOPT | No first-backup completion state anywhere — the moment the product exists for | grep "first backup" → running copy only ✓; `statusCode` has no `done` |
| J02-F4 | S1 | ADOPT | A failed run offers no next step (per ruling 6: "Run backup now" / "Reconnect", not a log retry) | `settled = succeeded \|\| trial_succeeded` → failed gets `[]` ✓ (`BackupRunDetailView.astro:71,171-187`) |
| J03-F6 | S1 | ADOPT | Reconnect loop never closes: `Connected` over `Last backup: failed`, `Status checked 1h ago` frozen | J03 §6; `SourceDetailView.astro:23,44,80,115`; shot `J03-06` |
| J03-F11 | S2 | ADOPT | Auth/expired-token failure — the one repairable class — has no reachable surface | `fixtures/backup-runs.ts:196` reaches only `data-search`; no auth branch in `backups/run.astro`. Harness-unreachable, source-established |
| J04-F6 | S1 | ADOPT | Restore has no in-progress and no failure state; `RestoreOutcome` has no failure shape | `RestoreView.astro:46-61` ✓ |
| J07-F2 | S1 | ADOPT | Failed report run → 404; no reason field; Retry has no listener | `pages/reports/run/[runId].astro:18-19` ✓; `data-rpd-retry` unwired ✓ (`ReportDefinitionView.astro:196` vs `:560-570`) |
| J07-F18 | S3 | ADOPT | "Run now" writes only to `sr-only`; queued run appears nowhere | `ReportDefinitionView.astro:565` ✓ |
| S16-F3 | S2 | ADOPT | The LLM surface has no "could not answer", no error and no rate-limit state: `finish()` has one path, both canned replies affirm, `Stop` erases the turn without trace, and the one honest refusal in the product is a fixture string rendered as a confident answer. Three renderings (no-answer marker + next step · in-thread error + Retry, never a toast · stopped marker), one canned path reaching the refusal. Which questions the engine refuses is NOT-OURS; that a refusal can render is ours | `schemaChat.ts:295-319` · `SchemaChat.astro:102-108` · `schema-lab.ts:908` |

### D04 — Failure states its scope, cause, and what was written

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J02-F2 | S1 | ADOPT | Failure reason 91px below the fold; alert prints only the first failing base | `BackupRunDetailView.astro:278-283` ✓ (`bases.find`) |
| J02-F3 | S1 | ADOPT | "Captured" chips show configured depth, lit over "nothing written" | `depthChips` from `run.depth`, rendered under label `Captured` ✓ (`:117-121,222-227`) |
| J02-F13 | S2 | ADOPT | The log never shows why a run failed; reason only in `data-search` | `BackupsListView.astro:140` ✓ |
| J02-F17 | S3 | ADOPT | Error names the raw Airtable id under an `<h1>` with the base's name | J02 §8; `BackupRunBaseView.astro:243` |
| J03-F2 | S1 | ADOPT | Log prints `—` for Records/Attachments on every non-succeeded run that wrote real data | `isOk` at `BackupsListView.astro:65` driving `:150-151` ✓ |
| J03-F3 | S1 | ADOPT | No partial outcome stated ("5 of 6" appears nowhere); "stopped the run" contradicted by the table | J03 §6; the inbox row states it correctly (`fixtures/inbox.ts:36-37`) |
| J03-F4 | S1 | ADOPT | Unreached bases never marked `Pending` on failure — "completed" and "never ran" render identically | `backups/run.astro:91-100` vs `:106-114` |
| J03-F9 | S2 | ADOPT | Retry scope not in the label; permanent and transient failures batched under one button | `BackupRunDetailView.astro:311-327` ✓; `FailedAttachment` has no class field |
| J03-F10 | S2 | ADOPT | No copyable Run ID / Trigger Run IDs, against the spec's explicit ask | `specs/08-backups.md:104`; foot renders bare `<code>` ✓ |
| J03-F14 | S3 | ADOPT | `Error.Airtable…` (no space) on one level, `Error. Airtable…` on the next | J03 §8 (measured innerHTML); cause unverified, difference real |
| J03-F15 | S3 | ADOPT | One base, two Airtable ids, one drill apart | J03 §8; consequence of `RunDetail` having no error of its own |
| J03-F16 | S3 | ADOPT | "Airtable access was lost." — no when, no why, no instruction | `SourceDetailView.astro:68` |
| J07-F5 | S1 | ADOPT | Delivery failures stored ("Mailbox full") and rendered nowhere; "Delivered 4/5" unexplorable | `fixtures/reports.ts:61,94` ✓; `types.ts:42` "expandable on the row" ✓ |
| S07-F3 | S2 | ADOPT | A comment pass that failed and a Space that has never had a comment render one identical card whose mechanism sentence asserts the capture worked. **Merged instance: Attachments**, same single-branch shape (`DataMedia.astro:597-600`). Fix at section level: a capture-outcome prop shared by the two retrieval tabs, worded like the status tooltips. NOT-OURS half recorded under "Still open": whether a partial comment/file capture can occur — if Dan rules it impossible, this re-binds ACCEPT with the reason in `pattern-empty-state` | `DataComments.astro:227` (single ternary), copy `:503-504`; no partial/failed branch on any Data tab ✓ |
| S14-F12 | S2 | ADOPT | There is no such thing as a base that could not be graded: `BaseHealth` has no ungraded/failed variant, the component is never passed `bases`, and `Bases {health.length}` counts only what came back — a failed grade and a never-connected base are indistinguishable, and the count silently under-reports the Space. Pass `bases`; render ungraded rows with a neutral `Not graded` + one sentence on why grading lags. NOT-OURS: can a grade *fail* per-base (model variant first). HARNESS: `?fixture=failed` reaches nothing on /schema | `SchemaHealth.astro:92-107,185` · `SchemaView.astro:250-251` · `pages/schema.astro:22-26` |

### D05 — The restore contract

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J04-F1 | S1 | ADOPT | Target defaults to a hard-coded live base unrelated to the base being restored; entry drops `&base=` | `RestoreView.astro:189,203` ✓ (existing checked, literal placeholder); `BackupRunBaseView.astro:141` ✓ (no `&base=`) |
| J04-F3 | S1 | ADOPT | No point-in-time choice; no date/run/health anywhere; restores from a failed run silently | J04 §6; `restore.astro:9` hard-coded default ✓ |
| J04-F4 | S1 | ADOPT | A restore leaves no audit row anywhere, against the spec's Restore-Run contract | `specs/09-restore.md:59-60` ✓; `/backups` has no restore kind |
| J04-F5 | S1 | ADOPT | Completion screen cannot state where data landed — handler carries only `&att=` | `RestoreView.astro:399-405` ✓ (source-verified; harness fixture masks it) |
| J04-F7 | S3 | ADOPT | Attachments mode chosen blind — no counts, no link-dependency statement | J04 §5 |
| J04-F8 | S2 | ADOPT | "Create a new base" accepts an empty name; button stays enabled | J04 §4 (measured) |
| J04-F10 | S2 | DEFER | Records-only restore — V1 in the spec, absent in the app | **Trigger: Dan rules V1 scope; then amend whichever document lost.** `specs/09-restore.md:51-53` vs the form's table-only granularity |
| J04-F13 | S2 | ADOPT | Write-permission requirement never stated, checked, or failable-into | J04 §6 (measured regex sweep) |
| J04-F15 | S3 | ACCEPT | 920px column — only view not at 1200/1400 | Accepted as the spec-requested calm surface (`specs/09-restore.md:146-148`); reason recorded in catalog per D05 |

(J04-F2 → D06; J04-F6 → D03; J04-F9 → D15; J04-F12/F14 → D08; J04-F16 → D21.)

### D06 — Destructive actions confirm and name the consequence

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F9 | S2 | ADOPT | Leaving mid-setup destroys 5 steps of input silently; no guard | `IntegrationsSetupWizard.astro` — no `beforeunload`; no-draft decision at `:16` is fine, the silence is not |
| J04-F2 | S1 | ADOPT | The one operation that writes to live Airtable has no confirm — one click executes | `RestoreView.astro:399-405` ✓; Pause/Cancel both confirm (`BackupRunDetailView.astro:292,301`) |
| J04-F11 | S2 | ADOPT | Irreversibility never stated on the form or result | J04 §8 (measured regex sweep) |
| J07-F3 | S1 | ADOPT | Deleting a report (named object + history + live external mailing) — no dialog, no toast, no undo | `ReportsView.astro:287-294` ✓ (splice + remove, `sr-only` only) |
| J08-F9c | — | ADOPT | (confirm half of J08-F9 — see D02 row) | — |
| J08-F16 | S2 | ADOPT | `Delete account` rendered `btn-neutral`, identical to `Change photo`; danger card has no error border | `SettingsView.astro:236` ✓ (generic button branch) |
| S17-F3 + S18-F2 (merged) | S1 | ADOPT | On both register tabs a hover-revealed trash marks the record `Removed` on the first click — no dialog, no consequence, no undo, and **no path back anywhere in the UI** (the removed row drops its trash, the panel footer returns `''`, nothing sets status back to active); the default Status facet then hides the result on the same tick. D06 built this machinery for five surfaces and missed these two twins. One `ConfirmModal` + consequence written once beside the act, reused by row and panel (they already share the event); relabel `Delete` → the act it performs; and the ruling: a soft delete with no un-delete is a hard delete wearing a status field — add `Mark as active` to the removed panel footer or stop calling it soft. Both tabs, one commit | `schemaAutomations.ts:252-253,381-388` ✓ · `schemaInterfaces.ts:259-260,383-392` ✓ · `schemaReadBody.ts:315-318` ✓ · grep ConfirmModal in `components/schema/` → **0** ✓ |
| S15-F5 | S2 | ADOPT | The delete-document confirm is a hand-built `<dialog class="modal">` — the only `modal-box` in apps/web outside `Modal.astro` — where `ConfirmModal` exists and its usageDont forbids exactly this ("Don't rebuild a confirm dialog inline"). Replace, drive via `returnValue === 'confirm'`, delete the `pendingDelete` state machine; land with/after D06's footer-sizing fix | `SchemaDocs.astro:263-273` · `storybook.ts:1355-1384` |

### D07 — Addressable state

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F4 | S2 | ADOPT | First-run "track it" links land on the run *list*; progress lives one level deeper | `SpaceHomeView.astro:126`; instances: inbox "View log" → `/backups`; DataChangelog "Jump to this backup" → `/backups` (`DataChangelog.astro:217`) |
| J01-F8 | S2 | ADOPT | Wizard never writes `?step=`; reload → step 1, Back exits the flow | `IntegrationsSetupWizard.astro:763-776,757`; comparison `sectionTabs.ts` |
| J01-F25 | S3 | ADOPT | Wizard route marks no sidebar item active | J01 §3 (DOM-verified) |
| J02-F6 | S2 | ADOPT | Three URL contracts for one run page; list drops the id for every non-succeeded run | `BackupsListView.astro:66-75` ✓ (`detailHref` ternary) |
| J02-F8 | S2 | ADOPT | Every run page titled "Backup run" — no identity in h1/crumb/title | `BackupRunDetailView.astro:143-145,153`; comparison `ReportDetailView.astro:60-71` |
| J06-F7 | S2 | ADOPT | No search/facet/sort/group/page state in the URL on either Data tab; localStorage keeps the wrong half | `grep history.* → 0` in `DataMedia`/`DataComments` ✓ |
| J07-F11 | S2 | ADOPT | Report tabs carry no URL state — the only unlinkable section tabs in the app | `ReportDefinitionView.astro:452-457` |
| S06-F5 | S2 | ADOPT | A preset — a named, saved, user-created object with an id — has no address: `?tab=` is the only URL state on Records while preset identity, table, filter tree, search, sort and page live in four localStorage keys. **The last open member of J06-F7**: `556189b` shipped `wireViewState` for the other three Data tabs and did not touch Browse. One URL contract for the section (`?tab=&preset=&table=&q=&page=`); localStorage keeps only true preferences (page size, library collapsed) | `dg-presets-v2` at `DataBrowse.astro:735,965` ✓; no `wireViewState`/`replaceState` in the file ✓ (re-censused 2026-08-12) |

### D08 — No named dead ends

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J03-F5 | S1 | ADOPT | In-use-by row for Space *Product* lands on Space *Core CRM*'s Home (302, query dropped). **Merged: J08-F7 (same control, same line)** | `SourceDetailView.astro:99` ✓; `integrations.astro:6` redirect ✓ |
| J04-F12 | S3 | ADOPT | Mass-delete run panel opens on "Created 0"; the flagged loss is the third tab | J04 §2; re-confirmed J05 |
| J04-F14 | S2 | ADOPT | Discovery surfaces (Data mass-delete, Schema Removed facet) never lead to Restore — escalated by J05: panel copy *names* "a restore" and withholds the link | grep: exactly two `/restore` hrefs in `apps/web/src`, both Backup views ✓ |
| J05-F1 | S1 | ADOPT | Zero links between the Schema and Data changelogs in either direction; a change naming 12 records dead-ends | grep verified ✓ (0 `/data` hrefs in `components/schema`; 1 `/schema` href in `components/data`). Prerequisite: one entity id namespace (harness note) |
| J05-F5 | S2 | ADOPT | Health's "-4 since last backup" is inert; no metric/issue links to the Changelog window | `SchemaHealth.astro:278`; only verb on the tab is "Open in Airtable" |
| J05-F6 | S2 | ADOPT | Reverse dependencies exist only inside an opened panel; no row/issue carries a count; capability unnamed. **Flag to Dan** (`research-airtable-dependencies-reverse-direction`) | `schemaReadBody.ts:848-896` real and correct; zero user-facing "dependencies" string |
| J06-F2 | S1 | ADOPT | Attachments ⇄ Comments render each other's subject, link in neither direction (inert `Comment` chip, inert paperclip count) | `DataMedia.astro:507` ✓, `DataComments.astro:352` ✓ |
| S15-F7 | S2 | ADOPT | Chat's "Saved as a doc" card's `Open` switches to the Docs tab unconditionally, then `openDoc` returns silently on the missing id — the user is moved and shown a different document; a document's origin (authored vs generated from a chat) is recorded nowhere on the Docs side. ADOPT the navigation half now (gate the switch on the id resolving; one honest line on a miss); provenance half — an `origin` field + one byline line — proposed and **DEFERred to Dan in-row** (trigger: the write-vs-derive answer the spec-refresh must give) | `SchemaDocs.astro:1133-1138,719` · `schemaChat.ts:334-338` |

### D09 — One time system

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F21 | S3 | ADOPT | "Next run in 18d" vs "Aug 7, 2026, 4:24 AM · Monthly" — one event, one click apart | shots `J01-14` / `J01-16` |
| J02-F19 | S3 | ADOPT | Date/When/Time for one column; four formats in one journey; private formatter copies | `SpaceHomeView:171` · `BackupsListView:122` · `BackupRunDetailView:240` |
| J05-F2 | S1 | ADOPT | The two halves stamped 22 days apart, labelled differently, neither names its run | J05 §6 (gap fixture-shaped; missing run reference and label words are `apps/web`) |
| J05-F4 | S2 | ADOPT | "Last 7 days" = wall clock on Schema, backup as-of on Data (0 vs 2 rows at one instant). **Rule: anchor on the backup as-of and print it** | `SchemaView.astro:231` (no `now`) vs `DataView.astro:180` |
| J05-F11 | S2 | ADOPT | Three date formats on one screen; panel drops the time so same-day changes are unordered | J05 §8 (measured) |
| J05-F12 | S2 | ADOPT | Every timestamp timezone-less; no zone printed anywhere; day-bucketing shifts with the reader's browser | `data-date="2026-06-21T10:20:00"` — no `Z`; parsed local. Production emission unverified |
| J06-F6 | S2 | ADOPT | Two different date controls reading two clocks in one section (0 of 221 vs 314 of 547) | `DataMedia.astro:316` (DateRangePicker) vs `DataComments.astro:224` (FacetFilter) |
| J06-F14 | S3 | ADOPT | Bare "Captured" header where Airtable supplies no attachment date — qualify it | `DataMedia.astro:419`; honesty contract at `dataTypes.ts:251-253` |
| J07-F8 | S2 | ADOPT | Schedule sets a time with no timezone — the one surface whose spec demands the zone | `ReportDefinitionView.astro:288-291`; `specs/11-reports.md:128-130` |
| S09-F2 | S2 | ADOPT | The `When` column prints a bare `9:14 AM` on a flat feed with no day header and no tooltip; the run's date sits two columns left under a heading reading `Backup run` (and again inside the id); the panel one click away renders the same run with `fmtDateTime`. Fix: `fmtDateTime` (or Comments' day+time pair, D11 item 3) under When + the absolute-with-zone tip; do NOT re-stack day over id — D10 flattened that on purpose | `DataChangelog.astro:169,191,201` ✓; `runReadBody.ts:85` ✓; `pattern-time` (`storybook.ts:3686`) ✓; comparison `BackupsListView.astro:223-224` |
| S16-F10 | S3 | ADOPT | The one surface that can be confidently wrong names no snapshot: nothing in a durable thread says which capture the answers read (the fixture's own `m8` gives a snapshot-relative answer with no snapshot beside it), and the disclaimer sends the reader to "your schema" — the artefact this page *is*. Stamp the thread with the run/as-of the header already builds (passed the way Changelog gets `asOf`); rewrite the disclaimer to name a reachable path (References / Browse) — the copy half ships alone | `SchemaChat.astro:290` · `QuickAskDock.astro:211` · `SchemaView.astro:246` vs `:268` · `schema-lab.ts:903` |

### D10 — The two changelogs are one component family

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J05-F8 | S2 | ADOPT | Attention is a facet on one half, a column on the other | J05 §7 (measured toolbars) |
| J05-F9 | S2 | ADOPT | Pager splits a day across pages with identical headings, no "continued" | J05 §6 (measured at Rows 10); comparison `decision-tree-showmore-not-pager` |
| J05-F10 | S2 | ADOPT | Six shared jobs done six ways (row element, header band, search, date format, time heading, panel title) | J05 §7 head-to-head table (measured) |
| J05-F18 | S3 | ADOPT | Drill-panel title = entity name on one half, a bare date on the other | J05 §7 |
| S07-F7 + S09-F7 (merged) | S2 | ADOPT | The family exposes its column header two ways: Comments' `.cl-fhead` is `role="group"` with labelled sortable cells, while Schema Changelog's and Data Changelog's are `aria-hidden="true"` over `<button>` rows whose accessible name degrades to a run of bare digits (`Jun 15, 2026 run_… 12 4 0`) — the three count cells carry no labels at all. One answer for three feeds; ship the cheap half now (aria-labels / sr-only words on the count cells), and when X01 unifies heads, **Comments' is the head to copy** (per S07 §7 — it is the only feed on THE ONE RECIPE) | `DataComments.astro:306-316` vs `SchemaChangelog.astro:202` ✓ and `DataChangelog.astro:166` ✓ |
| S13-F3 | S3 | ADOPT | The Schema half's search cannot find a date on a day-grouped feed — the day lives in the heading outside the row's cached `textContent` — while silently matching badge vocabulary (`renamed`, `Needs attention`) beside two facets that answer differently; the Data half renders the day inside the row and finds it. Seed the cache with the row's day words (one line); decide the badge-vocab overlap once for the family, not per half | `SchemaChangelog.astro:353,218` vs `.dc-run-day` |

### D11 — Attachments and Comments converge

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J06-F1 | S1 | ADOPT | Attachments search matches 3 fields only — base/table/field/record on every row return "No files match" | `DataMedia.astro:925` ✓ (`name + storelabel + kindlabel`); Comments uses whole `textContent` ✓ |
| J06-F3 | S2 | ADOPT | Comments location styled as a link (`cursor:pointer`, hover underline+chevron) with no handler | `<span class="cl-loclink">`; contract comment at `global.css:1647` ✓ |
| J06-F4 | S2 | ADOPT | Gallery deletes the `Where` column and the choice persists across sessions | `DataMedia.astro:1447` |
| J06-F5 | S2 | ADOPT | Group-by: no `None`, count contradicted by pager, trigger never shows the value, Base grouping loses the date | `DataComments.astro:134-140,609` |
| J06-F8 | S2 | ADOPT | Truncated filename/location have no tooltip; the same file's clip detector excludes them; active query collapses out of view | `DataComments.astro:565-583` (detector + rationale, one file away) |
| J06-F11 | S3 | ADOPT | Open-beside exists on Attachments, not on any comment row | `DataMedia.astro:1500-1509` vs `DataComments.astro:841-844` |
| J06-F12 | S3 | ADOPT | Three page-size ladders inside one section (25/50/100 · 24/48/96 · 10/20/50) | J06 §7 (measured) |
| J06-F13 | S3 | ADOPT | "Airtable user" renders in the same register as a real name — demote to the worded-absence style only | `commentText.ts:48`; do **not** synthesise identities (see What-is-good) |

(J06-F9 → D15; J06-F10a/b → D19.)

**S06–S09 references into this decision (no new rows):** S06-F6 — the J06-F8 truncation ruling's
third instance, the record's own primary at a hardcoded 320px with no tooltip and no clip detector
(`DataBrowse.astro:497` ✓; fixture ships 96/117/165-char primaries so the state is real); the one
cap+tooltip contract must cover this cell, with `display:block` against the `tooltip` class's
`inline-block` trap. D11 itself re-verified holding on both tabs, nothing regressed (S07 §7, S08 §5).

### D12 — Sources and Destinations are one family; Edit edits

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J08-F4 | S1 | ADOPT | `Edit` on both detail pages opens the empty *create* form; primary mints a second object | `SourceDetailView.astro:59`, `DestinationDetailView.astro:55` ✓; own header comment contradicts it (`:8`) ✓. Fix per `decision-panel-edit-mode-not-inline` |
| J08-F5 | S1 | ADOPT | `<form method="POST">` with zero submitters beside an `<a>` dressed as the primary — typed input discarded | `DestinationAddView.astro:90,115` ✓ |
| J08-F8 | S2 | ADOPT | The matched pair diverges on 6 of 15 shared jobs (in-use-by table vs inert chips the worst) | J08 §7 table (measured) |
| J08-F10 | S2 | ADOPT | Postgres destination told it has a "Per-Space subfolder" | `DestinationDetailView.astro:78` (unconditional) |
| J08-F13 | S2 | ADOPT | No validation on either create form (dead-control half → D02) | J08 §5 (measured `required: false` everywhere) |
| J08-F25 | S3 | ADOPT | Unknown `?id=` silently renders a different object with HTTP 200 | `fixtures/sources.ts:40`, `destinations.ts:47` fallback — the shape a real loader would copy |

### D13 — A report honours its definition

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J07-F1 | S1 | ADOPT | A scoped report renders every section and base it excludes; its own preview scopes correctly | `ReportBodyKpi.astro:24` ✓ (`Props { report }` only — no `sections`/`baseScope`) |
| J07-F4 | S1 | ADOPT | "Create report" saves nameless/recipientless/formatless, says "Saved.", stays on the page | `ReportDefinitionView.astro:566` ✓ (no validation in handler) |
| J07-F7 | S2 | ADOPT | Second cadence vocabulary; event cadence never resolves to the schedule it inherits | `CadencePicker` chips vs radio column (`:273-277`) |
| J07-F12 | S2 | ADOPT | Run header hard-codes "Since the last report."; states no scope, no status | `ReportDetailView.astro:72`; `windowLabel()` exported, zero importers |
| J07-F13 | S2 | ADOPT | History keyed by Period, ordered by generation, unsortable | shot `J07-03` |
| J07-F19 | S3 | ADOPT | Preview captioned as saved output while rendering live data | `ReportDefinitionView.astro:333`; catalog specifies the honest caption |

### D14 — Tier gating: one recipe, one position

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J08-F2 | S1 | ADOPT | 11 upgrade CTAs in 9 files, 8 visual treatments, all landing on a 12-line placeholder, against the recorded no-tier-gating decision. **Merged: J05-F7** (Configure rules → billing wearing a config verb, + five Pro+ gates) and J07's locked cadence tiers | CTA census in J08 §7 (spot-verified: `SchemaHealth.astro:199` ✓, `SchemaCanvas.tsx:2083` ✓, `SchemaChat.astro:188` ✓, `components/backups/CadencePicker.astro:40` ✓ — path corrected). Ruling 5 above: recorded decision governs pending Dan |

### D15 — One table (interim; X01 completes)

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J02-F9 | S2 | ADOPT | None of the three backup tables sorts — the audit log is the app's only major unsortable table | `grep data-sort → 0` in all three Backup views ✓ |
| J04-F9 | S2 | ADOPT | Restore step 2 unbounded — no pager, search or sort on the surface that must handle 50 tables | J04 §5 |
| J05-F3 | S1 | ADOPT | Split view collapses Health's metric-name track to 0px (five unnamed rows) and paints the score under the panel — the `minmax(0,1fr)` floor. **Rule: every flexible grid track carries a real `minmax()` floor** | `SchemaHealth.astro:714,717` ✓ (`minmax(0,1fr)` beside fixed+auto tracks); fix pattern written at `DataChangelog.astro:260-268`. Note: split view persists in `localStorage['panel-split:schema']` |
| J06-F9 | S2 | ADOPT | Two sibling tabs, two table engines — sticky sortable `<table>` vs static `aria-hidden` div-grid that loses its header on scroll | J06 §7 (measured) |
| J07-F9 | S2 | ADOPT | Three header recipes in one journey; the only sorter uses a text `↕` glyph overriding the global caret | `ReportsView.astro:317-321` vs `global.css:1416-1441` |
| J07-F10 | S2 | ADOPT | Neither Reports table paginates — the fixture was built "to exercise pagination" | `fixtures/reports.ts:85` |
| J08-F20 | S3 | ADOPT | Neither registry sorts, searches or pages | J08 §5 (measured) |
| S06-F1 | S2 | ADOPT | The Records grid — the reference implementation of `pattern-data-grid` — re-declares the shared frame and column label instead of adopting them by name, as its own entry instructs: an 11px frame against the token's 12px, a `.65` label alpha against `.55`, and three loose bands where the entry asks one card. Its two sibling tabs in the same page adopt the shared classes. Class swap `.dg-wrap`→`.tbl-frame`, `thead`→`.tbl-colhead`; keep only the sticky/overflow rules that are genuinely this grid's | `DataBrowse.astro:488,490` ✓ vs `global.css:1682-1710` ✓; in-page adopters `DataMedia.astro:399,403`, `DataChangelog.astro:162` ✓ |
| S08-F3 | S2 | ADOPT | **J06-F15's DEFER trigger has fired** (the `Captured`→`In backup` rename resized a header-sized column): measured at 1280, `.md-listwrap` client 944 / scroll 1097 — 153px of inner overflow with SIZE (96/100), STORAGE (77/81) and IN BACKUP (82/86) headers clipped. Apply the re-derivation F15 prescribed rather than nudging a number: real `minmax()` floors on the header-sized columns, and `.md-gcol-date` derived from the same source as the flat column instead of a literal 88px | `DataMedia.astro:428` ✓ · in-file budget `:696-701, 788-795` · `:907`; orchestrator geometry 2026-08-12 closes the NEEDS-MEASUREMENT |
| S10-F4 | S2 | ADOPT | One component, two sort arrows: Browse's Flat header uses the shared CSS caret (P37) while the Tree header 430 lines above still draws a literal `▲` at 8px off a private `data-sort-active` — J07-F9's exact construction, already ruled in this section. Put `data-sort-col`/`data-sort-dir` on the four `.br-sortbtn`s, delete `.br-sortind`; P37's parked handler item stays parked | `SchemaBrowse.astro:666-668,1016` vs `:393-396,990` + `global.css:2437-2454` |
| S10-F5 | S2 | ADOPT | Browse's one sticky tree header has four children where every row has five (the trailing chevron + gap), so Type/Status/Tagged paint right of their cells — under a comment asserting alignment. Fix by derivation (spacer of the chevron's width, or chevron into `.br-meta`), never a padding nudge; the Changelog's one-shared-declaration construction is the model. **Painted offset still unmeasured** (the one S10 measurement row the browser pass did not answer) | `SchemaBrowse.astro:234-252,647,231-233` vs `global.css:2571-2572` |
| S12-F14 | S3 | ADOPT | Relationships never uses `.tbl-frame` — measured: `querySelector('.tbl-frame')` null on the tab; `.rl-tree` re-types it at **11px** and `.rl-flatwrap` at **13.6px** against the token's 12px — which is why `panRail` gives this tab the app's one bare (unframed) rail. Class swap + delete the re-declarations; consider `.tbl-colhead` on the private `thead th` rule in the same pass. S06-F1 is the precedent | `SchemaRelationships.astro:397,507,420` vs `global.css:1701-1705`; `panRail.ts:70-73`; measured 2026-08-12 |
| S13-F2 | S3↓ | ADOPT | The desktop `.cl-*` template keeps `minmax(0,8rem)` on Attention — the same zero floor D15 exists to stop — and the seven-track string is hand-duplicated in two rules 24 lines apart, inside the block D10 wrote and beside the narrow block whose own comment names the omission. **Demoted S2→S3: measured, the symptom does not occur** (`.cl-c-attn` 128px vs 122px needed at 0/1/2 panels — panels overlay). Floor it (`minmax(6rem,8rem)`), collapse the two rules into one selector list | `global.css:2635,2659,2741-2744` ✓; measured 2026-08-12 |
| S18-F3 | S2 | ADOPT | The column floors that repaired this tab's zero-width-name defect exist only under `max-width:1279.98px`; the desktop template keeps `flex:1; min-width:0` against 520px of incompressible columns, and the file's own comment names the mechanism it does not apply at ≥1280. **UNVERIFIED at panel widths** (A3: not reproduced at 1440/0 panels; U1 unmeasured; the overlay hypothesis is not a disproof — and split view (`panel-split:schema`, J05-F3 measured) is a persisted narrower that reflows). Floor the name at desktop (`min-width:12rem`, the narrow template's own number); container query is the named follow-up | `SchemaInterfaces.astro:359-363,384,497-533` ✓ · `S14-S18-measurements.md` A3/U1 |
| S18-F6 | S2 | ADOPT | The column band is a hand-rolled `.tbl-colhead` differing in weight (600 vs 700) and alpha (.45 vs .55), its 11px outside the floor's named carve-out, and the three sortable cells are bare `<span>`s — mouse-only sorting on the shared sort module. `tbl-colhead` on `.if-thead`, labels wrapped in `<button>`; the same pass covers `SchemaAutomations.astro:356` and the `.ts`-regenerated header string (the fix has two homes) | `SchemaInterfaces.astro:357-358,215-218` · `global.css:1721-1739` · `storybook.ts:1518-1528` |
| S17-F9 | S3 | ADOPT | Sorting acts per base group under identical repeated headers, and **no header ever carries `aria-sort`** (lead-measured A1: null on all three, before and after a click) — two of three "sorted" headers lie by omission and none is announced. ADOPT the signal halves: `wireTableSort` writes `aria-sort` once for every adopter; one sort context across groups, **or** per-group RATIFIED into the catalog in one sentence. Cross-group IA deferred in-row — trigger: first ask for a global sort | `schemaAutomations.ts:391-397` · `tableSort.ts:53-60` · measured 2026-08-12 (A1) |
| S18-F10 | S3 | ADOPT | The 152px `Type` column restates what the glyph, indent and twist already say (`Interface`/`Page`) while the informative fact — `pageType` (Dashboard · Record detail · List), modelled and fixture-filled — renders only inside the panel. Print `pageType` when present, fall back to `Page` | `SchemaInterfaces.astro:237,140,28-30` · `schemaReadBody.ts:392` · `schema-lab.ts:1012-1024` |

### D16 — The catalog already rules: converge on existing entries

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F5 | S2 | ADOPT | `alert-warning` for both the gate violation and the neutral heads-up | `IntegrationsSetupWizard.astro:144,753` |
| J01-F6 | S2 | ADOPT | OAuth/PAT switch grey-on-grey, weight-only — the exact anti-pattern `pattern-segmented-control` names. **Merged: J08-F12** (`SourceAddView.astro:40-43`, + `role="tablist"` with no tabs) | wizard CSS `:576-579` ✓; SourceAddView markup ✓ |
| J01-F15 | S3 | ADOPT | Two glyphs for "destination" 200px apart, against `decision-entity-glyphs` | `:69` vs `:226` |
| J01-F16 | S3 | ADOPT | Welcome validation: no required marker on terms, errors 390px from the field, no `aria-invalid` — `TextInput` ships the anatomy | `WelcomeView.astro:94,128-137` |
| J01-F18 | S3 | ADOPT | Drawer rhythm: sibling-gap (5px) ≤ intra-field gap — batch with the wizard PR | J01 §10 (measured) |
| J01-F19 | S3 | ADOPT | Managed badge wraps the tile name; first grid row 19px taller | J01 §10 (measured) |
| J01-F22 | S3 | ADOPT | `md` rail button where everything is `sm` (`decision-density-sm-is-default`) — instances: J02-F4's "Run backup now", J04's footer pair | measured 40px/14px |
| J01-F23 | S3 | ADOPT | Two stacked headings saying the same thing on unconfigured Home | `SpaceHomeView.astro:311-312` + hero |
| J01-F24 | S3 | ADOPT | Animated hero: strip the pulse and radial gradient, keep the static teaching diagram (`specs/00` bans the motion) | `SpacePipelineHero.astro:96,101-108` |
| J01-F26 | S3 | ADOPT | Two heading registers inside one panel | `:500` vs `:536` |
| J02-F7 | S2 | ADOPT | Clickable-looking rows keyboard-dead — half of `pattern-row-actions`. **Instances:** Home history, `SourceDetailView.astro:99`, both registries' rows (from J08-F9) | DOM-verified by scouts; `onclick` only in source ✓ |
| J02-F12 | S2 | ADOPT | Empty state adds a second solid primary at `btn-lg` — a size sanctioned nowhere. Instances: J07-F16 | `BackupsListView.astro:176` |
| J02-F16 | S3 | ADOPT | Restore soft on run detail, solid on base page — one emphasis per action | `:185` vs `BackupRunBaseView.astro:141` ✓ |
| J02-F20 | S3 | ADOPT | Literal `→` glyph as icon, three places on Home — Lucide-only rule | `SpaceHomeView.astro:166,201,219` |
| J03-F7 | S2 | ADOPT | Error alerts with no recovery action, against the `alert` entry's own usageDo — three surfaces | `BackupRunDetailView:278-283`, `BackupRunBaseView:240-245`, `SourcesView:47-54` |
| J03-F12 | S2 | ADOPT | Native `title=` on the truncated destination path, on pages carrying 29 `[data-tip]` | `BackupRunDetailView.astro:269` etc. |
| J05-F17 | S2↑ | ADOPT | `.cl-daylabel` at 11.52px on a reference surface, no `ds-ok` — upgraded S3→S2 per the charter's reference-surface clause | `global.css:1611` ✓ (`.72rem`) |
| J07-F6 | S2 | ADOPT | Reports: two bespoke export dropdowns instead of `ExportControl`; soft-primary trigger the entry forbids | `ReportDetailView.astro:89-95`, `ReportsView.astro:156-161` |
| J07-F15 | S3 | ADOPT | One verb, three button levels; no solid primary on the report page | `:117` vs `ReportsView:154` vs `:164,:209` |
| J07-F16 | S3 | ADOPT | (merged instance of J02-F12 — listed for traceability) | `ReportsView.astro:191,198` |
| J07-F17 | S3 | ADOPT | Five under-floor sizes with no `ds-ok`, one of them the recipient error hint | `RecipientInput.astro:179-181,189` etc. |
| S06-F2 | S2 | ADOPT | Records is the only `.sch-tb` in the app with its search in the right cluster, at a third local width (210px), against eight leading-search siblings and the contract prose in `global.css`. The lead heard the scout's counter-case (search is saved preset config) and rules convergence — one row disagreeing with eight costs more than the taxonomy point wins; `pattern-toolbar` stays as written | `DataBrowse.astro:215-222` ✓; `global.css:1855-1859` ✓ |
| S06-F4 | S2 | ADOPT | At `?fixture=big` the pager totals 220 while the Export button above offers 1,240,000 — two readings of scale four orders apart, against `pattern-data-grid`'s own usageDont, and the pager is structurally unable to carry an approximate total. Fix: optional approx total on `createPager` (`1–50 of ~1,240,000`) **or** stop `ExportControl` quoting `approx` — NOT-OURS question below (does the engine return an approximate total?) decides which. The pager component itself is correct everywhere else (J07-F10) and is not swapped | `ui/tablePager.ts:125-133` ✓ (`total = items.length`); `data-lab.ts:61,182` ✓ |
| S06-F7 | S3 | ACCEPT | Two stacked `role="tablist"` strips 16px apart in two idioms (section-nav underline + Chrome pin-bar) — nowhere else in the app. The pin-bar model is founder-chosen and documented (`pattern-data-views`); re-litigating the affordance is the recorded trap. **ACCEPT with the reason and a visual-separation note written into `pattern-data-views`**; reopens only on user-testing evidence of confusion | `DataView.astro:160-199` vs `DataBrowse.astro:110` |
| S06-F8 | S3 | ADOPT | The app's only loading skeleton does not resemble the grid it replaces — four fixed bars × 8 rows, no frame, no header band — so the bordered container vanishes while loading and the layout jumps on arrival. Put the skeleton inside the frame, keep the header row painted, match the active preset's column count | `DataBrowse.astro:250-259` vs the `skeleton` entry (`storybook.ts:2047`) |
| S06-F9 | S3 | ADOPT | An eighth spelling of the `/` search hint: local `.dg-kbd` at a different opacity that disappears on focus, where the shared `.sch-tb-slash` deliberately stays (`global.css:2079-2081` states why). Delete the class, adopt the shared one — two lines | `DataBrowse.astro:222,474-475` ✓ vs `global.css:2331` (7 adopters) |
| S07-F4 | S3 | ADOPT | The same `DateRangePicker` (same props, same anchor) folds into the `Filter` drill on Attachments and sits permanently on the row on Comments and Data Changelog. The rule beats the majority — a time window is a refinement and refinements fold: add `'.dr'` to all three `mountRefineCollapse` call sites | `DataComments.astro:1216` ✓ vs `DataMedia.astro:1747` ✓ vs `DataChangelog.astro:1022` ✓ |
| S08-F7 | S3 | ACCEPT | Attachments is the only `/data` tab opening with a metric strip — and it has earned it: the strip answers a space-level quantity question ("what is eating my 20 GB", argued in-file) and tells the truth under filter. **ACCEPT with the earn/refuse rule written into `pattern-metric-tiles`**: a strip is earned by a whole-set quantity question (Home, this storage bill) and refused on a retrieval surface — so no fourth Data tab adds one | `DataMedia.astro:376-394,1384-1398`; `hm-kpis` in this file only ✓ |
| S10-F3 | S2 | ADOPT | Sorting a capped tree node re-orders the same 25 rows instead of re-windowing to the top 25 of 340 — the Flat handler 20 lines up ends `pager.reset(); apply();` with the reason in a comment; the tree handler just ends. One line (`resetChunks(); apply();`), and amend `pattern-node-showmore` usageDo 3 to "search, filters **or sort**" — the entry's silence is what let this ship | `SchemaBrowse.astro:1011-1036` vs `:1002-1003`; `storybook.ts:3024` |
| S10-F8 | S2 | ADOPT | The two remaining listings without `mountClipTips`: Browse (names guaranteed to truncate — its own CSS records `"S"`/`"Comp"`) and Relationships (**merged instance M3, measured**: `Deal Score` −11px, no tip, while every clipped string on the Changelog beside it has one). The J06-F8/D11 cap+tooltip ruling's fourth and fifth members; mind the `tooltip` `inline-block` trap on the `inline-flex` `.br-name` | `SchemaBrowse.astro:526,574-583` · M3 measured 2026-08-12; six adopters incl. `SchemaChangelog.astro:368` |
| S10-F9 | S2 | ADOPT | `role="tablist"`+`role="tab"` with `aria-selected` never written, on the exact control (`.sch-tb-modes`) the segmented-control entry names as its reference — a screen reader is told "tab" and never which. Fix per the entry's own clause: `role="group"` + `aria-pressed`, set where the class toggles. Two files, four lines (**instance in-row**: `SchemaRelationships.astro:263-267`). S2 against a reference surface per the charter clause | `SchemaBrowse.astro:218-224,908` ✓; `storybook.ts:3094` |
| S11-F5 | S2 | ADOPT | Sixteen sub-floor font sizes (9.5–11.5) among 50 raw JSX `fontSize` numbers on the flagship surface — cardinality labels, edge labels, legend headings — in the file that cites the 12px floor to justify a zoom decision. ADOPT the sixteen now; the full `--t-*` migration is a D23 instance; the `ds-checks.mjs` `.tsx` inline-style arm is D21 Phase-2 tooling. **Gate blindness confirmed by the lead's 2026-08-12 run**: ds-audit exit 1 with 6 issues, none in this file | `SchemaCanvas.tsx:547,676,1129,1199,795,702,332` ✓; `.claude/hooks/ds-checks.mjs:42,134-144` |
| S11-F6 | S2 | ADOPT | Pressing `/` does nothing on Visualize and the search box carries no `/` hint — the shortcut works on six sibling feeds via `[data-sch-search]`, which this input lacks. Two attributes; the handler needs no change | `SchemaCanvas.tsx:2012-2017` ✓ (0 hits); `sectionTabs.ts:80-88`; `SchemaView.astro:389` |
| S11-F8 | S2 | ADOPT | One facet dropdown, two control languages: checkbox leaves when workspace groups exist, `toggle` rows when they don't — the control changes shape when a second workspace appears. The Astro twin's comment forbids exactly this mixture by name; checkbox everywhere | `SchemaCanvas.tsx:2430` vs `:2447`; `FacetFilter.astro:152-155,175` |
| S12-F7 | S2 | ADOPT | Searching never opens a collapsed base, so the toolbar count rises over an empty tree — Browse's own `apply()` auto-expands on query/filter (`:870`) and the memory decision records that as settled tree behaviour. One line in `apply()` | `schemaRelationships.ts:124-127,157-159` vs `SchemaBrowse.astro:870` |
| S12-F9 | S2 | ADOPT | The one thing this tab cannot know (Airtable's API hides sync links; half the rows are guesses or hand-typed) is admitted only inside the Declare drawer — Automations ships the model: a dismissible `alert-soft alert-info` per SURFACE, with its comment recording why empty-state-only was "exactly backwards". Copy move, not new copy | `RelationshipPanel.astro:62` vs `SchemaAutomations.astro:202-212` |
| S10-F12 | S3 | ADOPT | The Tagged-cell guard reads `[data-br-tagdd]` while the markup writes `class="br-tagdd"` — the guard matches nothing, so keyboard/touch clicks on the tag count open the entity panel over the popover, against the comment stating the opposite. One character; prefer the attribute (the file's behaviour-hook convention). Recorded as a ds-lint blind spot | `SchemaBrowse.astro:91` vs `:922` ✓ (grep: exactly 2 hits) |
| S10-F13 | S3 | ADOPT | `With description` silently deletes every base and view row (both hardcode `data-desc="none"`, honestly — the model has no description for either kind) with nothing on screen saying why. Adopt the app's own precedent sentence (`DataMedia.astro:597`), shown only while the filter is active. **NOT-OURS half logged**: does Airtable expose a base description on any endpoint? | `SchemaBrowse.astro:242,311,359,788`; `schemaEntities.ts:246,289` |
| S12-F11 | S3 | ADOPT | Two tooltips on one hover: the glossary trigger carries its own `data-tip` nested inside the rich `tooltip-content` wrapper — one shared controller paints every `[data-tip]`. Drop the inner one; the `aria-label` already names the control. **Painted double-bubble UNVERIFIED** (scripted hover cannot drive `:hover`); the fix is safe regardless | `SchemaRelationships.astro:306-316` |
| S12-F12 | S3 | ADOPT | The tab's only help affordance sits inside `<th data-sort-col="3">`, so clicking the ⓘ re-sorts every base group. `stopPropagation` on the trigger or move the glossary out of the `<th>` (which D27's Flat parity needs anyway); keep the recorded column association (Oleh 2026-07-24) | `SchemaRelationships.astro:303-317` vs `tableSort.ts:54-56` |
| S15-F2 | S1 | ADOPT | The documents console's search cannot find a document: labelled and announced "Search documents", it is the schema-entity typeahead (`EntityKind` has no `doc`), it never filters the list (the published `schema:searchInput` seam has zero listeners here), and a pick opens an entity panel over the document being read — against the entry's own usageDont ("the toolbar filters the LIST"). Listen on the seam, filter `[data-dc-item]` by the `data-name` already emitted, drop the panel-opening pick, add the filtered-to-nothing card; doc-and-entity combined search is a flagged follow-up design | `SchemaDocs.astro:112,127` ✓ · grep searchInput → 0 ✓ · `schemaEntities.ts:13` ✓ · `storybook.ts:5195` |
| S14-F2 | S2 | ADOPT | The only statement of how the score is made is hover-only, behind a `cursor:help` button with **no click handler in 1,210 lines**, built on the raw `.tooltip-content` card the app replaced (no `data-tip`, hand-set `z-index:80`) — the tooltip entry's own usageDont forbids essential info in a tooltip. Methodology becomes persistent content (drawer or inline under Score breakdown); ONE rich-tooltip mechanism app-wide — promote the card into the catalog or delete both copies (shared-mechanism half rides S12-F11) | `SchemaHealth.astro:187-198,828-832` · `storybook.ts:1699` |
| S14-F3 | S2 | ADOPT | The methodology names a three-category decomposition the page cannot render — `HealthMetric` has no category field; the `.hl-comp*` grid that once drew it is dead CSS. Add `category` + a row-group label (the spec's own ask, `specs/10-schema.md:94-95`), or rewrite the sentence to describe the flat weighted catalog — and delete the dead block either way | `SchemaHealth.astro:189-194,295-331,708-713` |
| S14-F4 | S2 | ADOPT | The base rail — the surface's only navigation — wears half the row contract: `.row-go` without `.row-clickable` (no hover, no focus ring), under a CSS comment claiming the class is inherited; and the chevron promises depth on a `role="tab"` that swaps a pane in place. Add the class, delete the stale comment, then decide the chevron (tabs → drop `.row-go`) | `SchemaHealth.astro:228,231,683` · `row-actions.css:5-24` |
| S14-F6 | S2 | ADOPT | `/` does nothing on Health — the one search of six outside the shared contract (no `data-sch-search`, no kbd hint, `type="text"`). Two attributes + the hint; and the lead records the D-level note: six-of-eight hand-carried hooks argue for a `SectionSearch` wrapper that makes the next tab correct by construction | `SchemaHealth.astro:207-210` · `sectionTabs.ts:80-88` |
| S14-F7 | S3 | ADOPT | The two catalog primitives that name this exact surface are re-implemented by hand: the bars where `ProgressBar` ships (like-for-like swap), and the ring the `radial-progress` entry cites as its own example ("the future Health Score"). Keep the ring only with a `health-ring` entry stating why it is not `radial-progress` and that it is the ONE ring in the app — and amend `radial-progress` to stop advertising a use it does not serve | `SchemaHealth.astro:141,269-273,305` · `storybook.ts:1601-1610,1759-1766` |
| S14-F8 | S3 | ADOPT | A private single-select sort menu and TWO private segmented controls in one file, for jobs the section has one component each for — the sub-switcher's comment names the pattern it is not using. Sort → `FacetFilter single labelTrigger`; extract `pattern-segmented-control` into a real shared component and route both copies through it (the ui-consistency-backlog's "unshared → extract INTO the DS" head item) | `SchemaHealth.astro:211-221,869-875,924-927` · `SchemaChangelog.astro:184-187` |
| S14-F9 | S3 | ADOPT | One idea, two staleness treatments: stale *insights* get a visible soft-warning alert + Re-run; the stale *score* — on the heaviest metric — is a text suffix inside a collapsed row, three clicks deep, with nothing at the ring. Hoist score staleness to base level with the same alert + a clock mark on collapsed rows | `SchemaHealth.astro:327,436-441,553` · `schema-lab.ts:519` |
| S14-F10 | S3 | DEFER | The metric row is the exact `div role="button"` + hand-wired keydown D10 deleted from the sibling — here for a real, unwritten forcing reason: a `<button>` cannot contain the label-wrapped toggle. Write the reason beside `:301` and into the catalog now so nobody "fixes" it into a broken button; the restructure (button region + sibling toggle) is deferred. **Trigger: the toggle moves out of the row, or a keyboard-accessibility pass** | `SchemaHealth.astro:301,308,969-973` · `SchemaChangelog.astro:222-224,486-488` |
| S14-F11 | S3 | ADOPT | Two `aria-modal` drawers slide from the same edge as the section's one panel host and can be open over each other — on the section whose law is one stack; four Schema tabs now run a Drawer beside PanelHost. ADOPT the mutual close now (opening either closes the other, exactly as `app:tabchange` already does); whether a prompt editor is a Drawer at all or an EntityPanel edit mode is deferred in-row — trigger: a fifth Drawer beside a PanelHost | `SchemaHealth.astro:496,573` · `SchemaView.astro:286` · `sectionTabs.ts:60-61` |
| S15-F6 + S16-F9 (merged) | S2 | ADOPT | The Knowledge cluster is the only place in the product that opens OS dialogs: `window.prompt` twice for add-link (no safe cancel of the second prompt; a link once added can be neither edited nor removed while the tag row one section above has a hover ✕) and once for rename-chat — while the correct control (`chat-convert-pop` / the `+ Add tag` swap-in) exists in the same files. One recipe, three sites, one PR; `.dc-linkrow` gains the ✕ | `SchemaDocs.astro:831-835,694-699` ✓ (grep `window.prompt` → 3 hits total) · `schemaChat.ts:98-106` · `SchemaChat.astro:200-210` |
| S15-F10 | S3 | ADOPT | The reading surface's controls are keyboard-unreachable and its empty title is the banned shape: tag rows are `<span cursor:pointer>` (D10: a row that opens something is a button), the two popovers carry `aria-selected` on role-less `<div>`s, the Edit/Read join announces nothing (fifth S10-F9 instance — fold into that fix), and `No documents yet` is the "Nothing here!" the entry forbids (title lands in D17's copy sweep) | `SchemaDocs.astro:660,921,938,1049,1060,98` |

### D17 — One empty-state model (interim; X04 completes)

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J05-F14 | S3 | ADOPT | Two empty models for one condition — Data's page-level degrade + exit is the reference; Schema keeps chrome, offers nothing | shots `J05-08` / `J05-09`; spec asks for Data's model |
| J07-F14 | S2 | ADOPT | Both Reports empty states internally contradictory; one describes a state the model says cannot occur | `ReportsView.astro:193-199`; `types.ts:290` ✓ |
| J08-F17 | S3 | ADOPT | Empty state duplicates the page's primary — two identical `Add source` primaries at once | `SourcesView.astro:39,63`; same on Destinations |
| S06-F10 + S07-F2 + S08-F2 + S09-F3 (merged) | S2 | ADOPT | **Four tab-level "nothing here" anatomies inside ONE section**: bare `.dg-empty` (centred icon at 40% + a sentence, error state reuses it) · `.cl-empty` (dashed 13.6px, `base-100`+border tile, 48ch) · `.md-empty` (no frame at all, `base-200` tile, 56ch) · `.dc-empty` (dashed 14px — a hand-typed copy of `.cl-empty` differing by 0.4px), plus `LockedTab` at 14px rendering in the same slot. The lead settles the fork D17 was waiting on: **one shared `.tab-empty`** — framed dashed card (the catalog's own example markup; makes Attachments the single frame fix), `base-200` tile with **no border** (catalog + 2 of 4), title 16/650, one mechanism sentence capped **48ch** (amend the entry's "~44ch" — three of four already sit at 48, and `.md-empty`'s 46-word sentence shortens with it), radius = the 12px card token (D23). `.dc-empty*`/`.dc-nomatch` deleted for the shared classes, exactly as Comments already does | `DataBrowse.astro:243-247,523` · `global.css:2727-2735` ✓ · `DataMedia.astro:597-601,758-762` ✓ · `DataChangelog.astro:352,502` ✓ · `LockedTab.astro:24` ✓ |
| S12-F8 | S2 | ADOPT | The Relationships empty state offers no way to fill it: `Declare a synced table` — the tab's only creation path — lives inside the `hasRel` branch, so the one state where declaring is the only useful action cannot reach it. The entry's own "header CTA yields to the empty state" clause + the Automations precedent; the `[data-rl-new-synced]` wiring makes an empty-state copy free | `SchemaRelationships.astro:228,262,368-375` vs `SchemaAutomations.astro:165-169`; `storybook.ts:3745` |
| S10-F10 | S3 | ADOPT | Browse's filtered-to-nothing card is a hand-typed near-copy of the shared `.cl-nomatch` the sibling tab uses; Relationships holds a third copy (`.rl-nomatch`). Delete `.br-empty`'s CSS, adopt `cl-nomatch`, sweep `.rl-nomatch` in the same edit — the section lands on one card. The wider `.md-nomatch` reconciliation stays with D17's owner | `SchemaBrowse.astro:438-442,717-719` vs `global.css:2784-2785` + `SchemaChangelog.astro:286` |
| S18-F11 | S3 | ADOPT | The filtered-to-nothing state is a bare grey sentence with no exit — the thinnest of the section's hand-rolled copies, on a surface with five simultaneous filters. Reuse the family card + `Clear filters` wired to the existing `[data-if-clear]`; lands in S10-F10's sweep (fourth copy), and `.au-nomatch` (S17-F8's clear half) in the same edit | `SchemaInterfaces.astro:259,391` · `schemaInterfaces.ts:123-130` |

**S14–S18 instances into this decision (no new rows):** the section's empty-state census grows by
ten vessels — `.sch-soon` (Health, dashed box; copy stays per S14 what-is-good), `.dc-empty`
(Docs — dashed, banned "No documents yet" title per S15-F10), `.chat-empty` / `.chat-greet` /
`.chat-gate` / `.scd-newempty` (Chat/Ask, four families on one surface), `.au-empty` / `.au-gate`
/ `.if-empty` / `.if-gate` (the register twins) — all absorbed by D17's one `.tab-empty` when the
sweep runs.

### D18 — Single-operator V1

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J08-F1 | S1 | ADOPT | No second user exists; four copy strings promise invites/members/teammates; `isAdmin` has no production source (`config.ts` drops `membership.role`). **Ruling 4: single-operator V1 — copy and half-model out; multi-user DEFERred, trigger: Dan states multi-user is V1** | `lib/config.ts:118-128` ✓, `lib/account.ts:60-98` ✓, `SettingsView.astro:48-49,77,81-82` ✓ |
| J08-F11 | S2 | ADOPT | Locked row deletes its own description; non-admin state near-identical to not-built state | `SettingsView.astro:228-236` ✓ |

### D19 — One status and verb vocabulary (interim; X08/X13 complete)

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F13 | S2 | ADOPT | Three verbs for one act in one drawer family ("Connect" / "Test & create" / "Save destination") — instances: J08's `Test & create` that tests nothing | J01 §8 |
| J01-F14 | S2 | ADOPT | `badge-error` = "Required" while error red means Failed everywhere. **Merged: J08-F18** (`DestinationAddView.astro:54`) | `IntegrationsSetupWizard.astro:236,399` |
| J01-F17 | S3 | ADOPT | "the terms and privacy policy" is not a link | `WelcomeView.astro:94` |
| J01-F20 | S3 | ADOPT | Review names a count, not the bases, before an irreversible run | `:344,692` |
| J03-F8 | S2 | ADOPT | `Reconnect` — the repair verb — rendered as a status badge; same state named three ways | `SourcesView.astro:22,83` |
| J03-F13 | S3 | ADOPT | `Last backup: failed` — a status in a time column, duplicating the Status cell | `SourceDetailView.astro:104` |
| J06-F10a | S3 | ACCEPT | Exception-only status column (blank = Active) — deliberate, argued in-file; **record in catalog** (ruling 1) | `DataComments.astro:357-381` |
| J06-F10b | S2 | ADOPT | One state, three names ("In the last capture" / "Active" / nothing) → founder's words Active / Deleted / Record deleted everywhere | `DataComments.astro:184-195` |
| J06-F13b | — | — | (see D11 row J06-F13 — vocabulary half lands here) | — |
| S08-F1 | S2 | ADOPT | One fact — the date Baseout captured a file — carries **five names** on one tab and its panel, two of them the same column one toggle apart: `In backup` (flat `<th>`) vs `Captured` (group card), against the file's own declared contract three lines above the code that breaks it ("Same labels, same sort keys"); the rename (`2f3298d`) touched one of two render sites. Pick one string (the panel's qualified `Captured by Baseout` already answered J06-F14, or `In backup on`), give `GTHEAD` and the flat `<thead>` a **shared label source**, and reach `refineFacetIcons.ts:58` with it | `DataMedia.astro:428` ✓ vs `:1324` ✓; `refineFacetIcons.ts:58` ✓; `mediaReadBody.ts:168` ✓; `:270`; `:385` |
| S12-F5 | S2 | ADOPT | Two toolbar controls govern one fact: `Validity` (Valid/Invalid) and `History` (Active/Removed only/All) both act on `validity === 'invalid'`, and their legitimate default combination (Invalid + Active) returns zero rows with no conflict shown; a third control, the `Status` facet, is named for the column showing all three words. Collapse to the Automations tri-state (delete the Validity facet — `Invalid` and `Removed only` are one set), then un-collide the word `Status` | `schemaRelationships.ts:81-92`; `SchemaRelationships.astro:159,241-250` vs `SchemaAutomations.astro:186-190` |
| S12-F10 | S2 | ADOPT | Direction is an unexplained glyph that contradicts itself: `→`/`↔` is the only carrier of direction (row, panel, export), the otherwise-complete glossary never explains it, and one relationship kind gets two glyphs by provenance — the inferred synced view is `direction:'two'` (`↔`) while a hand-declared synced table is hardcoded `'one'` (`→`) against the form's own one-way labels. One glossary line + one direction per kind (**NOT-OURS**: which is right for a sync — that they must agree is ours) + direction in words in the detail meta. J05-F6 owns the capability half, untouched | `SchemaRelationships.astro:90,308-314`; `schemaRelationships.ts:447`; `schema-lab.ts:694,779-784` |
| S14-F14 | S2 | ADOPT | One score, two colour vocabularies: Health prints `Yellow` in five places while Reports prints `Amber` for the same number and the type under both is `'amber'`. Keep **Amber** everywhere; the pair enters D19's state-word table; two of the five sites are greppable only by name (`SchemaView.astro:258`, the file header) | `SchemaHealth.astro:96,120,195,5` · `ReportBodyKpi.astro:79,268` |
| S14-F16 | S3 | ADOPT | The band sentences defend the product instead of grading the base — "Nothing is broken by us." is the file's only first person, Red reads softer than the spec's own Amber example, and "Your records are safe" appears on Amber only. Rewrite to grade like the severity ladder above them; the reassurance moves once into the methodology (S14-F2's persistent home) | `SchemaHealth.astro:119-121` · `specs/10-schema.md:146` |
| S17-F7 | S2 | ADOPT | `Removed` is amber in the list and red in the panel — the catalog names amber as correct and the panel's own `.au-dot-amber` sits unused for the state. One word (`tone = 'amber'`), Interfaces twin checked in the same pass | `SchemaAutomations.astro:133,451-455` · `schemaReadBody.ts:323-327` · `storybook.ts:5025` |

### D20 — Stale intent and dead surfaces

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F7 | S2 | RATIFY | Catalog stepper entry documents a step order the product doesn't have — fix the entry | `storybook.ts` `pattern-setup-stepper` description ✓ ("Source → Destination → Bases → Depth → Schedule") |
| J01-F10 | S2 | ADOPT | `/integrations/configure/bases` — second base-picker whose "Done" discards the selection; delete or wire with `&step=bases` | `IntegrationsManageBasesView.astro:22` |
| J01-F11 | S2 | ADOPT | `/integrations` 302s dropping the query; four live `apps/web` links still target it; `specs/07` describes a hub that no longer exists | `IntegrationsConfigureView.astro:45,162,163,281` |
| J01-F12 | S2 | DEFER | OAuth consent hand-off has no designed surface. **Trigger: real OAuth wiring — design first** | J01 §3 |
| J05-F15 | S3 | ADOPT | `/data` — the deepest section — has no spec file and is absent from the spec index; write `specs/16-data.md` from the shipped surface | `ls specs/` ✓ |
| J07-F20 | S3 | ADOPT | A v2 run names a deleted v1 schedule object; v1 type family still alive | `fixtures/reports.ts:59` ✓; `types.ts:170-215` |
| J07-F21 | S3 | ADOPT | `specs/11-reports.md` describes a different product; its two still-binding demands (CSV, timezone) are violated — rewrite, answering both | spot-verified |
| J07-F23 | S4 | RATIFY | `pattern-report-schedule` documents a Reports surface that no longer exists — rewrite or delete; keep the next-run-preview usageDo | `storybook.ts:2429` ✓ |
| J08-F14 | S2 | ADOPT | `/profile` assembled in the harness — cannot ship; no `h1`; duplicates Settings ▸ Account with a different value. Port now; **merge decision DEFERred inside this row — trigger: Dan answers `specs/12` Option A/B/C** | no `ProfileView.astro` in `apps/web` ✓ |
| J08-F19 | S3 | DEFER | `/help` is a 12-line placeholder behind a first-class nav item. **Trigger: pre-production — build the spec's four blocks (diagnostic card first) or pull the nav item** | `PlaceholderView.astro:11` |
| J08-F23 | S3 | ADOPT | Profile is the only surface on the `icon-*` family and only one without an `h1` — fix with the F14 port; icon sweep → D21 | 24 `icon-*` vs 831 `size-*` |
| J08-F24 | S3 | DEFER | Account-group model (Sources/Destinations as account objects) has no client-stated job. **Trigger: client confirms `decision-account-destinations`** | `specs/` census |
| S06-F11 | S3 | ADOPT | The only intent doc `/data` has (`openspec/changes/data-page/`) contradicts the shipped grid in three named requirements — cursor-only "Load more" paging (shipped: `TablePager`, reversal recorded in the catalog with name and date), removable filter chips (shipped: a condition tree), cross-base search (shipped: in-table, deferred in a source comment) — and the client's engineer reads that spec. Fold into J05-F15's ruling: whoever writes `specs/16-data.md` amends or retires these three | spec text vs `DataBrowse.astro:240,126-140`; `pattern-data-grid` pagination note (`storybook.ts:3913`) |
| S06-F14 | S3 | RATIFY | *(lead-filed from S06 §4)* Two catalog entries answer one toolbar row differently: `pattern-toolbar` reserves primary for "the main CTA only" while `pattern-data-views` sanctions the solid-primary Save preset in that same row. The app follows a documented entry either way — the conflict is the catalog's. Amend `pattern-toolbar` to name the exception: a Save/Discard pair is a **save contract**, not a "toolbar action button" | `storybook.ts:5276` ✓ vs `:3986` ✓ |
| S07-F5 | S3 | RATIFY | Comments' `column-gap: 24px` triples the family's settled 8px — argued soundly in-file (nine tracks of 12px text read as one run at 8px) and never written into the catalog, so the next reviewer will "fix" it back. Amend `pattern-changelog-timeline`'s seven-jobs table to license a surface-justified gap, citing the in-file argument | `DataComments.astro:575` ✓ vs `global.css:2571-2572` ✓ |
| S07-F6 | S3 | RATIFY | The author initials chip (24px neutral fill, weight 650) is a second treatment of `Avatar`'s soft-primary initials — and the better one at this density: 20 tinted plates down a feed would read as interactive. Record a neutral dense-row initials variant in the `avatar` entry (which already blesses this surface's no-photo decision); do NOT swap the component in | `DataComments.astro:618` ✓ vs `Avatar.astro:36-38` ✓ |
| S08-F5 | S3 | RATIFY | The catalog's own worked examples draw the media format chip `badge-soft` six times, inside the two entries whose rules and shipped code say **solid** — with the 1.3:1 contrast failure recorded in the same entry's usageDont. Delete `badge-soft` from the six example strings; zero app change, and `/styleguide` stops teaching the unreadable version | `storybook.ts:4456,4460,4514,4519,4524,4529` ✓ vs `mediaFormat.ts:229` ✓ |
| S08-F6 | S3 | RATIFY | The Attachments **listing** — the default projection — has no catalog entry; its rules live inside `pattern-media-gallery`, the entry for the alternative projection, which also carries the section's seven-clause retrieval contract and opens with a warning that it is not where its reader would look. Split: the retrieval contract into its own entry, a listing entry for `.md-*`, the gallery entry keeping the gallery. **Sequence after S08-F1/F3/F4 land**, so the entry describes the converged surface | `grep -n DataMedia storybook.ts` → 2 reference-string hits ✓ |
| S09-F6 | S3 | RATIFY | `pattern-data-changelog` contradicts the shipped code in three places — "day title" vs the shipped run-id panel title, "50/page" (twice) vs `DCP_DEFAULT_PAGE_SIZE = 25`, "open the record panel" vs the shipped in-place drill — inside the entry whose own opening paragraph warns this exact drift built the last divergence. The code is right all three times; fix the prose | `runReadBody.ts:85` ✓ (`title: run.runId`); `DataChangelog.astro:680` ✓; `storybook.ts:4387,4393` ✓ |
| S10-F11 | S3 | RATIFY | `pattern-deleted-items` documents a control the product replaced — "a single neutral checkbox Include deleted + count badge" vs the shipped tri-state `Status` facet — while its sibling entry `pattern-view-details` records the replacement, so the two entries disagree and one disagrees with the code. Fix the entry (reveal = the tri-state governing three kinds); leave every `unknown` clause alone — the code follows those exactly | `storybook.ts:4567` vs `:4622` vs `SchemaBrowse.astro:203-209` ✓ |
| S10-F14 | S3 | ADOPT | `specs/10-schema.md` describes a page that no longer exists: "currently a placeholder", three tabs with Visualize default vs eight tabs with Browse landing, no Browse/Relationships/Docs/Chat/Automations/Interfaces anywhere, and a "Material Symbols + Lucide" instruction CLAUDE.md forbids. Rewrite from the shipped section; carry the honoured Airtable-iconography demand forward verbatim. **One spec-refresh act with J07-F21 + J05-F15** — same author, same PR | `specs/10-schema.md:3-13,47-52,170-174` vs `SchemaView.astro:185-218` |
| S12-F15 | S3 | RATIFY | `pattern-schema-relationships` describes a screen that no longer exists in six particulars; the code is right on four (tri-state History, the DECLARE verb, Type-as-a-column, the status badge) — fix the entry; its two correct clauses the code has not done route to D26 (no bespoke sidebar; EntitySearch pickers). Delete the dead `.rl-typegroup` rules + the `apply()` loop walking them. **Recorded: the tab has no `specs/` section at all** — a write path with an inference model and a Confirm/Dismiss contract has no intent doc (folds into the S10-F14/J07-F21 spec act) | `storybook.ts:4915-4943` ✓ vs code; dead rules `SchemaRelationships.astro:409-415` + `schemaRelationships.ts:120-123` |
| S13-F5 | S3 | RATIFY | The catalog still mandates the zone note Oleh deliberately deleted from five reading surfaces (`9fd6598`: US-only, times are the reader's own; it survives only in the schedule editor where it changes what a person types) — and `SchemaView.astro:140` keeps the comment pointing at nothing. Amend `pattern-time` + `pattern-changelog-timeline`, delete the orphan comment, check the other four surfaces for the same orphan. Lead-verified: `ZoneNote` renders only in `BackupScheduleScope.astro:77` | `storybook.ts:3686,3695,4321` vs `9fd6598`; `SchemaView.astro:139-140` ✓ |
| S14-F15 | S3 | ADOPT | Every issue prints twice on one screen in two vocabularies — a finding inside its metric AND a row in the Issues table, count in-sentence vs in-column, two `Open in Airtable` controls — where the spec describes ONE list inside the decomposition. The S10-F14 spec-refresh act picks the shape (findings-are-the-list, or two declared jobs); ADOPT now: one count format, one Airtable-exit control | `SchemaHealth.astro:310-319,382-390` · `specs/10-schema.md:97-101` · fixture twins `schema-lab.ts:516-527` |
| S14-F17 | S3 | RATIFY | `global.css:134` still names Health as `--rail-l`'s reason to exist; Health deliberately uses `--rail-m` with the reason and author in-file. Re-document `--rail-l` by its surviving consumers (grep first — delete the token if none), list Health under `--rail-m` — S13-F5's class, one line | `global.css:134,142-143` · `SchemaHealth.astro:664-665` |
| S16-F13 | S3 | RATIFY | `pattern-schema-chat` is wrong in four particulars and the correction runs both ways: "reused EntitySearch" and "sender by label / no bubble decoration" are the catalog being **right and unheeded** — the code moves to them (D31); the "green" doc card and "last tab" are stale — the prose moves (a neutral card is right; semantic colour is for status). The entry is corrected saying which is which | `storybook.ts:5125-5139` · `SchemaChat.astro:392` |

### D21 — Phase-2 debt track (the one DEFER for unit debt)

**Trigger for the whole track: Phase 2 opens, or any file listed is touched for another reason.**
`ds-audit` red (exit 1, "295 issue(s) across 193 file(s)", 2026-08-07) is **one item on this track**
— a rem-fraction codemod with a visual diff, not 295 register rows.
**Update 2026-08-12:** that codemod has largely happened (`ed8b03b`); `ds-audit` now reads **6
issue(s) across 207 file(s)** (exit 1) — six unsized `btn` variants in five files. The weights/radii
remainder moved to **D23**.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| J01-F27 | S4 | DEFER | `RunBackupNowModal` rendered with no opener on unconfigured Home | `SpaceHomeView.astro:322` |
| J01-F28 | S4 | DEFER | Breadcrumbs computed for a 302'd path, rendered nowhere | harness routes |
| J02-F15 | S4 | DEFER | Third status vocabulary in `lib/backups/format.ts`, consumer is a dead view | trigger: real endpoint wiring or the orphan-views pass |
| J03-F17 | S3 | DEFER | Sources/Destinations pushed out of the nav scroller at short viewports. Trigger: any sidebar work | measured; partly harness |
| J04-F16 | S4 | DEFER | Restore's bespoke spacing entirely off the 4px grid (rem fractions) | measured computed values |
| J05-F16 | S3 | DEFER | Visualize has no change/diff state. Trigger: first client ask, or `SchemaCanvas` mode work. Cheap interim noted: highlight a changelog row's entity | `SchemaCanvas.tsx:1834-1842` |
| J05-F19 | S4 | DEFER | Cross-changelog shape divergences invisible to both gates. Trigger: the D10 consolidation | — |
| J06-F15 | S4 | DEFER | Attachments table clears its container by 2px, held by four hand-tuned caps. Trigger: **any** column/panel width change → re-derive with `minmax()` floors per D15 | `DataMedia.astro:678-686` |
| J07-F22 | S4 | DEFER | Dead v1 report code and orphan fixtures | `view2.ts:48`, `types.ts:170-215` |
| J08-F22 | S4 | DEFER | `.src-*`/`.dst-*` byte-identical CSS duplicated ×4; rem-fraction family. Trigger: the D12 unification collapses both | measured |
| — | S4 | DEFER | The eight orphan views (CLAUDE.md census) — delete-vs-revive pass | `IntegrationsView.*`, `DashboardView`, etc. |
| S06-F12 | S4 | DEFER | The preset lock sentence is written twice by hand (frontmatter + client script) with a comment admitting nothing keeps them in sync; the `/` shortcut is wired twice (shared handler + a local `document` keydown). **Trigger: any edit to the lock sentence, or this track opening** | `DataBrowse.astro:57,666-668` ✓; `DataView.astro:355` + `DataBrowse.astro:1553-1559` |

### D22 — One scroll model and one narrow form for every listing

Rule and full argument in `audit/decisions/22-one-scroll-model-one-narrow-form.md`. Two of four
members landed while this adjudication was being compiled; both fixes lead-verified in source.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S06-F3 | S2 | ADOPT | Two scroll models in one section: Records and Attachments scroll in a bounded sticky-header box, Comments and the Data Changelog scroll the page — so `global.css:2587`'s sticky-header rule can never fire on the one Data feed that renders its class, and `DataBrowse.astro:478-487` asserts at length the opposite of what line 229 ships. Rule it once for the section (the scrollport, per `pattern-data-grid`'s "page-wide decision" usageDont), then delete the stale comment | `data-grid-fit` adopters re-censused 2026-08-12 ✓: Browse, Media, 3× Schema — not Comments (`DataComments.astro:277`) nor Data Changelog (`DataChangelog.astro:162`) |
| S07-F1 | S1↑ | ADOPT — **landed `ed8b03b`** | Comments had no narrow form and four zero-floor tracks: measured at 1280 the COMMENT track — the column the tab is named for — rendered **5px** against 78px of content and STATUS clipped; at 500, five of nine tracks were destroyed (LOCATION/RECORD/AUTHOR ~6px, COMMENT **0**) with no sideways scroll — content silently gone. Raised S2→S1 (ruling 1 above; J05-F3 precedent). Fix verified in source: `data-narrow-pan` on the feed, the four `minmax(0,…)` tracks refloored, a `.cm` narrow track set | `DataComments.astro:277,587` ✓ (post-fix; in-file comment cites "audit S07-F1, 2026-08-12"); orchestrator geometry 2026-08-12 closes the NEEDS-MEASUREMENT |
| S08-F4 | S2 | ADOPT | The `data-narrow-pan` sweep (2026-08-11 + the two fixes above) has now reached four Schema containers, Comments and the Data Changelog — **Attachments is the last listing without a narrow form**; its two widest columns are shrink-caps and every cell is `nowrap`, and at 1280 the frame already scrolls inside itself (see S08-F3's measurement). Add the attribute to `.md-listwrap` with real floors; check `.md-gallery` separately (the `#layout-content` display hazard the rule itself flags) | `.md-listwrap` carries `data-grid-fit` only ✓ (`DataMedia.astro:399`); narrow-pan census 2026-08-12 ✓ |
| S09-F1 | S2 | ADOPT — **landed `c0aab03`** | Below 1280 the run list kept its desktop tracks including a zero-floor ATTENTION track: measured at 500 pre-fix — ATTENTION **0px**, row 64px, **6** descendants painting past their own cells. Fix verified: narrow template (ATTENTION → 96px, row → 40px, escapes → 0) + `data-narrow-pan` on the frame | `DataChangelog.astro:162,306,325` ✓ (post-fix); orchestrator geometry 2026-08-12 |
| M1 (lead-filed) | S2 | ADOPT | **The Schema section has no single scroll model, and it changes with width** — measured at 1440: Browse and Relationships inner-scroll only, Visualize page-scrolls only, Changelog does **both** (a feed hiding 1226px of itself inside a page that also scrolls); at 540 all four converge on inner-scroll, so the model a user learns at one width is not the one they get at another. **This is D22 unfinished, not a new decision** — the rule already says "a section picks ONE". Apply it to Schema; Visualize is the one argued ACCEPT inside the rule (a zoom/pan canvas is not a listing), recorded in the decision doc, not by silence | `S10-S13-measurements.md` M1 table, measured 2026-08-12 |
| S10-F7 | S2 | ADOPT | Browse re-typed the shared narrow-scroller's four declarations locally and carries no `data-narrow-pan` — so the section's DEFAULT tab and a charter reference surface is the only Schema listing with no top rail (**measured M2**: `hasPanAttr: false`, 166px sideways pan at 540, 0 rails vs one each on its neighbours) — while `global.css:1027` credits this very file as the source of the mechanism. Add the attribute, **delete** the local copies (Astro scoping out-specifies the shared block), and check the rail against the sticky `.br-fhead` + `gridFit` together | `SchemaBrowse.astro:580,598,619,230,389` ✓ vs `global.css:1068-1074`; `panRail.ts:112`; M2 measured 2026-08-12 |
| S13-F1 | S2 | ADOPT | The timeline rail is an absolutely-positioned pseudo of the box that became its own scrollport — **measured: 369px of rail against 1595px of content, 77% of the feed railless**, day rings hanging on nothing at max scroll, the bottom fade landing mid-list. Draw the rail on the in-flow day sections (Comments already solved this exact case with `content:none` + a per-card rail); sticky is not equivalent (one screen of line that never ends is a different lie). **Sequenced BEFORE D22 item 2**, which would spread the cause to two more feeds | `global.css:2598-2604` vs `gridFit.ts:38-40`; `DataComments.astro:699-720`; measured 2026-08-12 |
| S14-F13 | S3 | ADOPT | Health is the only Schema tab with no narrow form for the CONTAINER: a two-pane console with a 280px sticky rail held to an 860px *viewport* query, while its own metric grid already asks the container and writes down why ("split view halves .sch while the viewport stays 1440"). Apply the same `@container` upward to the console grid; also the section's **fourth** scroll model (`calc(100dvh - 13rem)` sticky rail — M1 instance) | `SchemaHealth.astro:665,679,929-935,756-764` |
| S15-F9 | S2 | ADOPT | One console, two authorities on its own width: list-sheet mode is decided from the section column (`listSheet.ts`, whose comment names the viewport rule as the defect it replaced) while the doc grid stacks on `@media (max-width:1279.98px)` forty lines above. Move the stacking onto the column measure `listSheet` already computes (publish the derived 667px floor as a class). **UNVERIFIED at panel widths (U1)** — held S2: split view is a persisted narrower that reflows; if a browser pass shows `.dc-main` never crossing the 377px prose floor, the scout's own DEFER alternative is accepted | `SchemaDocs.astro:411-420,777` · `listSheet.ts:29-60` |
| S16-F8 | S2 | ADOPT | Chat and Docs are declared one console language and stop being full-height 520px apart (760 vs 1279.98) while the rail's sheet mode is decided by the shared column measure — two conditions that can disagree. Make "the rail is a sheet" and "the console is not full-height" ONE condition: `height:auto` on `is-list-overlay`, delete the raw 760px query. **UNMEASURED in the 760–1280 band** — demote to S3 if nothing visible breaks (scout's own condition); the divergence stands either way | `SchemaChat.astro:309,458-462,475-491` · `SchemaDocs.astro:306-307` · `storybook.ts:5180` |

(J06-F9's surviving third — the feed loses its header on scroll — closes with S06-F3's ruling.)

### D23 — Foundations: weights and radii (interim; completes when S01/S04/S05 are adjudicated)

Rule and full argument in `audit/decisions/23-foundations-weights-and-radii.md`. The type-size and
spacing halves of the old foundations complaint are **already clean** on all four Data surfaces —
say so and keep it so; what remains app-wide is weights and radii.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S06-F13 | S3 | ADOPT | Weights `500·550·600·650·700` (two undefined by any token) and **nine** hardcoded radii (`2·5·6·7·8·10·11·12·999px`) in one component, the 11px frame sitting one px off its own catalog entry — while every type size is a `--t-*` token and every spacing value is on the 4px grid. One codemod per axis when the S01/S04/S05 census completes; the 11px and the 13.6/14px pair are fixed sooner by D15/D17 anyway. **Recorded instances (no rows):** S07 §10 (650 ×3 shared classes), S08 §10 (560/650/740 shared; the 12px cluster as evidence FOR a 12px card token), S09 §10 (550/650; six radii, two 0.4px apart) | `DataBrowse.astro` census in S06 §10 ✓ (spot-checked); `ds-audit` 6/207 (2026-08-12) — the type half of the old 295 landed in `ed8b03b` |

**S10–S13 instances (recorded, no rows):** Browse — five radii, clean weights, everything else on
grid/tokens (S10 §10); Visualize — six weights, eight radii, ~12 off-grid spacing values, all in
JSX inline styles both gates are blind to (S11 §10 · the sub-floor sixteen are ADOPTed under D16);
Relationships — five weights, nine radii (S12 §10); Schema Changelog — 550/650 + the 12.8/13.6 pair
(S13 §10). Plus **Q1** (see Still open): badges paint 11px on all four tabs — the `--t-*` ladder
has an 11 rung, `interface-rules` says the floor is SM/12px; the two rules disagree and D23 settles
it once.

### D24 — One export contract: the count is the view, true in every projection

Rule and full argument in `audit/decisions/24-one-export-contract.md`.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S10-F2 | S1 | ADOPT | Browse's Export counts rows with a selector matching only the Tree projection — in Flat mode a full 386-row table reads `0 entities` / `Nothing to export`, button disabled, "No entities match the current filter." over visible rows; in Tree mode it counts the rendered chunk (a 340-field table contributes 25). Every other `ExportControl` caller passes a hook matching all its rows; the `data-export-livecount` seam is documented in the component and never set here. One hook on both row classes + livecount from `apply()` | `SchemaBrowse.astro:217` ✓ (`rowSelector=".br-row"`) vs `:402` ✓ (`br-trow`); `ExportControl.astro:245-253` ✓ |
| S11-F1 | S1 | ADOPT | Visualize's hand-built export offers the retired `Current view / Everything` radios and prints the **same number on both** (one `nodeCount` prop feeds both spans), while counting base-container boxes as content — against the entry's verifiability clause and the 2026-07-15 retirement the shared component implements. Delete the radios, render the shared one-line note, count content nodes only | `SchemaCanvas.tsx:286-295` ✓ · `:2194` · `:1094` vs `ExportControl.astro:126-129` ✓ |
| S12-F13 | S3 | ADOPT | Relationships' export reports the pager's window, not the match — Flat reads "25 relationships" under a toolbar count reading the true number; Tree reports the full set, so the count differs by display mode. Publish `data-export-livecount` from `apply()` — one line, the number is already computed | `SchemaRelationships.astro:258`; `ExportControl.astro:250-253`; `schemaRelationships.ts:112-118` |
| S13-F4 | S3 | ADOPT | The two changelog halves ship two export dialogs: the Data half passes `changeScope`, resurrecting the "All changes" scope the written contract retired and re-implementing a Change-type filter its own toolbar has; the Schema half matches the contract. Data drops `changeScope`, gains a `rowSelector`; if `changeScope` survives for a reason not in source, that reason goes into `pattern-export-control` | `DataChangelog.astro:145` vs `SchemaChangelog.astro:195`; `ExportControl.astro:103-130` ✓ |
| S14-F5 | S2 | ADOPT | Filtering the base rail never changes which base you are reading — the active row can be filtered out while its report stays — and the export counts the filtered rail ("1 base") for a screen showing one report. Selection follows the filter (first visible row); `.hl-master-empty` gains Clear; and the referent is ruled: a Health PDF is the open base's report (`total={1}`, `noun="report"`) or explicitly every base — never the rail count | `SchemaHealth.astro:1053-1062,947-955,201` · `ExportControl.astro:253` |
| S15-F8 | S3 | ADOPT | On a just-created document the export reads "Exports this document — 0 documents" and disables itself (`newDoc` clears `dc-active`; the row selector counts nothing) while the bar's trash silently no-ops in the same state. Publish `data-export-livecount` from openDoc/newDoc — folds into D24's livecount contract; the third proof the selector approach is the wrong contract | `SchemaDocs.astro:163,711-714,741,827` · `ExportControl.astro:245-254,299` |
| S18-F4 | S2 | ADOPT | One word, three numbers: the base head counts active *parents*, the pager counts *nodes*, the export counts interfaces **and pages** — and folding a group (a reading gesture, not a filter) silently drops its rows from the export via the `offsetParent` count. Collapse never changes export scope (`data-export-livecount` from the tab's true logical count); the three-nouns half takes ONE section answer with S12-F13. In-row twin instances: Automations' collapsed groups + pager window (S17), Chat's `.chat-trow` counting archived rail rows against its own comment (S16) | `SchemaInterfaces.astro:189,211,349,376` · `schemaInterfaces.ts:100-108` |

### D25 — Visualize: legible by default, honest when empty

Rule and full argument in `audit/decisions/25-visualize-legible-and-honest.md`. This is the
flagship-surface convergence: 13 rows, one decision, and the catalog entry (S11-F11) lands first
or the fixes are unreviewable.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S11-F7 | S1↑ | ADOPT | **The default landing fit paints 16px node titles at 2.59px** (measured: scale 0.162 at 1440 on the default fixture; 2.61 at `?fixture=thin`; panel open/closed irrelevant) — Oleh's «Visualize зовсім не готова», reproduced: not blank, unreadable. The narrow branch derived the fix (12/16 = 0.75 floor) and the wide branch was set to 0.05 to fix position. One line: `minZoom: 0.75` in the wide `fitViewOptions`; overflow pans; component `minZoom` 0.2 stays. Raised S2→S1 (blocks the job) | `SchemaCanvas.tsx:1404` ✓ vs `:1386-1390`; measured 2026-08-12 |
| S11-F2 | S1 | ADOPT | Relationships mode with zero relationships renders a blank dot grid — zero nodes (tables are filtered by edge participation), no legend, no sentence; reachable at `?fixture=thin` and by hiding every relationship type. Mechanism lead-verified in source; **painted state UNVERIFIED in browser** (scripted pass could not drive the mode switch — under-audited list). Per-mode empty card from the section's `.sch-empty` | `SchemaCanvas.tsx:1119,1140` ✓ · `:1971` ✓ · `:2240` ✓ (appLayer-gated); `schema.astro:26,52` ✓ |
| S11-F3 | S2 | ADOPT | Data mode after `Hide all` is the same unexplained dot grid; the only sentence naming the cause lives inside the Export dropdown. The filtered branch of the same per-mode empty card, reading `filterCount`, carrying `Clear filters` | `SchemaCanvas.tsx:1548-1549,334,2065-2069` |
| S11-F4 | S2 | ADOPT | The island mounts in a `hidden` panel at 0×0; the one-shot settle effect exhausts its 31-frame bound against zero width and disconnects permanently; the page's remedy dispatches `resize` — **nothing in the island listens** (lead-verified: 0 listeners). The `ResizeObserver` that fixes exactly this is `embed`-only. Drop the gate; delete the dead dispatch. The mechanism most consistent with the blank canvas that reproduces on one machine and not another | `SchemaView.astro:227,392` ✓; `SchemaCanvas.tsx:1724-1779` ✓ |
| S11-F9 | S2 | ADOPT | `nodesDraggable` left at `true`: the user can rearrange the diagram, the next filter click wipes it, nothing persists — and the spec says the visualizer is not an editor. `nodesDraggable={false}` now; manual arrangement as a real feature DEFERred in-row, trigger: a client asks to arrange the diagram | `SchemaCanvas.tsx:2201-2221,1688` vs `specs/10-schema.md:141-144` |
| S11-F10 | S2 | ADOPT | In Relationships mode the entire payload is the edges and `edgesFocusable={false}` makes them unreachable by keyboard; the tooltip is hover-only so touch gets nothing. Remove the flag, add a focus trigger; the same relationships have a keyboard path one tab away, which makes this a choice | `SchemaCanvas.tsx:2208-2220,2262-2286` vs `SchemaView.astro:294` |
| S11-F11 | S3 | RATIFY | The tab's default mode has no catalog entry — the app's largest bespoke surface is documented only for its third mode, which is why F5/F8/F12 could be built with nothing to fail against. Write `pattern-schema-canvas`: node anatomy, relationship colour language, field cap + `+N more`, zoom/pan chrome (ACCEPTing the `@xyflow` controls and their vendored `title=` in writing), the legible-fit floor, the per-mode empty rule, the search-jump idiom. Lands **before** the fixes | `storybook.ts:5071` ✓ (only entry, "third mode") |
| S11-F12 | S3 | ADOPT | `client:only` ships no server HTML at all — the one tab that must download a bundle is the one that renders nothing while it does. Astro wrapper renders the toolbar + a muted canvas placeholder, hidden on hydrate. Dev-server pre-bundle delay is NOT-OURS | `SchemaView.astro:229` ✓ |
| S11-F13 | S3 | ADOPT | The node shows record count OR field count, never both — every fixture table has records, so the field count the spec asks for never renders. Both counts in the header meta | `SchemaCanvas.tsx:547-549` vs `specs/10-schema.md:58-59` |
| S11-F14 | S3 | ADOPT | A table past the 14-field cap silently loses the relationship EDGES on its capped fields; the footer admits hidden fields, never missing links — an ER diagram quietly omitting relationships. Exempt relationship-bearing fields from the cap (they are the payload). **HARNESS: no fixture triggers it** — one capped-link relationship added to `schema-lab` (harness track) | `SchemaCanvas.tsx:197,828,858,894,565` |
| S11-F15 | S3 | ADOPT | The toolbar search jumps to one node while six sibling searches filter — defensible on a canvas but undeclared, and a typed query survives `Clear` with no visible control to remove it. Keep jump (recorded in the F11 entry), add `setQuery('')` to `resetFilters`, make the affordance say "jump" | `SchemaCanvas.tsx:1935-1948,1474,2016` |
| S11-F16 | S3 | ADOPT | Two fits race on every filter change — the 450ms animated fit and the settle effect's instant `fitNow()`, re-armed because the effect depends on `fitNow`'s identity, which changes on every `setNodes`. Gate on a mount/boundary ref; also removes per-relayout observer churn | `SchemaCanvas.tsx:1697,1433,1744,1764` |
| S11-F17 | S4 | ADOPT | The TDZ crash-shape survives once: the settle effect reads `wrapRef`, declared 44 lines below — safe only while it stays out of the dep array, with the recorded crash's warning written above it. Move the `useRef` above the effect | `SchemaCanvas.tsx:1724,1768` vs `:1372-1376` |

### D26 — One relationship detail, one row

Rule and full argument in `audit/decisions/26-one-relationship-detail-one-row.md`.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S12-F2 | S1 | ADOPT | The `Removed history` badge's tip promises "see the Changelog in the detail" on exactly the rows whose click opens the entity panel — which has no relationship changelog; the one that does is built only in the panel those rows never open. Fixture proves the combination (`rel-deals-companies`: valid + field + `hasRemovedHistory` + real `removedAt`). Falls out of F1: route every row to the relationship detail | `SchemaRelationships.astro:177` ✓; `schemaRelationships.ts:464` ✓; `schema-lab.ts:690-698` ✓ |
| S12-F3 | S1 | ADOPT | **Confirm survives confirming**: the handler queries `.rl-actions` — measured **0** matches in the rendered page vs **21** `.row-actions` — so a just-accepted relationship keeps a one-click Dismiss; the injected `VALID_BADGE` is also `badge-sm` (measured 23px/11px replacing 24px/14px) and arrives without its `.rl-status-cell` anti-overlap wrapper. One slot class, default-size badge, wrapped | `schemaRelationships.ts:203,400` ✓ vs `SchemaRelationships.astro:151-152` ✓; DOM count measured 2026-08-12 |
| S12-F1 | S2 | ADOPT | One list, two panel systems chosen by a rule the row does not show: valid field-based rows open the shared stackable `EntityPanel`; synced/invalid rows open a bespoke fixed overlay with a close × and nothing else — and a chip inside the bespoke panel closes it and opens the other kind. Make the detail a kind on the section's `PanelHost` (`buildDetail` already returns the shape it wants); `schema:openRelationship` and the Visualize edge click work unchanged | `schemaRelationships.ts:463-469` ✓; `RelationshipPanel.astro:42-57`; `SchemaView.astro:286,294` |
| S12-F4 | S2 | ADOPT | A row you just declared is not the row above it: the controller's `treeRow`/`flatRow` omit `row-clickable`, the chevron and hover-revealed actions, and use `badge-sm`+`size-3` where the server uses default size. Build runtime rows from the same exported helpers the `.astro` uses — two hand-copies of one row is how the classes diverged | `schemaRelationships.ts:397,401-402` vs `SchemaRelationships.astro:150-153,210,218` |

### D27 — One body, two projections: a view toggle changes layout, never facts

Rule and full argument in `audit/decisions/27-one-body-two-projections.md`. Precedent: J06-F4 (D11).

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S10-F1 | S2 | ADOPT | Flat has no base rows while the Type facet on the same toolbar offers `Bases` — filtering to Bases in Flat prints "No entities match your filters." over three matching bases — and one word, `entities`, carries three totals on one screen (SSR excludes bases + includes removed; hydration swaps the tree total; the Flat toggle swaps a third, 3 lower, no filter change). Add base rows to `flat`; derive ONE total in `apply()` and let SSR, both projections and D24's livecount read it | `SchemaBrowse.astro:118,135,48,100,216,742-744,874-877` ✓ |
| S10-F6 | S2 | ADOPT | Flat is the lossy projection: drops the health dot the catalog's own example draws, drops chat tags entirely (a chat reference is invisible in Flat), renders ≥2-doc tags as a non-interactive `<span>`, and moves `unknown` to a different column. The fixing helpers (`statusBadgeHtml`, `taggedHtml`) already exist as single functions — call-site changes. Tree adopts Flat's visible `since` caption in return (a date that fits does not live in a tooltip) | `SchemaBrowse.astro:96,286,423,407-418,327,408,94-97` |
| S12-F6 | S2 | ADOPT | Tree and Flat are two different tabs behind one toggle: Flat silently removes the Status word (a 9.6px `aria-hidden` dot, no legend anywhere in the view), the glossary, the cardinality tooltip, click-to-sort, and changes row height — while the catalog says Flat is where the global sort lives, and it is the one view with none. Flat gains the Status column, the tooltip and `data-sort-col`; the glossary moves out of the `<th>` (S12-F12) so both views carry it | `SchemaRelationships.astro:214,219,222,304-317,340,475-478,511` vs `storybook.ts:4932` |
| S17-F8 | S3 | ADOPT | The base-group count is a frontmatter constant touched only by register — every facet, search, status change and page turn leaves it lying (`Removed only` leaves `7` above one row; a no-match search leaves full counts above an empty card). Derive the group count in `apply()` from visible rows (D27's one-derived-total rule); write what the count means under filter into the family entry — Interfaces asks next (`schemaInterfaces.ts:351`, same construction); the `Clear filters` ghost lands with S18-F11's sweep | `SchemaAutomations.astro:226,244` · `schemaAutomations.ts:101-126,377` |

### D28 — Capability gates render the true state

Rule and full argument in `audit/decisions/28-capability-gates-true-state.md`.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S16-F1 | S1 | ADOPT | A paying Pro customer out of AI credits is shown **"Upgrade to Pro"**: the union declares `ready \| locked \| no-credits`, every AI consumer collapses it to `=== 'ready'`, and the policy-off state the `ai-settings` proposal specifies has no branch anywhere — served on every smoke run (`?ai=no-credits` is a declared variant), green. One shared gate, three true branches; `no-credits` keeps the surface visible-disabled (the reader has threads to re-read) | `SchemaChat.astro:52,58,180-186` ✓ · `SchemaHealth.astro:116` ✓ · `SchemaAutomations.astro:72` ✓ · `SchemaInterfaces.astro:60` ✓ · `SchemaCanvas.tsx:2244-2248` ✓ · `smoke.mjs:186` |
| S17-F6 + S18-F7 (merged) | S2 | ADOPT | Both register tabs — no AI in either — are gated whole on the AI-credits prop, so `?ai=no-credits` serves "Available on Growth and above" + `View plans` to a customer who may hold the plan. The gate itself is spec-required; its **input** is not. Own `tier` capability prop + `?tier=` harness query; interim honest minimum `aiState !== 'locked'`. The hero shape + price sentence executes under D14's one-recipe rule | `SchemaAutomations.astro:68-72,157-163` ✓ · `SchemaInterfaces.astro:57-60,148-154` ✓ · `pages/schema.astro:9` · `specs/automations-interfaces-tabs/spec.md:10-12` |

### D29 — The register speaks once: recorded, never observed

Rule and full argument in `audit/decisions/29-register-speaks-once.md`.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S17-F1 + S18-F1 (merged) | S1 | ADOPT | Both register tabs have **two writers for the status badge, and the runtime one asserts observation**: the server tooltip says "You recorded this as published — Baseout cannot check it"; every client repaint replaces it with "Published in Airtable — live for users" / "On in Airtable — this automation is running" / "No longer exists in Airtable" — the exact strings the catalog quotes verbatim as forbidden. The honest text survives until the user does anything, and the note's permanent dismissal leans on the badges keeping the truth — which they do not. One exported badge writer per tab, **server wording wins**, both tabs one commit (the D10 move); never fix by editing the `.ts` strings — two writers is the defect | `schemaAutomations.ts:22-29` ✓ vs `SchemaAutomations.astro:133-136` ✓ · `schemaInterfaces.ts:23-28` ✓ vs `SchemaInterfaces.astro:126-131` ✓ · `storybook.ts:5520` ✓ (verbatim counter-example) |
| S17-F2 | S1 | ADOPT | The Trigger column answers "what fires this" from a different field than the panel: list "When a record matches conditions" vs panel "When a record is updated" on one automation; list `—` — this table's word for *not recorded* — over a trigger the panel prints in full on another; search and sort index the wrong field. Export `triggerLabel(a) = readAnatomy(a).trigger?.type ?? a.triggerType` from `automationAnatomy.ts` (the declared seam), call it in all three places including the search string. NOT-OURS: whether capture should overwrite a divergent manual `triggerType` | `schemaReadBody.ts:245-278` ✓ · `SchemaAutomations.astro:146` ✓ · `schemaAutomations.ts:211,352` · both fixture cases `schema-lab.ts:948-950,982-985` ✓ |
| S17-F4 + S18-F8 (merged) | S2 | ADOPT | Registering an already-registered ID silently appends a second row while the map overwrites — two rows, one record, on both tabs (`openEdit` is only ever called with `null`, so the upsert's existing-check can never fire); the Interfaces form also still asks for an "Interface ID · pbl…" after Page is chosen, and neither ID field says where the value comes from. `byId.has(id)` → `setCustomValidity` on both; `syncType` rewrites label/placeholder; a where-to-find-it hint under the ID field. NOT-OURS: server-side rejection; inbound-API collisions | `schemaAutomations.ts:227,319,335-336,357-375` ✓ · `schemaInterfaces.ts:300-312,357-370` · `SchemaInterfaces.astro:280-281` |
| S17-F5 | S2 | ADOPT | "Who gets notified when this automation runs" promises an event the tab's own banner, empty state and every status tooltip say Baseout cannot observe. Copy in the Active toggle's exact grammar: "Who Airtable notifies when this automation runs. Recorded in Baseout — Baseout sends nothing." If a Baseout notification is intended, it is NOT-OURS and needs a named event first (the pattern's own boundary: a backup product records what a base *is*, not what it *did*) | `SchemaAutomations.astro:317-321` vs `:213,285` · `storybook.ts:1936` |
| S18-F9 | S3 | ADOPT | A view can be tagged and then never found: the picker admits `kind:'view'`, both facets and the row count ignore it, and the label says "tables & fields" — search alone matches it, which hides the inconsistency. ADOPT (a): exclude views from the picker now, one honest line; (b) — a Views facet + a three-kind label — is the named trigger when Dan's open #4 views item lands | `SchemaInterfaces.astro:314,104-117,122,312` · `schemaEntities.ts:225` |

### D30 — One save contract

Rule and full argument in `audit/decisions/30-one-save-contract.md`.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S15-F3 | S1 | ADOPT | **The app's only authoring surface has no save contract at all** — no Save, no Cancel, no dirty state, no leave guard — and renders "Draft · not saved" with no control that could change it; every route out (row click, delete, the four inbound `schema:openDoc` callers, newDoc) overwrites `editor.innerHTML` unconditionally. The contract ships 60 lines away in the panel this very tab opens: one footer slot, Save + Cancel, Esc-to-cancel. Ours: the controls, dirty diff, guard, byline; NOT-OURS: persistence. Amend `pattern-schema-docs`' bar anatomy — the catalog currently blesses the gap | grep -in save → only `'Draft · not saved'` `:738` ✓ · `SchemaDocs.astro:153-165,717-731,763,1137` · `schemaReadBody.ts:305-314` ✓ |
| S15-F4 | S2 | ADOPT | Every document opens in **Edit** — including for the four inbound reading errands — on the section whose spec calls itself read-only; compounded with F3 the surface starts in the one mode it cannot leave safely. Open in Read; Edit deliberate (the panel's own default); `newDoc` stays edit-first and title-focused. Edit-first for authors would be a RATIFY recorded in the entry — impossible while there is no Save | `SchemaDocs.astro:730,1209,767-772` · `schemaReadBody.ts:38,92` · `specs/10-schema.md:141-145` |

### D31 — One assistant, two doors

Rule and full argument in `audit/decisions/31-one-assistant-two-doors.md`. Direction of
consolidation: panel mechanics toward `QuickAskDock` (its architecture and header are the model),
input and rendering toward the tab.

| finding | sev | disp | defect | evidence |
|---|---|---|---|---|
| S16-F2 | S1 | ADOPT | **The quick-ask panel — the assistant's only door on all eight tabs — has a composer that cannot be typed into**: the input is a `<div>` holding its placeholder as literal text, the send is a `<span>` painted `--color-primary` exactly like the real button; zero `textarea`, zero hooks, zero listeners — while everything else in the panel is live. Lift the tab's composer + `send()` into the shared partial (the fix F4/F5/F6 want anyway), or delete the fake box for `Open full chat`; what may not ship is a primary-painted `<span>` send | `QuickAskDock.astro:164,208,528` ✓ (0 `textarea` in file ✓) vs `SchemaChat.astro:242,286` · `schemaChat.ts:269-274` |
| S16-F4 | S2 | ADOPT | One assistant, three doors, **four records disagreeing**: the tab-bar comment says Chat is OUT of the row as `Chat History`, 31 lines above a row tab labelled `Chat`; the catalog says "last tab"; the proposal says appended — and the two renderings differ on composer, picker contents, chip builder, type size (`--t-16` vs `--t-13`), bubble radii, empty state and reference clickability. Keep both doors (two real jobs), one implementation, the label per the decision or the decision amended, and the missing panel⇄tab return route — **one record survives** | `SchemaView.astro:182-184` ✓ vs `:215` ✓ · `QuickAskDock.astro:286-289` · `storybook.ts:5125` |
| S16-F5 | S2 | ADOPT | `Add context` is built twice offering **different worlds**: the dock filters `!removed` and offers Views, with a comment naming exactly the defect; the tab does neither — so the full tab can scope an answer to a deleted base and never to a view, and the two filter loops are re-typed near-identically. One picker component (four groups, `!removed`), both callers — the catalog already says it is "the reused EntitySearch typeahead", imported by neither | `QuickAskDock.astro:75-82` vs `SchemaChat.astro:127-131` · `schemaChat.ts:228-246` vs `QuickAskDock.astro:339-359` · `storybook.ts:5130` |
| S16-F6 | S2 | ADOPT | Five hand-rolled entity-glyph ladders across the three chat files against `entityIcon.ts`'s "Import from here — **do not write a sixth**" — and the one correct caller carries the comment naming the drift still live four lines below it (bare `lucide--database` without `concept-ic-*`; a hand-typed tag for a field). `entityIconClass` / `fieldIconSvg(type) \|\| entityIcon('field')` at all five sites | `SchemaChat.astro:65-70,122-125` ✓ · `schemaChat.ts:25-31` ✓ · `QuickAskDock.astro:57-73` ✓ · `entityIcon.ts:7-11` ✓ |
| S16-F7 | S2 | ADOPT | Catalog and file header both promise "sender shown by **label** + subtle background, no bubble decoration"; the shipped surface clips the label to nothing (`clip:rect(0 0 0 0)`) and distinguishes the speakers by an 8%-alpha tint and tail radii that exist nowhere else in the product. Unhide the label (`--t-11` uppercase), drop the tails — the one colour-only distinction and the single most consumer detail in the app; keeping the bubbles is a RATIFY that rewrites both records | `SchemaChat.astro:104,110,369,365-375` · `storybook.ts:5130` |
| S16-F11 | S3 | DEFER | Assistant answers render as escaped `pre-wrap` plain text though the proposal's Reuses clause names the markdown renderer and the invited questions answer in lists — a ten-item answer is one unbroken `--t-16` block. **Trigger: the first real engine response lands** (engine markdown would paint as literal `- `/`**`). `esc()` stays; the fix is an allowlisted renderer (p, ul/ol, code, strong), never `set:html`. Recorded in `pattern-schema-chat` | `SchemaChat.astro:105,370` · `schemaChat.ts:306` · `openspec/changes/chat-tab/proposal.md` |


### Harness-track fixes (apps/design only — no client PR)

| finding | sev | disp | defect |
|---|---|---|---|
| ~~J08-F15~~ | S2 | **CORRECTED 2026-08-14 → split; see S32-F1** | **The original row was wrong about `/settings`.** It read "`?fixture=trial` ignored by `/sources`, `/destinations`, `/settings`". Verified by S32 and re-verified by the lead: on `/settings` the fixture **is** read — `settingsCatalog.ts:232,239,272` resolve `org?.name ?? ''` / `space?.name ?? ''` correctly. The defect is not that the fixture is ignored but that **the empty result is mis-rendered**: `ENROLLED_WORKSPACES` is a module constant (`settingsCatalog.ts:513`) rendered unconditionally at `SettingsView.astro:216`, so a trial user with no connection is shown a named Space, three named Airtable workspaces with base counts, and a red **Delete Space** card. That half is a **product S1 in `apps/web`**, not a harness fix, and is registered as **S32-F1** under D17. The `/sources` and `/destinations` half of the original row **stands as filed** (harness, ADOPT) and is verified still true (`?fixture=trial` serves a populated registry on `/destinations`, HTTP 200). |
| J08-F21 | S3 | ADOPT (harness) | The two registries' fixtures contradict each other on which Spaces use which objects |
| S09-F4 | S3 | ADOPT (harness) | `?fixture=nochanges` missing — the Data Changelog is the only Data tab whose own tab-level empty state no query string can render (its siblings have `nocomments` / `nomedia`), so the one state a first-time user is guaranteed to see is unverified on screen. One-line fixture: `changelog=[]` with the page otherwise populated |
| S11-F14h | S3 | ADOPT (harness) | No fixture has a relationship-bearing field past the 14-field node cap, so the capped-edge omission (S11-F14, D25) is unlookable — add one linked field past position 14 on `Ops Ledger` |

## Harness prerequisites for the S-pass (fix before S01–S40 run)

Unreachable worklist states discovered by the journeys; each blinded at least one finding class:

1. `/?fixture=failed` not implemented (`index.astro:24`) — the failed-Home state has never rendered (hid J02-F1).
2. `/backups/run` ignores `?id=` — no failed run openable from Home; log and detail show different events.
3. `/restore` ignores `?fixture=` — empty state unreachable; the restore never runs (no progress/failure observable).
4. Inbox wired to `?inbox=`, not `?fixture=` — trial Home shows failure notifications for nonexistent bases.
5. `/data` and `/schema` ignore `failed`/`trial` — no partial-diff or partial-capture observable.
6. Two run-id namespaces (`run_2026_06_15_daily` vs `run_a1b2c3`) and three unrelated entity-id
   namespaces (Schema `b-*`, Data `baseCRM`, Health's invented tables) — blocks walking J05/J06's
   headline scenarios and D08's links.
7. Sticky scenario cookies survive sessions (`middleware.ts:25`) — start every audit session with
   `?scenario=reset`; check `localStorage['panel-split:schema']` and `data-md-view` too.
9. A populated Space with one **empty table** is unreachable on `/data` — every fixture table has
   rows and `?fixture=empty` empties the whole page, so the `This table has no records in this
   backup.` copy (`DataBrowse.astro:1148`) has never rendered (S06 §6).
10. The worklist's "empty" state for S07/S08 means `?fixture=nocomments` / `?fixture=nomedia`, not
   `?fixture=empty` (which degrades the page before any tab renders); S09-F4 adds `nochanges`.
8. Scout viewport was capped at 648px height — set 1440×900 explicitly for the S-pass.

## Still open at lead level

- **To Dan (via Oleh):** multi-user V1 yes/no (D18) · tier-gating position (D14) · records-only
  restore V1 scope (J04-F10) · surface "Dependencies" as a headline capability (J05-F6) ·
  `specs/12` Profile Option A/B/C (J08-F14).
- **NOT-OURS, to the client's engineer (from S06–S09):** does the row-window endpoint return an
  approximate total (decides S06-F4's fix) and a distinguishable failure cause (S06's
  `Couldn't load records.`)? · can a comment/file capture partially fail (decides S07-F3 vs an
  ACCEPT)? · does `capturedAt` vary within one run (S08 §"unverified" — default sort order)? · is
  the pager's server contract offset-based now the cursor model was reversed (S06-F11)?
- **Measurement debt (S06):** the four S06 `NEEDS-MEASUREMENT` rows were not in the orchestrator's
  geometry pass — the two counters at `?fixture=big` (S06-F4), surviving characters in a 320px cell
  at 1440 (S06-F6 ref), the painted gap between the two tablists (S06-F7), and whether `gridFit`
  reaches its 240px floor at 1440. Plus DataBrowse below 1280 (D22 item 3). One browser pass closes
  all five; none blocks its ruling.
- **NOT-OURS, to the client's engineer (from S10–S13):** does Airtable expose a base description
  on any endpoint (decides S10-F13's note vs a model fix)? · which direction is semantically right
  for a declared synced table (S12-F10 — that inferred and declared must agree is ours)? · does
  the Data changelog's `changeScope` export exist for a backend reason (S13-F4)?
- **Q1 — a rule conflict for D23 to settle once:** badges paint 11px on all four Schema tabs; the
  `--t-*` ladder has an 11 rung and `ds-lint` is green, but `interface-rules` states the sizing
  floor as SM/**12px**. Two stated rules disagree about whether 11 is legal (J05-F17 took 11.52px
  to S2 on a reference surface). Settle in D23 rather than re-arguing per surface.
- **Measurement debt (S10–S13):** the painted `.br-fhead`-vs-row offset at 1440/1000 (S10-F5 — the
  one S10 measurement row the browser pass did not answer) · the Relationships-mode blank canvas
  seen by a human (S11-F2, S1 bound on source) · whether the nested tooltips double-paint on a
  real pointer (S12-F11) · a long-name fixture for the Schema changelog's clip path (S13 §6) ·
  the single-node and ~200-table fits (S11 §6, fixture fixed at 19).
- **NOT-OURS, to the client's engineer (from S14–S18):** can a per-base grade *fail*, as opposed
  to lag (S14-F12 — model variant first)? · should capture overwrite a divergent manual
  `triggerType` (S17-F2)? · what event could ever fire "Notified subscribers" (S17-F5)? · does a
  plan-holding Space with zero AI credits exist, and what does production pass the register tabs'
  gate (D28)? · does the intake reject duplicate register ids server-side (S17-F4)? · is a view a
  legitimate interface tag target (S18-F9 — waits on Dan's #4 views)?
- **To Dan, new from S14–S18:** Docs write-vs-derive + document origin (S15-F7; the spec-refresh
  must answer it) · the Chat tab's label (`Chat History` per the decision, or amend it — D31) ·
  Health's category decomposition: model change or copy change (S14-F3) · the Health PDF's
  referent (S14-F5).
- **Measurement debt (S14–S18): U1 first.** Every panel-open scenario on S15/S17/S18 is
  unmeasured (the orchestrator could not open a panel by script); the overlay hypothesis is NOT a
  disproof, and the closing pass must also test **split view** (`panel-split:schema`, persisted,
  known to reflow — J05-F3). Three S2 rows (S15-F9, S16-F8, S18-F3) hold severity on it. Also
  owed: S14's three rows (method tooltip vs PanelHost; rail scroll onset past 6 bases; metric
  grid at panel widths), Chat's 760–1280 band (S16-F8's demotion condition), the shared 216px
  chrome offset vs `innerHeight`, and `?tab=chat` as a declared smoke variant. Harness gaps:
  one-base/clean/>6-base/ungraded Health states, the broken doc tag, a single-row register group,
  a long automation name, a duplicate-id register, and a `?ai=` policy-off value (D28's third
  branch is currently unlookable).

- **Waiting on S/X evidence:** D15 (X01), D17 (X04), D19 (X08/X13) are interim; X02 (toolbars),
  X06 (overlays — journeys found overlay use correct everywhere checked), X14/X15 not yet decided.

---

## S19–S21 adjudication (Reports) — 2026-08-12, third wave

**Adjudicated by the orchestrator, NOT `audit-lead`.** The lead agent for this wave terminated on an
API spend limit before writing anything. The rulings stand on the same evidence standard, but they
have had **no second reader** — a real difference from the two Schema waves above, recorded here so
nobody reads these rows as twice-checked. Full adjudication: `audit/waves/2026-08-12-s19-s21.md`.

36 scout findings + 2 lead-filed = 38 considered → **34 rows** (4 merges, 0 rejected).
**S1 ×4 · S2 ×13 · S3 ×16 · S4 ×1.** Register total: **331**.

**Reference-status ruling.** Reports **holds** as the reference for the list and the definition, and
**loses it for the run result**: on the five questions a run page answers, three go the wrong way
(`did it succeed` — the document never reads `status` or `generationState`, both on its own type;
`what did it produce` — a fourth private metric strip; `what if it failed` — no document at all).
`BackupRunDetailView` is the reference for run results from here. Reports keeps the reference for
`Showing N of M` count grammar (S19-F10) — Schema and Backups converge onto it.

| id | sev | row | disposition |
|---|---|---|---|
| S19-F1 + S20-F6 | **S1** | `overflow-x: clip` on both Reports tables. `scrollLeft = 400` reads back **0** — no scroll container, so hidden columns are unreachable by bar, drag, keyboard or script. `/reports` @500 hides **362px** (`Schedule`·`Last run`·`Delivery`) and puts the row's action **346px** outside the client box; `/reports/def-full?tab=history` @**1280** loses `Delivery`, @540 loses four of six facts incl. `Generated`. Only two `clip` instances in the tree. | MERGED, **raised S2→S1**, bound to **D22** as a new clause (no new decision). Interim `auto`; real fix `pattern-mobile-row` on both. |
| S21-F8 + R-B | **S1** | Nine of eleven clickable run rows on `/reports/def-full` render the generic `NotFoundView` for a run the product listed, dated, statused and made clickable one click earlier. Topbar reads `Report · Core CRM` over it. | MERGED, **raised S2→S1** (not "stale or mistyped" — the product's own current links). Harness half split out below. |
| R-B (harness) | S3 | `reportDetails` holds 5 keys against many more `runs` rows. | HARNESS, with S20-F9. |
| S21-F1 | **S1** | The run document never states whether the run succeeded. | ADOPT. |
| S21-F2 | **S1** | The failed run has no document and the row *deliberately* refuses to open (`ReportDefinitionView.astro:224-226` nulls `role`/`tabindex`/`onclick`) — with nothing offered in its place. | ADOPT. |
| **R-C** | S2 · **GATE** | `smoke` declares `/reports/run/r-gen-failed` and passes green: it and `no-such-run` both return **HTTP 200** with the not-found body, indistinguishable to an HTTP-only check — while the gate's charter is "does every route still render at all". Third recorded gate blind spot (with `ds-audit`/`SchemaCanvas.tsx` and `typecheck`/`.astro <script>`). | ADOPT — one content assertion per route that must not 404. Filed as a **gate** row; the audit now carries gate blind spots. |
| S20-F1 | S2 | A **fourth** save contract: always-editable form whose `Cancel` navigates away and discards, where two sibling detail views revert in place. `beforeunload` → **0 hits app-wide**. | Folded into **D30**. **Open question left unbound:** does D30 clause 1 (open in Read) govern *forms*, or only documents and panels? |
| S20-F2 | S2 | The dirty flag is a one-way latch, not a diff, and misses chip removal, autocomplete picks and Backspace-removal (`RecipientInput` dispatches no event). | ADOPT — **sequences before S20-F1**; any exit guard is only as good as this flag. |
| S19-F2·F3·F4, S20-F3·F5·F7·F8·F10·F12, S21-F3·F4·F5·F6·F7 | S2/S3 | As filed. | ADOPT. |
| S19-F5·F6·F7·F8·F10·F11·F12, S21-F9·F10·F11 | S3 | As filed. | ADOPT. |
| S19-F9, S21-F12, S20-F4 | S3 | Catalog describes surfaces that stopped shipping (`pattern-export-control` has no entry for the download-this-object job; `pattern-report` forbids a shipped behaviour; `pattern-report-schedule` documents the deleted `.rps` sub-view). | **RATIFY code, fix catalog** — the class S13-F5 and S12-F14 established. |
| S20-F9 | S3 | `/reports/[id]` reads no `?fixture`; no schedule-less or disabled-schedule fixture exists, so `cadenceLabel`'s `Manual` is dead through every page. | HARNESS. |
| S20-F11 | S4 | Duplicated media query + duplicated comment. | Phase 2, cleanup-on-next-open. |

**NOT an instance of S10-F7:** `/reports` has no `data-mobile-rows`, and measured at 540 it has zero
sideways scroll, zero clipping, zero overlap. Nothing pans, so nothing needs the narrow row. Recorded
so the absent attribute is not read as the Schema Browse defect.

**`task-new-report-screen`** — S20 judges it answered by the shipped three-step form (rejected sticky
rail argued at `ReportDefinitionView.astro:906-908`). Reasoning holds, but it is Oleh's note:
**recommended closed pending his word**, not closed.

**Under-audited, new this wave:** no second reader on any row above · the run-result page's own
geometry at both widths (routing was measured first; the dev server went down before I returned) —
S21's three `NEEDS-MEASUREMENT` rows all still open · S20-F12 unmeasured and may close with no change
· harness: no `?fixture` on `/reports/[id]`, no schedule-less or disabled definition, no long-name
fixture anywhere in Reports, the pager never turns a page (3 rows against a 20-row page).

---

## S22–S24 adjudication (Sources) — 2026-08-13, fourth wave

**Neither scouted nor adjudicated by an agent.** The API spend limit forbade spawning either, and the
dev server is down, so this wave is source-only, browser-free and single-reader. It is also
**incomplete on purpose**: `S24` (Sources ▸ new) was not audited and says so. Recorded at this
standard so nobody reads these rows as equal in weight to the three agent waves above.
Findings: `audit/findings/S22-S24.md`.

8 rows. **S2 ×4 · S3 ×4.** Register total: **339**.

### Two system rows, both larger than the section that produced them

| id | sev | row | disposition |
|---|---|---|---|
| **X-A** | **S2** | **One job, twenty radii.** The construct `border: 1px solid var(--color-base-300); border-radius: …` appears with 20 distinct values; **80 sites cluster within 4.4px of each other spelled seven ways** (10 · 11 · 11.2 · 12 · 12.8 · 13.6 · 14.4). The shared `tbl-frame` class is used by **six files**, five of them one section. **The app's most common value is 11px; the catalog's 12px is fifth by frequency.** | ADOPT as a **sweep**. This is the class behind **S12-F14** and **S19-F12**, both already adopted as instances, plus `.reg-tablewrap` at `.7rem`. Bind the near-12 cluster to `tbl-frame`; leave deliberately-different values; record the residue. |
| **X-B** | **S2** | **One scoped not-found exists; four object routes use the global 404.** `NotFoundView` takes **no props** and renders "Page not found · Back to Home" on six routes — correctly for `/404` and `[...slug]`, wrongly for `sources/detail`, `destinations/detail`, `reports/[id]` and `reports/run/[runId]`, where the page exists and the *object* does not. `BackupRunDetailView`'s `notFound` prop is the shipped scoped version, with copy that explains why the link went stale and an exit **Back to Backups**. | ADOPT. **This generalises R-B**: the Reports run page is not a Reports defect but the fourth instance of a missing shared contract — and it is the instance where nine of eleven real links land. `BackupRunDetailView`'s copy is the reference. |

### S22 · Sources list

| id | sev | row | disposition |
|---|---|---|---|
| S22-F1 | **S2** | `statusMeta[s.status].label` indexed with **no fallback** at `SourcesView:102,114` and `DestinationsView:111,123` — an unknown status throws and takes the page down. The file's own comment (`:29-32`) names this exact failure and fixes it for one value by adding a map entry instead of adopting the `?? default` the app uses at `BackupsListView:188`, `RestoreHistoryView:171`, `ReportsView:133`, `ReportDefinitionView:207`. Sources and Destinations are the only two views without it. | ADOPT. |
| S22-F2 | **S2** | **The account cluster never adopted `text-title`.** 15 views use it; **7 hand-roll `text-2xl font-bold tracking-tight`**, and all seven are Sources · Destinations · Integrations — one region of the app as a separate typographic world. | ADOPT as a sweep. If `leading-tight` is genuinely needed it belongs in the class, not at three call sites. |
| S22-F3 | S3 | The success notice dismisses itself with an inline `onclick="this.closest('.alert').remove()"` (`:57`) — nothing else in the tree dismisses by self-removal. | ADOPT — a prop on the shared alert, or route through the toast that already exists. |
| S22-F4 | S3 | `.reg-tablewrap` is a fourth hand-written `tbl-frame` at `.7rem` (`:163`). | Instance of **X-A**. |
| S22-F5 | S3 | No narrow form — six `nowrap` columns, `overflow-x: auto`, no `data-nrow`. | Instance. **`auto` is sanctioned**, so materially better than Reports' `clip`; recorded, not re-filed. |
| S22-F6 | S3 | Row nav by `onclick="window.location=…"` (`:105`) — a **seventh** site of the class S19 recorded app-wide, which **still has no register id**. | **Give it one.** |

### S23 · Sources detail — ~~RATIFY, and name it the reference~~ **CORRECTED 2026-08-14**

**This section originally read "No findings" and named `SourceDetailView` the reference for the
editable-object contract. That was wrong, and it was wrong because the pass that wrote it was
source-only and browser-free — it read the `Cancel` handler, which is correct, and never drove the
state machine around it.** S25-F1 found the defect from the Destinations side; the lead re-verified
it in source on **both** files today.

**The reference fails the contract it was named the reference for.** `setMode()`
(`SourceDetailView.astro:307-317`, `DestinationDetailView.astro:279-289`) restores nothing, and its
first line is `if (mode === 'edit') entryValues = inputs.map((i) => i.value)` — so **every** entry
into edit re-captures the current, possibly dirty, value as the new baseline. Leaving edit via the
`Read` segment neither saves nor reverts: the input keeps the typed text while the page shows the
old value, re-entering edit overwrites the baseline with the dirty value, and `Cancel` can never get
back. Measured end state on `/sources/detail?id=src-ops`: `readSlot: "Ops Airtable"`,
`inputVal: "TYPED-NEVER-SAVED"`. Only `[data-reg-cancel]` and Escape restore, and both read the
overwritten baseline. Three exits are live with a dirty input (`.back-link`, `Reconnect`, `Read`)
with no dirty flag anywhere and `window.onbeforeunload` null. `pattern-panel-edit-mode` states
verbatim that *"Cancel restores the values as they were on entering edit mode"* and that leaving
while dirty *"keeps the draft"*. **Neither half holds.**

**What this changes.**

1. **S23's "no findings" is withdrawn.** The row is **S25-F1, S1, ADOPT**, filed against both twins
   and bound to **D38**.
2. **`SourceDetailView` loses reference status for the editable-object contract.** Its Read-mode
   layout, its Save/Cancel-in-one-slot placement and its `ConfirmModal` removal (`:220-226`, D06)
   remain exemplary and are named in D38's "explicitly not changing" — but a file whose `Cancel` has
   stopped cancelling cannot be the thing other surfaces are told to copy.
3. **D30 names no reference for the editable-object contract until D38's `registryEditMode.ts`
   ships.** D30's rule is unchanged and its citation of `SourceDetailView.astro:319-322` is
   downgraded from "the idiom" to "the correct half of a broken machine". The nearest shipped
   implementation of the *whole* contract is `schemaReadBody.ts:305-314`
   (`pattern-panel-edit-mode`), which D30 already cites first; the panel, not the registry, is the
   reference until further notice.
4. **Reference status is a tie-breaker, not immunity** (charter §Reference surfaces). This is the
   second time that clause has been used in this audit — Reports lost the reference for the run
   result in the third wave, and it is used here against a reference this audit itself created.

### Under-audited

**S24 (Sources ▸ new) was not audited** — a create form's findings live in its validation and
in-flight states, which a grep cannot judge. **S25–S27 (Destinations) not audited**, though S22-F1
and S22-F2 cite it, because the two files declare themselves one family; a real Destinations pass may
find the divergences that declaration exists to prevent. **No browser pass and no second reader on
any row above.** X-A counts one exact CSS construct, so the true radius spread may be wider.


---

## S24–S40 adjudication (creation forms · Destinations · Integrations flow · Settings/Billing/Profile/Help · Welcome/Login/Register/404/Styleguide) — 2026-08-14, fifth wave

**Adjudicated by `audit-lead`.** 85 rows from 85 considered items (5 scout findings merged into 2
rows and 1 recorded as an instance of an existing class; 1 scout finding split into 2 rows; 2 rows
lead-filed). Three previous attempts at this wave died on transient 529 without writing anything, so
nothing below was carried over from them. **Register total: 424.**

**Verification, run by the lead.** Gates, 2026-08-14: `corepack pnpm@11.1.1 run ds-audit` →
verbatim `ds-lint: 6 design-system issue(s), across 208 file(s). Fix them or mark a line ds-ok. A UI
task is NOT done until this is clean.` / `[ELIFECYCLE] Command failed with exit code 1.` —
**exit 1**, and the ~295/193 rem-fraction baseline in the audit brief is **stale**: `ed8b03b`
retired it, so this wave files **no** unit-debt DEFER. `corepack pnpm@11.1.1 -r --parallel run
typecheck` → **exit 0** (0 errors across `apps/web`, `apps/design`, `apps/survey`). One of the six
`ds-audit` rows is `NotFoundView.astro:50 unsized control = md`, which S36-F6 cites — confirmed
verbatim.

Source spot-checks, all confirmed by the lead in `apps/web` today:

| claim | result |
|---|---|
| `setMode()` restores nothing and re-captures `entryValues` on every edit entry | **CONFIRMED**, byte-identical at `SourceDetailView.astro:307-317` and `DestinationDetailView.astro:279-289`. This is the load-bearing S1 of the wave |
| `#login-error` has no writer | **CONFIRMED** — 2 hits, both markup, `LoginView.astro:99-101`; `novalidate` at `:86`; `if (!email) return;` at `:196` |
| the auth shell cannot scroll | **CONFIRMED** — `@apply flex h-screen w-full overflow-hidden` |
| the 19 failure codes are rendered by nothing live | **CONFIRMED** — `access_denied`/`api_call_failed` exist only at `IntegrationsView.astro:51,58`; the other eight only at `StoragePicker.astro:476-493`, in different words |
| create forms have no form-level error slot | **CONFIRMED** — every error node in `SourceAddView.astro` is `[data-reg-err-for="<field>"]` |
| `ENROLLED_WORKSPACES` is a module constant rendered unconditionally | **CONFIRMED** — `settingsCatalog.ts:513`, `SettingsView.astro:216` |
| no support address anywhere | **CONFIRMED** — `grep -rn "mailto:\|support@" apps/web/src` → 0 hits |
| `ds-lint` has never inspected `storybook.ts` | **CONFIRMED** — `.claude/hooks/ds-lint.mjs:40-50` walks `apps/web/src` only |
| `SB_ENTRIES` count | **CONFIRMED 113** (`grep -c "^    id: '"`), against the charter's "96" |
| `smoke` variant gaps | **CONFIRMED** — `smoke.mjs:225` (six `/settings` variants, none a fixture), `:243` (`bases.astro:16-20` has no `empty` branch), no `/login` or `/register` entry |
| `/integrations/authorizing` | **CONFIRMED, and it lives in `apps/design`** — no `apps/web` view exists. Drives the severity ruling on S28-F1 |

**Two citation-path errors in the findings files** (line numbers and substance correct in both, as
in earlier waves): `auth.css` is `apps/web/src/styles/components/auth.css`, not `apps/web/src/styles/`;
`settingsCatalog.ts` is `apps/web/src/views/settingsCatalog.ts`, not `lib/settings/`.

### The three consolidation candidates — judged

1. **"The failure copy exists and is never rendered" — ONE decision, and larger than the brief
   framed it.** The brief proposed merging S28-F2 with S24-F9. Both belong, and so do three more the
   same rule resolves: `Test connection` with exactly one outcome and it is success (S25-F6), the
   OAuth return page with no error branch (S28-F1), and a front door that confirms a typo as sent
   (S36-F2). **D32 — one form failure contract**, six members across five surfaces, one code table,
   one slot recipe, and the death of the `IntegrationsView.astro` copy deck that `CLAUDE.md` has
   been keeping alive precisely for this event.
2. **"The gate is green on states it never reaches" — ONE decision, and it is a tooling row, not a
   product row.** All three legs verified. **D33 — the render gate walks states, not labels.** It
   touches `smoke.mjs` only; **no client PR comes out of it**, and it is the cheapest row in the
   wave. It gets one register row (**G-A**) because the audit now carries gate blind spots — this is
   the fourth. The three product findings it hid (S32-F1, S28-F10, S36-F2's ten unwalked branches)
   stay filed on their own surfaces; D33 is why they were invisible.
3. **"The catalog is never linted" — ONE decision, three clauses, and I considered splitting it and
   did not.** F14 is caused by the lint exemption; F4 (unreadable below 1024) and F15 (unsearchable)
   are not. But all three land in the same two files, for the same reader, in one PR, and none of
   them ports to the client monorepo — splitting would produce three reviews of one file for no
   gain. **D34 — the catalog is a product surface.**

### The two write-surface S1s — ruled

- **The auth shell cannot scroll: S1 HELD.** `/welcome` at 844×390 puts `Continue`'s bottom at
  **459.8** in a 390 viewport with `documentElement.scrollHeight === clientHeight === 390` — the
  onboarding form cannot be submitted, and there is no scrollbar to tell the user why. That is the
  charter's S1 test met exactly ("blocks the job"), and it is the most surprising behaviour in the
  wave. Bound to **D35**. Its companion S36-F3 (the 390 floor gate is missing from the only three
  routes a signed-out person can reach) is correctly **S2**, not S1 — below the floor those pages
  degrade gracefully; the missing gate's real cost is that it **hid this S1**.
- **Login and Register refuse nothing: S1 HELD.** `not-an-email` is accepted and answered with *"we
  sent a sign-in link. The link expires in 5 minutes."* The UI states something untrue and the user
  then waits five minutes for a mail that was never addressable. An empty submit produces no
  reaction of any kind, which nothing else in the product does. Bound to **D32**.

### Two severity changes from the scouts' proposals

- **S28-F1 (`/integrations/authorizing`) S1 → S2.** The scout's evidence is right — every return,
  including `?error=access_denied`, returns HTTP 200 with the identical "Authorizing…" DOM and
  hard-redirects into the wizard 1,700ms later, with `#layout-content a,button` measuring **0
  elements**. But the surface exists **only in `apps/design`**; there is no `apps/web` code that is
  wrong, so there is no line a client PR can change. The remedy is therefore *build the return state
  in `apps/web`*, which is a design gap, not a shipped lie. S2, ADOPT, bound to D32.
- **S36-F4 (`/styleguide` destroys its content below 1024) S1 → S2.** The measurement holds
  (`grid-template-columns: 264px 126px` at 390; `.sb-guide-wrap` needs 561px of min-content in a
  44px client box with `overflow-x: hidden` and `body.sb { overflow: hidden }`). It blocks a
  **builder**, not a user, and this phase judges the product through the user's eyes. It stays high
  in the ship order because an unreadable catalog is what lets everything else drift.

### The vessel ruling applied (Oleh, 2026-08-14)

`EmptyState.astro` (**D17**), an alert vessel and `Badge.astro` as the only path for a status badge
are **BOUND**. **`Table.astro` is DEFERRED, not rejected** — see the 2026-08-14 amendment on
`audit/decisions/15-one-table.md` for the trigger (completion of fix waves 1–2) and for the two rows
of this wave filed against it (**S25-F4**'s structural half, **S25-F12**). No finding was closed to
avoid the deferred vessel, and none was scheduled into Wave 3.

### New decisions

**D32** one form failure contract · **D33** the render gate walks states, not labels · **D34** the
catalog is a product surface · **D35** one auth shell · **D36** one page name · **D37** one narrow
tier · **D38** the object registry is one pattern · **D39** the base picker has one list model.
Extended: **D07 · D08 · D14 · D15 (deferred) · D16 · D17 · D19 · D20 · D21 · D23 · D29 · D30 · X-A · X-B**.

### S24 · S27 — the two registry create forms

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| S24-F9 | **S1** | ADOPT | D32 | **A credential form with nowhere to say "that failed".** Both files can render *"X is required"* and nothing else — a rejected PAT, a denied grant, a duplicate name or an unreachable host has no surface to appear on. The only outcome the UI can express is success. | every error node is `[data-reg-err-for]` (lead-verified); `SourceAddView.astro:199-222` has no failure branch; the copy sits unrendered at `IntegrationsView.astro:32-43` |
| S24-F1+F2 | S2 | ADOPT | D36 | **MERGED.** At 390 both pages name themselves twice in two different words (`.tb-title` "Add source · Core CRM" at 14px/y=11.5 vs `<h1>` "Add an Airtable source" at 20px/y=99.9), and the two destination headings are `text-2xl`/`text-xl` literals that compute identically at 390 and 1440 while the same files' `.reg-section-title` steps 16→14. One fix. | `SourceAddView.astro:35`, `DestinationAddView.astro:55,94`; `global.css:260,510` |
| S24-F3+F4 | S2 | ADOPT | D38 | **MERGED** (F4 falls out of F3's fix). The field error is rendered as a `<p>` **outside** the `<fieldset>`, so daisyUI's rule never matches and it inherits **16px** — larger than its own 14px label — with the hint still stacked under it, and `aria-describedby` still points at the hint while the error has no `id`. | `SourceAddView.astro:57-59,94-96`; `DestinationAddView.astro:118-120,138-140,157-159`; `TextInput.astro:59,99-108` |
| S24-F5 | S2 | ADOPT | D38 | A **sixth** spelling of the segmented control, in a tree whose canonical rule carries a comment saying there must never be a local copy: `primary/.16` fill, 0px border, 35.5px tall, 7.2px radius, 13px label against the canonical `.14`/1px/32px/6px/12px. | `SourceAddView.astro:138-142` vs `global.css:2470-2520`, `storybook.ts:3137-3154`. **Catalog correction:** the entry's `reference` names `.sb-segtrack` and `grep -rn segtrack apps/` returns **0** |
| S24-F6 | S2 | ADOPT | D37 | On a touch pointer the connection-method option stays a 34px target while every button beside it grows to 44 — it is a `<span>` and matches none of the selectors that grant the floor. | `global.css:617-627`; measured 35.5 @1440 / 34 @390 |
| S24-F7 | S2 | ADOPT | D38 | One family, two promises about a secret: the Postgres field says *"Stored encrypted."*, the PAT field — the one screen where a user pastes an Airtable credential — says nothing about storage at all. | `DestinationAddView.astro:153` vs `SourceAddView.astro:90` |
| S24-F8 | S2 | ADOPT | D38 | A credential the user abandoned is still in the POST body: switching PAT→OAuth hides the token field and keeps its value, and the declared no-JS path posts it. | measured `new FormData(form)` → `method=oauth, token=<typed>` |
| S24-F11 | S2 | ADOPT | D38 | Nothing gates any exit and Destinations dresses a discard as a step control — `Back` and `Cancel` are byte-identical `btn btn-sm btn-ghost` 60px apart, and all three exits drop typed input with no prompt. | `grep -rn beforeunload apps/web/src` → **0 app-wide**. **The ruling is "no guard on a create form", stated in the catalog** — see the D30 amendment |
| S24-F10 | S3 | ADOPT | D38 | No in-flight state, and all four action controls are hand-rolled: the primary never disables, never spins, never gets `aria-busy`. | `SourceAddView.astro:104-109`; `Button.astro:57-61` has the documented `loading` prop |
| S24-F12 | S3 | ADOPT | D38 | `.reg-mono` paints nothing — a PAT and a Postgres URL both render in Urbanist. Two causes: `class` on `TextInput` lands on the wrapper `<fieldset>`, and an Astro-scoped rule cannot reach a child component's element. | `SourceAddView.astro:89,129`; MEMORY `infra-astro-scoped-styles-child-component` |
| S24-F13 | S3 | **DEFER** | D38 | Back from a created object lands on a pre-filled form that looks ready to create it again. **Trigger: the first duplicate-source report** — fixing it properly means moving success off the URL, which is S22-F3's decision, not this one's. | measured: `history.back()` restores `name`, token empty, nothing says a source was made |
| S24-F14 | S3 | ADOPT | X-B | `?type=<unknown>` is swallowed — `/destinations/new?type=bogus` renders the picker with no message and the bad parameter still in the address bar. Same shape as the four object routes; quieter, not better. | measured `pickCount: 9`, href unchanged |
| S24-F15 | S3 | ADOPT | D38 | The family's two headers wear different marks (36×36 `img` vs a 40×40 tinted tile) and its two primaries different glyphs (`lucide--plug` vs `lucide--check`) for the same act — in files that declare themselves ONE FAMILY. | `SourceAddView.astro:8-12,106`; `DestinationAddView.astro:169` |
| S24-F16 | S3 | ADOPT | D38 | Mixed icon language inside one picker: Google Drive, Dropbox and S3 carry full-colour brand marks, the other six monochrome glyphs, so three of nine rows are louder for a reason that is not product meaning. **Ruling: none, not all nine.** The brand-logo exemption exists for marks with *no Lucide equivalent*; `hard-drive` and `database` are equivalents, and dropping three assets costs nothing where sourcing six costs asset work with no owner. | `DestinationAddView.astro:42-46`; `audit/shots/S24-S27-dest-picker-500.png` |
| S24-F19 | S3 | ADOPT | D38 | The tallest block on the source form is an explainer about a method the reader has not chosen — `AccessScopeNote` is **301px of a 619px form at 390** (48.6%), sits above the method choice, and stays fully expanded after PAT is chosen, still opening with *"If you connect with OAuth…"*. Its own contract puts it where the credential decision is made. | `AccessScopeNote.astro:9-13`; `audit/shots/S24-S27-source-pat-500.png`. The `:has()` mechanism at `:145-148` already does this for two other blocks |
| S24-F20 | S4 | ADOPT | D38 | The create-form controller is 60 lines duplicated in two `.astro` `<script>` blocks where `astro check` cannot see it (diff today: one comment word). The scout proposed DEFER; **overtaken** — D38 creates `lib/registry/registryForm.ts` anyway, so deferring would mean touching the same lines twice. | `lib/registry/removal.ts` is the precedent; MEMORY `infra-typecheck-blind-to-astro-scripts` |
| S24-F18 | — | **DEFER (question)** | — | **NOT-OURS.** After a PAT is submitted, is the source *connected*? The button says `Create source`; the registry it lands on says `needs_connection` / `token ••••`. **Trigger: the client's engineer answers.** The answer decides one sentence of copy on each side. | `apps/design/src/fixtures/sources.ts:76-89` |

*Recorded as an instance, not a row:* **S24-F17** — the success alert's inline
`onclick="this.closest('.alert').remove()"` is a second site of **S22-F3**, byte-identical at
`SourcesView.astro:82` and `DestinationsView.astro:86`.

### S25 · S26 — Destinations list and detail

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| S25-F1 | **S1** | ADOPT | D38 | **`Cancel` stops cancelling, silently, and the next `Save` commits a value the user abandoned.** Leaving edit via the `Read` segment neither saves nor reverts; re-entering edit re-captures the dirty value as the new baseline. Nothing on screen says a draft exists. Three exits are live with a dirty input. **This is the file S23 named the audit's reference for the editable-object contract — S23 is corrected in place above and the reference is withdrawn.** | lead-verified in source both files: `SourceDetailView.astro:307-317`, `DestinationDetailView.astro:279-289`; measured end state `readSlot: "Ops Airtable"` / `inputVal: "TYPED-NEVER-SAVED"`; `pattern-panel-edit-mode` (`storybook.ts:5082`) states the opposite |
| S25-F2 | **S1** | ADOPT | D38 | **The app renames the object you just created, at two separate clicks.** A destination created as *"My analytics DB"* is listed under that name; the row link and the detail `Connect` rebuild it from `?new=1&type=` with no `&name=`, so the page is called **"Postgres"**. | `DestinationsView.astro:64-67`, `DestinationDetailView.astro:76`; twins at `SourcesView.astro:54-57`, `SourceDetailView.astro:107`; `audit/shots/S26-connect-drops-typed-name.png`. **PARKED P7 recorded this as fixed** — four callers were; these four are the fifth through eighth and are in `apps/web` |
| S25-F3 | S2 | ADOPT | D38 · D29 | One status, two words, and a fallback that guesses `broken`: the list says `Reconnect`, the detail `Reconnect required`, and the detail's ternary catch-all asserts a broken connection for any status it does not know. | `DestinationsView.astro:26` vs `DestinationDetailView.astro:44-48`; identical at `SourceDetailView.astro:46-50`. The argument against it is written one file away at `DestinationsView.astro:30-42` |
| S25-F4 | S2 | ADOPT (copy) | D38 · **D15 deferred** | You cannot see, reach or act on the Spaces that depend on a destination: a one-column list of names, and a Remove card saying *"Unlink them first"* with no unlink control and no link to one. **Copy half ADOPT now; the columns are filed against deferred D15 and blocked on PARKED P7.1.** | measured `useHeaders: ["SPACE"]`, `role: null`, `cursor: auto` vs the twin's seven columns with `role="button"`; `audit/shots/S26-detail-inuse-1440.png`. **`specs/16-responsive.md:317`'s "one column by design" must be annotated before it is cited as a blessing** |
| S25-F5 | S2 | ADOPT | D38 | The broken-destination alert drops three clauses its twin carries — not *when* access was lost, not *which* account, not *which* credential — and the `Status checked` date is missing from the `dl` while its caveat floats below as loose 12px text. | `DestinationDetailView.astro:90,133` vs `SourceDetailView.astro:52-80`. Content half blocked on PARKED P7.2; placement half is not blocked |
| S25-F6 | S2 | ADOPT | D32 | **`Test connection` has exactly one outcome and it is success** — including on a destination that has never been connected, where it reports *"reachable, credentials still valid."* | `DestinationDetailView.astro:317-322` (one unconditional string); twin `SourceDetailView.astro:345-350` |
| S25-F7 | S3 | ADOPT | D38 · D19 | The `Last write` column prints a status word where a time belongs — right-aligned, `tabular-nums`, `failed` between "2h ago" and "—", on a row whose Status cell already says `Reconnect`. The view's own comment claims the value is *"never written"*. | `apps/design/src/fixtures/destinations.ts:39`; `DestinationsView.astro:52-57`; `audit/shots/S25-list-default-1440.png` |
| S25-F8 | S3 | ADOPT | D38 | The detail page drops the kind glyph the list gives every row, so a Postgres database and a Drive folder open into two visually identical pages — on the one object here that has two kinds. | measured `headerGlyphs` = mode-switch icons only; `DestinationsView.astro:151`; `decision-entity-glyphs` |
| S25-F9 | S3 | ADOPT | D38 | A consequence sentence addressed to an empty list: *"No Spaces use this destination yet."* immediately above *"Changing this connection affects every Space listed here."* | `DestinationDetailView.astro:170` conditioned only on `needsReconnect`; the Remove card two blocks down already branches on `inUseCount` |
| S25-F10 | S3 | ADOPT | **X-A** | Four bordered boxes at **11.2px** beside the catalog's 12px on the same page, and the empty-state glyph is 22px under a comment claiming it is the optical match for the twin's 28px. Four new sites for an already-bound class. | measured `.reg-empty`/`.reg-card` 11.2 vs `.tbl-frame` 12; `DestinationsView.astro:198-200` |
| S25-F11 | S3 | ADOPT | D38 | `kindMeta[d.kind].icon` indexed with no fallback — the third unguarded map lookup in the file that just fixed the other two, six lines above the 13-line comment explaining why. | `DestinationsView.astro:151` vs `:45` |
| S25-F12 | S4 | **DEFER** | **D15 deferred** | Dead keyboard wiring (`.reg-userow[role="button"]` selects **0** elements) and a sortable header over one column. **Trigger: PARKED P7.1 lands** — both lines become correct the moment the rows gain ids; deleting and re-adding is churn. Recorded so the next reader does not conclude the keyboard works. | measured `keyboardWired: 0`; `DestinationDetailView.astro:327` vs `:162` |

*Instances, not rows:* S22-F3 (`DestinationsView.astro:86`) · **X-C** (`:143`, see below) · D07 (list
sort not in the URL) · PARKED P7.1/P7.2/P7.4.

### S28–S31 — the Airtable connect flow

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| S28-F2 | **S1** | ADOPT | D32 | The live connect flow can express **0 of the 19** failure codes the copy deck names, while `StoragePicker` renders 8 of the same 10 in entirely different words. The wizard's connect always succeeds. | lead-verified: `IntegrationsView.astro:51,58` are the only sites of `access_denied`/`api_call_failed`; `StoragePicker.astro:476-493`; `IntegrationsSetupWizard.astro:986-999` (850ms timer, no failure branch) |
| S28-F1 | S2 | ADOPT | D32 | **Downgraded S1→S2** (see above): `/integrations/authorizing` has no error state, no exit and no timeout — `?error=access_denied` returns HTTP 200 with the identical "Authorizing…" DOM and hard-redirects into the wizard after 1,700ms, and its last words before a failed connect are *"Confirming read-only access"*. The surface exists **only in `apps/design`**, so the remedy is to build it in `apps/web`. | `apps/design/src/pages/integrations/authorizing.astro:10,22-28` (lead-read in full); measured `#layout-content a,button` = **0** at 1440 and 390 |
| S28-F3 | S2 | ADOPT | D37 | The two workspace-level controls are bare inputs in `<span>`s — **20×20** hit targets in the same table where a base row is a **1007×41 `<label>`**. | `BaseSelectionTable.astro:527-533,616-629` vs `BasePickerRow.astro:33`; WCAG 2.2 SC 2.5.8 |
| S28-F4 | S2 | ADOPT | D37 | At 390 grouped, the switch that decides "back up every future base in this workspace" is a **27 of 33px** sliver with its column label **entirely off-screen** — on a screen whose own CSS comment chose pan *because* both things it exists to touch are controls. | measured at `scrollLeft:0`, clip `l:13 r:362`; `audit/shots/S30-bases-grouped-390.png`; the decision at `:1004-1025` |
| S28-F5 | S2 | ADOPT | D37 | Edit mode's tab bar collapses to a **four-row, 147px** vertical column at 390 with `Save changes` parked level with the last tab — the same `.sch-tabbar` markup holds one 38px row on `/schema`, which mounts `watchSectionNav` and this does not. | `IntegrationsSetupWizard.astro:112-120` vs `SchemaView.astro:375`, `DataView.astro:342`; `audit/shots/S29-edit-390.png` |
| S28-F6 | S2 | ADOPT | D39 | A **fourth** pagination implementation: `.bst-pager` differs from `TablePager` in every element — page index vs row range, "Show N per page" vs "Rows", labelled Prev/Next vs icon squares, no top rule. | `BaseSelectionTable.astro:678-692,993-996` vs `TablePager.astro:8-9,30-47`, whose comment claims *"there is no second pager left to drift from"* |
| S28-F7 | S2 | ADOPT | D39 · D19 | One plan cap, **three different sentences**, chosen by which control the user touched — all rendered into the same `[data-bst-cap-text]` node. | `BaseSelectionTable.astro:1142,1217,1283,1312,1435,1440,1492` |
| S28-F8 | S2 | ADOPT | D39 | The picker silently changes its navigation model mid-gaze: flat and paginated on arrival, then ~15s later the rows re-home into groups and **the pager vanishes with all 50 rows revealed** — the user touched nothing. `Select all` fills to cap across pages they cannot see. | `applyView` `:1189-1196`, `onResolved` `:1596-1605`; measured both phases. The catalog describes the reflow and never mentions pagination |
| S28-F9 | S2 | ADOPT | D37 | `ConfirmModal`'s controls **shrink** as the viewport narrows — 38px → **27px** at 390, below the app's own `--control-min: 28px` — and `.modal-box` keeps 24px padding. This is the shared destructive confirm, so it lands on every D06 dialog. | measured with the dialog `showModal()`'d at both widths; `specs/16-responsive.md` §6 names `.modal` as one of the four containers |
| S28-F10 | S2 | ADOPT | **D17** | The standalone picker has no zero-base empty state and its one empty sentence states the wrong fact (*"No bases match your filters"* over an account with no bases). The **wizard's** branch of the same step does it right. | `IntegrationsManageBasesView.astro:44`, `.bst-empty` `:674`, unhidden only at `:1193,1202`; vs `IntegrationsSetupWizard.astro:220` |
| S28-F11 | S2 | ADOPT | D37 | The first-run empty card has no narrow fold: at 390 its text column is squeezed to **98px** (title 2 lines, sub 3) beside a 128px button. | measured `.picker-empty` `flex-wrap:nowrap`; `audit/shots/S29-setup-390.png` |
| S28-F12 | S2 | ADOPT | D36 | `/integrations/authorizing` has **no heading element anywhere**; its name exists only in `.tb-title`, which is `display:none` at ≥1280 — so at 1440 the page is nameless. | measured `#layout-content h1,h2,h3` = `[]` at both widths; `IntegrationsManageBasesView.astro:34` does it right and writes down why |
| S28-F13 | S3 | ADOPT | D37 | The 5-step stepper wraps to two rows at 390 and leaves a connector after step 2 pointing into empty space. `pattern-setup-stepper` says nothing about narrow and needs the answer either way. | measured steps at y 151/151/175/175/175, 13.64px `::after` |
| S28-F14 | S3 | ADOPT | D37 | Three card paddings in one flow at 390 — `.tab-body` 20, `.bst-gband` 12, `.modal-box` 24 — none of them 16. | measured all three at 390 and 1440 (identical) |
| S28-F15 | S3 | **ACCEPT** | D39 | The widest column in the grouped table is the one holding a single 20px switch: Auto-add **464.6px (45%)** against a base name capped at 256px. **ACCEPTED, with the reason corrected in the catalog** — the in-file argument that the track is *"pulled tight against the thing it acts on"* is false as measured and must be rewritten or the track capped at `max-content`. Recorded in `pattern-base-picker`. | measured `grid-template-columns: 38.4/256/464.6/96/96` @1440; the claim at `:831-837` |
| S28-F16 | S3 | ADOPT | D32 | The in-flight page announces nothing: no `role="status"`, no `aria-live`, no `aria-label` on the spinner — in a component library where the picker's own progress bar has one. | measured 0 live regions; `BaseSelectionTable.astro:424`, `IntegrationsSetupWizard.astro:365` |
| S28-F17+F18 | S4 | **DEFER** | D20 | **MERGED.** `lib/dashboard.ts:73-78` still points a `setup_incomplete` Space's next step at `/integrations` (302 → `/`, query dropped), and `app-config.json:28` anchors the Backups nav section to the same 302'd prefix. **Trigger: the dead-module sweep / D20 item 3.** | both lead-cited; `stores/dashboard.ts` has no importer at all |

*Instances, not rows:* J01-F5 · J01-F6 (`.method-tabs`) · J01-F10 · J01-F13 · J01-F14 · J01-F15 ·
J01-F20 · J01-F26 · J03-F5 · J08-F2 (two more `/settings/billing` CTAs). *Closed since J01, not
re-adjudicated:* J01-F8, J01-F9, J01-F25, J01-F11's four links.
**D28 has no members in this flow** — its only gate is a two-value numeric cap and both values
render truthfully (verified by the scout, accepted by the lead).

### S32–S35 — Settings · Billing · Profile · Help

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| S32-F1 | **S1** | ADOPT | **D17** | **Settings ▸ Space invents a whole Space for a user who has none** — empty name field, confident defaults, a red **Delete Space** card, and an `Enrolled workspaces` list naming *Growth · 24 bases · checked 2h ago* / *Operations · 14* / *People & Finance · 9 · Auto-enrolled* with live toggles and Un-enroll buttons, under **both** `?fixture=trial` and `?fixture=empty`. **Corrects J08-F15 in place**: the fixture IS read; the empty result is mis-rendered. | lead-verified `settingsCatalog.ts:513` (module constant) and `SettingsView.astro:216` (gated on `current.id === 'space'` only); `:272` `space?.name ?? ''`; `audit/shots/S32-space-trial-390.png` |
| S32-F2 | **S1** | ADOPT | D08 | **"Contact support" is a named dead end** — the product instructs the user to reach support in three places and contains no support address, status page or docs link anywhere. **Upgrades J08-F19 from S3/DEFER.** | lead-verified `grep -rn "mailto:\|support@" apps/web/src` → **0 hits**; `IntegrationsView.astro:503,505`, `settingsCatalog.ts:148`; `/help` → `PlaceholderView` |
| S32-F3 | **S1** | ADOPT | D14 | Billing never states which plan you are on or how much of your allowance you have used — the two rows that promise it carry no value, so the surface whose whole job is that fact renders a door labelled with the answer's description. | `settingsCatalog.ts:350-357,359-366` (`control:'link'`, no `value`); measured pane text matches no plan name under any fixture |
| S32-F4 | S2 | ADOPT | D30 | A read-only field is **pixel-identical** to an editable one — same background, colour, border, `cursor: text`, width; only the attribute differs. A contract with no Edit switch must make "this cannot be edited" visible some other way. | `SettingsView.astro:171-176`; `audit/shots/S32-account-390.png`; the registries' "from capture" marker is the model |
| S32-F5 | S2 | ADOPT | D37 | On a phone every settings control is indented **62px** behind an invisible 54px "Saved" badge — nine toggles on Notifications start 62px right of their own labels with nothing in the gap. | measured `.set-flag` `opacity:0`, width 54; row `x=37`, control `x=99`; `SettingsView.astro:167-170,373,381-384` |
| S32-F6 | S2 | ADOPT | D37 | `.set-input { width: 100% }` is **written and dead** — `.set-rowctl { flex: 0 0 auto }` makes it circular, so controls stay at intrinsic width (155 / 82.2 / 117.2 / 85px in a 316px row) and select values clip to `Daily · 02⌄0`, `Tiered (GF⌄S)` and `⌄ff`. | measured at 390; `SettingsView.astro:365,381-384`; same class as `audit/PARKED.md:827` |
| S32-F7 | S2 | ADOPT | D36 | `/settings`, `/settings/billing` and `/help` render **no `<h1>`**; Settings' page name is an `<h2>` subordinate to a title that does not exist, and the placeholders open at `<h3>`. **Supersedes the stale J08-F23 clause.** | measured `h1` count 0 on all three vs the three reference surfaces; `pattern-page-header` (`storybook.ts:2971`) |
| S32-F8 | S2 | ADOPT | D14 | Two Billing addresses: `/settings?tab=billing` holds the real rows, `/settings/billing` is a placeholder with no breadcrumb, no h1 and no route onward — and **every upgrade CTA in the app points at the placeholder**. D14 §3 says no gate lands on a placeholder; **D14 now has a third and cheapest option it did not have: retarget.** | measured breadcrumbs `[]`, `h1` 0; seven CTAs cited (`SchemaHealth.astro:199,503,580`, `SchemaChat.astro:185`, `CadencePicker.astro:40`, `BaseSelectionTable.astro:385,608`) |
| S32-F9 | S2 | ADOPT | D32 | Billing email accepts any string and flashes **Saved** — the field that decides where invoices go has no format validation; `org-slug` accepts spaces and capitals under a description saying "Used in URLs". | `SettingsView.astro:175` (every row is `type="text"`); `settingsControls.ts:103-123` refuses only the empty string |
| S32-F10 | S3 | ADOPT | D14 | A **ninth** tier-gate dialect D14's census missed: *"Available on Business plans and above."* as plain section help above a `link` row that is not locked, not disabled and carries no lock glyph. | `settingsCatalog.ts:479-492`; `settingsCatalog.ts` is not among D14's surfaces-changed |
| S32-F11 | S3 | ADOPT (documents) | D20 | `specs/13-profile.md` and worklist item S34 both name `/profile`, which returns **404**; the Option A/B/C decision J08-F14 deferred to the client **has already been taken in code**. Retire spec 13 into spec 12, close J08-F14, drop the deferral trigger. **The app side needs no change.** | measured `/profile` → 404; `SettingsView.astro:22-24`, `settingsCatalog.ts:124-128`, `Sidebar.astro:517-522,591-596` |
| S32-F12 | S3 | ADOPT | D08 | The Settings search field is `disabled` with a live placeholder and no explanation — the first element on the page at 390. The page's own convention is that every deferred control prints an honest sentence; this is the one that says nothing. | `SettingsView.astro:103-106` vs `settingsControls.ts:189-197` |
| S32-F13 | S3 | ADOPT | D16 | The button ladder encodes the control's *kind*, not its *consequence*: **Change photo** (opens a picker) and **Sign out everywhere** (ends every session) are both `btn-soft btn-primary`, while **View sessions** is `btn-ghost`. The same file gets it right for `destructive`. | `SettingsView.astro:192` vs `:198-203`; `decision-button-system` |
| S32-F14 | S3 | ADOPT | **D17** | `This page is ready for content.` — developer copy shipped to users on two routes reachable from first-class sidebar nav. | `PlaceholderView.astro:10-11`; `audit/shots/S35-help-390.png`. Lands with S32-F2 and S32-F8, which remove the need for it on both routes |

**The Billing ruling stands as the scout wrote it and the lead adopts it:** Billing is compliant with
`decision-no-tier-gating-default` in what it does — it neither gates nor upsells — and non-compliant
in what it omits. Nothing needs removing; a plan value and a usage value need adding, and the CTAs
need to stop pointing at an empty page.

### S36–S40 — Welcome · Login · Register · 404 · Styleguide

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| S36-F1 | **S1** | ADOPT | D35 | **The auth shell cannot scroll**, so in any viewport shorter than the card the content is clipped at **both** ends with no scrollbar and the primary becomes unreachable: `/welcome?fixture=trial` at 844×390 → `scrollHeight === clientHeight === 390`, card −69.8 → 459.8, `Continue` bottom **459.8**. **The onboarding form cannot be submitted.** | lead-verified `apps/web/src/styles/components/auth.css:6` = `@apply flex h-screen w-full overflow-hidden`; `audit/shots/S36-S38-auth-short-viewport-clipped.png` |
| S36-F2 | **S1** | ADOPT | D32 | **Login and Register refuse nothing:** the error slot is dead markup, `novalidate` kills the browser's guard, an empty submit does nothing at all, and `not-an-email` is confirmed with *"we sent a sign-in link"*. | lead-verified `LoginView.astro:86,99-101,196`; `#login-error` grep → 2 hits, both markup |
| S36-F3 | S2 | ADOPT | D35 | The 390 floor gate is absent from `/login`, `/register` and `/welcome` — the only three routes a signed-out person can reach. **Held S2, not S1, deliberately:** below the floor these pages degrade gracefully; the gate's real cost is that it hid F1. | `SidebarLayout.astro:171-183` renders `#too-narrow`; `AuthLayout.astro` never does. Measured exact where it exists: `none` @390, `flex` @375 |
| S36-F4 | S2 | ADOPT | D34 | **Downgraded S1→S2** (blocks a builder, not a user): `/styleguide` destroys its own content below 1024 — `grid-template-columns: 264px 126px` at 390, `.sb-guide-wrap` needing 561px of min-content in a 44px client box with `overflow-x: hidden`, and `body.sb { overflow: hidden }` so the page cannot pan either. | measured at 390/768/1024; lead-verified `styleguide.astro:312`; `audit/shots/S40-styleguide-390-768.png` |
| S36-F5 | S2 | ADOPT | D23 | `.fieldset-label` prints **12 / 14 / 16px** depending on its parent, and the 16px case is the 2FA failure message — the largest text on the screen after the title. Not auth-only: `/settings?tab=security` prints the same string at 16px. | measured; `CodeInput.astro:67`, `LoginView.astro:99` put the class outside a `.fieldset`. The caption size belongs on the class, not on its ancestry |
| S36-F6 | S2 | ADOPT | **X-B** · D17 | One component ships two unrelated designs for "not found": the scoped branch follows `pattern-empty-state` exactly, the path branch matches nothing — `h3` vs `h1`, 80px bare glyph vs a 48px tile, unsized `btn` vs `btn-sm`, `max-w-md` vs `44ch`. Fixing it clears the live `ds-lint` row. | `NotFoundView.astro:29-40` vs `:42-55`; **lead re-ran `ds-audit`: `NotFoundView.astro L50 unsized control = md` confirmed verbatim**; `audit/shots/S39-404-generic-vs-scoped.png` |
| S36-F7 | S2 | ADOPT | D36 · D23 | The whole 404 page is off the compact type scale — icon 80px, `h3` 24px, body 16px, **identical at 390 and 1440**, on a product whose narrow body copy is 12–14. `text-[80px]` is an arbitrary literal and the paragraph carries no size class at all. | measured at both widths; `specs/16-responsive.md` §2 |
| S36-F8 | S2 | ADOPT | D35 · D36 | No `<h1>` on any signed-out route or on the path 404 — the page title is an `h2`, or an `h3`, while the *same component's* scoped branch uses `<h1>`. | measured `h1` count 0 on `/login`, `/register`, `/welcome` and four `?state=` variants; `NotFoundView.astro:33` vs `:44` |
| S36-F9 | S2 | ADOPT | D35 | Welcome is the only screen in the family with no brand mark and no footer — the screen a new user spends longest on is the one that stops looking like the product. | measured `hasLogo:false, hasFooter:false` vs `true/true` on both siblings; `WelcomeView.astro:20-22` |
| S36-F10 | S2 | ADOPT | D07 | The "check your email" panel offers *Try a different email* and **no resend**, and the state is not addressable — a refresh loses it, because the panel swap is `classList` only with no `history` write. Same divergence as J01-F8. | `LoginView.astro:126-128,205-206`; `sectionTabs.ts` writes `?tab=` for exactly this reason |
| S36-F11a | S2 | ADOPT | D32 | **The expired-link screen does not exist** — the commonest failure of a passwordless product. The sent panel promises *"The link expires in 5 minutes"* and nothing renders the moment it does. | grep `expired` over `apps/web/src` → connection-expiry copy only; `LoginView.astro:116` |
| S36-F11b | S3 | **DEFER** | D32 | **SPLIT from F11.** "Already signed in" and "link issued for a different account" are not built anywhere. **Trigger: better-auth link handling is wired** — all three states land together, and designing two of them against an unwired model is speculation. | grep → 0 for both |
| S36-F12 | S2 | **ACCEPT** | D35 | The signed-out routes are hard-locked dark regardless of the user's theme (`AuthLayout.astro:27` writes `data-theme="baseout"` literally; measured, a light theme does not reach `.auth-panel`). **ACCEPTED as a brand decision** — a signed-out brand surface is a different job from a signed-in tool, and the theme has not been chosen yet at that point in the session. **The reason is recorded in the new `pattern-auth-screen` entry, and the dead light-logo branch at `auth.css:140-154` is deleted with it** — an ACCEPT that leaves unreachable code behind is half an ACCEPT |
| S36-F13 | S2 | **RATIFY** | D35 | The product's front door is built from a family the catalog does not document at all: 113 entries and **0** hits for `auth-card` / `auth-layout` / `LoginView` / `WelcomeView`; `auth.css` is 267 lines and ~30 classes. This is the worst case the charter names — reused **and** invisible, so it drifts. **RATIFY the family into the catalog as `pattern-auth-screen`; its absence is why F1, F5, F8, F9 and F12 all shipped.** | lead-verified `SB_ENTRIES` = 113 |
| S36-F14 | S2 | ADOPT | D34 | The catalog's own chrome breaks the rules the catalog states — **9.5px**, 10.5px and four 11px sizes below its own 12px floor, and a class-less `<input>` beside its own `input` entry. **Mechanism: the file lives in `apps/design`, so `ds-lint` has never inspected a line of it.** | measured; lead-verified `.claude/hooks/ds-lint.mjs:40-50` scopes `apps/web/src` only |
| S36-F15 | S2 | ADOPT | D34 | The catalog can only be read one entry at a time and cannot be searched by content — **112 of 113** sections carry `hidden` and the search filters `data-name` only, so find-in-page over the rules returns nothing. | measured; the repo tells builders to read the `.ts` instead, which is the admission |
| S36-F16 | S3 | ADOPT | D19 | The lockout screen states the same fact twice, 4px apart, at 14px and 16px. | `AuthChallengeView.astro:43,86-91` |
| S36-F17 | S3 | ADOPT | D36 | Three page-title formats across five surfaces: `Sign In — Baseout`, `Page Not Found \| Baseout`, and a bare `Welcome` with no product name. | `apps/design/src/fixtures/auth.ts:98`, `apps/design/src/pages/welcome.astro:12`, `AuthLayout.astro:14` |
| S36-F18 | S3 | ADOPT (documents) | D20 | `specs/03-login.md` and `specs/04-register.md` describe a page that no longer exists — a disabled Google row, a **Material** `mail` icon (forbidden by CLAUDE.md), wrong labels, wrong subhead, and the claim that the page is not assembled from a shared view when Register **is** Login in `register` mode. Neither doc mentions Airtable SSO, 2FA or the domain fork: the three biggest things on the surface. `03:75` also blesses the dead `#login-error` slot of F2. | both cited by line; same class as S10-F14 / J01-F11 |
| S36-F19 | S3 | ADOPT | X-B | The 404 never says which page failed and offers one exit where `specs/15-not-found.md:60-64` asks for 1–2. **The second exit is ADOPT now; the path echo is DEFERred — trigger: a ruling on whether echoing a user-supplied path is safe to render.** | `NotFoundView.astro:45-54` |
| S36-F20 | S3 | ADOPT | D35 | The Welcome greeting sets a raw email address in a 24px heading, wrapping across three lines at 390 — greeting a person by the identifier the form exists to replace. | `WelcomeView.astro:21`; `audit/shots/S36-S38-auth-390.png` |
| S36-F21 | S3 | **RATIFY** | D20 | `specs/16-responsive.md:685-687` still argues the Sources-registry row shape should FOLD; **both registries pan today** and one says so in-file. **The app is right; correct §12.2b and re-check the "3 FOLD identified but not applied" tally at `:311`/`:355`.** | `SourcesView.astro:114,129`, `DestinationsView.astro:119` |
| S36-F22 | S4 | ADOPT | D34 | The charter and the catalog disagree on the catalog's size — `audit/01-charter-ux.md:36` says 96 entries; there are **113**. | lead-verified `grep -c "^    id: '"` = 113 |

*Recorded, not filed:* J01-F16, J01-F17, J01-F28 (Welcome rows already registered) · no 500/403
surface (`specs/15-not-found.md:75-79` calls it separate work) · four harness/NOT-OURS notes
including `?fixture=trial` being a no-op on `/welcome`.

### Two rows filed by the lead, not by a scout

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| **G-A** | S2 · **GATE** | ADOPT | **D33** | **`pnpm smoke` is green on states it never reaches.** `/settings` declares six variants and none is a fixture, so `?fixture=trial\|empty` is walked by nothing — which is how S32-F1's invented Space survived. `/integrations/configure/bases` declares `fixture=empty` and the route has no `empty` branch, so the gate has been requesting the 50-base default under an empty label since the variant was added. `/login` and `/register` declare zero variants, leaving ten guarded branches unwalked. **Fourth recorded gate blind spot.** | lead-verified `smoke.mjs:225,243,245`; `bases.astro:16-20` |
| **X-C** | S3 | ADOPT | D16 | **Row navigation by `onclick="window.location=…"` finally gets a register id.** Recorded app-wide by S19, cited again as a "seventh site" by S22-F6 and an "eighth site" by S25 — three passes have now asked for an id and none was issued. Eight sites; a link that behaves like a button, unreachable by middle-click, `Cmd`-click or the keyboard's own navigation. | `DestinationsView.astro:143`, `SourcesView.astro:105`, and the six S19 recorded |

### This wave's counts

| severity | rows |
|---|---|
| S1 | 9 |
| S2 | 42 |
| S3 | 29 |
| S4 | 4 |
| (no severity — NOT-OURS question) | 1 |
| **total** | **85** |

| disposition | rows |
|---|---|
| ADOPT | 76 |
| RATIFY | 2 (S36-F13 · S36-F21) |
| ACCEPT | 2 (S28-F15 · S36-F12 — both with the reason recorded in `storybook.ts`) |
| DEFER | 5, every one with a trigger (S24-F13 first duplicate-source report · S24-F18 engineer answers · S25-F12 PARKED P7.1 lands · S28-F17+F18 dead-module sweep · S36-F11b better-auth link handling wired) |

### Ship-first order for this wave

1. **S36-F1** — the auth shell scrolls. One CSS rule, five screens, and it is the only row here that
   makes a form unsubmittable. Pair with **S36-F3** (the gate moves into `Layout.astro`) so the next
   viewport regression is reported rather than hidden.
2. **S25-F1** — `Cancel` cancels again. Two files, one state machine, and the audit's own reference
   is the thing that is broken.
3. **S32-F1** — Settings stops inventing a Space, with a Delete button, for a user who has none.
4. **S36-F2 + S24-F9** — the front door and the credential forms can say "no". Both are D32 and both
   are small; S28-F2 (moving the 19-code deck into the live flow) follows in the same PR series.
5. **S25-F2** — the app stops renaming the object you just created.
6. **G-A / D33** — `smoke.mjs`. Do this **before** the fix waves, not after: it is an hour, it costs
   the client nothing, and without it the four rows above ship back into an unwatched hole.
7. **S32-F2 / S32-F8** — the support dead end and the two Billing addresses. Retarget the eleven
   CTAs first (one line each) and the placeholder can be deleted rather than built.
8. **D36** (one page name) and **D37** (one narrow tier) as sweeps, batched by surface, after the S1s.
9. **D34** (the catalog) — no client PR, so it can run in parallel with everything above.
10. **D38's remaining members** and **D39** last: they are the largest diffs and the least urgent,
    and D38 should land as one `lib/registry/` module rather than as eighteen edits.

### Under-audited — named, not smoothed over

1. **Every geometry number in this wave was taken in a private headless Chrome or a same-origin
   iframe, not in the shared browser.** Four scouts ran concurrently and the Chrome MCP's global
   page selection was stolen a documented **twelve** times across the five files, twice returning
   another route's DOM under a probe. The iframe method is sanctioned by `specs/16-responsive.md:344-347`
   and the numbers are internally consistent, but **no number in this wave was verified twice by
   two instruments**, and I did not re-measure any of them myself.
2. **Chrome would not lay out below ~500px on this machine.** Every screenshot labelled 390 is a
   500-wide layout cropped (the scout verified this by shooting the same URL at both widths and
   getting the identical clip point). So **every 390 claim rests on iframe `getComputedStyle`
   alone**, and the shots cannot corroborate it. This affects S24-F1/F6/F19, S28-F4/F5/F11/F13,
   S32-F5/F6 and S36-F1 — ten rows, including the wave's headline S1.
3. **S27 (Destinations ▸ new) has no independent audit.** It was folded into S24's file as "one
   family, audited together". The merge is argued and the diff is real, but a surface that was
   audited *as a twin* has not been asked whether its own job differs.
4. **S31's severity ruling rests on a file I read and a route I did not load.** I read
   `authorizing.astro` in full and confirmed the harness-only claim; I did not run
   `curl -D- '?error=access_denied'` myself. The HTTP-200 claim is the scout's, unverified by me.
5. **S25-F1's browser measurement is unverified by me.** I confirmed the *cause* in source on both
   files — which is the load-bearing half and is conclusive — but the measured end state
   (`readSlot` / `inputVal`) is the scout's alone.
6. **`S33 /settings/billing` is thin by nature and thin in the file.** It is thirteen lines of
   harness pointing at `PlaceholderView`; three findings describe its absence and none describes
   what should be there beyond `specs/12-settings.md`'s six bullets. **This is the wave's thinnest
   item** and D14's "retarget rather than build" ruling is what makes that acceptable — if the
   client instead wants the page built, S33 needs a real pass.
7. **`S35 /help` likewise.** S32-F2 upgrades it to S1 on the strength of a grep, which is sound, but
   nobody has designed the four blocks `specs/14-help.md:42-82` asks for, and open decision #6
   (does a support channel exist at all) **has never been put to the client**. That question is the
   blocker, not the design.
8. **Long-value states are unmeasured across the entire wave.** No fixture anywhere in Sources,
   Destinations, Settings or the base picker holds a long name: `DestinationsView` has no `truncate`
   where its twin does, `.set-rowname`/`.set-rowdesc` have no `text-overflow`, `.bst-gwsid` is
   documented as yielding before the name and was never tested. Five surfaces, one unlooked-at
   state.
9. **The wizard's `capblocked` and `wsnames=none` branches are reachable only inside the wizard**,
   so the limited-access picker and the cap-blocked workspace chip were judged from the wizard's
   render only, never on the standalone route that hosts the same component.
10. **`Enrolled workspaces` above 3 has no behaviour anywhere.** The constant is length 3, there is
    no pager and no "show N more", and nothing was measured above 3 — so S32-F1's fix has no
    specified overflow treatment to adopt.
11. **No second reader on any row in this wave**, as with the three waves before it.

---

## X01–X15 adjudication (the sixteen cross-cutting lenses) — 2026-08-14, sixth and final wave

**Adjudicated by `audit-lead`.** **77 rows** from 84 raw scout findings across **five** files
(3 findings merged into 1 cross-lens row · 3 findings merged into other rows · 3 findings recorded
as instances of already-registered rows · 1 finding split into 2 rows on disposition · 1 row
lead-filed). **Ten new decisions (D40–D49)**; twelve existing decisions extended, three of them
completed or corrected in place. **X16 was not lens-passed** — `specs/16-responsive.md` is the
standard and carries its own measurements; re-deriving it was explicitly out of scope.

**The fifth findings file, `audit/findings/X10-X11-X14.md`, was not in this step's input list. The
lead read it and adjudicated it anyway** — leaving three lenses unregistered would have shipped an
audit that claims completeness it does not have. It contributed 15 rows, 3 duplicate-instances and
one new decision (D49).

**Register total: 501.** **This is the last wave; the audit's adjudication is complete for all
sixteen lenses and all forty surfaces.**

### Verification, run by the lead today (2026-08-14)

Gates, verbatim:

- `corepack pnpm@11.1.1 run ds-audit` → `ds-lint: 6 design-system issue(s), across 208 file(s). Fix
  them or mark a line ds-ok. A UI task is NOT done until this is clean.` / `[ELIFECYCLE] Command
  failed with exit code 1.` — re-run bare to read the code: **exit 1**.
- `corepack pnpm@11.1.1 -r --parallel run typecheck` → **exit 0** (`apps/web`, `apps/design`,
  `apps/survey`, 0 errors / 0 warnings).

Source spot-checks. Every S1 and every load-bearing count below was re-read by the lead:

| claim | result |
|---|---|
| `.sch-empty*`'s five rules are byte-identical in two view files | **CONFIRMED** — `DataView.astro:330-334` ≡ `SchemaView.astro:353-357`, character for character, including `max-width: 44ch` |
| there is no `EmptyState.astro`, no `Alert.astro`, no `Table.astro` in `components/ui/` | **CONFIRMED** — the directory holds `TablePager.astro`, `Badge.astro`, `Modal.astro`, `Drawer.astro`, `PanelHost.astro` and 20 others; none of the three |
| the sentence cap has seven values and **46ch has six files** | **CONFIRMED by re-census** — 42ch ×1 · 44ch ×2 (one copied block) · **46ch ×6** (`SchemaRelationships:559`, `SchemaDocs:359`, `ReportDefinitionView:1070`, `ReportsView:504`, `RestoreView:791`, `RestoreHistoryView:383`) · 48ch ×2 · 52ch ×2 · 56ch ×1 |
| three registries label an unknown status `Cancelled` | **CONFIRMED verbatim** — `BackupsListView.astro:208` `statusMeta[r.status] ?? statusMeta.cancelled`; `BackupRunDetailView.astro:189` `runStatusMeta[run.status] ?? runStatusMeta.cancelled`; `RestoreHistoryView.astro:175`; `ReportsView.astro:136` falls back to `statusMeta.issues` |
| `bg-base-content/40` has zero literal occurrences | **CONFIRMED** — `grep -rn "bg-base-content/40" apps/web/src apps/design/src` → **0**, against the interpolation at `ReportBodyKpi.astro:164` read in full |
| `panelStack` / `PanelHost` never call `.focus()` | **CONFIRMED** — `grep '\.focus()'` over both files → **0** |
| `Drawer` asserts `aria-modal="true"` twice | **CONFIRMED** — `Drawer.astro:35` and `:56` |
| `Breadcrumbs.astro` has zero importers | **CONFIRMED** — `git grep -a -l "ui/Breadcrumbs" -- 'apps/**'` returns **only** `apps/design/src/lib/storybook.ts` |
| twelve rows navigate by `window.location=` | **CONFIRMED, all twelve at the exact cited lines** — `ReportBodyKpi:229,281,360` · `BackupRunDetailView:436` · `BackupsListView:229` · `DestinationsView:143` · `ReportDefinitionView:232` · `ReportsView:154` · `RestoreHistoryView:196` · `SourceDetailView:182` · `SourcesView:154` · `SpaceHomeView:289`. `grep -c` over the tree = **12**, no thirteenth |
| the three toolbar copies are byte-identical | **CONFIRMED** — `BackupsListView.astro:383`, `ReportsView.astro:441`, `RestoreHistoryView.astro:332` all read `display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 1rem;` |
| `collapsingSearch` is keyed on `.sch-tb-search` only | **CONFIRMED** — `const WRAP = '.sch-tb-search'` |
| `aria-sort` and `scope="col"` are absent tree-wide | **CONFIRMED** — 0 and 0 |
| `badge-soft badge-neutral` is live in three files | **CONFIRMED** — `BackupRunDetailView.astro:530`, `BackupRunBaseView.astro:325`, `SchemaCanvas.tsx:646`; the ban is quoted at `inbox.ts:137` |
| the badge/alert counts | **CONFIRMED** — `badge-soft` 175 · `badge-ghost` 68 · `alert-soft` 77 · `<Badge` 10 call sites in 6 files |
| `inbox.ts` `ago()` floors and drops "ago" | **CONFIRMED** — `Math.floor` on all three units, `now`/`5m`/`3h`/`3d`, `fmtDayShort` after 7 days. 90 minutes prints **`2h ago`** via `time.ts` (`Math.round`) and **`1h`** via `inbox.ts` |
| `SchemaHealth` marks its column band `aria-hidden` | **CONFIRMED** — `<div class="hl-metrics-head tbl-colhead" aria-hidden="true">` |
| `SchemaDocs` hand-rolls a `<dialog class="modal">` delete confirm | **CONFIRMED** — `SchemaDocs.astro:263-266` |

**Two scout claims corrected, neither fatal to its row.**

1. **Citation path.** `StoragePicker.astro` is at `apps/web/src/components/backups/StoragePicker.astro`,
   not under `components/integrations/`. Four audit files cite it bare. Line numbers and substance
   are correct (`:121` solid `alert alert-error`, `:476-493` the eight developer-voiced codes,
   `:500` `error_code:`).
2. **`UNVERIFIED` sub-claim.** X05's ARIA census records `role`=none for `StoragePicker.astro:121`.
   The element carries `role="alert"` at `:120`. The five-role spread is real; the "none ×2" cell is
   overstated by at least one and is marked **UNVERIFIED** — X05-F1 does not rest on it.
3. **Counts have grown since the scout's pass.** `<th`-declaring files is **24** today (scout: 23);
   `.tbl-colhead` files **18** (scout: 17). The ratio is unchanged and the finding is unaffected;
   recorded because a census that drifts between the pass and the ruling will drift again before the
   fix.

### The two things this step was asked to settle

**D17 (`one-empty-state`) is COMPLETE.** The vessel is bound (Oleh, 2026-08-14), the census landed,
and the four conditions are named. **The sentence cap is bound to 46ch** — six files against 44ch's
two (which are one copied block) and 48ch's two. The catalog's "~44ch" and S06-F10's "48ch" are both
amended to 46ch in `audit/decisions/17-one-empty-state.md`. D17 is no longer interim.

**D19 (`one-status-vocabulary`) CANNOT be completed, and the block is now exact.** Its deliverable is
the app-wide state-word table, and the table cannot be written until three rulings exist:

| # | ruling | who binds it | status |
|---|---|---|---|
| 1 | Is `Badge.astro` the component every status passes through, or is the raw class string RATIFIED and `Badge` demoted from "reference"? | **Oleh — ALREADY MADE**, 2026-08-14: `Badge.astro` is the **only** path. | **BOUND.** The lead binds the sub-clause as D44: `Badge` takes `{ label, tone }` from a registry, and the two zero-caller variants (`secondary`, `tertiary`) are deleted rather than documented. |
| 2 | Is `Running` **primary** (the catalog, 0 adopters) or **warning** (8 live sites)? | **Oleh only.** | **OPEN.** The `decision-density-sm-is-default` precedent says the shipped surfaces win and the catalog changes — but making `Running` amber leaves the app with **no in-progress colour distinct from degraded**, and amber already carries paused, degraded, stale, removed and tier-gate. That is a taste call with a real cost either way; the lead will not bind it. |
| 3 | Do the badge entry's ~10 prose rules become regex checks in `.claude/hooks/ds-checks.mjs`? | **Oleh only** — it is his gate, and switching the `badge-soft badge-neutral` check on turns `ds-lint` red in three files nobody is touching. | **OPEN.** The lead's recommendation is **yes for the two mechanically-detectable ones** (the banned pair, and error-red on a non-failure literal). X08-F6 is a stated ban live in three files with every gate green — prose in the catalog is not enforcement. |

Until #2 lands, the *word* column of the state-word table is writable and the *colour* column is not.
D19 therefore stays **INTERIM**, with X08-F4 as its open row. Everything in D19 that does **not**
depend on the colour column — the fallback contract (D43), the vessel (D44) and the verb/label rules
— is bound now and ships without it.

### The mechanism this wave honours

**Astro scoped styles cannot cross a file boundary.** That is not a footnote; it is the cause. Five
`.sch-empty*` rules are declared byte-identically in two view files because a third adopter would
need a third copy. It is why there are 28 empty-state families and 9 header constructions and 5
alert vessels — and it is why **a remedy that leaves the rule in a view's `<style>` is not a remedy**.
Every D40–D48 change below moves the rule into a component (whose scoped style travels with it) or
into `global.css`. A "sweep" that re-types a corrected value into 26 files is explicitly rejected.

### New decisions

**D40** one column header, one sort · **D41** one listing chrome · **D42** one alert vessel ·
**D43** a registry answers the state it does not know · **D44** `Badge.astro` is the only path ·
**D45** one overlay model · **D46** one clickable row · **D47** one breadcrumb ·
**D48** one glyph map · **D49** one busy affordance.

Extended or corrected: **D06 · D07 · D08 · D09 · D15 (deferred — one new member) ·
D16 (X-C superseded) · D17 (COMPLETE) · D19 (still interim, block stated) · D21 (baseline
corrected) · D28 · D30 · D32 · D33 · D34**.

### X01 · X02 · X03 — tables, toolbars, pagination

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| X01-F1 | S2 | ADOPT | D40 | **Nine constructions for one column-label band, drifting in five metrics at once** — 4 opacities (.45/.55/.60/.65), 2 weights (600/700), 2 sizes (11/12px), 2 tracking values, 3 border-tops. Backups → Schema Automations → Home reads the same label in three weights and three greys. | **Counts re-taken 2026-08-14 with `/usr/bin/grep -a`: 19 of 25 files** (`<th`-declaring files **25**, `.tbl-colhead` files **19** — the register's 24/18 and the scout's 23/17 were `ugrep` figures that silently skipped `DataBrowse.astro`, which holds 5 `<th` and 2 `.tbl-colhead`; see X-M19. The ratio is unchanged and the finding is unaffected). `global.css:1851-1858` (the recipe) vs `SchemaAutomations.astro:356` · `SchemaRelationships.astro:420` · `SchemaInterfaces.astro:358` · `RecordPanel.astro:764` · `SchemaBrowse.astro:729` · `SpaceHomeView.astro:269,326` · `StaticImport.astro:123` |
| X01-F2 | S2 | ADOPT (catalog half) | D40 · **D15 deferred** | **The cause, and it is two causes.** (a) `components/ui/` ships `TablePager.astro` and **no** `Table.astro`/`TableHead.astro`, so the catalog hands out a CSS class plus a function and every author retypes the markup; (b) all **three** catalog table examples demonstrate `<tr class="text-xs uppercase tracking-wider">` rather than `.tbl-colhead`, and `SpaceHomeView.astro:269` is that example verbatim — **the catalog is teaching the drift**. The catalog half is ADOPT now under D34/D40. **The `Table.astro` half is filed against deferred D15 — not closed, not scheduled into Wave 3.** | `storybook.ts:1550,2597,3055` vs `storybook.ts:1523-1524`; lead-verified `ls apps/web/src/components/ui/` — no `Table.astro`; `TablePager.astro:4-11` records the same problem solved by making a component |
| X01-F3 | S2 | ADOPT | D40 | **Sorting is mouse-only on 23 of 24 tables and silent to a screen reader on all 24.** `wireTableSort` delegates a click off a bare `<th>` with no `tabindex` and no key handler; `aria-sort` **0** and `scope="col"` **0** tree-wide (lead-verified). A keyboard user cannot sort the backup audit log — the one screen whose job is "prove it ran". | `tableSort.ts:54-63`; `DataMedia.astro:411-413,431-433` is the only table with real `<button>` headers; `global.css:1864` exists **specifically** so a `<button>` inside `.tbl-colhead` still paints correctly |
| X01-F4 | S2 | ADOPT | D40 | **Four sort-attribute vocabularies and four sort glyphs, two of them inside one component.** `SchemaBrowse` paints the shared CSS caret on its flat table and an 8px unicode `▲/▼` on its tree. #1/#2 are index-keyed and #3/#4 name-keyed, so moving a column in markup silently re-points the sort on 20 tables and does nothing on 2. | `tableSort.ts` · `ReportsView:281` + 5 siblings · `SchemaBrowse.astro:393-396` vs `:695-697` · `DataMedia.astro:1133` · shared caret `global.css:2574-2591` |
| X01-F5 | S2 | ADOPT | D40 | **The shared sort mechanism is selector-bound to `<th>`, so the three lists built from `<div>`/`<span>` grids could not adopt it and grew a toolbar sort menu instead.** Health and Docs sort from a `btn-square` dropdown; every other list sorts by clicking a header. Clicking Health's column label does nothing. This is structural, not careless. | `SchemaHealth.astro:212-213,295,730` · `SchemaDocs.astro:114-115` · `SchemaInterfaces.astro:357-358` · rule `global.css:2567` (`[data-sort-col]`) · sibling `SchemaAutomations.astro:232-236` which *is* a `<table>` and does sort |
| X01-F6 | S2 | ADOPT | D40 | **A reference surface breaks a rule the catalog states in its own words.** Schema Health marks its column-label band `aria-hidden="true"` — verbatim the `table` entry's usageDont. **Filed against the reference**, per the charter. | lead-verified `SchemaHealth.astro:295` = `<div class="hl-metrics-head tbl-colhead" aria-hidden="true">`; `storybook.ts:1513` usageDont, last bullet |
| X02-F7 | S2 | ADOPT | D41 | **The collapsing search and the word-dropping toolbar reach `.sch-tb` only, so the same field behaves two ways at one window width.** At 1280 the Schema search is a 32px magnifier and its buttons are icons; Backups, Reports and Restore-history keep a full-width search and wrap to two rows. Same job, same width, two answers. | lead-verified `collapsingSearch.ts:15` `const WRAP = '.sch-tb-search'`; `toolbarFit` mounted from `DataView.astro:341` and `SchemaView.astro:374` only; `global.css:2244,2277-2287`; `BackupsListView:145,383` · `ReportsView:98,441` · `RestoreHistoryView:133,332`. **`NEEDS-MEASUREMENT`** for the wrap height — not measured by anyone |
| X02-F8 | S3 | ADOPT | D41 | **One toolbar rule, three byte-identical private copies** — `.bl-toolbar`, `.rpl-toolbar`, `.rh-toolbar` each declare `display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:1rem;`. Three names for one thing is exactly what made them invisible to X02-F7's mechanism. | lead-verified byte-identical at `BackupsListView.astro:383` · `ReportsView.astro:441` · `RestoreHistoryView.astro:332` |
| X02-F9 | S3 | **RATIFY** | D41 | **`toolbarFit.ts` is not dead and must not be deleted** — it is the sole writer of `data-narrow`, and six CSS rules die with it. It measures `#layout-content`'s `clientWidth` rather than the viewport **because a media query cannot see split view**, and the header comment carries the measurement that produced the number. Ratified into the catalog as the toolbar's width answer; the open "delete it?" question resolves as **extend its reach**. | `toolbarFit.ts:4-16,18,37-40,49-50`; consumers `global.css:2244,2277,2278-2280,2285,2286,2287` |
| X02-F10 | S3 | ADOPT | D41 | **`ExportControl`'s word-drop is orphaned on Reports.** Its label lives in `.sch-tb-lbl`, which only drops inside `.sch-tb[data-narrow]`; `ReportDetailView` contains zero `.sch-tb` and never mounts `watchToolbars`, so the identical control keeps its word there and loses it on nine other surfaces. The `\|\| root.parentElement` fallback at `:380` shows the case was known and left. | `ExportControl.astro:82,88,380`; `grep -c sch-tb views/ReportDetailView.astro` → 0 |
| X03-F11 | S3 | ADOPT | D41 | **Four sentence shapes for one "show more" control** — `Show 50 more — 1,240 left` · `Show 25 more of 340` · `Show 3 more referenced fields` · `Show 3 runs`. The catalog picks one ("say what is left") and two of the four ignore it. | `pickerSearch.ts:559` · `SchemaBrowse.astro:841` + `recordReadBody.ts:387` · `SchemaRelationships.astro:205` · `inbox.ts:199-203` vs `storybook.ts:3067` usageDo |
| X03-F12 | S3 | ADOPT | D41 | **Six tables can grow past a screen with neither a pager nor a cap, and no written threshold says when one is owed.** `pattern-table-toolbar` says "any set that can grow" and never names a row count, so "can grow" is a judgement made six times as "no". | 0 `TablePager` hits in `SourcesView` · `DestinationsView` · `SourceDetailView` · `DestinationDetailView` · `BackupRunDetailView` · `BackupRunBaseView`, against `RestoreView`/`BackupsListView` which mount it. Two of the six are already inside D15 §3 — **do not double-count**. **`NEEDS-MEASUREMENT`** for real row counts |
| X01-F14 | S3 | ADOPT | D19 | Two labels for one control: **"Clear filters"** (10 sites) vs **"Clear"** (3). D19 item 5 ("one act, one verb") already governs it; this is the instance list. | `DataChangelog.astro:222` and siblings vs `BaseSelectionTable.astro:457` |
| X01-F15 | S3 | ADOPT | D34 | **The pager's catalog example contradicts the pager's catalog rule.** `pattern-table-toolbar`'s usageDont says "don't hand-copy the pager markup"; its own example hand-types a *different* pager — `Prev`/`Next` text on `btn-outline` (deprecated by `decision-button-system`) where the real one is two square-ghost chevrons — plus `checkbox-xs`, `badge-xs` (below the SM/12px floor) and a raw inline `style="background:color-mix(…)"`. **Not a new finding: it is a measurement of D34**, and the sharpest one yet. | `storybook.ts:3055-3063` vs `TablePager.astro:31-45` |
| X01-F16 | S4 | **DEFER** | D21 | Six files carry a near-identical private `getValue` closure **plus the same explanatory comment** to read `data-sort-<n>` off a row. Invisible to the user. **Trigger: the seventh copy, or D40's sort work touching any of the six** — at which point `tableSort.ts` takes a default extractor and all six delete. | `ReportsView:281-283` · `ReportDefinitionView:847-848` · `SourcesView:197-199` · `SourceDetailView:373-375` · `DestinationsView:186-187` · `DestinationDetailView:345-347` · `DataComments:1060-1062` |

*Merged out:* **X01-F13** (no list's sort or page is addressable — `tableSort.ts:30-31` holds sort in
a closure; `page` is ephemeral by written contract) is **one finding with X12-F3**, not two. It is
recorded as an instance under X12-F3's row and is **not** double-counted. The `pageSize`-persists /
`page`-resets asymmetry is deliberate and correct and stays.

### X04 · X05 · X08 — empty states, alerts, status vocabulary

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| X04-F1 | S2 | ADOPT | **D17** | **D17's own reference is a hand-copy, which is why the system could not spread.** `.sch-empty`'s five rules are declared byte-identically in two view files **because an Astro scoped style cannot cross a file boundary** — a third adopter needs a third copy, and that mechanism produced 26 file-local families across 30 files. The remedy is the bound component, not a shared class: `global.css` already carries two orphaned attempts (`.cl-empty`, `.pk-empty`) that nobody adopted. | lead-verified byte-identical `DataView.astro:330-334` ≡ `SchemaView.astro:353-357`; `ls components/ui` → no `EmptyState.astro`; 28 families enumerated in `audit/findings/X04-X05-X08.md` §7 |
| X04-F2 | ~~S3~~ **S4** | ADOPT | **D17** | **CORRECTED 2026-08-14 (measured): variance with zero rendering payoff.** At 390 the cap **never binds, 5 of 5** — the centred shrink-to-fit container binds first (painted 300–316px against caps of 326–357px). At 1440 the cap binds exactly, but **42ch and 46ch produce identical line counts in 5 of 5** sentences; only the 46-vs-56 gap moves anything, and only on 2 of 5. **46ch stands as bound — seven numbers for one job is the variance this audit exists to remove — but it must be scheduled as a zero-user-impact tidy and never bundled with work claiming a visual difference, because there is none to find.** Original row: **Seven sentence caps for one measure**, and the catalog states an eighth reading. **BOUND: 46ch**, six files, the plurality — the entry's "~44ch" (2 files, one copied block) and S06-F10's 48ch (2 files) are both minority readings and both are amended. | lead re-censused all `max-width: *ch` in `apps/web/src`: 42 ×1 · 44 ×2 · **46 ×6** · 48 ×2 · 52 ×2 · 56 ×1 · none (`.reg-empty`). ~~Painted line length is `NEEDS-MEASUREMENT`~~ **MEASURED 2026-08-14** — line counts via `Range.getClientRects()` on five `?fixture=empty` routes at exactly 1440 and exactly 390 (`emulate`, not `resize_page`); `1ch` = 8.3701px at 14px and 7.7722px at 13px, so every `ch` cap silently shrinks 7.1% below 1280 *on top of* never binding there. `audit/findings/X-MEASURED-BROWSER-2026-08-14.md` §C2. **Scope note on the census:** D17's table counts the empty-state population; a tree-wide `/usr/bin/grep -a` for `max-width: *ch` finds 46ch in **7** files (the seventh, `DestinationAddView.astro`, is a form hint, not an empty state) and 56ch in 5. The plurality reading is unaffected |
| X04-F3 | S3 | ADOPT | **D17** | **The empty-state tile disagrees with the catalog's own example and with D23's card token in 14 of 15 declarations** — radius `.8rem` (12.8px) ×10 against the 12px token, `999px` ×2, `7px` ×1; fill `base-100`+border ×7 against the reference's borderless `base-200`; sizes `3rem`/`3.2rem`/`2.75rem`/`48px`. The one tile on the token is Attachments'. Falls out of the vessel free. | `DataMedia.astro:777` vs `DataView.astro:331` vs `storybook.ts:3844` example (`rounded-box bg-base-200`, no border) |
| X04-F4 | S2 | ADOPT | **D17** · D12 | **`.reg-empty-ic` is one class name with two contradicting declarations, in the two files D17 named as one fix.** Sources sets `border-radius: 7px; opacity: .8`; Destinations sets `font-size: 1.4rem; color: …/.35` and carries a `ds-ok`. Neither draws the 48px tile the anatomy requires and neither sets a cap. A reader who learns the Sources empty state does not recognise its twin. | `SourcesView.astro:210` vs `DestinationsView.astro:200` |
| X04-F5 | S3 | ADOPT | **D17** · D28 | **The capability-gate card is a fifth empty-state condition with no catalog entry at all.** `.au-gate` (a 999px circle tile), `.if-gate`, `.chat-gate` (3.2rem/52ch), `.sec-gate` and `LockedTab.astro` — five vessels; `pattern-empty-state` documents three conditions, none of them "you do not have this". D28 governs whether a gate tells the truth; **nothing governs its shape**. | `SchemaAutomations.astro:379` · `SchemaInterfaces.astro:395` · `SchemaChat.astro:453-456` · `LockedTab.astro:28` · `storybook.ts:3844` lists conditions 1·2·3 only |
| X05-F1 | S2 | ADOPT | **D42** | **The `alert` entry names no reference component, and there is no `Alert.astro` — so ~60 banners are hand-composed and the vessel drifted on three axes at once.** Six live **solid** alerts against a rule the entry states twice; **five ARIA roles** on one element; class order flipped at `ReportBodyKpi.astro:176`. **COUNTS CORRECTED 2026-08-14, re-taken with `/usr/bin/grep -a` (lead-reproduced): `role="alert"` **79**, not 54 · `role="status"` **35**, not 11 · `role="note"` 4 ✓ · `role="group"` 6, not 1.** The 54 was not wrong so much as differently scoped and the scope was never written down: it counted roles **on the `alert`-class vessel**, and **58 of the 79 sit on one**. **This matters for D42's scope, not just for bookkeeping: the vessel closes 58 of 79 sites and the other 21 need a second, smaller answer** — inline field errors under a `TextInput`/`Select` (which already own an `error` prop), the five `.reg-err` boxes, four bare status paragraphs, and `#too-narrow`. `Alert.astro` will not absorb those and should not try. `role="status"` at 35 cuts the same way: **the polite half of the product is three times the size D42 assumed**, which strengthens the case for the component picking the role. `alert` is the **only** Primitive in the catalog with no `reference:` key. | `storybook.ts:1644` (no `reference`) vs `storybook.ts:680` (`badge` has one); solid at `StoragePicker.astro:121` (lead-verified `class="alert alert-error mt-4 hidden"`), `BackupHistoryWidget.astro:202,334`, `SchemaCanvas.tsx:2001`, `IntegrationsSetupWizard.astro:949`, plus the emitting maps `connection-health-banner.ts:66-71` and `lib/reports/view.ts:29-33`. The role census's "none ×2" cell is **UNVERIFIED** — `StoragePicker.astro:120` does carry `role="alert"`. Full 79-site classification, with the writer resolved for each: `audit/findings/X-MEASURED-SOURCE-2026-08-14.md` §12.3. Lead-reproduced counts today: `role="alert"` **79** · `role="status"` **35** · `role="note"` **4** |
| X05-F2 | S2 | ADOPT | **D42** | **One glyph carries two severities and the catalog's error glyph carries none.** `lucide--circle-alert` is the dominant **error** glyph (5 of 7) *and* the second **warning** glyph (5 of 40); `lucide--circle-x`, which the entry's own example uses for error, has **zero** uses. Warning spreads over 7 glyphs, info over 8. Colour is then the only thing separating an error banner from a warning one — a colour-alone distinction, against the entry's own "pair it with an icon". | glyph census in `audit/findings/X04-X05-X08.md` §7; `storybook.ts:1644` example |
| X05-F3a | S2 | ADOPT | **D42** | **Three hand-rolled tinted boxes are alerts wearing another name, and one introduces a fifth alert colour the catalog does not define.** `.bases-reset-note` is a bare tinted `<p>` in **`--color-primary` at 8%** — exactly the shape `alert`'s usageDont forbids, in a colour with no row in the four-colour table. `.switch-confirm` is a second one **in the same file, alongside a real alert**: three vessels, one file, one job. `.bst-autoadd` is the third. | `IntegrationsSetupWizard.astro:204` + CSS `:632-634`; `:625-631`; `:147` (the real alert); `BaseSelectionTable.astro:756` |
| X05-F3b | S3 | **ACCEPT** | **D42** | **`.hm-status` stays a bespoke status card and is not folded into the alert vessel.** It is Home's largest object, carries six tone classes and its own icon chip, and does a different job — a persistent state *card*, not a transient banner. Converging it would cost the app its one honest state display to gain nothing. **Reason recorded in `storybook.ts`** as a named carve-out on the `alert` entry ("a persistent per-Space status card is not an alert; see `.hm-status`"), so the next reader does not file it again. Its tone *name* is still wrong — that is X08-F3, not this row. | `SpaceHomeView.astro:651-681` |
| X08-F1 | S2 | ADOPT | **D44** | **The catalog's declared status primitive is used by ~5% of the app's badges, and 2 of its 10 variants have zero callers.** `Badge.astro` — `reference:` of the `badge` entry, "the pattern every view should converge on" — has **10 call sites in 6 files** (one of them the dead copy deck) against **176** raw `badge-soft` and **68** raw `badge-ghost` strings (**re-counted 2026-08-14 with `/usr/bin/grep -a`: `badge-soft` 176, not 175 — the `DataBrowse.astro` line, X-M19; `badge-ghost` 68 ✓, `alert-soft` 77 ✓, `<Badge` 10 in 6 files ✓**). `secondary`→`badge-secondary` and `tertiary`→`badge-accent` occur exactly once app-wide: their own map line. The component also cannot express what the app most needs — a status *registry* — so all 28 registries re-implement the class strings. | `grep -rl "<Badge" apps/web/src` → 6; `Badge.astro:5,21-32`; `storybook.ts:680` |
| X08-F2 | S3 | **RATIFY** | **D44** | **The `status-dot` catalog entry documents a daisyUI component the product has never used.** `grep "status status-"` over `apps/web/src` → **0**. Every dot in the app is a hand-composed `size-1.5 rounded-full bg-current` inside a badge — which is what the `badge` entry already prescribes. **The app is right and the catalog is wrong:** fold `status-dot` into `badge` as the dot clause. | 8 hand-composed sites incl. `SchemaRelationships.astro:172`, `SchemaBrowse.astro:96,286,328`, `ReportBodyKpi.astro:208,265,314`, `Badge.astro:44` |
| X08-F3 | S2 | ADOPT | **D43** | **`broken` is painted through a class named `is-paused`, and two tone names share one paint.** Home maps the broken-connection level to tone `paused`; `.is-paused` and `.is-warn` are the identical `--color-warning` at 8%. The app's most severe connection state reads, in source, as its calmest — and the next editor to touch `.is-paused` will style two unrelated states at once. 7 levels → 6 tone names → 5 paints. The **colour is defensible; the name is not**. | `SpaceHomeView.astro:136-144`, `:653`, `:658` |
| X08-F4 | S3 | ADOPT | **D19** (still interim) | **There is no state-word table in `specs/` or `storybook.ts`, and that is why D19 cannot close.** The census exists now — **12 words for "it succeeded", 10 for "it failed", 5+2 for in-progress/queued**, and five words that change colour between surfaces. The table's *word* column is writable today; its *colour* column waits on ruling #2 above. Until it is written, each new registry invents its words again, as `SpaceHomeView:146-150`, `lib/reports/view.ts:20-45` and the automations/interfaces twins each already did. | census in `audit/findings/X04-X05-X08.md` §7 X08; D19 §storybook.ts |
| X08-F5 | **S1** | ADOPT | **D43** | **Three registries answer an unknown status by naming a state that did not happen.** `statusMeta[r.status] ?? statusMeta.cancelled` labels a run whose status the UI does not recognise **`Cancelled`** — a word that asserts a person deliberately stopped it — on a backup log, the one screen whose job is to prove what ran. Reports guesses **`Issues`**; the run-base view guesses `Pending`. This is the exact failure the `Unknown` fallback was added on 2026-08-13 to prevent, in the surfaces where a wrong word costs most. **The charter's S1 test is met verbatim: the UI states something untrue.** | lead-verified verbatim at `BackupsListView.astro:208` · `BackupRunDetailView.astro:189` · `RestoreHistoryView.astro:175` · `ReportsView.astro:136` · `ReportDefinitionView.astro:211` · `BackupRunBaseView.astro:107`. The correct answer is already written and shipped one file away: `SourcesView.astro:36-51`, with a 14-line comment arguing exactly this case |
| X08-F6 | S2 | ADOPT | **D44** | **The one badge combination the catalog explicitly BANS is live in three files, and a fourth file quotes the ban.** `badge-soft badge-neutral` — the catalog's own recorded measurement is 1.34:1 text and 1.02:1 for the pill on dark, "the chip is invisible, shape and all" — draws `Won't retry` on two lists of **permanently failed files**, where invisibility loses the one word saying the failure is final. `ds-lint` has never flagged it: the rule is prose in the catalog, not a check in `ds-checks.mjs`. ~~Painted contrast is `NEEDS-MEASUREMENT`~~ **MEASURED 2026-08-14 — STANDS and WIDENS.** The catalog's dark figures reproduced **to the digit** by an independent method (canvas-resolved `oklab` → WCAG): **1.34** text, **1.02** pill, `badge-ghost` **17.40** in the same slot. **New: the light theme fails too — 4.35 text (AA needs 4.5 at 12px/600) and 1.11 pill (UI needs 3.0) — and the catalog does not say so**; that half is filed as X-M21. Severity unchanged at S2. | lead-verified `BackupRunDetailView.astro:530` · `BackupRunBaseView.astro:325` · `SchemaCanvas.tsx:646`; ban quoted at `inbox.ts:137`; measurement in `audit/findings/X-MEASURED-BROWSER-2026-08-14.md` §C1, shot `XMB-C1-01`. **Citation correction: the dark theme is `data-theme="baseout"`; there is no `baseout-dark`** (`lib/theme.ts:13-14` — `DARK_THEME = 'baseout'`, `LIGHT_THEME = 'baseout-light'`). `REGISTER.md` and `SHIP-ORDER.md` never named it; `audit/findings/X04-X05-X08.md:376` did and is corrected in place; `specs/02-shell-sidebar-topbar.md:195` still does and is filed as X-M12 |
| X08-F7 | **S1** | ADOPT | **D44** | **A KPI status dot builds its colour by string interpolation and one of its four values has no literal source, so it paints nothing.** `` `bg-${s.tone === 'neutral' ? 'base-content/40' : s.tone}` `` — Tailwind v4 emits a utility only when the literal appears in a scanned source. `bg-success`/`bg-warning`/`bg-error` survive because `overrides.css` names them; **`bg-base-content/40` has zero literal occurrences in `apps/web` or `apps/design`** (lead-verified) and no `@source inline` / safelist exists. The neutral tone is then a transparent dot beside a bare number — **and the tone is the dot's only carrier of meaning**: no label, no `aria-label`. It is also `size-2` where every other dot in the app is `size-1.5`. The fix is four lines: a static map, exactly as `connection-health-banner.ts:73-77` already does for the same four tones. **The blank pixel is `NEEDS-MEASUREMENT`; the mechanism is proven in source.** | lead-verified `ReportBodyKpi.astro:164` read in full; `grep -rn "bg-base-content/40" apps/web/src apps/design/src` → **0** |
| X08-F8 | S2 | ADOPT | **D43** | **16 of 28 status registries have no fallback at all, and two are bare-indexed in a way that throws.** `usageStatus[u.status].label.toLowerCase()` and `usageStatus[u.status].badge` are a runtime `TypeError` on an unrecognised status — **in the same file that guards its own header badge 130 lines earlier**. `lib/reports/view.ts`'s `sectionEmptyAlert` has three keys and yields `class="alert undefined"` for a fourth. Two more are ternary chains whose else-branch mislabels: anything not green/red becomes **`Could improve`**. **Whether an out-of-map status can occur is NOT-OURS** (the engine's vocabulary is backend); that the UI has no branch for it is ours. | `SourceDetailView.astro:181,189` vs `:47-50`; `lib/reports/view.ts:21-51` consumed raw at `ReportBodyKpi.astro:208,265,314,348`; `SchemaBrowse.astro:65-68`; `SpaceHomeView.astro:153-154` |
| X08-F9 | S3 | ADOPT | **D44** | **Error red and primary blue are spent on things that are not states, across 20+ sites.** `text-error` on the benign **`Clear filters`** ghost button in **13 places** — clearing a filter destroys nothing. `badge-error badge-soft` on the Inbox **count**, red whatever the rows say. `badge-soft badge-primary` on three non-states in the status slot: `Pro+` (a tier gate — D14 governs it), `Recommended`, `Always on`. Each is small; together they are why the badge entry's reservation clause reads as advisory. | `pickerSearch.ts:813` · `DateRangePicker.astro:61` · `Inbox.astro:172` · `SchemaChangelog.astro:188,289` · `SchemaRelationships.astro:252,330,352` · `SchemaBrowse.astro:211,441` · `SchemaAutomations.astro:193` · `BaseSelectionTable.astro:457` · `SchemaCanvas.tsx:2089` · `Sidebar.astro:153` · `SchemaHealth.astro:199,325,427` · `DestinationAddView.astro:76` · `IntegrationsSetupWizard.astro:263,410` · `BackupScheduleScope.astro:114` |

*Merged out:* **X05-F4** (the live OAuth deck speaks in the engineer's register and prints
`error_code:` to the user) is **one finding with X13-F1 and X13-F2** — see the D32 row below. The
scout proposed it be filed under X05 rather than X04, and that reasoning is **accepted and
recorded**: a connect failure is not an empty state, so it never enters D17. But the vessel, the
voice and the absence are one remedy in one PR series, so it is **one row, not three**.

### X06 · X07 · X15 — overlays, clickability, keyboard

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| X06-F1 | **S1** | ADOPT | **D45** | **The panel stack — the app's primary overlay, cap 10 — is invisible to the keyboard.** `panelStack`'s "focused" panel is a CSS class and a z-order, never DOM focus. Opening a panel leaves the caret on the row behind it; Tab walks the page *underneath* the panel; Escape closes a panel the user never reached; closing restores nothing. | lead-verified: **zero** `.focus()` calls in `panelStack.ts` or `PanelHost.astro`; `panelStack.ts:271-272` (`setFocus` toggles `cls.focus`, calls `cfg.onFocus`); `PanelHost.astro:574-580` (Escape acts on `stack.focused()`). Contrast `Modal.astro:35` + `showModal()`, which gets trap, restore and Escape from the UA in **zero lines** |
| X06-F2 | **S1** | ADOPT | **D45** | **`Drawer` claims `aria-modal="true"` and delivers nothing modal.** A 55%-black scrim covers the page, focus never enters, the background is not `inert`, Tab reaches every control behind the scrim, Escape restores focus to nothing. A screen-reader user is told the page behind is unavailable while their virtual cursor is still in it. **It is the only place in the app where the markup asserts something about itself that the code contradicts** — and `QuickAskDock.astro:90` writes `aria-modal="false"` correctly, two files away. Seven surfaces host one. | lead-verified `Drawer.astro:35` and `:56`; scrim `:82`; the entire script `:121-134` unchecks a checkbox and nothing else |
| X06-F3 | S2 | ADOPT | **D45** | **CORRECTED 2026-08-14 (measured): the `vw`/scrollbar half FALLS on this platform; the one-contract half STANDS and its larger cause is now filed as the S1 X-M3.** Measured at 390 and 425: `innerWidth − documentElement.clientWidth` = **0.00px at every width tested**, even against a forced 20,983px page — Chrome on macOS paints overlay scrollbars, so `94vw` = 366.59 and `94%` = 366.60, a 0.01px rounding difference. **Classic-scrollbar platforms (Windows/Linux, ~15px) could not be emulated and are UNVERIFIED, not disproved.** The "two of the five fall back to a literal `480px`" clause is **unreachable**: `min(94vw,30rem)` == `480px` at every width ≥ 511, and below 1280 all five hosts override with `calc(100% - 40px)` (lead-verified at `EntityPanel.astro:315`, `RecordPanel.astro:670`, `DataChangelog.astro:507`, `MediaPanel.astro:490`, `QuickAskDock.astro:541`). **What survives, and is the reason the severity does not fall:** `Drawer` is the only overlay family with no narrow width rule at all, so at 390 four "overlay over the page" hosts paint four widths at four left edges — 288.79/101.21 · 350.00/40.00 · 358.80/31.20 · 366.59/23.41, a **77.80px spread** — and the first two are *the same declaration in the same media query*. Original row: **The `vw` ruling of `specs/16-responsive.md` §8 was applied to five panel hosts and missed the token they fall back to.** `--drawer-w: min(94vw, 30rem)` is the declared width of `.ep-sheet`, `.rp-sheet`, `.dcp-sheet` and the sole width of `.rl-detail-panel`; §8's `100%` spelling only lands inside `@media (max-width: 1279.98px)`. Two of the five fall back to a literal `480px` instead. **The ruling this needs is that Drawer and panel are ONE contract** — the same object at different z-indexes, indistinguishable to a user by width. | `global.css:144`; `EntityPanel.astro:203,315`; `RecordPanel.astro:632,670`; `DataChangelog.astro:366,507`; `MediaPanel.astro:360`; `QuickAskDock.astro:415`; `SchemaRelationships.astro:567`; the seven `vw` sites tabulated at `specs/16-responsive.md:488-494`. ~~`NEEDS-MEASUREMENT` below 511px~~ **MEASURED 2026-08-14** with `emulate({viewport:"390x844x3,mobile,touch"})` — the instrument the audit lacked; `resize_page` floors a macOS window at ~500px, which is why every earlier "390" in this audit is a 500-wide layout. Raw tables in `audit/findings/X-MEASURED-BROWSER-2026-08-14.md` §B, shot `XMB-B-01`. **The scrollbar rationale in `specs/16-responsive.md:472-474` must be dropped or scoped to classic-scrollbar platforms — it measures 0.00px here** (filed as X-M11) |
| X07-F4 | S2 | ADOPT | **D46** | **Twelve list rows navigate by `window.location='…'` on a `<tr role="button">`, so no list row in the product can be opened in a new tab.** ⌘-click, middle-click, right-click ▸ Copy link address and "open in a background tab" are all unavailable — `window.location=` ignores modifier keys. On a tool whose job is comparing runs and bases side by side this is the most-felt clickability defect. **This row supersedes `X-C`**, which recorded eight sites and issued no ruling; the count is **twelve** and the ruling is two-part. | lead-verified all twelve: `ReportBodyKpi:229,281,360` · `BackupRunDetailView:436` · `BackupsListView:229` · `DestinationsView:143` · `ReportDefinitionView:232` · `ReportsView:154` · `RestoreHistoryView:196` · `SourceDetailView:182` · `SourcesView:154` · `SpaceHomeView:289`; `grep -c` tree-wide = 12. The answer is already in the tree at `BackupRunDetailView.astro:446` — a real `<a href>` on the lead cell inside the clickable `<tr>`, the one site where ⌘-click works |
| X07-F5 | S2 | ADOPT | **D46** | **Three of the four clickable tables in the report body announce `role="button" tabindex="0"` and have no keydown, so Enter does nothing.** A keyboard user tabs onto a row that paints a focus ring, presses Enter, and the app does not respond — the worst affordance failure available, because the row visibly claims to be actionable. | `ReportBodyKpi.astro:229,281,360` carry `onclick` only; the file's one `keydown` (`:505`) returns at `:490` unless the target is a section header. The fourth table (`:326`) is wired by both hosts |
| X06-F6 | S2 | ADOPT | **D45** | **`SchemaDocs` hand-rolls a destructive-delete `<dialog class="modal">` instead of using `ConfirmModal`** — the app's only bespoke dialog. It re-spells the footer against the component's deliberately-unsized md pair, states the consequence with no recovery, and cannot participate in the `returnValue === 'confirm'` contract the other five destructive dialogs share. Zero new catalog surface required. | lead-verified `SchemaDocs.astro:263-266`; opened `:759`, closed `:766`; `ConfirmModal.astro:17-25,57-77` |
| X06-F7 | S2 | ADOPT | **D45** | **`SchemaRelationships` runs a seventh overlay — a hand-rolled fixed drawer that is neither `Drawer` nor a `PanelHost` panel.** It wears the drawer's canonical header (its own comment says it "mirrors EntityPanel") with no stack, no cap, no resize grip, no persistence, no `＋`, its own document Escape, and a scrim that explicitly does not dim. An entity chip inside it opens the shared `EntityPanel` **over** it — the exact second-stack handoff `decision-one-stack-one-entity-one-drawer` bans. This is the unfinished tail of `1c5ffa9`, not a new project. | `SchemaRelationships.astro:562,564-567`; Escape at `schemaRelationships.ts:267`; `PanelHost.astro:331` kind registry |
| X06-F8 | ~~S3~~ **S2** | ADOPT | **D45** | **CORRECTED 2026-08-14 (measured): Escape has no owner — it is not that the wrong listener wins, it is that every listener runs.** One press with a `listSheet` and a panel co-open was delivered to **24** `document` listeners, **13 of them after** `listSheet.ts:191`'s `stopPropagation()` — which cannot stop a sibling listener on the same target, and all 24 are on `document`. The one `stopImmediatePropagation()` (`entityPanelController.ts:711`) lands **last** and stops nothing. **Both overlays closed on one press:** a user who opens the Documents list, opens a base panel to read it, then dismisses the list, loses the panel too. That breaks the learned one-Escape-one-overlay expectation and silently discards a reading position — **S2, not S3**. The original framing ("which wins is registration order") was wrong in the safe direction. | Instrumented log (patched `addEventListener` + `stopPropagation` via `initScript`) at `innerWidth: 900`, reproduced twice: 91 `keydown` listeners, 22 on `document`, 14 from `apps/web` across 8 sources; `totalDeliveries: 24`, `deliveriesAfterListSheetStopPropagation: 13`; shots `XMB-A-01` → `XMB-A-02`. **Site-list corrected in both directions: there are 8 `document`-level Escape sites, not 5** — `PanelHost.astro:574` · `Drawer.astro:126` · `tooltip.ts:213` · `schemaRelationships.ts:267` · `listSheet.ts:189-193` (guarded, the one `stopPropagation`) · **`components/ui/collapsingSearch.ts:70`** · **`entityPanelController.ts:705`/`:719`** · **`DataBrowse.astro:1313`** — the last of these found by the lead today and **invisible to every grep pass in this audit** (the NUL-byte file, row X-M19); it is unconditional and closes two popovers. `sectionTabs.ts:81` and `EntitySearch.astro:266` are **`/` handlers, not Escape**, and come off the ledger. `listSheet.ts:190`'s `!isOpen(h)` guard is correct and stays |
| X07-F9 | S3 | ADOPT | **D46** | **The same 3-line "Enter/Space → `r.click()`" block is copied into 11 files, and the three places it was not copied are X07-F5.** `row-actions.css:1-11` declares the keyboard half of the contract **in prose**; nothing enforces it, so each surface re-implements it and one file forgot. | `runLog.ts:76-83` · `ReportsView:267` · `ReportDefinitionView:662` · `ReportDetailView:155` · `BackupRunDetailView:734` · `SpaceHomeView:508` · `SourcesView:191` · `DestinationsView:180` · `SourceDetailView:356` · `DestinationDetailView:328` · `DataMedia:1721`. The argument is written at `global.css:2766-2772`: `.cl-entry`/`.dc-runrow` became real `<button>`s and need **zero** keyboard code |
| X06-F10 | S3 | **RATIFY** | **D45** | **`Drawer` is two components sharing one name and one prop.** `side="bottom"` is a bespoke transform sheet with its own scrim, `height` prop and reduced-motion rule; `side="end"/"start"` is daisyUI's checkbox drawer. A caller changing one prop silently changes the engine, the layout model and the animation. **Both engines are correct for their jobs — the catalog's silence is what makes it a trap.** RATIFY by splitting the entry: `drawer` keeps end/start, a new `sheet` entry documents bottom. No code moves. | `Drawer.astro:31-50` vs `:52-72`; CSS `:112-118` vs `:78-93`; contrast `Modal.astro:20-26` where `size` genuinely only swaps a `max-w-*` |
| X06-F11 | S3 | **DEFER** | **D45** | **Overlay z-index is an eight-level undocumented ladder** — top layer · 400 · 63 · 62 · 60 · 50 · 40 · 20 — with no token and no comment stating the order. A new overlay author can only pick a number by grepping. **Trigger: X06-F2 or X06-F7 landing** — both move an overlay between layers, and the ladder must be written down in the same PR rather than re-derived. The width steps were tokenised for exactly this reason (`global.css:132-137`); depth never was. | `Drawer.astro:78-79` (400) · `global.css:1456` `.pk-pop` (63) · `PanelHost.astro:631` (63) · `QuickAskDock.astro:514` (62) · EntityPanel (60) · `SchemaRelationships.astro:564` (50) |
| X07-F12 | S4 | ADOPT | **D46** | `BackupRunDetailView.astro:731` states its rows are "wired the same way … the Backups list wire theirs"; the Backups list has no such wiring **in its own file** — it inherits it from `runLog.ts:76`. A future implementer following the comment finds nothing. One-line fix, folded into X07-F9's PR. | `BackupRunDetailView.astro:730-732` vs `BackupsListView.astro:299,318` → `lib/runLog.ts:76-83` |
| X07-F13 | S4 | **DEFER** | **D21** | `cursor: pointer` is declared **167** times across `apps/web/src` (**re-counted 2026-08-14 with `/usr/bin/grep -a`; the recorded 154 was a `ugrep` figure and `DataBrowse.astro` alone holds the missing 13 — 154 + 13 = 167 exactly, see X-M19**) while `.row-clickable` supplies it once for the whole row family. Invisible to the user; pure duplication. **Trigger: the next variance census, or D46's row work touching a listed file.** | `/usr/bin/grep -roaE 'cursor-pointer|cursor: pointer' apps/web/src \| wc -l` → **167** (shimmed `grep` → 154); `row-actions.css:14` |

*Not filed, and deliberately so:* `ConfirmModal`'s `confirmHref` anchor (8 uses) is a **NOT-OURS**
mirror-repo stand-in for a server action, documented at `ConfirmModal.astro:11-13`. The scout was
right to refuse it and the lead confirms the refusal. Likewise the scout **corrected three of its
own item's starting facts** — "2 `<dialog>` but 14 `showModal()`" is the system working, not a
defect (all 14 trace to a rendered id, including the four conditional ones); the picker *does* have
a forward key; row navigation is twelve sites, not seven. Those corrections are the most valuable
thing in the file and are recorded here so nobody re-files them.

### X09 · X12 · X13 — icons, navigation and IA, copy and tone

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| X13-F1+F2+X05-F4 | **S1** | ADOPT | **D32** | **MERGED — three findings, one remedy, one PR series.** The Airtable connect flow can render **none** of its nineteen documented failure messages: the copy lives in a view on no route, whose own header says so. The one deck that *does* ship covers eight of the same codes in the engineer's register — *"your browser dropped the OAuth handoff cookie during the round-trip"*, *"the OAuth state parameter didn't match what we sent"* — inside a **solid** `alert-error`, with `error_code: <code>` printed to the user. **We ship the engineer's words and keep the writer's in a dead file.** The remedy is one table in one voice in the live flow. | lead-verified `apps/web/src/components/backups/StoragePicker.astro:120-123` (solid `alert alert-error`), `:476-482` (developer voice, typographic apostrophes), `:498-502` (`error_code:` line); `IntegrationsView.astro:2-18` (header stating it is a copy deck), `:50-61` (10 connect codes), `:489+` (9 rescan codes). **Path correction: `StoragePicker.astro` is under `components/backups/`, not `components/integrations/`.** Keep `StoragePicker`'s "allow cookies for this site" remedy clause and its `error_code:` foot — for a technical-ops user those are the only two things the live deck does better |
| X12-F1 | S2 | ADOPT | **D47** | **The catalog's breadcrumb reference is a dead component, and six views hand-roll the markup — four of them commenting that they use the catalog.** `components/ui/Breadcrumbs.astro` has **zero** importers anywhere in `apps/web`. It escaped the repo's dead-view sweep because that check only walks `views/*.astro`. | lead-verified `git grep -a -l "ui/Breadcrumbs" -- 'apps/**'` returns **only** `apps/design/src/lib/storybook.ts`; hand-rolls at `BackupRunBaseView:132` · `BackupRunDetailView:219` **and** `:234` (twice in one file) · `ReportDefinitionView:115` · `ReportDetailView:72` · `RestoreView:209` |
| X12-F2 | S2 | ADOPT | **D47** | **The Record panel's Base ▸ Table trail is dead text; the identical trail in the Attachments panel is clickable** — two panels of the same Data section, styled identically. `locationCrumbs.ts:7` says "Every drawer uses this — never hand-roll a breadcrumb"; `recordReadBody.ts` hand-rolls one anyway and has no clickable branch at all. | `recordReadBody.ts:338-343` (every segment a plain `<span>`) vs `locationCrumbs.ts:30-32` (`<button class="sb-crumb-link">` when `openAttrs` is present) + `mediaReadBody.ts:216`; hosts `RecordPanel.astro:119`, `DataChangelog.astro:746` |
| X12-F5 | S3 | ADOPT | **D47** | **`getBreadcrumbs()` is computed on 25 pages, serialised into the DOM, parsed into a store — and painted by nothing.** `global.css:480` says it out loud. A whole data pipeline exists for a UI that does not. It resolves *with* X12-F1 (the component finally has a consumer) or it is deleted; it must not be left. | `lib/config.ts:92`; `SidebarLayout.astro:27,54,136`; `stores/pageHeader.ts:15`; `Header.astro:64-92` (paints `title` only, from the same store) |
| X13-F3 | S2 | ADOPT | **D09** | **Three relative-time implementations, and two disagree arithmetically.** An event **90 minutes** old prints **`2h ago`** on Home (`Math.round`) and **`1h`** in the Inbox (`Math.floor`) — and the Inbox drops the word "ago" entirely, so `3d` there and `3d ago` on Home are the same fact in two grammars. Home and the Inbox are read together, and **the Inbox is the surface that tells you a backup broke**. `ReportsView.astro:33-40` is a character-for-character duplicate of the reference, in a reference surface. | lead-verified `lib/time.ts:142-155` vs `inbox.ts:222-236` (floor on all three units, 7-day cutover) vs `ReportsView.astro:33-40`. `inbox.ts:232-235` carries a *correct* D09 note about locale pinning — the module knows this class of bug and forked the arithmetic anyway |
| X13-F5 | S3 | ADOPT | **D09** | **CORRECTED 2026-08-14 (measured): the file count was right, the mechanism was wrong, and the corrected mechanism makes the item cheaper and sharper.** **Not one of the 45 calls formats a date** — every one is `Number.prototype.toLocaleString()` on a count (`.length`, `total`, `recordCount`, `run.counts[t]`), so the `14 Jul` / `Jul 14` reordering this row cites **cannot occur**. What can occur is a **thousands separator that changes by machine** while the app *pins* it in 13 places: `/backups` prints both grammars 40px apart — `BackupsListView.astro:28,62` renders row counts through `new Intl.NumberFormat('en-US')` and the pager 40px below renders its total through `tablePager.ts:54,132` bare. Same pairing on `/backups/run/*`, `/reports/*` and `/restore`. **Severity held at S3, and the S2 reading was considered and declined:** two number grammars on one screen is genuinely "one job, two ways", but on the stated audience (`lib/time.ts:32-33`, "the customers are in the United States") all 45 render identically to the 13 and nothing is untrue — the exposed populations are a non-US customer, a US customer with a non-US OS region, and Oleh reviewing from Ukraine. **Scope corrected: it is closer to four files than fifteen** — fixing `tablePager.ts` alone (4 calls, **15 importers**) corrects the pager total on every paged table in the app; the other four shared files (`recordReadBody.ts`, `runReadBody.ts`, `schemaReadBody.ts`, `pickerSearch.ts`, `ExportControl.astro`) cover most of the rest. **`lib/` has no shared number formatter to route through** — the only exported one is `lib/reports/view.ts:9`, inside the reports domain — so the fix is `fmtCount` as a sibling of `time.ts`, written with the same header, then the 5 shared files, then the 10 leaves, then the 13 duplicate `nf` instances delete. Re-counted today with `/usr/bin/grep -a`: **57 `toLocale*` occurrences tree-wide · 11 in `lib/time.ts` · 46 outside it = 45 real calls + 1 prose mention**, in **15 files — the register's "15" was files and was right** (`SHIP-ORDER.md` compressed it to "15 calls", and the measurement request inherited that). All 46 are `toLocaleString`; **zero take an argument** (`/usr/bin/grep -roa --exclude=time.ts 'toLocale[A-Za-z]*'` → `toLocaleString` only, 46). `lib/time.ts` passes `LOCALE` at all 10 of its call sites. **`Intl.*` is NOT the same defect wearing another name: 14 constructors, all pinning `'en-US'`, zero omissions** — do not "fix" the value, delete the duplication. Sites: `recordReadBody` ×6 · `DataChangelog` ×6 · `DataMedia` ×6 · `ExportControl` ×4 · `tablePager` ×4 · `SchemaDocs` ×4 · `runReadBody` ×3 · `DataComments` ×3 · `SchemaBrowse` ×3 · `MediaPanel` ×2 · `RecordPanel` ×2 · `pickerSearch` · `schemaReadBody` · `StaticImport` · **`DataBrowse:1075` — the line every `ugrep` pass in this audit silently dropped (X-M19)** |
| X09-F1 | S2 | ADOPT | **D48** | **Twenty files decide an entity's glyph outside `entityIcon.ts`, and six of them import it and hand-roll a second map in the same file.** The module's own header says "This replaced FIVE copies … do not write a sixth." There are now twenty. Only `EntityPanel`'s field-type case is a documented exception. | `entityIcon.ts:6-17`; in-file twins at `QuickAskDock.astro:71` · `SchemaHealth.astro:176` · `schemaReadBody.ts:564` · `DataComments.astro:812` · `DataMedia.astro:1230`; fourteen non-importers listed in `audit/findings/X09-X12-X13.md` §7. Lead-verified 19 files reference `entityIcon` today |
| X09-F2 | S2 | ADOPT | **D48** | **The concept colours contradict themselves on one screen.** On Attachments, `base` is blue in the group headers (`concept-ic-base`) and uncoloured in the refine panel — both visible at once — so the colour cannot be read as meaning anything. `refineFacetIcons` picks the glyph and **omits the class**. | `DataMedia.astro:1231` vs `lib/refineFacetIcons.ts:46-52`; rule at `global.css:2542`. `entityIconClass('base')` cannot omit it, which is the fix |
| X09-F3 | S3 | ADOPT | **D48** | **`.iconify.lucide--table-2` is coloured concept-green globally at specificity (0,2,0), so three *navigation* controls wear an entity colour and Restore's muted-icon intent is out-specified.** The rule's own justifying comment asserts `table-2` is only ever the table entity; it is also the Records tab icon, the wizard's Bases step icon and the "Airtable copy" tab icon. **`NEEDS-MEASUREMENT`** — one `getComputedStyle(el).color` on `/restore` settles whether the override dies. | `global.css:2534,2538-2541`; wearers `DataView.astro:176`, `IntegrationsSetupWizard.astro:71`, `SchemaAutomations.astro:303`; losers `RestoreView.astro:345,643` (a (0,1,0) utility in a Tailwind layer) |
| X09-F4 | S3 | ADOPT | **D48** | Two calendar glyphs for one concept on one page: `lucide--calendar` in the refine panel, `lucide--calendar-days` in the same tab's facet. The gap that let both exist is that `entityIcon` has no `date` kind. | `refineFacetIcons.ts:50` vs `DataComments.astro:813` |
| X09-F5 | S4 | **DEFER** | **D21** | **CORRECTED 2026-08-14 (measured): the trigger fired, and the premise was wrong — the sweep stays deferred and the real defect is filed separately as X-M15.** 24 routes swept at 1440: **22 of 24 measure ≥ 12px**, because an "unsized" span is almost always sized by a bespoke component rule to 12/13/14/16/20px — *not* inheriting a bare `1em` from `global.css:1503`, which was the stated mechanism. The three sub-12px cases are the opposite of unsized: they are **explicitly** sized below the floor in raw `rem` literals (X-M15). **Trigger rewritten to something the measurement can falsify: an unsized `.iconify` whose *nearest* `font-size` rule is absent** — "any measured icon below 12px" has now been satisfied by a mechanism this row was never about. **Census corrected: 75 occurrences on 73 lines across 31 files**, re-counted today with `/usr/bin/grep -a`; the old "73" was `git grep -c`, i.e. lines. | `/usr/bin/grep -roa 'class="iconify lucide--[a-z0-9-]*"' apps/web/src \| wc -l` → **75**; `-rla` → **31 files** (lead-run today, both figures); per-route minimum computed `font-size` table in `audit/findings/X-MEASURED-BROWSER-2026-08-14.md` §D. **Still unmeasured and named: 15 of the 73 lines are runtime HTML strings inside interaction-gated states never opened (`SchemaChat.astro`, `schemaChat.ts`, `QuickAskDock.astro`, `typeaheadItems.ts`, `schemaRelationships.ts`), and the sweep ran only at 1440 — the `<1280` type step-down could expose more** |
| X12-F3 | S2 | ADOPT (Schema + Data) · **DEFER (the rest)** | **D07** | **13 of 15 filterable surfaces keep search, facet and group state out of the URL — against a contract this app has already written, argued and shipped twice.** A colleague can be sent `/schema?tab=health` but not "Health, filtered to the two bases with issues". **This row absorbs X01-F13**: no list's sort or page is addressable either (`tableSort.ts:30-31` holds sort in a closure; `page` is ephemeral by written contract), on 13 paged and 14 sortable surfaces. ADOPT for Schema's nine tabs and the three Data tabs, which is where the contract already half-exists; **DEFER the remaining surfaces — trigger: the surface gains a second filter, or the first support request needing a shareable filtered list.** | 15 `FacetFilter` hosts vs 2 `wireViewState` callers (`DataComments.astro:1196`, `DataMedia.astro:1751`); `viewState.ts:1-24,19-20,79-87,103-105`; `sectionTabs.ts:16-18,54,72-78`; D07 item 4. **Correction to the worklist, verified: "Schema's nine tabs are not addressable by any query param" is no longer true** — `SchemaView.astro:382-394` wires `wireSectionTabs` and all nine `data-tab` keys resolve |
| X13-F4 | S3 | ADOPT | **D41** | **A count that changes grammar as you filter.** `SchemaBrowse` prints `Showing N of M` with a filter on and `M entities` with it off — the label changes shape, the number moves and the noun appears and disappears. Reports is the reference: one sentence shape, both numbers in `mono-data` so the digits do not jitter. **`runReadBody.ts:126`'s third form is not a defect and must not be flattened** — "Showing the 500 sampled of 12,480 — open the backup for the full list" is the only count in the app that says *why* two numbers differ; Reports' grammar should learn from it where sampling applies. | `SchemaBrowse.astro:906` vs `ReportsView.astro:110` vs `runReadBody.ts:126` |
| X12-F4 | S3 | ADOPT | **D33** | **Eight of Schema's nine tabs are requested by no smoke variant, so their markup is walked by nothing.** `/schema` declares seven `fixture=`/`ai=`/`wsgroup=`/`detail=` variants and **zero `tab=`** — while `/reports/def-full` declares three, including a deliberately stale key. Harness-only; no client PR. | `.claude/hooks/smoke.mjs:198` vs `:201` and `:186-196` |
| X12-F6 | S3 | ADOPT | **D33** | **`/reports/[id]` reads no `?fixture=`, so the report definition page has no empty and no no-backups render at all** — in a repo whose entire preview model is `?fixture=`. Harness gap, not a product defect, and it is why D13's empty states have never been seen. | `apps/design/src/pages/reports/[id].astro` imports fixtures directly; `smoke.mjs:66` declares four ids and no fixture |

### X10 · X11 · X14 — destructive actions, save contracts, loading and latency

**This file was not in this step's input list. The lead read it and adjudicated it rather than leave
the audit incomplete** — `audit/findings/X10-X11-X14.md`, 21 findings, previously registered by
nobody. **Three of its findings are duplicates of already-registered rows and are recorded as
instances, not rows** (see below), which is itself the argument for having read it: two of the three
are wave-5 S1s, and the lens reached them independently by a different route.

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| X10-F1+F2 | **S1** | ADOPT | **D06** | **MERGED — one remedy. Automations and Interfaces destroy a record on one click, with no confirm, no undo and no way back.** The Delete control is invisible until hover/focus and sits one Tab from a row whose Enter merely *opens* it — so the destructive control is harder to see than the benign one and adjacent to it. Nothing un-removes either kind: the edit modal re-reads the existing status on save, and the removed row no longer renders a control. The app's own rule, written in its own source, is that a verb which cannot be taken back is not shippable. | `schemaAutomations.ts:253`→`:381` (`softDelete`, lead-verified); `schemaInterfaces.ts:260`→`:383`; reveal `row-actions.css:33-35`; row Enter `schemaAutomations.ts:265-271`; no-undo `schemaAutomations.ts:326`, row `:354`. The rule: `panelStack.ts:512-520`. The counter-example one file away: `ReportsView.astro:242` puts **both** a dialog and an undo toast on a strictly less destructive act |
| X10-F3 | S2 | ADOPT | **D06** | The panel footer's Delete for the same two entity kinds also destroys with no confirm — and **closes the panel first**, so the record disappears from under the user. Same fix as X10-F1+F2, different code path, so it is a row and not an instance: a fix applied only to the row controller leaves this one live. | `entityPanelController.ts:581`; the standard is `RestoreView.astro:481` |
| X10-F5 | S2 | ADOPT | **D06** · D19 | **`Restore into Airtable?` — the most consequential dialog in the product — is the one whose cancel label is bare `Cancel`.** Every less consequential sibling names what staying preserves: `Keep running`, `Keep it`, `Keep editing`, `Stay in setup`. The one place the user most needs to know what "not now" means is the one place the app does not say. | `RestoreView.astro:481` vs `BackupRunDetailView.astro:501` and `SettingsView.astro:247` |
| X11-F1 | **S1** | ADOPT | **D30** | **Schema ▸ Docs is an editable surface with no save control of any kind.** The byline reads `Draft · not saved` and nothing in the file can change it; `setMode` has an edit branch and a read branch and **no save branch** (lead-read in full). Every route in overwrites `editor.innerHTML` unconditionally, destroying typed text. This is D30's own subject and D30 has not shipped. | lead-verified `SchemaDocs.astro:744` (`byline.textContent = 'Draft · not saved'`), `:729` (`openDoc`), `:743` (`newDoc` → `editor.innerHTML = '<p></p>'`), `:767` (`deleteDoc`), `:773-777` (`setMode`, no save branch). Reference: `entityPanelController.ts:157` + `schemaReadBody.ts:305-314` |
| X11-F3 | **S1** | ADOPT | **D30** | **The report definition page tracks dirty, lights `Unsaved changes`, and puts a plain unguarded `<a href="/reports">Cancel</a>` immediately beside it.** The page has already computed the predicate; it simply does not use it. The app's own link-click exit guard exists, on the same kind of loss, in another file. | lead-verified `ReportDefinitionView.astro:399` (`<span class="rpd-unsaved" data-rpd-unsaved hidden>…Unsaved changes</span>`) and `:404` (`<a href="/reports" class="btn btn-ghost btn-sm">Cancel</a>`) **on adjacent lines**; `markDirty` `:654-655`; the guard `IntegrationsSetupWizard.astro:871-886` |
| X11-F4 | S2 | ADOPT | **D30** | **Four save contracts do one job.** A user who edits a source, a report, a document and an automation panel in one session meets four different meanings for the same two buttons. **Converge C2, C4 and C7 onto C1** (`exitEdit`), and add the invariant D30's text currently lacks: *the read slot renders from the draft, not from the loaded record* — that is what makes "the segment discards" safe rather than merely defined. | C1 `entityPanelController.ts:142,157` · C2 `SourceDetailView.astro:307-341` · C4 `ReportDefinitionView.astro:399-405` · C7 `SchemaDocs.astro:773-777`. *Instances on this row:* **X11-F5** (`Cancel` carries three unrelated meanings — revert my edits · leave and discard everything · stop a running backup: `SourceDetailView.astro:137` · `ReportDefinitionView.astro:404` · `BackupRunDetailView.astro:510`) and **X11-F8** (no `specs/` document states a save contract; the D30 rewrite *is* the artefact) |
| X11-F6 | S2 | ADOPT, **narrowly** | **D30** | **Exactly one exit is gated in the whole product.** `beforeunload` is **0** app-wide and `popstate` is **0** app-wide (lead-verified), so browser Back and tab-close discard silently everywhere — including inside the wizard, whose own guard Back walks straight past. **The lead adopts the scout's Ruling 2 rather than a blanket `beforeunload`:** the browser dialog's copy cannot be written, cannot be reached by the charter's tone rules, and firing it on a half-typed name is the app shouting where it currently whispers. Lift the wizard's interceptor into `lib/` (it is already surface-agnostic but for its selectors), mount it on **`SchemaDocs` and `ReportDefinitionView` only**, add `popstate` to the same helper, and add `beforeunload` on those same two surfaces as the last resort — a ⌘W is the one exit a click interceptor cannot see, and an entire authored document is what the blunt dialog exists for. **Not** on the registries or the entity panel, whose loss is one field and whose discard-on-exit is correct. | lead-verified `grep -rn 'beforeunload\|popstate' apps/web/src` → **0**; the one guard `IntegrationsSetupWizard.astro:862-886` |
| X11-F7 | S3 | **DEFER** | **D30** | Closing an entity panel mid-edit discards the draft with no warning; `editIds`/`drafts` are per-panel state that dies with the panel. **Trigger: X11-F6's shared exit guard landing** — at that point mounting it here is three lines, and building a bespoke warning first would be thrown away. | `entityPanelController.ts:12`, `:136` |
| X14-F2 | S2 | ADOPT | **D08** | **`Retry` tells the user the result "will appear in History" — while the button itself is rendered inside History, on a row that is not updated.** It names a destination the user is already standing in, which is verbatim what D08 forbids, and it promises a future in a toast whose pattern says outcomes are past tense. | `ReportDefinitionView.astro:268` (the button, in the History table) vs `:807-808` (the toast) |
| X14-F3 | S2 | ADOPT · **RATIFY the entry** | **D49** | **Eight idioms for "your click is being worked on", and the catalog's documented affordance is the one nobody uses.** `Button`'s `loading` prop has **zero** callers (lead-verified); `setButtonLoading` has **12** files. The app is right and the catalog is wrong: converge the six one-offs onto `setButtonLoading` and **RATIFY it into the `button` entry** as the busy affordance, rather than migrating twelve files onto a prop that has never been used. | `Button.astro:61` (0 callers) vs `lib/ui.ts:47-59` (12 files, lead-counted; the scout said 14 — the finding is unaffected, the number is corrected) |
| X14-F4 | S2 | ADOPT | **D49** | **Actions with no busy state can be double-submitted** — nothing disables the control between click and outcome, on four controls including two that start work. The correct implementation is already in the tree. | `ReportDefinitionView.astro:696` (Run now), `:801` (Retry), `SourceDetailView.astro:328` (Save), `LiveRefresh.astro:56` (Refresh) vs `schemaAutomations.ts:322-337` |
| X14-F5 | S2 | ADOPT | **D49** | **A failed action says nothing to anyone.** The cancel handler swallows the error behind a comment saying no toast infrastructure exists — **`undoToast.ts` now exists and is a standalone callable.** The comment is stale and the silence it justifies is not. | `lib/backups/cancel-button.ts:96-98`; `undoToast.ts:1-15` |
| X14-F6 | S3 | **ACCEPT** | **D49** | **There are no skeletons in the product, and there should not be.** `grep` for a `skeleton` class → **0** (lead-verified); every list is SSR-complete, so a skeleton would be theatre for data that is already in the HTML. `BaseSelectionTable.astro:1612` records one being proposed and rejected. **The worklist's starting evidence for this lens was wrong** and is corrected here. **Reason recorded in `storybook.ts`** on the loading entry, so the next reader does not add one. | `SourcesView.astro:3`, `DestinationsView.astro:3` (the "(skeleton)" prose hits, meaning stub view); `BaseSelectionTable.astro:1612` |
| X14-F7 | S3 | **DEFER** | **D49** | `LiveRefresh`'s Refresh is a full `location.reload()` with no busy state, so the whole surface blanks and a slow refresh is indistinguishable from a dead button. **Trigger: the real re-fetch replacing the reload** — it must arrive with a busy state, and adding one to a reload is work that the re-fetch deletes. | `LiveRefresh.astro:56` |
| X14-F8 | S3 | **DEFER** | **D49** | `LiveRefresh` is mounted on 5 views and absent from Schema, Data and Reports, which render equally snapshot-based data with **no freshness stamp at all**. **Trigger: the staleness work under D01/D17** — the stamp and the refresh are one question and answering half of it twice is churn. | `grep -rln LiveRefresh apps/web/src` → `BackupsListView`, `BackupRunDetailView`, `SpaceHomeView`, `RestoreHistoryView`, `DestinationDetailView` |

**Three findings in this file are duplicates of already-registered rows — recorded as instances, no
new row, no double-count.** That two of the three are wave-5 S1s reached independently by a lens is
the strongest corroboration in the audit:

- **X11-F2 ≡ S25-F1.** Leaving edit via the `Read` segment neither commits nor reverts, so the next
  `Edit` re-baselines `entryValues` to the abandoned text and `Cancel` permanently stops cancelling.
  The lens' **Ruling 1** — that `SourceDetailView` fails the contract it was relayed as the reference
  for, and that the replacement reference is `entityPanelController.ts:157` with the footer anatomy
  at `schemaReadBody.ts:305-314` — is **exactly the correction the fifth wave made in place**, from
  different evidence. It stands, confirmed twice.
- **X14-F1 ≡ S25-F6.** `Test connection` has exactly one outcome and it is success. The lens adds
  two clauses the surface row did not carry and they are folded into it: **there is no pending state
  and no failure branch**, and the sibling rescan path at `IntegrationsView.astro:532-560` *does* use
  `setButtonLoading` and *does* have an error branch — so the correct implementation is in the tree,
  in the dead file, again.
- **X10-F4 ≡ X06-F6.** `SchemaDocs`'s bespoke `<dialog>`. The lens adds the destructive half the
  overlay lens did not: it uses a **solid** `btn-error` confirm where all eight siblings use
  `CONFIRM_DESTRUCTIVE`'s outline (`lib/ui.ts:15`). Folded into X06-F6's row under D06 as well as D45.

### One row filed by the lead, not by a scout

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| **X-D** | S4 | ADOPT | **D21** | **The one DEFER record in this audit describes a number that no longer exists.** `audit/decisions/21-phase2-debt-track.md` is written around "`ds-audit` exit 1, 295 design-system issues across 193 files" and calls the `rem`-fraction codemod its first track item. Commit **`ed8b03b` retired that debt**: today `ds-audit` reports **6 issues across 208 files**, still exit 1, and none of the six is a `rem` fraction. A deferral record whose premise is two orders of magnitude wrong will be cited as cover for work that is already done. Corrected in place. | lead-run today, verbatim: `ds-lint: 6 design-system issue(s), across 208 file(s).` / `[ELIFECYCLE] Command failed with exit code 1.`; bare re-run → **exit 1** |

### This wave's counts

| severity | rows |
|---|---|
| S1 | 8 |
| S2 | 35 |
| S3 | 29 |
| S4 | 5 |
| **total** | **77** |

| disposition | rows |
|---|---|
| ADOPT | 65 |
| RATIFY | 3 (X02-F9 `toolbarFit` · X08-F2 `status-dot` folds into `badge` · X06-F10 `Drawer`'s two engines split into `drawer` + `sheet`). X14-F3 carries a fourth RATIFY inside an ADOPT row: `setButtonLoading` is ratified into the `button` entry |
| ACCEPT | 2 (X05-F3b `.hm-status` · X14-F6 no skeletons — both with the reason recorded in `storybook.ts`) |
| DEFER | 7, every one with a trigger (X01-F16 the seventh `getValue` copy or D40 touching one of the six · X06-F11 X06-F2/F7 landing · X07-F13 the next variance census · X09-F5 any measured icon below 12px · X11-F7 the shared exit guard landing · X14-F7 the real re-fetch replacing the reload · X14-F8 the D01/D17 staleness work). X12-F3 carries an eighth, partial DEFER inside an ADOPT row |

### Cumulative, after the sixth wave

| severity | count |
|---|---|
| S1 | 73 |
| S2 | 225 |
| S3 | 181 |
| S4 | 21 |
| (no severity — NOT-OURS question) | 1 |
| **total** | **501** |

### Under-audited — named, not smoothed over

**Carried forward, still true.** Every under-audited item from the three 2026-08-12 waves, the
2026-08-13 fourth wave and the 2026-08-14 fifth wave stands unchanged. In particular, and because
they bear directly on this wave's remedies:

1. **No number anywhere in this audit has been verified twice by two instruments.**
2. **Chrome would not lay out below ~500px on this machine.** Every screenshot labelled 390 is a
   500-wide layout cropped. Every 390 claim in the whole audit rests on iframe `getComputedStyle`
   alone. X06-F3's drawer-width finding inherits this directly: the defect is *only* visible below
   ~511px, which is exactly the band that could not be photographed.
3. **No second reader on any row, in any wave.**

**Added by this wave:**

4. **All four lens files are source-only. The dev server was never started for any of them.** That
   is a stated method and it is defensible — but it means **every painted claim in 62 rows is
   inferred from declarations**, in a tree with a documented history of rules that are written and
   dead (`audit/findings/X-CSS-ORDER.md`, `specs/16-responsive.md` §10, four proven mechanisms).
   The scouts marked 14 claims `NEEDS-MEASUREMENT` and **the lead measured none of them**. The
   highest-value single measurement in the audit is still unmade: **does the neutral KPI dot paint
   at all** (X08-F7, an S1)? The mechanism is proven in source; the blank pixel is not.
5. **The `NEEDS-MEASUREMENT` backlog is one browser session and nobody has scheduled it.** In
   priority order: X08-F7's computed `background-color` · X09-F3's `getComputedStyle().color` on
   `/restore` · X06-F8's Escape-ordering instrumentation · X06-F3's `clientWidth` at 390/425 ·
   X08-F6's computed contrast on dark · X02-F7's toolbar wrap height on both families ·
   X04-F2's painted line lengths · X09-F5's per-site computed `font-size` · X05-F1's screen-reader
   announcement on the 54 `hidden`-toggled `role="alert"` banners.
6. **X16 was not audited by anyone in this wave, by instruction.** `specs/16-responsive.md` is
   asserted to cover it. That assertion was **not** re-checked against the lens template — nobody
   asked whether the responsive standard answers the same ten questions the other fifteen lenses
   answer. It is probably right; it is not verified.
7. **X10, X11 and X14 were nearly lost.** `audit/findings/X10-X11-X14.md` (314 lines, 21 findings,
   three of them S1) was **not in this step's input list**, and no earlier wave registered it. The
   lead found it by listing the findings directory, not by being told. It is adjudicated above — but
   **the process that produced the input list dropped a fifth of the lens evidence silently**, and
   nothing in the audit's own bookkeeping would have caught it. Anyone auditing this audit should
   assume a second such omission exists and check the directory against the register by hand. It also
   means **X10/X11/X14's rows had the least lead scrutiny of any in this wave**: eight source
   spot-checks, against ~20 for the other four files.
8. **The empty-state census counted class families, not screens.** 28 families across 30 files is a
   count of `<style>` blocks. **Three of the families have never been seen empty by anyone** —
   `/restore` ignores `?fixture=`, `bases.astro` has no `empty` branch, `/settings` declares no
   fixture variant — so D17's vessel is being designed against source it has not watched render.
9. **The 28 status registries were counted, not read.** X08-F8 names 16 with no fallback and two
   that throw; the lead verified four of the eighteen. **Twelve registries are asserted defective on
   a grep.** They are individually cheap to check and none of them was.
10. **`.hm-status`'s ACCEPT rests on one reader's judgement.** It is the only ACCEPT in the wave and
    it exempts the app's most prominent status object from the alert vessel. If Oleh disagrees, D42
    gains a member and X05-F3b flips — this is the row most likely to be wrong.
11. **Two counts drifted between the scout's pass and this ruling** (`<th` 23→24, `.tbl-colhead`
    17→18) in a tree nobody was editing for the audit. A census that moves while it is being read
    will move again before the fix lands; **D40's PR must re-census rather than trust these
    numbers.**
12. **The `Table.astro` deferral has no size estimate, by design, and that is a known risk.**
    Oleh's reason for deferring was that the 9-class / 23-file migration's size "is not yet
    knowable". Four rows across two waves now sit against a decision with no schedule (S25-F4's
    structural half, S25-F12, X01-F2's component half, and the residue of X01-F1/F5). If waves 1–2
    complete and nobody re-opens D15, those four are silently dropped.

---

## Final consolidation — 2026-08-14, seventh pass (the audit is CLOSED)

**Compiled by `audit-lead`.** Input: `audit/OLEH-RULINGS-2026-08-14.md` (ten binding rulings) and four
findings files that no register row reflected — `X-MEASURED-2026-08-14.md`,
`X-MEASURED-BROWSER-2026-08-14.md`, `X-MEASURED-SOURCE-2026-08-14.md`,
`X-CENSUS-INSTRUMENT-NUL-BYTE.md`. Output: **13 new rows (501 → 514)**, **2 severity moves**, **9
in-place corrections**, **D17 and D19 COMPLETE**, **D15 deferred behind a hard gate**.

### Gates, run by the lead today, verbatim

- `corepack pnpm@11.1.1 run ds-audit` → `ds-lint: 6 design-system issue(s), across 208 file(s). Fix
  them or mark a line ds-ok. A UI task is NOT done until this is clean.` /
  `[ELIFECYCLE] Command failed with exit code 1.` → **exit 1**.
  **All six are the same rule** — `unsized control = md` at `RunBackupButton.astro:47`,
  `ConfirmModal.astro:61` and `:65`, `BackupRunDetailView.astro:226`, `NotFoundView.astro:50`,
  `SpaceHomeView.astro:428`. **Oleh's ruling 1 (converge every button to 32) therefore takes
  `ds-audit` to exit 0 for the first time in this audit** — which is a stronger argument for the
  ruling than the variance one, and it was not made when the ruling was taken.
- `corepack pnpm@11.1.1 -r --parallel run typecheck` → **exit 0** (`apps/design`, `apps/support`,
  `apps/survey`, `apps/website`, `apps/prelaunch`: 0 errors each; one `ts(80006)` hint in
  `apps/survey`, not `apps/web`).

### Source spot-checks the lead ran before accepting any of the four files

| claim | result |
|---|---|
| `PanelHost.astro:623` declares `.ph-panels` with no `width` and no `left` | **CONFIRMED verbatim** — `position: absolute; top: 0; right: 0; bottom: 0; display: flex; flex-direction: row; justify-content: flex-end; max-width: 100vw; pointer-events: auto;` |
| the five sheets spell the narrow width `calc(100% - 40px)` | **CONFIRMED** — `EntityPanel.astro:315` · `RecordPanel.astro:670` · `DataChangelog.astro:507` · `MediaPanel.astro:490` · `QuickAskDock.astro:541` |
| `baseout-dark` does not exist | **CONFIRMED** — `lib/theme.ts:13-14`, `DARK_THEME = 'baseout'` / `LIGHT_THEME = 'baseout-light'`. The only citations of the nonexistent theme are `audit/findings/X04-X05-X08.md:376` (corrected in place today) and `specs/02-shell-sidebar-topbar.md:195` (filed, X-M12). **`REGISTER.md` and `SHIP-ORDER.md` never contained it — the brief's claim that they did is wrong and is recorded here rather than acted on.** |
| `specs/16-responsive.md` §8 records the panel fix as verified at 326.59 → 350 and x 63.41 → 40, and attributes 8.41px to the scrollbar | **CONFIRMED verbatim** at `:462-479` |
| `listSheet.ts:49` `OVERLAY_BELOW = 964`, measured against the section column | **CONFIRMED** — `:149` `const w = available(h.root)`, and the header comment at `:50-52` says "the SECTION's content column minus its own padding" |
| the three sub-12px icon rules | **CONFIRMED at the cited lines** — `global.css:1902` `.hm-delta .iconify { font-size: .74rem; }` · `SpaceHomeView.astro:726` `.hm-conn-badge .iconify { font-size: .72rem; }` · `IntegrationsSetupWizard.astro:591` `.review-link-badge .iconify { font-size: .72rem; }`. None carries `ds-ok` |
| `toolbarFit.ts` compares against 1440 | **CONFIRMED** — `const NARROW_AT = 1440` at `:18`, and the header comment at `:6` already states "at a 1440 laptop with split on, the content column is ~795px" |
| `DataBrowse.astro:936` holds two raw NUL bytes | **CONFIRMED by direct byte read** — `NUL count: 2`, both on line 936, `a.colOrder.join('\x00') === b.colOrder.join('\x00')` |
| `#login-error` has no writer anywhere | **CONFIRMED** — `/usr/bin/grep -rna 'login-error' apps/web/src` → 2 hits, both the markup at `LoginView.astro:99,101`; `lib/auth-utils.ts` has **exactly one importer**, `Sidebar.astro:643` |
| `lib/restore/controller.ts:65-69` assigns `textContent` unconditionally, and `render()` has 13 call sites | **CONFIRMED** — `el.textContent = value` with no comparison; `render()` at `:369` called from `:400,420,428,434,438,449,456,461,468,473,477,513` = **12 calls + the definition = 13 occurrences** |
| `Running` is amber at 8 live sites | **CONFIRMED, and the eighth is not the word `Running`** — 7 sites are `running: { label: 'Running', badge: 'badge-soft badge-warning' }` or its inline twin (`BackupRunDetailView.astro:183,199` · `BackupsListView.astro:45` · `BackupRunBaseView.astro:103,111` · `RestoreHistoryView.astro:60` · `RestoreView.astro:534`); the eighth is `ReportDefinitionView.astro:235`, `Generating` in the same amber. The colour ruling must cover both words |
| `storybook.ts:732` scopes the ban's failure figures to the dark theme | **CONFIRMED verbatim** — it does say `badge-ghost` is "17.4:1 in BOTH themes", so the asymmetry is precisely that the *failure* is dark-only in the text and the *replacement* is both |

### Every count carried forward that could touch `DataBrowse.astro`, re-counted with `/usr/bin/grep -a`

The instrument defect is real and the lead reproduced it: `grep -roE 'cursor-pointer|cursor: pointer'
apps/web/src | wc -l` → **154** through the session's `ugrep -I` shim, **167** through
`/usr/bin/grep -a`, and `DataBrowse.astro` alone holds **13**. 154 + 13 = 167 exactly. Same file
accounts for exactly +1 on every other pattern below.

| figure | recorded | re-counted | changed? |
|---|---|---|---|
| `role="alert"` occurrences | 54 (differently scoped) / 78 | **79** | **yes** |
| `role="status"` | 11 | **35** | **yes** |
| `role="note"` | 4 | **4** | no |
| `toLocale*` occurrences (tree / outside `time.ts`) | "15 calls" | **57 / 46** (= 45 calls, 15 files) | **yes — the 15 was files** |
| `class="iconify lucide--*"` | 73 lines | **75 occurrences / 73 lines / 31 files** | **yes (units)** |
| `<th`-declaring files | 24 | **25** | **yes** |
| `.tbl-colhead` files | 18 | **19** | **yes** |
| `cursor: pointer` | 154 | **167** | **yes** |
| `badge-soft` | 175 | **176** | **yes** |
| `badge-ghost` | 68 | **68** | no |
| `alert-soft` | 77 | **77** | no |
| `window.location='…'` row navigations | 12 | **12** | no |
| `document.addEventListener('keydown')` sites | 10 | **12** | **yes — and one of the two is an 8th Escape site** |

**The `<th` 23 → 24 → 25 and `.tbl-colhead` 17 → 18 → 19 drift is now fully explained**: each pass
used a different binary, and each increment is one file. This closes under-audited item 11 of the
sixth wave. Counts taken on `HEAD` and on the working tree agree, so the implementer's concurrent
`global.css` edit does not affect any figure above.

### The 13 new rows

| id | sev | disp | decision | row | evidence |
|---|---|---|---|---|---|
| **X-M3** | **S1** | ADOPT | **D45** | **The panel-width ruling that `specs/16-responsive.md` §8 records as *applied and verified* is conditionally dead: the first panel paints 288.79px at x=101.21 instead of 350 at x=40, and the number does not change between a 390 and a 425 viewport.** `.ph-panels` declares no `width` and no `left`, so an absolutely-positioned flex box **shrink-to-fits from its own content**; the five sheets then say `width: calc(100% - 40px)`, and that `100%` resolves against a box sized by that same child — a circular percentage CSS breaks by sizing the parent from the child's max-content contribution. Hence 328.79 → 288.79, and hence the width is **viewport-independent**. Opening a second panel pushes `.ph-panels` into its `max-width: 100vw` clamp and the documented 350-at-x=40 appears. **So the identical declaration in the identical media query is correct on `/data` and wrong on `/schema`,** and 61.21px of screen is left showing body text clipped mid-word (`The` / `hub.` / `com` / `anyt`). Four hosts, four widths, four left edges, **77.80px** of spread at 390. `css-guard` cannot see it: the cascade is correct and the **containing block** is wrong. | lead-verified `PanelHost.astro:623` in full (no `width`, no `left`); measured `.ph-panels` clientWidth **328.79** at 390 and **329** at 425 with one panel, **390 (clamped)** with two; `.ep-sheet` 288.79 at x=101.21 both widths; `.rp-sheet` on `/data` **350.00 at x=40** — same declaration, correct. `EntityPanel.astro:315`, `RecordPanel.astro:670`; shot `XMB-B-02`. Fix proposed, not applied: give `.ph-panels` a viewport-sized basis (`width: 100vw` or `inset-inline: 0`), then re-read the computed width on all five hosts. **`EntityPanel.astro:307-314`'s comment is the trap — it records why a custom property was abandoned for a direct `width` (an inline `--panel-w` from drag-resize outranks the media rule); that reasoning is still correct and must survive the edit** |
| **X-M11** | S2 | ADOPT | **D45** · D20 | **A spec records a number the app does not paint, and recording it as verified is what stopped anyone re-measuring it for a year.** `specs/16-responsive.md:462-479` certifies EntityPanel at "326.59 → **350**" and its left edge "63.41 → **40**". Measured today: **288.79 at x=101.21** for the first panel (X-M3). Its *rationale* is separately wrong here: "the **8.41px** RecordPanel gained is the scrollbar" measures **0.00px** at 390 and at 425, even against a forced 20,983px page, because Chrome on macOS paints overlay scrollbars — `94vw` and `94%` differ by 0.01px. **Stated precisely and not overclaimed: classic-scrollbar platforms (~15px) could not be emulated, so §8 is not disproved — its number is simply not this platform's,** and it must be scoped to those platforms or dropped, because item 34 cannot be justified by a 0px effect. | `specs/16-responsive.md:462-479` read in full by the lead; probe table (`window.innerWidth` / `documentElement.clientWidth` / painted `100vw` = 390 · 390 · 390, and identical with a forced tall page) in `audit/findings/X-MEASURED-BROWSER-2026-08-14.md` §0 |
| **X-M12** | S3 | ADOPT | **D20** | **A spec instructs the reader to use a theme that does not exist.** `specs/02-shell-sidebar-topbar.md:195` — "Already wired to `@opensided/theme`'s `baseout-light` and `baseout-dark` themes." There is no `baseout-dark`: the dark theme is `baseout`. Anyone writing or measuring a dark-theme rule from this sentence sets `data-theme="baseout-dark"`, gets **no theme at all**, and measures the fallback — which is exactly how a contrast figure gets recorded against the wrong palette. | lead-verified `lib/theme.ts:13-14`; `/usr/bin/grep -rna baseout-dark` over `apps/`, `specs/`, `.claude/` → one live citation, `specs/02-shell-sidebar-topbar.md:195` |
| **X-M13** | S2 | ADOPT | **D42** | **The product's error banners behave one way for a sighted user and up to five ways for a screen-reader user: `role="alert"` is on 79 elements and doing its job on 7.** The discriminator is the **writer's ordering**, not the attribute — a live region announces when it enters the tree with content or when text mutates inside it while it is in the tree, and `hidden` removes it from the tree. Classified: **(a) 19** revealed-only (text static — unreliable, treat as silent) · **(b) 17** written and revealed, of which **13 write while still `hidden` and then reveal**, the order that suppresses the announcement, and only 4 reveal-then-write · **(c) 3** inserted at error time (two of which fire when a *drawer opens*, not when anything failed) · **(d) 1** with no writer anywhere · **(e) 39 SSR-static** — present with their final text at first paint, so the role can never fire. **Nobody chose this; the ordering is per-handler accident across 17 hand-rolled writers.** Two sub-findings recorded as instances rather than rows: `SidebarLayout.astro:179`'s `#too-narrow` is an **assertive region driven by a CSS media query** (`global.css:367-369`, no JS) — a viewport condition, `role="status"` at most; and `BaseSelectionTable.astro:260` is one of the four that *do* work and what it announces assertively is *"3 new bases appeared"*, i.e. good news interrupting the reader. **11 of the 19 (a) sites are the consequence line inside a destructive `ConfirmModal`, where the role is wrong for all 11** — the dialog takes focus and reads its own content. | Full site-by-site classification with the writer resolved for each, `audit/findings/X-MEASURED-SOURCE-2026-08-14.md` §12.2–12.4; lead-reproduced counts (79 / 35 / 4); the two correct-order proofs the vessel should copy are `ReportDefinitionView.astro:689` and `BaseSelectionTable.astro:1471-1479` |
| **X-M14** | S3 | ADOPT | **D42** | **The mirror image of the silent-banner finding, and nobody looked for it: one live region is chatty.** `lib/restore/controller.ts:65-69` `text()` assigns `el.textContent = value` **unconditionally**, and `paint()` runs from `render()`, which has **13 call sites** in the file. `[data-rs-sum-warn-text]` sits *inside* `role="alert"` at `RestoreView.astro:459-461` and is visible whenever a snapshot warning applies — so **every checkbox toggle, table selection and target change in the restore builder replaces the text node inside a live assertive region, even when the string is identical.** A screen-reader user configuring a restore is interrupted by the same warning sentence on every click. The fix is in the vessel's contract (**write only on change**), not in `RestoreView`. | lead-verified `controller.ts:65-69` (no comparison before assignment) and 13 `render()` occurrences at `:369,400,420,428,434,438,449,456,461,468,473,477,513`; `RestoreView.astro:459`. **`paint()` itself is right and must not be unwound** — one derivation painted into both the page summary and the confirm dialog through a prefix, so the two can never disagree |
| **X-M15** | S3 | ADOPT | **D23** | **Three CSS rules paint an icon below the SM/12px floor with no `ds-ok`, two of them visible on Home — the app's landing surface — and no gate can see any of them.** `global.css:1902` `.hm-delta .iconify { font-size: .74rem }` → **11.84px** (box 10.45 × 11.84, on `SpaceHomeView.astro:220`'s KPI delta arrow); `SpaceHomeView.astro:726` `.hm-conn-badge .iconify { .72rem }` → **11.52px** ×2 (`:440`, `:446`, the pipeline connectors); `IntegrationsSetupWizard.astro:591` is the same rule, measured **not** visible in the default state. `ds-checks.mjs` looks for `*-xs` utilities and ~10px, **not a `rem` literal**, so `ds-lint` has never had a chance. **Seven sibling sub-12px rules DO carry `ds-ok` with a stated reason, so the floor is otherwise being honoured deliberately and these three are oversights, not policy.** | measured on `/` at `innerWidth: 1440` with `data-astro-source-loc`; all three rules lead-verified at the cited lines, none carrying `ds-ok`; the sanctioned siblings are `EntityPanel.astro:341`, `SchemaBrowse.astro:538`, `:695`, `ReportDefinitionView.astro:1043`, `:1055`, `:1060`, `:1061`. **`.hm-conn-badge` is only `1rem` square, so this may be a badge-size decision rather than an icon one — UNVERIFIED which, and the implementer must decide it at the element, not from this row** |
| **X-M16** | S2 | ADOPT | **D23** | **One button height (Oleh, ruling 1): the 40px `md` carve-out is deleted from the 17 views that hold it.** **This is not a defect fix — measured before the ruling, there were zero off-tier buttons and the 40/32 split was fully obeyed.** It is a deliberate reduction in the number of sizes the product has, it **supersedes `decision-density-sm-is-default`'s "md = page-header CTA only"**, and the catalog entry must be amended in the same PR or the next reader restores the 40. **It also takes `ds-audit` to exit 0**: all six remaining issues are `unsized control = md`. Cost, recorded because the lead argued the other way and lost: the page CTA loses size as its emphasis channel and must carry emphasis by colour and position alone. | `audit/OLEH-RULINGS-2026-08-14.md` §1; `ds-audit` today lists exactly six `md` controls — `RunBackupButton.astro:47` · `ConfirmModal.astro:61` · `:65` · `BackupRunDetailView.astro:226` · `NotFoundView.astro:50` · `SpaceHomeView.astro:428`. **`ConfirmModal`'s footer pair is currently a documented `ds-ok`'d exception (D45 "not changing") — that carve-out closes with this ruling and D45 must be read alongside it** |
| **X-M17** | S2 | ADOPT | **D41** | **A threshold that can never evaluate false, and it means six `global.css` rules that read as a narrow adaptation are in fact the product's only rendering.** `toolbarFit.ts:18` compares `#layout-content`'s `clientWidth` against **1440** — and that column is **1184 at a full-screen 1440 laptop with no split view**, because the sidebar takes 256. So `data-narrow` is permanent: on nine `.sch-tb` surfaces the button words are always dropped and the search is always a 32px magnifier, and no finding in this audit said so. Oleh's ruling (7) is **fix the threshold to measure what it claims**. **Consequence to review by eye, because it is a visible change to every dense toolbar in the product: at wide widths the button words and the full search field come back.** It needs a screenshot at 1440 before it is called done. Supersedes the framing in `task-responsive-1440-toolbar`. | lead-verified `const NARROW_AT = 1440` at `toolbarFit.ts:18`; measured `/schema` at viewport 1440 → `#layout-content` **1184**, `data-narrow` **ON**, search collapsed to **32px**, toolbar one row; `/backups` at 1440 → same 1184 column, `data-narrow` **absent tree-wide**. The file's own header comment at `:6` already contains the number that disproves the threshold |
| **X-M18** | S3 | **DEFER** | **D07** · D45 | **A list console silently changes from a column into a page overlay at a width nothing records, and above that width the co-open state the audit filed a finding against cannot exist at all.** `OVERLAY_BELOW = 964` is measured against the **section column**, not the viewport: at viewport 1440 the column is 1136 and **zero** elements carry `is-list-overlay`. The state X06-F8 describes was only reachable at viewport 900 (column 876). The sheet's mode is also absent from the URL, which is D07's subject. **Filed chiefly so the next pass is not misled: a scout doing a 1440 sweep will conclude the overlay does not exist.** **Trigger: any work on ship item 28 (which must reproduce at a ≤964 column, not at 1440) or on `wireViewState`.** | lead-verified `listSheet.ts:49` and the header comment at `:50-52` ("the SECTION's content column minus its own padding"), `:149` `available(h.root)`; measured `#layout-content` 1184 → section 1136 at 1440, 876 at 900 |
| **X-M19** | S3 | ADOPT | **D21** | **Two bytes of real product code make one file invisible to every census tool in the repo, with a clean exit code.** `DataBrowse.astro:936` writes its array-join separator as a **literal NUL byte** instead of the escape `'\0'` — `a.colOrder.join('<NUL>') === b.colOrder.join('<NUL>')`. The idiom is sound; the encoding is not. `file(1)` calls the result "Java source, Unicode text, UTF-8 text" and every binary-classifying tool (`ugrep -I`, `git grep` without `-a`) skips it silently. **It is the only NUL-bearing file in `apps/web/src`, `apps/design/src`, `specs/` and `.claude/` — 1 file, 2 bytes, whole tree** — and it is the mechanism behind six drifting counts in this audit, including an **8th `document`-level Escape listener at `:1313` that no pass in this audit could see** (folded into X06-F8). **Not a UX finding, and it is one row, not the six counts it corrupted.** Runtime behaviour after the fix is byte-identical. **STATUS at the close of this pass: the 2-character fix has LANDED in the working tree** (a concurrent implementer applied it while this pass was compiling) — `HEAD` still carries `NUL count: 2`, the working tree carries **0**, and the shimmed `grep` now reads the file. **Every count in this pass was taken against `HEAD` (`61d121e`) and against a working tree that then still matched it, so the figures stand; any count taken after that commit lands must be re-taken, because the tool population changed under it.** | lead-verified by direct byte read: `NUL count: 2`, both line 936; reproduced the skip — `grep -c 'role="alert"' DataBrowse.astro` → nothing, `/usr/bin/grep -ac` → 1; `grep -roE 'cursor…' apps/web/src` 154 vs `/usr/bin/grep -a` 167 with 13 in this file. **`CLAUDE.md` already prescribes `-a` for `git grep` and was right about the symptom and vague about the cause: it is this one file and this one idiom, and it applies to the bare `grep` in this shell too** |
| **X-M20** | S3 | ADOPT | **D44** | **The two mechanically-detectable badge rules become checks (Oleh, ruling 6): the banned `badge-soft badge-neutral` pair, and error-red on a literal non-failure set.** A ban stated in the catalog, live in three files, with every gate green, is not enforcement — it is prose. **Expect `ds-lint` to go red in three files nobody is touching, and fix those three in the same PR rather than `ds-ok`-ing them:** that is the point of switching it on. Harness/gate only; no client PR for the check itself. | `audit/OLEH-RULINGS-2026-08-14.md` §6; the three live sites are lead-verified at `BackupRunDetailView.astro:530` · `BackupRunBaseView.astro:325` · `SchemaCanvas.tsx:646`; the ban is quoted in product code at `inbox.ts:137`. **Add a `rem`-literal sub-12px check in the same edit** — X-M15 exists because `ds-checks.mjs` looks for `*-xs` and ~10px only |
| **X-M21** | S2 | ADOPT | **D44** · D34 | **The catalog's own evidence for its only banned badge pair documents one theme, and the pair fails in both.** `storybook.ts:732` gives 1.34:1 text and 1.02:1 pill "on the dark theme" and then says `badge-ghost` is "17.4:1 in **BOTH** themes" — so the sentence's shape invites the reading that light is fine. Measured: light is **4.35** text (AA needs 4.5 at 12px/600 — it misses by 0.15) and **1.11** pill (UI needs 3.0). **In both themes the chip has no readable text and no discernible shape**, on two lists of permanently failed files where the invisible word is `Won't retry` — the one word saying the failure is final. The **copy is correct and must not be "fixed"**; the colour is what destroys it. | canvas-resolved WCAG computation at `innerWidth: 1440` on the live element in both themes; dark reproduced the catalog's figures to the digit (1.34 / 1.02 / 17.40), light adds 4.35 / 1.11 / 16.29; shot `XMB-C1-01`; `BackupRunDetailView.astro:530`. `storybook.ts:732` read in full by the lead |
| **X-M22** | S4 | ADOPT | **D20** | **Two places describe a card-padding split the product no longer has, and a ~14-file edit was scheduled off them.** `specs/16-responsive.md` §3 and the comment at `apps/web/src/styles/global.css:340-347` both still describe the 33-vs-29 narrow text inset as live. It was real when `.bl-panel` folded; **Oleh's ruling of 2026-08-13 moved Backups to `data-narrow-pan` and the folded row's 4px inline padding went with it.** Measured at a real 390: Home's `.hm-kpi` **29**, the report document's genuinely-folded `.rptk-card` **29**, `.bl-panel` not comparable because it pans. **The fix is documentation only; the row-padding edit is not needed.** For the record, 29 is not a grid violation: it is `12` gutter + `1` border + `16` padding, and the 4px grid governs what an author writes, not the sum of nested boxes. | `audit/OLEH-RULINGS-2026-08-14.md` §2 |

### Folded in place, not filed — and why

Four items the measurement pass proposed as rows are **audit bookkeeping, not product defects**, and
filing them would inflate the register with corrections to itself:

- **M2** (X06-F8's site list wrong in both directions — 7 sites not 5, one guarded `stopPropagation`
  not two unconditional, `sectionTabs.ts:81` and `EntitySearch.astro:266` are `/` handlers) → folded
  into X06-F8's evidence cell, **with an eighth site the lead found today** (`DataBrowse.astro:1313`).
- **M5** (the scrollbar rationale costs 0px; the `480px` divergence is unreachable) → folded into
  X06-F3, with the classic-scrollbar caveat kept as **UNVERIFIED**. The spec half is X-M11.
- **M9** (X09-F5's premise wrong though its trigger fired) → folded into X09-F5, whose trigger is
  rewritten; the real defect is X-M15.
- **D41's stated measurement** (Oleh ruling 8) → the decision body is corrected, not a row. Measured
  at 1100, **none** of the three copies wraps: they carry 2–3 controls totalling ~430px in an 1100px
  column. **They converge for variance — three byte-identical private rules for one job — and the
  wrap argument must not be repeated, or the next audit will measure for a wrap, fail to find one,
  and reverse a correct decision.** Wrapping is a problem of the *dense* toolbars, which are already
  `.sch-tb`.

**Two of Oleh's rulings produce no row at all, deliberately.** Ruling 3 (`.rs-snapwrap` → PAN) and
ruling 4 (source-detail `.reg-usewrap` → PAN) are **standard decisions on the responsive track**,
not findings — X16 was never lens-passed and neither element ever had a register row. Both are
recorded where they belong (`specs/16-responsive.md` §12 and the responsive census). Ruling 3's
counter-argument rested on *"Backups folds"*; **measured, `.bl-tablewrap` is `overflow-x: auto` with
clientWidth 332 / scrollWidth 623 and `panRail` mounted — Backups pans**, so the premise was false.
Folding `.rs-snapwrap` would also hide the radio the step exists to press.

### This pass's counts

| severity | rows |
|---|---|
| S1 | 1 |
| S2 | 5 |
| S3 | 6 |
| S4 | 1 |
| **total** | **13** |

| disposition | rows |
|---|---|
| ADOPT | 12 |
| DEFER | 1 (X-M18 — trigger: ship item 28, or any `wireViewState` work) |
| RATIFY | 0 |
| ACCEPT | 0 |

**Severity moves this pass (2, both on measured evidence, both stated with the number that moved
them):** X04-F2 **S3 → S4** (the cap never binds at 390, 5 of 5; 42ch and 46ch give identical line
counts in 5 of 5 at both widths) · X06-F8 **S3 → S2** (24 deliveries per press, 13 of them after the
one `stopPropagation`; both overlays close). **No row is left undisposed.**

### Decisions amended by this pass

**D17 COMPLETE** (46ch bound, with the zero-payoff note recorded so nobody looks for a visible
difference twice) · **D19 COMPLETE** (`Running` = primary; the colour column is written) ·
**D15 DEFERRED behind a hard gate** in `SHIP-ORDER.md`, not a bullet · **D41** (rationale replaced;
gains the `toolbarFit` threshold) · **D42** (gains the write/reveal ordering contract, the
"no live role at first paint" rule, and an explicit statement of which of the 79 sites are its) ·
**D45** (gains the `.ph-panels` containing-block fix as its first item, and its Escape clause is
re-stated as "no owner") · **D23** (gains one button height and the sub-12px icon floor) ·
**D21** (the NUL byte; X09-F5's trigger rewritten; the icon census corrected) · **D09** (the
`toLocale*` mechanism corrected from dates to thousands separators) · **D07** (the listSheet's mode
is unaddressable) · **D20** (three documentation defects: two specs and one stale comment) ·
**D44** (the gate switch-on and the light-theme catalog sentence). **No new decision file was
created — this pass reduced the audit's surface, it did not extend it.**

### Under-audited — carried forward in full, plus what this pass adds

**Every item from the six prior waves stands unchanged**, except **item 11 (the drifting `<th` /
`.tbl-colhead` counts), which is now CLOSED** — the cause is X-M19 and the corrected figures are 25
and 19. In particular these still stand: no number verified twice by two instruments *except* the
ones in this pass's re-count table · no second reader on any row in any wave · 62 rows inferred from
declarations by source-only lenses · three of D17's 28 empty-state families have never been seen
empty by anyone (D33-blocked) · twelve of the 28 status registries are asserted defective on a grep
and were never read · `.hm-status`'s ACCEPT rests on one reader's judgement · X16 was never
lens-passed and that assertion was never re-checked.

**"Chrome would not lay out below ~500px on this machine" is now PARTLY retired.** `emulate`
(`Emulation.setDeviceMetricsOverride`) does lay out at 390 and 425 and was used for every narrow
number in this pass. **But every 390 claim in waves 1–6 was taken with `resize_page` and is still a
500-wide layout**, so those rows are not retroactively verified — only the ones re-measured here are.

**Added by this pass, in the order a next pass should take them:**

1. **Icons were measured only at 1440.** `global.css:204-210` steps `--t-*` down below 1280, so a
   narrow sweep could find more sub-12px cases. **Not run.**
2. **Classic-scrollbar platforms are unverified.** The whole `vw`-vs-`%` argument in
   `specs/16-responsive.md` §8 measures 0.00px on macOS overlay scrollbars and could not be emulated
   at ~15px. Neither proved nor disproved.
3. **`/integrations/configure/bases` (`IntegrationsManageBasesView`) was never swept** by any pass in
   this audit, at any width.
4. **15 of the 73 unsized-icon lines were never measured** — they are runtime HTML strings inside
   states nobody opened (`SchemaChat.astro`, `schemaChat.ts`, `QuickAskDock.astro`,
   `typeaheadItems.ts`, `schemaRelationships.ts`).
5. **`.rl-detail-panel` — the seventh overlay — has never had its width measured**, at any viewport,
   by anyone. It is the only overlay family absent from the four-host comparison, and it is the one
   X06-F7 proposes to fold into `PanelHost`.
6. **No screen-reader ever ran.** X-M13's classification is a source argument about ordering and the
   lead accepts it as one. The single probe that would settle the 19 (a) sites — *does removing
   `hidden` from a pre-populated `role="alert"` announce in the target AT?* — was not taken; it
   changes how they are described, not the remedy.
7. **X-M15's `.hm-conn-badge` question is unresolved**: a `1rem`-square badge may not be able to hold
   a 12px glyph, in which case it is a badge-size decision and not an icon one. The lead did not
   decide it and the implementer must, at the element.
