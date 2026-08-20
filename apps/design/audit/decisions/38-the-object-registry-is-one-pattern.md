# D38 — The object registry is one pattern

**Rule in one sentence:** Sources and Destinations are one documented pattern —
`pattern-object-registry` — with one shared module (`lib/registry/`) owning the status badge, the
kind glyph, the create controller and the edit-mode state machine, so a divergence between the twins
becomes a compile error rather than a screen.

## Why this option, not the alternative

`SourcesView.astro:10-14` already says it: *"'Mirrors DestinationsView' was already written here,
which makes every divergence between the two unintended BY DEFINITION."* Four files declare
themselves one family and **the catalog has no entry describing what that family is** — which is
precisely how twelve shared defects came to be shared. This is the worst case the charter names: a
mechanism that is reused **and** invisible. `PARKED P7.4` has carried the missing entry for weeks.

The rejected alternative — fix the twelve divergences file by file — was rejected on cost and on
recurrence. `lib/registry/removal.ts` is the same team's precedent and its own header states the
argument: *"a six-line handler written twice drifts exactly as readily as a sentence written
twice."* The module exists and already has the right name; this decision fills it.

**Three defects in this family are S1 and each is a separate kind of untruth.**

1. **`Cancel` stops cancelling.** Verified in source on both files: `setMode()`
   (`SourceDetailView.astro:307-317`, `DestinationDetailView.astro:279-289`) restores nothing, and
   `if (mode === 'edit') entryValues = inputs.map(i => i.value)` **re-captures the dirty value on
   every entry**, so leaving edit via the `Read` segment keeps the typed text in the input while the
   page shows the old value, and the next `Save` commits a value the user abandoned. Only
   `[data-reg-cancel]` and Escape restore, and both read the overwritten baseline. Nothing on screen
   says a draft exists, and three exits (`.back-link`, `Reconnect`, `Read`) are live with a dirty
   input. **This is D30's named reference file failing D30's own contract** — the register is
   corrected in place, not appended to.
2. **The app renames the object you just created.** A destination created as *"My analytics DB"* is
   listed under that name, but the row's link and the detail page's `Connect` rebuild the object
   from `?new=1&type=` with **no `&name=`** (`DestinationsView.astro:64-67`,
   `DestinationDetailView.astro:76`; same two omissions at `SourcesView.astro:54-57`,
   `SourceDetailView.astro:107`), so the page you land on is called **"Postgres"**. `PARKED P7`
   recorded this defect as fixed; four callers were fixed and these four are the fifth through
   eighth — and unlike the first four, these are in `apps/web`.
3. **One status, two words, and a fallback that guesses `broken`.** The list badge says
   `Reconnect`; the detail badge for the same object says `Reconnect required`, and the detail's
   writer is a ternary whose catch-all is *"Reconnect required"* — so any status neither map knows
   makes the page **assert a broken connection for a state it does not understand**. The file one
   door away argues the case against exactly this (`DestinationsView.astro:30-42`) and the list has
   the guard; the detail does not.

## Surfaces changed

New/extended `apps/web/src/lib/registry/`:

- `registryStatus.ts` — one `destinationStatusBadge` / `sourceStatusBadge`, `?? statusUnknown`,
  imported by list **and** detail. **Converge on the list's word** (`Reconnect`), because it is the
  verb the CTA uses. Same module takes `kindMeta` and gives it the fallback the file's own
  `statusMeta` got (`DestinationsView.astro:151` is the third unguarded map lookup in the file that
  just fixed the other two).
- `registryEditMode.ts` — the state machine both files ask for in-file (`:205-209`): `entryValues`
  captured once per **dirty session**, `Read` while dirty either reverts like `Cancel` or holds the
  page in edit, and the three exits ask.
- `registryForm.ts` — the 60 lines currently duplicated in two `.astro` `<script>` blocks, where
  `astro check` cannot see them (diff today: one comment word). Carries D32's form-level error slot.
- URL contract: `&name=` on all four hrefs — **or, preferred, stop carrying `new=1&type=` at the
  object level at all**, since an id that resolves is all a real loader needs and the
  reconstruct-from-provider path is the thing that can rename. (**NOT-OURS half** for the client's
  engineer: whether production resolves `id=new-destination` before the object is connected.)

Per-file, beyond the module: the detail header takes the kind glyph the list gives every row
(`decision-entity-glyphs`: glyph where the row KIND varies — and Destinations is the one object here
with two kinds); the broken-destination alert copies the twin's clause discipline
(`lostWhen`/`asAccount`/credential/blast radius/one action) verbatim rather than re-inventing it;
the `Last write` cell stops printing the status word `failed` where a time belongs; the `In use by`
note branches on `inUseCount === 0` (today it tells a user with zero Spaces that *"Changing this
connection affects every Space listed here"*); the segmented control drops the sixth private
spelling `.reg-seg` for the canonical `.sch-modeswitch`; the field error goes through `TextInput`'s
`error` prop instead of a sibling `<p>` outside the fieldset (which is why it paints at **16px**,
larger than its own label, with the hint still stacked under it and `aria-describedby` still
pointing at the hint); hidden-branch inputs are `disabled` so an abandoned PAT is not in the POST
body; the four action controls are built from `Button` so the primary can show `loading`; one create
glyph and one header mark across the twins; `.reg-mono` gets a path that can reach the input.

## storybook.ts

**New entry `pattern-object-registry`** (closes PARKED P7.4): list frame + detail cards + the
create form as one family; one status writer with a neutral unknown; the kind glyph rule; the
create→list→detail URL contract; the edit-mode state machine and its dirty rule; the `In use by`
block including what it must link to. **Correct `pattern-segmented-control`**: its `reference` names
`.sb-segtrack` for track density and `grep -rn segtrack apps/` returns **0** — either build it once
or delete it from the entry. **Amend `input`**: the error is rendered by the primitive, never as a
sibling.

## Explicitly not changing

- The list table. `.tbl-frame.reg-tableframe > .reg-tablewrap[data-narrow-pan]` with `panRail`
  **inside** the frame is the app's best listing frame, and the comment says why (one element and
  the rail paints across the card's top border). It is the shape the rest of the app should copy.
- The comment's position inside the `<div>` — one line higher it is the first child of a ternary
  branch, which is a silent SSR 500 with every gate green. Do not tidy it upward.
- `lastWriteRank`, `statusUnknown` as a new neutral entry rather than an alias, `describeRegistryRemoval`,
  the kind-aware copy (`Per-Space schema` vs `Per-Space subfolder`), the in-use guard as one
  `disabled` button rather than two branches, and the layout half of the edit contract (32px slot in
  read, 32px input in edit, `visibility:hidden` on `Test connection` so the header does not reflow).
  **A fix that disturbs those numbers has overshot.**
- `Cancel` on a **create** form leaving without a prompt. There is no dirty guard anywhere in the
  app (`grep -rn beforeunload apps/web/src` → 0) and on a create form "no guard" is a defensible
  answer — but it must be the **stated** answer, written into the new entry, not the accidental one.
  Separately, Destinations' `Back` needs a label or a weight that distinguishes it from `Cancel`;
  today they are byte-identical `btn btn-sm btn-ghost` 60px apart.

## Members

S25-F1 (**S1**) · S25-F2 (**S1**) · S25-F3 (S2) · S25-F5 (S2) · S25-F7 (S3) · S25-F8 (S3) ·
S25-F9 (S3) · S25-F11 (S3) · S24-F3 (S2) · S24-F4 (S2) · S24-F5 (S2) · S24-F7 (S2) · S24-F8 (S2) ·
S24-F10 (S3) · S24-F12 (S3) · S24-F15 (S3) · S24-F19 (S3) · S24-F20 (S4, DEFER).
S25-F4's copy half; its structural half is filed against **deferred D15**.

## How to verify done

Type in edit mode, click `Read`, click `Edit`, click `Cancel` → the input holds the **saved** value,
on both twins · create a destination named "My analytics DB" and follow every link to it: it is
never called "Postgres" · an unknown status renders neutral `Unknown` on list **and** detail · one
`Reconnect` word across both · `git grep -c "statusMeta\[" apps/web/src/views` returns 0 unguarded
sites · a blank required field paints its error at 14px inside the fieldset with the hint suppressed
and `aria-describedby` on the error · `pnpm ds-lint` and `pnpm typecheck` green.
