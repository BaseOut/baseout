# D49 — One busy affordance, one outcome

**Rule:** Every control that starts work disables itself, sets `aria-busy` and shows a spinner
through `setButtonLoading`; every action that finishes says so, in the past tense, including when it
failed; and no surface renders a skeleton, because every list in this product is SSR-complete.

## Why this option, and what was rejected

**Eight idioms exist for "your click is being worked on", and the catalog's documented affordance is
the one nobody uses.** `Button`'s `loading` prop has **zero** callers (lead-verified);
`setButtonLoading` is used in **12** files. Twelve lines that disable the control, set `aria-busy`,
inject and remove the spinner.

**The app is right and the catalog is wrong, so the catalog changes.** This is a RATIFY, and it has
the same shape as `decision-density-sm-is-default`: describe what shipped rather than migrate twelve
files onto a prop that has never been exercised. Migrating to the prop would mean rewriting twelve
working call sites to reach a code path with no production history, to satisfy an entry nobody read.

**The cost of having no rule is measurable, not theoretical.** Four controls can be double-submitted
because nothing disables them between click and outcome — including two that *start work*
(`Run now`, `Retry`). One failed action says nothing to anyone: the cancel handler swallows its error
behind a comment claiming no toast infrastructure exists, and **`undoToast.ts` now exists and is a
standalone callable** — the comment is stale and the silence it justifies is not. And `Retry` tells
the user the result "will appear in History" **while the button is rendered inside History**, on a
row that is not updated: it names a destination the user is already standing in, which is verbatim
what D08 forbids, and it promises a future in a toast whose own pattern says outcomes are past tense.

**Rejected: adding skeletons.** The worklist's starting evidence for this lens was wrong.
`grep` for a `skeleton` class returns **0** (lead-verified) — the only hits are prose and "(skeleton)"
meaning stub view — and `BaseSelectionTable.astro:1612` records one being proposed and rejected.
Every list here is server-rendered complete, so a skeleton would be theatre for data already in the
HTML. **ACCEPT, with the reason written into the catalog** so nobody adds one.

## The concrete changes

1. **The six one-off busy idioms converge on `setButtonLoading`**, and `Button`'s unused `loading`
   prop is either deleted or documented as delegating to it.
2. **The four double-submittable controls gain a busy state**: `ReportDefinitionView.astro:696`
   (`Run now`), `:801` (`Retry`), `SourceDetailView.astro:328` (`Save`), `LiveRefresh.astro:56`
   (`Refresh`). The correct implementation is already in the tree at `schemaAutomations.ts:322-337`.
3. **A failed action speaks.** `lib/backups/cancel-button.ts:96-98` stops swallowing its error and
   calls `undoToast`; the stale comment goes with it.
4. **`Retry`'s toast names an outcome, not a destination the user is standing in**
   (`ReportDefinitionView.astro:807-808`), and the History row it belongs to updates — or the toast
   says plainly that it will not.

## Surfaces changed

`ReportDefinitionView` · `SourceDetailView` · `LiveRefresh` · `lib/backups/cancel-button.ts` ·
`Button.astro` · `lib/ui.ts` · the six one-off busy sites. **Batch: items 2 and 3 are the user-facing
half and are four small files; item 1 is a sweep and can follow.**

## storybook.ts

- `button`: **RATIFY `setButtonLoading` as the busy affordance** (the X14-F3 record), with the
  double-submit rule stated — a control that starts work disables itself for the duration.
- **Record the ACCEPT** on the loading/skeleton entry: *"Baseout renders no skeletons. Every list is
  SSR-complete, so a skeleton would be theatre for data already in the HTML; one was proposed and
  rejected at `BaseSelectionTable.astro:1612`. Do not add one; the busy affordance belongs on the
  control, not on the content."*
- Note the distinction the app already draws correctly and must keep: **the spinner inside a status
  badge answers "the object is working"; the spinner inside a button answers "your click is
  working".** They are different questions and both are needed.

## Not changing

`setButtonLoading` (`lib/ui.ts:47-59`) — twelve lines, correct, and this decision exists to point at
it. · The running-status spinner inside a status badge (`BackupsListView.astro:232` + six siblings) —
consistent everywhere and answering a different question. · `pattern-undo-toast` and `undoToast.ts`:
outcome in the past tense, a ghost Undo, supersession flushing the pending commit — and
`ReportDefinitionView` passing `null` for the action on `Run now`/`Retry`, because a countdown bar on
something irreversible promises a choice that does not exist. That `null` is correct; do not "fix" it.

## Deferred, with triggers

- **`LiveRefresh`'s `location.reload()`** blanks the whole surface with no busy state, so a slow
  refresh is indistinguishable from a dead button (X14-F7). **Trigger: the real re-fetch replacing
  the reload** — it must arrive with a busy state, and adding one to a full reload is work the
  re-fetch deletes.
- **`LiveRefresh` is on 5 views and absent from Schema, Data and Reports**, which render equally
  snapshot-based data with **no freshness stamp at all** (X14-F8). **Trigger: the D01/D17 staleness
  work** — the stamp and the refresh are one question, and answering half of it twice is churn.

## Verify

`grep -rn 'setButtonLoading' apps/web/src -l | wc -l` covers every action control ·
`grep -rn 'loading=' apps/web/src` returns no `Button` caller (or all of them, if the prop is kept) ·
`grep -rn 'class="[^"]*skeleton' apps/web/src` stays **0** · click `Run now` twice quickly on
`/reports/def-full` — the second click does nothing · fail a cancel and see a toast rather than
silence.
