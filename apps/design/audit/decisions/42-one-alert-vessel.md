# D42 — One alert vessel

**Rule:** Every banner in the product is one component — `components/ui/Alert.astro` — taking a
severity from a closed set of four, which fixes the vessel (`alert-soft`, never solid), the glyph
(one per severity), the ARIA role (one per severity), **the write/reveal ORDER, and whether a live
role is emitted at all**; nothing renders a hint as a bare tinted `<p>`, and there is no fifth colour.

## Why this option, and what was rejected

**`alert` is the only Primitive in the catalog with no `reference:` component.** Every other one
names a file; `alert` names none — so ~60 banners are hand-composed and the vessel drifted on three
axes at once: six live **solid** alerts against a rule the entry states twice, **five ARIA roles**
on one element (`alert` ×54 · `status` ×11 · `note` ×4 · `group` ×1 · none), and class order flipped
in one file. Four more are alerts wearing another name, one of them in **`--color-primary` at 8%**,
a colour the four-colour table does not define. `IntegrationsSetupWizard.astro` alone holds three
vessels for one job — a real alert at `:147`, `.switch-confirm` at `:625`, `.bases-reset-note` at
`:632`.

**Oleh bound this vessel on 2026-08-14.** The audit's own evidence for why a vessel and not a sweep:
the same team solved the same problem the moment it became a component (`TablePager`, 1
implementation, 13 mounts) and did not solve it where the catalog shipped a class. And **an Astro
scoped style cannot cross a file boundary** — a shared `global.css` class is what `.cl-empty` and
`.pk-empty` already are, and neither was adopted. A component's scoped style travels with it; that
is the mechanism, and it is why a "sweep" of 60 hand-composed banners would drift again.

**Rejected: keeping `role="alert"` everywhere, as the catalog's own examples do.** `role="alert"`
interrupts a screen reader. It is right for a failure the user did not ask for and wrong for the
**35** `role="status"` uses that are genuinely polite (**census corrected 2026-08-14: 35, not 11 —
the polite half of the product is three times the size this decision assumed, which strengthens the
case for the component picking the role**). The entry currently uses `role="alert"` for all four
colours *including info*, which is the source of the spread. The component picks: **error and
warning → `alert`; info and success → `status`.**

**Rejected: folding `.hm-status` in.** See below — it is the wave's one ACCEPT.

## The concrete changes

1. **Build `components/ui/Alert.astro`**: props `severity` (`info|warning|error|success`),
   `title`, `dismissible`, `role` override. It emits `alert alert-soft alert-<severity>` in that
   order, the fixed glyph, the fixed role, and slots for body and one recovery action at `btn-sm`.
2. **One glyph per severity, in the entry and then swept:** error `circle-x` · warning
   `triangle-alert` · info `info` · success `circle-check`. Today `circle-alert` is the dominant
   **error** glyph (5 of 7) *and* the second **warning** glyph (5 of 40) — one glyph, two severities
   — while `circle-x`, the entry's own error glyph, has **zero** uses. Warning spreads over 7 glyphs
   and info over 8. Colour is currently the only thing separating an error banner from a warning one.
3. **The six live solid alerts go soft:** `StoragePicker.astro:121`, `BackupHistoryWidget.astro:202`
   and `:334`, `SchemaCanvas.tsx:2001`, `IntegrationsSetupWizard.astro:949`, plus the two class maps
   that *emit* solid, `connection-health-banner.ts:66-71` and `lib/reports/view.ts:29-33`.
4. **Three hand-rolled tinted boxes become `Alert`:** `.bases-reset-note` (and its
   `--color-primary`-at-8% tint disappears with it — there is no fifth alert colour),
   `.switch-confirm`, `.bst-autoadd`. The wizard drops from three vessels to one.
5. **Class order is the component's problem, not the caller's** — `ReportBodyKpi.astro:176`'s
   `alert-warning alert-soft` stops being possible.

## Surfaces changed

`IntegrationsSetupWizard` (three vessels → one) · `BaseSelectionTable` · `StoragePicker` ·
`BackupHistoryWidget` · `SchemaCanvas` · `connection-health-banner.ts` · `lib/reports/view.ts` ·
`ReportBodyKpi` · and the ~60 hand-composed sites, **batched by surface, not swept tree-wide** —
Schema first, then Data, then Backups/Reports, then Integrations.

## storybook.ts

- `alert`: add the **`reference: components/ui/Alert.astro`** key it has never had. Add the glyph
  table (one per severity), the role rule (error/warning → `alert`, info/success → `status`), and
  the class-order note.
- **Record the ACCEPT** as a named carve-out on the same entry: *"A persistent per-Space status card
  is not an alert. `.hm-status` (`SpaceHomeView.astro:651-681`) stays bespoke: it carries six tone
  classes, its own icon chip and a state machine, and it answers 'what is the standing condition of
  this Space', not 'something just happened'. Do not fold it in; do not file it again."*
- The `.hm-status` tone **name** is still wrong (`broken` painted through `.is-paused`) — that is
  D43, not this entry.

## Not changing

`alert-soft` discipline is already at 149 of 162 uses — **this lens is 92% converged and must not be
treated as a rebuild.** · `BackupRunDetailView.astro:304-312`, the model failure alert: scope, cause,
what was achieved, one recovery verb — it is the reference and the component must reproduce it. ·
`SchemaAutomations.astro:202-216`, the only dismissible alert with a working dismiss and the
best-argued piece of UI reasoning in the audit — its comment explaining why the banner is
per-surface and why it renders hidden must survive. · `SpaceHomeView.astro:173-180`, an alert that
*refuses* to claim success because nothing is written yet.

## Verify

`ls apps/web/src/components/ui/Alert.astro` exists · `grep -rn 'alert-error\|alert-warning'
apps/web/src | grep -v 'alert-soft'` → 0 · `grep -rn 'bases-reset-note\|switch-confirm\|bst-autoadd'`
→ 0 · `grep -rn 'lucide--circle-alert' apps/web/src` returns no site inside an `alert-error` ·
`pnpm ds-lint`, `pnpm typecheck`, `pnpm css-guard` green. **`NEEDS-MEASUREMENT`, unmade:** whether
the 54 `hidden`-toggled `role="alert"` banners announce assertively. Source proves five roles; it
does not prove what a screen reader does.


---

## AMENDMENT 2026-08-14 — what the vessel must DO, from the measured census

The `role="alert"` census was taken from source with `/usr/bin/grep -a` and every site's writer was
resolved by name. **The counts move and the finding gets worse: the role is present on 79 elements and
doing its job on 7.**

**Counts corrected.** `role="alert"` **79** (not 54) · `role="status"` **35** (not 11) ·
`role="note"` 4 ✓ · `role="group"` 6 (not 1). The 54 was not wrong, it was **differently scoped and
the scope was never written down**: it counted roles on an element that also carries the `alert`
class, and **58 of the 79 do**.

**Scope, stated so the next census cannot re-litigate it.** The entry must say which sites are the
vessel's and which are not:

| population | count | whose job |
|---|---|---|
| `role="alert"` on an `alert`-class vessel | **58** | **`Alert.astro`** |
| inline field error under a `TextInput` / `Select` | 2 | those components' existing `error` prop |
| the five hand-rolled `.reg-err` boxes | 5 | **a third vessel decision** — they should be that same `error` prop |
| bare status paragraphs (`RunBackupButton.astro:40,60`, `StoragePicker.astro:295`, `FrequencyPicker.astro:95`) | 4 | small, and not a banner |
| `#too-narrow` (`SidebarLayout.astro:179`) | 1 | a viewport condition, `role="status"` at most — see below |
| the remainder of the 21 non-vessel sites | 9 | named in `audit/findings/X-MEASURED-SOURCE-2026-08-14.md` §12.1 |

**Four things the vessel must do that this decision did not previously say.** The class order and the
role are not what silences a live region — **the writer's ordering is**, and the app writes in the
unreliable order almost everywhere.

1. **Own the write/reveal sequence.** One `show(message)` that (i) un-hides, then (ii) writes.
   Measured: of the 17 sites that have a writer, **13 write the text while the vessel is still
   `hidden` and then reveal** — the mutation happens outside the accessibility tree, so the reveal is
   the only tree event and the announcement is unreliable. Only 4 reveal first. **Nobody chose this;
   the ordering is per-handler accident across 17 hand-rolled writers.**
2. **Write only on change.** Skip the assignment when the text is identical. The live proof is X-M14:
   `lib/restore/controller.ts:65-69` assigns `textContent` unconditionally and `render()` has 13 call
   sites, so **every click in the restore builder re-announces the same warning sentence** from inside
   `role="alert"`. Fix `text()` to compare-then-assign; **do not unwind `paint()`** — one derivation
   painted into both the page summary and the confirm dialog through a prefix is the right
   architecture and is why the two can never disagree.
3. **Take the role from the severity AND from the trigger.** Error/warning → `alert`, info/success →
   `status` — plus a second axis this decision lacked: **a banner present at first paint gets no live
   role at all** (39 SSR-static sites, where the role can never fire), and **a banner inside a modal
   or drawer that already takes focus gets no live role** (13 of the 19 reveal-only sites — 11 of them
   the consequence line inside a destructive `ConfirmModal`, where the dialog reads its own content and
   an assertive region is at best redundant and at worst interrupts the dialog's title). **A live
   region that cannot speak is a lie in the markup, and it is what made this count read as 54–79
   assertive alerts when the app has at most 7.**
4. **Refuse to render an empty vessel.** `LoginView.astro:99`'s `#login-error` has **no writer
   anywhere in the repo** and has been invisible for as long as it has existed, because nothing in the
   toolchain can see a `hidden` div with no writer. **A component whose message is a required prop
   makes that a type error instead of an audit finding.** (The S1 itself is ship item 6 under D32.
   The census adds the reason it is one site and not many: `lib/auth-utils.ts:2`'s `showFormError`
   exists and has **one importer** — `Sidebar.astro:643` — while `WelcomeView.astro:119-122`
   re-implemented it by hand and `LoginView` did neither. **The vessel is not missing; the wiring
   is.**)

**Two incidental findings recorded here so they are not re-filed.** `#too-narrow` is an **assertive
region driven by a CSS media query** (`global.css:367-369`, no JS touches it): it cannot announce on
the commonest path, because the window is already narrow at load and the region is in the tree from
first paint. And `BaseSelectionTable.astro:260` is one of the four sites that *do* reliably speak —
and what it announces assertively is *"3 new bases appeared."* Good news, interrupting the reader.
Under this decision's own role clause it is already wrong.

**The reference to copy is not in the 79.** `SchemaAutomations.astro:208-216` carries
**`role="note"`**, which is exactly why it is the reference: it picked a non-live role for a
persistent explanation, its in-file comment records *why* it renders `hidden` first ("unhiding is the
only order that avoids showing it for a frame to someone who already closed it"), and its writer is a
**named, reusable** wiring function (`schemaAutomations.ts:51` `wireRecordedNote`) rather than the
seventeenth per-file `showError`. Copy this component; do not touch it. The two hand-written proofs
that the correct *order* was reachable are `ReportDefinitionView.astro:689` and
`BaseSelectionTable.astro:1471-1479`.

**storybook.ts, added to the list above:** the write/reveal order · "write only on change" · the
no-live-role-at-first-paint and no-live-role-inside-a-focus-taking-overlay rules · and **an explicit
statement of which of the 79 sites the vessel owns and which it does not**, or the next census
re-litigates the 54.

**Verify — replacing this file's stale `NEEDS-MEASUREMENT` line.** ~~whether the 54 `hidden`-toggled
banners announce assertively~~ **answered from source, and no painted measurement was needed: 4 of 79
reliably announce** (`BaseSelectionTable:260`, `ReportDefinitionView:403`, `RestoreView:459`,
`RestoreView:485`) plus 3 inserted-at-error-time, two of which fire when a *drawer opens*. The
remaining open probe is optional and changes only a description, not the remedy: *does removing
`hidden` from a pre-populated `role="alert"` announce in the target AT?* — one site
(`SchemaHealth.astro:553`, the cleanest reveal-only case), one AT. **Not taken.**
