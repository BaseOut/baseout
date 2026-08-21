---
id: X-MEASURED-SOURCE
surface: two source-census items — SHIP-ORDER item 27 (`toLocale*`) and item 12 / X05-F1 (`role="alert"`)
url: n/a — source only. No browser was opened (a parallel scout held the MCP's global selected page).
shots: []
scout: audit-scout
---

# X-MEASURED-SOURCE — the two counts the audit deferred, taken from source

**2026-08-14.** `audit/SHIP-ORDER.md:123` (item 27) and `:125` (item 12) are the two
`NEEDS-MEASUREMENT` claims that do **not** need a painted pixel. Both are answerable from
`apps/web/src` alone, and both are answered below. Neither verdict rests on a screenshot.

---

## 0 · METHOD — and a methodology defect that explains the audit's drifting counts

**READ THIS BEFORE TRUSTING ANY COUNT IN THIS AUDIT.**

The session's `grep` is not `grep`. It is a shell function that execs **`ugrep -I`**
(`grep --version` → `ugrep 7.5.0`). `-I` means *skip files ugrep judges to be binary*, and
**`apps/web/src/components/data/DataBrowse.astro` is one of those files** — 3,000+ lines with
non-ASCII content that trips the heuristic. Every `grep` in this session silently omitted it, with
no warning and a clean exit code.

Measured, on the same tree, in the same second:

| pattern | shimmed `grep` (ugrep -I) | `/usr/bin/grep -a` | delta |
|---|---|---|---|
| `role="alert"` occurrences under `apps/web/src` | **78** | **79** | `DataBrowse.astro:262` |
| `toLocale` lines under `apps/web/src` | **46** | **47** | `DataBrowse.astro:1075` |

This is very likely the mechanism behind the two drifts the lead already recorded (`<th` 23→24,
`.tbl-colhead` 17→18): **one file, one line each, appearing or disappearing depending on which
binary answered.** `CLAUDE.md` warns about it for `git grep` (hence the `-a` in the dead-view
check); nobody carried the warning into the audit's counting passes.

**Every number in this file was produced with `/usr/bin/grep -a` (and cross-checked with a Python
pass that reads each file directly).** Recommendation for the lead: re-run any surviving
`NEEDS-MEASUREMENT` count with `/usr/bin/grep -a`, and treat a count taken with the bare `grep`
alias as ±1 per pattern.

Method for item 2 specifically: for each `role="alert"` site I (a) read the element's own opening
tag, including multi-line attribute forms; (b) resolved every `id=` / `data-*` hook to its writer by
name; (c) where the writer selects by a **templated** selector (`[${prefix}-warn]`) I traced the
prefix — this is how `RestoreView`'s two sites were nearly misfiled as writer-less; and (d) walked
the enclosing markup to find alerts revealed by an **ancestor** (`<ConfirmModal>`, `<Drawer>`,
`[data-sec-stage]`) rather than by their own `hidden`.

---

# ITEM 27 · The `toLocale*` calls

## 27.1 The corrected count

| figure | audit said | measured 2026-08-14 |
|---|---|---|
| `toLocale*` **occurrences** under `apps/web/src` | "15 `toLocale*` calls" (`SHIP-ORDER.md:72`) | **57** |
| …of which inside `lib/time.ts` | — | **11** (10 calls + 1 prose mention at `:40`) |
| …**outside** `lib/time.ts` | — | **46** occurrences = **45 real calls** + 1 prose mention (`DataMedia.astro:907`) |
| **files** outside `lib/time.ts` that call `toLocale*` | 15 (`REGISTER.md:1552`) | **15 ✓ — the register was right** |
| `Intl.*` constructors | not counted | **14 real** (+1 prose at `time.ts:21`) |
| `Intl.*` constructors that omit the locale | not counted | **0** |

**The "15" is files, not calls.** `REGISTER.md:1552` says *"15 files call `toLocale*` directly"* and
lists them; `SHIP-ORDER.md:72` compressed that to *"the 15 `toLocale*` calls"*, and the ship-order
line is what the measurement request inherited. The register's file list — including `DataBrowse`,
which my first (ugrep) pass wrongly dropped — is **exactly right**. The call count is **45**.

## 27.2 The whole table of sites

Every one of the 45 is `Number.prototype.toLocaleString()`. **Zero take an argument** — verified with
`/usr/bin/grep -rno -a "toLocaleString([^)]" apps/web/src --exclude=time.ts` → no matches. So there
is no "passed-but-dynamic vs hard-coded" split to report outside `time.ts`: it is *all* omission.

| file | calls | shared? | lines |
|---|---|---|---|
| `components/data/recordReadBody.ts` | 6 | **YES** — record-panel body, mounted by every Data/Schema drawer | `:137`, `:161`, `:200`, `:380`, `:387` ×2 |
| `components/data/DataChangelog.astro` | 6 | no | `:72`, `:74`, `:205`, `:633`, `:1012` ×2 |
| `components/data/DataMedia.astro` | 6 | no | `:1315` ×2, `:1316`, `:1438`, `:1445` (+ prose at `:907`) |
| `components/schema/ExportControl.astro` | 4 | **YES** — one export control across Schema + Data | `:287`, `:310`, `:313`, `:342` |
| `components/ui/tablePager.ts` | 4 | **YES — 15 importers** | `:46` ×2, `:54`, `:132` |
| `components/schema/SchemaDocs.astro` | 4 | no | `:933` ×2, `:1059` ×2 |
| `components/data/runReadBody.ts` | 3 | **YES** — run-panel body | `:96`, `:126` ×2 |
| `components/data/DataComments.astro` | 3 | no | `:835` ×2, `:836` |
| `components/schema/SchemaBrowse.astro` | 3 | no | `:262` ×2, `:841` |
| `components/data/MediaPanel.astro` | 2 | no | `:201` ×2 |
| `components/data/RecordPanel.astro` | 2 | no | `:212` ×2 |
| `components/ui/pickerSearch.ts` | 1 | **YES** — the picker, app-wide | `:337` |
| `components/schema/schemaReadBody.ts` | 1 | **YES** — entity-panel body | `:923` |
| `components/data/StaticImport.astro` | 1 | no | `:133` |
| `components/data/DataBrowse.astro` | 1 | no | `:1075` — **the line every ugrep pass in this audit missed** |
| **`lib/time.ts`** | **10** | **YES — the whole time system** | `:76`, `:84`, `:91`, `:97`, `:103` (`toLocaleDateString`/`TimeString`) · `:110`, `:127`, `:228`, `:297`, `:330` (`toLocaleString`) |

**`lib/time.ts` passes `LOCALE` (`= 'en-US'`, `:57`) at all 10 call sites.** Verified individually.
The D09 verification claim holds exactly as written: `toLocaleDateString` / `toLocaleTimeString`
outside `lib/time.ts` = **0** (`/usr/bin/grep -rho -a 'toLocale[A-Za-z]*' apps/web/src
--exclude=time.ts | sort -u` → `toLocaleString` only).

`Intl.*` — 14 constructors, **all with a pinned locale**, so this is *not* the same defect wearing a
different name:

`TrendChart.astro:91` · `BaseSelectionTable.astro:69` · `SchemaCanvas.tsx:509` · `:669` ·
`lib/restore/request.ts:20` · `lib/reports/view.ts:9` · `BackupRunDetailView.astro:98` ·
`BackupsListView.astro:28` · `RestoreView.astro:129` · `BackupRunBaseView.astro:64` ·
`ReportDefinitionView.astro:92` · `RestoreHistoryView.astro:43` · `SpaceHomeView.astro:115` —
thirteen `new Intl.NumberFormat('en-US')`, plus `time.ts:186`
`new Intl.DateTimeFormat(LOCALE, { timeZoneName: 'shortOffset' })`.

## 27.3 The finding this actually is — and it is not the one the register describes

**The register's framing is wrong on the mechanism, and the correction makes the item cheaper and
sharper.** `REGISTER.md:1552` says the 15 files *"format dates with `toLocale*` directly"* and cites
`inbox.ts:232`'s `14 Jul` vs `Jul 14` bug. **Not one of the 45 calls formats a date.** Every one is a
count: `.length`, `total`, `recordCount`, `run.counts[t]`, `rest`, `drawn`. The `14 Jul` / `Jul 14`
reordering **cannot happen** from any of them.

What *can* happen is a **thousands separator that changes by machine** — `1,240,000` on an `en-US`
host, `1.240.000` on a German one, `1 240 000` on a French one — and the real defect is that the app
already **pins** that separator in 13 places and leaves it floating in 45.

**One screen shows both.** `/backups`: `BackupsListView.astro:28,62` renders every row count through
`nf.format` (pinned `en-US`), and the pager 40px below renders its total through
`tablePager.ts:54,132` bare. On a non-`en-US` host the same page prints two different number
grammars for the same kind of quantity. Same pairing on `/backups/run/*`
(`BackupRunDetailView.astro:98` + `runReadBody.ts:96,126`), on `/reports/*`
(`lib/reports/view.ts:9` + `tablePager`), and on `/restore` (`RestoreView.astro:129` +
`lib/restore/request.ts:20` + `tablePager`).

**The honest scope limit:** `time.ts:32-33` records Oleh's ruling that *"the customers are in the
United States."* If every user's host really is `en-US`, all 45 render identically to the 13 and the
defect is invisible in production. The exposed populations are (i) any non-US customer, (ii) a US
customer who has set their OS to another region, and (iii) **Oleh reviewing from Ukraine** — the
third is the one that has historically caught this class of bug in this repo, and it is why
`time.ts` pins its own locale rather than trusting the audience.

## 27.4 VERDICT — item 27

**It is neither "one shared-helper fix" nor 45 scattered ones. It is one new helper plus 15 files,
and 5 of those 15 are shared components that cover most of the app's surface area.**

- **There is no shared number formatter in `lib/` to route through.** The only exported one is
  `lib/reports/view.ts:9` (`export const nf`), which lives in the *reports* domain — the exact
  boundary problem `lib/time.ts:10-16` wrote down for dates. So the pre-condition for a one-line fix
  does not exist yet; it has to be created.
- **The 13 `Intl.NumberFormat('en-US')` instances are the same duplication with the right value.**
  They are not a second bug, but they are 13 copies of one decision, and the fix should absorb them.
- **5 of the 15 files are shared** — `tablePager.ts` (15 importers), `recordReadBody.ts`,
  `runReadBody.ts`, `schemaReadBody.ts`, `pickerSearch.ts`, `ExportControl.astro`. Fixing
  `tablePager.ts` alone (4 calls) corrects the pager total on **every paged table in the app**. So
  the *user-visible surface* count is far smaller than 45, which is the answer the ship-order line
  asked for: **it is closer to "four files" than "fifteen"**, just not for the reason it guessed.

**Proposed sizing:** add `fmtCount` (a module-level `Intl.NumberFormat('en-US')` in `lib/`, sibling
to `time.ts`, with the same header comment stating *why* the locale is pinned) → sweep the 5 shared
files first (covers the pagers, panels and export control app-wide) → then the 10 leaf files → then
delete the 13 duplicate `nf` instances. One PR, mechanical, no visual change on an `en-US` host.

**Proposed severity: S3.** Not S1 — nothing is untrue on the intended audience's machine. There is a
defensible **S2** argument (two number grammars on one screen is the "same job done two ways" this
audit exists to find), and I would let the lead take it: the S2 reading is right about the
*mechanism* and the S3 reading is right about the *observed* impact.

**Proposed disposition: ADOPT.** The trigger for treating it as anything larger than a cleanup —
a non-US customer, or a locale setting in the product — does not exist today, but the fix is cheaper
than the argument about it, and the app has already paid for the pinned version 13 times.

**Verdict class: DEFECT** (provable in `apps/web` source; survives into the monorepo unchanged).

---

# ITEM 12 · The `role="alert"` banners (X05-F1)

## 12.1 The corrected count, and what the "54" actually counted

| figure | audit said | measured 2026-08-14 |
|---|---|---|
| `role="alert"` occurrences under `apps/web/src` | **54** (`X04-X05-X08.md:147`, `D42`) | **79** |
| `role="status"` | **11** | **35** |
| `role="note"` | **4** | **4 ✓** |
| `role="group"` | **1** | **6** |

**The "54" is not wrong so much as differently scoped, and the scope was never written down.** The
X05 census counts *roles on the alert vessel* — `role=` on an element that also carries the daisyUI
`alert` class — inside its population of 162 `alert-*` uses. Measured that way: **58 of the 79**
`role="alert"` sites sit on an element whose class list contains `alert`. The other 21 are
`role="alert"` on things that are **not** alert vessels — inline field-error `<p>`s
(`TextInput.astro:100`, `Select.astro:103`, the five `.reg-err` boxes), bare status paragraphs
(`RunBackupButton.astro:40,60`, `StoragePicker.astro:295`, `FrequencyPicker.astro:95`), and
`#too-narrow` (`SidebarLayout.astro:179`).

**This matters for D42, not just for bookkeeping.** D42's rule is *"every banner in the product is
one component"* and its role clause is *"error and warning → `alert`; info and success →
`status`."* Those 20 non-vessel sites are **outside** the vessel's reach — a component named
`Alert.astro` will not absorb an inline field error under a text input, and it should not try to.
**The vessel therefore closes 58 of 79 sites; 21 need a second, smaller answer** (see 12.5). D42's
"~60 hand-composed banners" is the right number *for the vessel*; the ARIA problem is 79 wide.

`role="status"` at **35, not 11**, cuts the same way: D42 argues the split *"is right for a failure
the user did not ask for and wrong for the 11 `role="status"` uses that are genuinely polite."*
There are 35 polite ones, so the polite half of the product is three times the size the decision
assumed — which strengthens, not weakens, the case for the component picking the role.

## 12.2 The mechanism, stated so the classification is checkable

`role="alert"` ⇒ implicit `aria-live="assertive"`. A live region is announced when it is **inserted
into the accessibility tree with content**, or when **text inside it mutates while it is in the
tree**. It is *not* announced merely because a node that already existed became visible with the
same text it always had. `hidden` (and `display:none`) removes a node from the accessibility tree.

So the discriminator is **the writer's ordering**, not the attribute:

- text already in the DOM, `hidden` removed, nothing written → **the region enters the tree
  pre-populated. Announcement is implementation-dependent and unreliable; in practice this is the
  silent case.**
- `hidden` removed **first**, text written **after** → an unambiguous mutation inside a live region
  that is in the tree. **Announces.**
- text written **while still hidden**, then `hidden` removed → the mutation happens *outside* the
  tree and the reveal is the only tree event. **Same unreliable case as the first.**
- node created and appended at error time → **announces.**

**The single most useful thing this census produced is that the app writes in the unreliable order
almost everywhere.** Of the 17 sites that have a writer at all, **13 write the text while the vessel
is still `hidden`, then reveal.** Only 4 reveal first. Nobody chose this; the ordering is per-handler
accident.

## 12.3 The classification — 79 sites

| class | count | announces? |
|---|---|---|
| **(a) revealed only — text static, handler toggles visibility** | **19** | unreliable → treat as silent |
| **(b) text written and revealed** | **17** | 4 reliably · **13 in the unreliable order** |
| **(c) inserted at error time** | **3** | yes |
| **(d) no writer exists anywhere in the repo** | **1** | never |
| **(e) SSR-static — never hidden, never revealed, never written; the role can never fire** | **39** | never |
| | **79** | |

### (b) — 17 sites, with the writer that decides each

| # | site | writer | order | announces |
|---|---|---|---|---|
| 1 | `ui/CreateSpaceModal.astro:22` (`#create-space-error`) | `lib/auth-utils.ts:2-5` `showFormError`, called `layout/Sidebar.astro:847`, `:869` | text → reveal | unreliable |
| 2 | `backups/RunBackupButton.astro:60` | `RunBackupButton.astro:94-97` `showError` | text → reveal | unreliable |
| 3 | `backups/StoragePicker.astro:120` (`data-storage-error-alert`) | `StoragePicker.astro:497-501` | **child** text → reveal | unreliable |
| 4 | `backups/StoragePicker.astro:295` | `StoragePicker.astro:350-354` `showError` | text → reveal | unreliable |
| 5 | `backups/FrequencyPicker.astro:95` | `FrequencyPicker.astro:125-129` `showError` | text → reveal | unreliable |
| 6 | `integrations/BaseSelectionTable.astro:260` (`data-bst-newbases`) | `BaseSelectionTable.astro:1471-1479` `refreshNewBanner` | **reveal → text** | **yes** |
| 7 | `integrations/BaseSelectionTable.astro:382` (`data-bst-cap-note`) | `BaseSelectionTable.astro:1113` `showCap` (7 call sites) | text → reveal | unreliable |
| 8 | `views/IntegrationsView.astro:301` (`data-selection-error`) | `IntegrationsView.astro:398-401` `showError` | text → reveal | unreliable — **and the view is dead** (see 12.4) |
| 9 | `views/ReportDefinitionView.astro:403` (`data-rpd-save-error`) | `ReportDefinitionView.astro:689` `showProblem` | **reveal → text** | **yes** |
| 10 | `views/WelcomeView.astro:96` (`#welcome-error`) | `WelcomeView.astro:119-122` `showError` (hand-rolled copy of `auth-utils`) | text → reveal | unreliable |
| 11 | `views/SourceAddView.astro:57` | `SourceAddView.astro:178-186` `setError` (`.is-on`, CSS `:134-135`) | text → reveal | unreliable |
| 12 | `views/SourceAddView.astro:94` | same | text → reveal | unreliable |
| 13 | `views/DestinationAddView.astro:118` | `DestinationAddView.astro:244-252` `setError` (CSS `:213-214`) | text → reveal | unreliable |
| 14 | `views/DestinationAddView.astro:138` | same | text → reveal | unreliable |
| 15 | `views/DestinationAddView.astro:157` | same | text → reveal | unreliable |
| 16 | `views/RestoreView.astro:459` (in `[data-rs-sum-warn]`) | `lib/restore/controller.ts:361-365` `paint`, prefix `data-rs-sum` (`:376`) | **reveal → text** | **yes — and see 12.4** |
| 17 | `views/RestoreView.astro:485` (in `[data-rc-warn]`) | same `paint`, prefix `data-rc` (`:377`) | **reveal → text** | yes, but inside a closed `<dialog>` |

### (a) — 19 sites, revealed only, text static

Element-level (the node's own `hidden` / class is toggled):

| site | writer | note |
|---|---|---|
| `settings/SecurityPanel.astro:197` | `lib/auth/securityPanel.ts:129` `regenNote?.classList.toggle('hidden', !regenerating)` | text static in markup |
| `schema/SchemaHealth.astro:437` (`data-ins-stale`) | `SchemaHealth.astro:1155-1156` — **only ever `hidden = true`** | SSR-conditional in; JS can only hide it |
| `schema/SchemaHealth.astro:553` (`data-pe-stale`) | `SchemaHealth.astro:1034`, `:1047` | text static (`:555`) |
| `schema/SchemaHealth.astro:611` (`data-ipe-stale`) | `SchemaHealth.astro:1193`, `:1206` | text static |
| `layouts/SidebarLayout.astro:179` (`#too-narrow`) | **no JS at all** — `styles/global.css:367-369`, a `max-width` media query | see 12.4 |
| `views/IntegrationsSetupWizard.astro:433` (`data-dest-field-managed`) | `IntegrationsSetupWizard.astro:1018` `hidden = !pendingDest.managed` | text static |

Revealed by an **ancestor**, not by their own attribute — `[data-sec-stage]`, `<Drawer>` or
`<ConfirmModal>` (a `<dialog>`; closed ⇒ UA `display:none` ⇒ out of the tree):

| site | revealed by |
|---|---|
| `settings/SecurityPanel.astro:240` | `lib/auth/securityPanel.ts:102` `stages.forEach(… classList.toggle('hidden', …))` |
| `settings/SecurityPanel.astro:274` | same |
| `views/IntegrationsSetupWizard.astro:444` | `<Drawer id="wz-drawer-reconnect">` |
| `backups/RunBackupNowModal.astro:27` | `ConfirmModal` → `showModal()` |
| `views/BackupRunDetailView.astro:503` | `ConfirmModal` (`#pause-run-modal`) |
| `views/BackupRunDetailView.astro:512` | `ConfirmModal` (cancel-run) |
| `views/RestoreView.astro:500` | `ConfirmModal` (`#restore-confirm-modal`) |
| `views/ReportDefinitionView.astro:519` | `ConfirmModal` (`#rpd-del-modal`) |
| `views/SettingsView.astro:249` | `ConfirmModal`, one per `destructiveRows` entry |
| `views/ReportsView.astro:244` | `ConfirmModal` (`#rpl-del-modal`) |
| `views/IntegrationsSetupWizard.astro:481` | `ConfirmModal` (discard-and-leave) |
| `views/SourceDetailView.astro:226` | `ConfirmModal` |
| `views/DestinationDetailView.astro:197` | `ConfirmModal` |

**11 of the 19 are the consequence line inside a destructive confirm dialog.** They are the single
biggest sub-population in the whole census, and `role="alert"` is the wrong role for all 11: the
dialog takes focus and reads its own accessible content, so at best the assertive region is
redundant with what the user is about to hear, and at worst it interrupts the dialog's title.

### (c) — 3 sites, inserted at error time

| site | inserted by |
|---|---|
| `backups/BackupHistoryWidget.astro:334` | template string returned into `innerHTML` |
| `schema/schemaRelationships.ts:313` | `parts.push('<div class="alert … rl-dinvalid" role="alert">…')` — a panel body |
| `schema/schemaReadBody.ts:414` | ternary inside an entity-panel body string |

These do announce. Two of the three are **panel bodies**, so the announcement fires when the user
*opens a drawer*, not when anything failed — an assertive interruption for a pre-existing condition
the user navigated to deliberately.

### (d) — the writer-less vessel. **1 site.**

**`views/LoginView.astro:99` — `#login-error`.** Confirmed exhaustively:

- markup: `<div id="login-error" class="… hidden" role="alert">` with `<span id="login-error-text">`
  at `:101` — the exact three-part shape of `CreateSpaceModal.astro:20-25` and
  `WelcomeView.astro:96-98`.
- `/usr/bin/grep -rn -a 'login-error' apps/web/src` → **two hits, both the markup.** No
  `getElementById`, no `querySelector`, nothing.
- `lib/auth-utils.ts` — which exists precisely to write this vessel (`showFormError`, `:2`) — has
  **exactly one importer in the whole tree**: `layout/Sidebar.astro:643`. `LoginView` does not
  import it. `WelcomeView.astro:119-122` re-implements it by hand instead.
- `LoginView.astro:142-221` is the view's only script. Read in full. It handles the SSO button,
  a bfcache `pageshow` restore, the sent-panel swap and the "try again" button. The submit handler
  (`:193-209`) does `if (!email) return;` — **an empty submit is a silent no-op**, and there is no
  path in the file that can put text in `#login-error` or remove its `hidden`.

So: **exactly one (d) site — not "more than one".** I looked for the pattern deliberately and it is
not there. The other candidates all resolved:

- `IntegrationsView.astro:100`, `:167`, `:301` **look** like (d) but are worse and differently
  filed: the file is the deliberately-kept dead copy deck (`CLAUDE.md`, "Dead views — resolved
  2026-08-08"; header comment `IntegrationsView.astro:1-19`). Its `data-selection-error` **has** a
  writer at `:398-401`; that writer is simply never mounted, because no route imports the view. This
  is the *rendering* half of the "0 of 19 codes" finding, already owned by X05-F4 / ship-order item
  5 — **not new (d) sites**, and I am not double-filing them.
- `RestoreView.astro:459` / `:485` **appeared** writer-less to a name-based grep and are not:
  `controller.ts:361-365` reaches them through a templated selector. Filed (b).

### (e) — 39 SSR-static sites, where the role can never fire

Present at first paint with their final text, no `hidden`, no hook, no writer. A live region that is
in the accessibility tree at initial page load announces nothing, ever — the role is inert markup.

`components/ui/TextInput.astro:100` · `components/ui/Select.astro:103` ·
`components/layout/ConnectionHealthBanner.astro:26` · `components/data/DataBrowse.astro:262` ·
`components/backups/RunBackupButton.astro:40` · `components/backups/BackupHistoryWidget.astro:202` ·
`components/reports/ReportBodyKpi.astro:176` · `:253` · `:295` · `:336` · `:370` ·
`views/BackupRunDetailView.astro:304` · `:318` · `views/IntegrationsView.astro:100` · `:167` ·
`views/LoginView.astro:65` · `views/RestoreView.astro:230` · `:381` · `:563` · `:594` · `:599` ·
`views/BackupRunBaseView.astro:186` · `:195` · `views/AuthAssociationView.astro:53` ·
`views/ActionsView.astro:112` · `views/IntegrationsSetupWizard.astro:313` ·
`views/DestinationAddView.astro:124` · `views/SpaceHomeView.astro:175` ·
`views/SourceDetailView.astro:93` · `:117` · `views/DestinationDetailView.astro:63` · `:86` ·
`views/SourcesView.astro:82` · `:86` · `views/AuthChallengeView.astro:67` · `:86` ·
`views/DestinationsView.astro:86` · `:90` · `views/WelcomeView.astro:25`

**Honest limit on (e).** Each was verified at the element (no `hidden`, no `id`/`data-*` hook, no
writer selecting it) and by an upward walk for a `<ConfirmModal>` / `<Drawer>` host. What I did
**not** do for all 39 is trace every arbitrary ancestor for a `classList.toggle('hidden')` — the
`[data-sec-stage]` pattern that caught `SecurityPanel:240,274` could in principle hide in another
heavily-toggled file. If any (e) site turns out to be ancestor-revealed it moves to (a), which does
not change any verdict below. `views/SpaceHomeView.astro:175` is the one I would re-check first: it
is SSR-gated on `(running || justSaved)`, i.e. it is a *transient* success that only ever appears on
a fresh page load, which is precisely when a live region cannot speak.

## 12.4 Three things the classification turned up that were not in the worklist

**1 · `RestoreView.astro:459` is not silent — it is chatty, and that is worse.**
`lib/restore/controller.ts:65-69` `text()` assigns `el.textContent = value` **unconditionally**, and
`paint()` (`:353-367`) is called from `render()` (`:369`), which has **13 call sites** in the file.
`[data-rs-sum-warn-text]` sits **inside** `role="alert"` (`RestoreView.astro:459-461`) and is
visible on the page whenever a snapshot warning applies. So every checkbox toggle, every table
selection, every target change in the restore builder **replaces the text node inside a live
assertive region** — even when the string is identical. A screen-reader user configuring a restore
would be interrupted by the same warning sentence on every click. This is a **new S2/S3 defect**, it
is the mirror image of what item 12 went looking for, and the fix is in the vessel's contract
(write-if-changed), not in `RestoreView`.

**2 · `#too-narrow` is an assertive region driven by a CSS media query.**
`SidebarLayout.astro:179`, revealed only by `styles/global.css:367-369` at `max-width`. No JS
touches it. Two consequences: it cannot announce on the commonest path (the window is *already*
narrow at load, so the region is in the tree from first paint), and if it *did* fire it would fire on
every resize across 390px. It is a viewport condition, not an alert — `role="status"` at most.

**3 · `BaseSelectionTable.astro:260` announces assertively for good news.**
`refreshNewBanner` (`:1471-1479`) reveals first and writes after, so it is one of only four sites
that reliably speak — and what it says is *"3 new bases appeared."* That is an informational
notification interrupting whatever the user was reading. Under D42's own role clause (info →
`status`) it is already wrong; worth noting that it is wrong *and* it is one of the few that works.

## 12.5 VERDICT — item 12

**Counts:** (a) 19 · (b) 17 · (c) 3 · (d) 1 · (e) 39 · total **79**.

**(d) list, in full: `views/LoginView.astro:99` (`#login-error`). One site.** Already the headline
of ship-order item 5. This census adds the *reason* it is one and not many: the shared writer
(`lib/auth-utils.ts:2`) exists, and has one importer out of three views that use its markup shape —
`Sidebar` imports it, `WelcomeView` copied it, `LoginView` got the markup and neither the import nor
the copy. **The vessel is not missing; the wiring is.**

**Does source answer the question item 12 asked?** Yes, and the answer is worse than "some don't
announce": **only 4 of 79 `role="alert"` sites reliably announce anything** (`BaseSelectionTable:260`,
`ReportDefinitionView:403`, `RestoreView:459`, `RestoreView:485`), plus the 3 inserted ones, and two
of *those* fire on a drawer opening rather than on a failure. **39 can never fire. 19 are
unreliable-by-construction. 13 of the 17 written ones write in the order that suppresses the
announcement. 1 has no writer at all.** The role is present on 79 elements and doing its job on 7.

**No painted measurement is needed to act on this.** I originally expected to need one and do not:
the write/reveal ordering is a source fact, and it is the ordering — not the role, not the CSS — that
decides the announcement. If the lead still wants a screen-reader confirmation, **the single
measurement is: does removing `hidden` from a pre-populated `role="alert"` announce in the target
AT?** — one probe, one site (`SchemaHealth.astro:553`, the cleanest (a)), one AT. That answer only
changes how the 19 (a) sites are *described*; it does not change the remedy, because the remedy makes
the ordering explicit rather than relying on the answer.

**Remedy: one shared vessel, per D42 — which is already bound. What the vessel must do:**

1. **Own the write/reveal sequence, not just the role attribute.** A single `show(message)` that
   (i) un-hides, then (ii) writes — in that order. This is the whole finding: D42 currently fixes the
   *class order* and the *role*, and the class order is not what silences a live region.
2. **Write only on change.** Skip the assignment when the text is identical, so a re-render cannot
   re-announce (`lib/restore/controller.ts:65-69` × 13 render sites is the live proof of why).
3. **Take the role from the severity and from the trigger, not from the caller.** D42 says
   error/warning → `alert`, info/success → `status`; the census adds a second axis the decision does
   not have: **a banner that is present at first paint gets no live role at all** (39 sites), and
   **a banner inside a modal or drawer that already takes focus gets no live role** (13 of the 19
   (a) sites). A live region that cannot speak is a lie in the markup, and it is what made this
   count read as 54–79 assertive alerts when the app has at most 7.
4. **Refuse to render an empty vessel.** `#login-error` was invisible for as long as it has existed
   because nothing in the toolchain can see a `hidden` div with no writer. A component whose message
   is a **required prop** makes that state a type error instead of an audit finding.
5. **Cover the 21 non-vessel sites too, or say in the catalog that it does not.** The inline field
   error (`TextInput.astro:100`, `Select.astro:103`, `.reg-err` ×5) and the bare status paragraph
   (`RunBackupButton.astro:40,60`, `StoragePicker.astro:295`, `FrequencyPicker.astro:95`) are two
   more one-job-two-vessels pairs, and `Alert.astro` will not absorb either. `TextInput`/`Select`
   already own an `error` prop — the four hand-rolled `.reg-err` boxes in `SourceAddView` /
   `DestinationAddView` should be that prop, which is a **third** vessel decision, not this one.
   Whichever way it goes, D42's entry must state which of the 79 sites are its and which are not,
   or the next census will re-litigate the 54.

**Proposed severity: S2** for the vessel/role split (a learned expectation: the product's error
banners behave one way for a sighted user and up to five ways for a screen-reader user), with the
**S1** carve-out already filed as X05-F4 / item 5 (`#login-error`: a UI that renders an error vessel
and cannot ever put an error in it). **Proposed disposition: ADOPT**, folded into D42 rather than
filed separately — the ordering rule and the "no live role at first paint" rule belong in the
component, and item 33's residue sweep is where the 79 call sites get touched.

**Verdict class: DEFECT** for all of it. Nothing here depends on the backend: the writer, the
ordering and the reveal are all in `apps/web`.

---

## What is good here — do not touch

- **`lib/time.ts` is the model, and it already won its argument.** Ten call sites, one `LOCALE`
  constant (`:57`), a 55-line header stating *why* the locale is pinned and what the exception is,
  and a verifiable claim (zero `toLocaleDateString`/`toLocaleTimeString` outside the module) that
  **still holds a week later**. Item 27's fix should be a sibling of this file, written the same way,
  with the same kind of header — not a bare `const nf`.
- **The 14 `Intl.*` constructors all pin `'en-US'`.** Whoever wrote them was consistent; the only
  problem is that there are 14 and not 1. Do not "fix" the value.
- **`lib/restore/controller.ts:353-367` `paint()` is the right architecture** — one derivation
  (`describeRestoreRequest`) painted into both the page summary and the confirm dialog through a
  prefix, so the two can never disagree. Its only fault is the unconditional `textContent` write.
  Fix `text()` (`:65-69`) to compare-then-assign; do not unwind `paint`.
- **`ReportDefinitionView.astro:689` and `BaseSelectionTable.astro:1471-1479` already reveal before
  they write.** They are the two hand-written proofs that the correct ordering was reachable, and
  they are the shape the vessel should copy.
- **`lib/auth-utils.ts:1-20` is the right helper.** `showFormError` / `hideFormError` /
  `showFormSuccess` / `hideFormSuccess` is exactly the four-function contract the auth forms need. It
  does not need redesigning — it needs `LoginView` and `WelcomeView` to import it instead of ignoring
  it and re-implementing it. (Its write order is the unreliable one, so the ordering fix lands here,
  in one place, for every caller it ever gains.)
- **`SchemaHealth.astro:553-557` is the best-composed alert in the (a) class**: soft, one glyph, a
  sentence stating the condition, and a real recovery action (`data-pe-rerun`) with its credit cost
  in a badge. Its only defect is that its reveal is silent to an AT. Keep the composition.
- **`schema/SchemaAutomations.astro:208-216`** — already named the X05 reference by the earlier
  scout, and the census agrees, with one correction: it carries **`role="note"`**, not
  `role="alert"`, so it is not one of the 79 — and that is precisely why it is the reference. It is
  the only banner in the tree whose in-file comment records *why* it renders `hidden` first
  (`:208-210`: *"unhiding is the only order that avoids showing it for a frame to someone who already
  closed it"*), and it picked a non-live role for a persistent explanation, which is the judgement
  D42 needs to encode. Its writer is `schemaAutomations.ts:51` `wireRecordedNote`, i.e. a **named,
  reusable** wiring function rather than a per-file `showError` — the seventeenth hand-rolled writer
  this census found is the argument for it. Do not touch this component; copy it.
