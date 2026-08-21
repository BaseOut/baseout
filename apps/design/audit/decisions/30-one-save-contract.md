# D30 — One save contract

**Rule in one sentence:** An editing surface opens in **Read**; Edit is an explicit switch; edit
mode carries **Save + Cancel in one slot** at one height; a dirty state gates every exit — the
contract already shipped for this very section at `schemaReadBody.ts:305-314`
(`pattern-panel-edit-mode`), applied to the one surface that edits whole documents.

## Why this option, not the alternative

The alternative — invent a Docs-specific save UX — was rejected because the section already
settled this twice (`decision-panel-edit-mode-not-inline`, and the panel footer this very tab
opens on a tag click): read by default, one footer slot whose contents swap between Delete and
Save+Cancel. Docs uses the same `join` mode switch and the same CSS family while ignoring the
half that makes editing safe. Editing a *description* in Baseout has Save and Cancel; editing a
whole *document* currently has neither, renders **`Draft · not saved`** with no control that
could change it, and destroys typed text on every route out (`openDoc`, `deleteDoc`, the four
inbound `schema:openDoc` callers, `newDoc` — all overwrite `editor.innerHTML` unconditionally,
no guard, no `beforeunload`). Both S1/S2 hold as filed; the lead re-verified the grep (the only
"save" in the file is the byline string at `:738`) and the panel contract in source.

## Surfaces changed

- `SchemaDocs.astro` document bar (`:153-165`): Save (`btn-sm btn-primary`, `lucide--check`) +
  Cancel (ghost) rendered in edit mode only — the panel's exact footer recipe.
- `SchemaDocs.astro` controller: a dirty diff against loaded `bodyHtml`/`title`/`entityIds`
  gating all exits (row click `:717-731`, delete `:763`, `schema:openDoc` delegate `:1137`,
  `newDoc` `:737`, plus `beforeunload`); the confirm is `ConfirmModal` (lands with S15-F5 / D06).
- Default mode: `openDoc()` ends in **Read**, not `setMode('edit')` (`:730`, `:1209`) — the four
  inbound routes are all reading errands. Exception kept: `newDoc()` opens in Edit and focuses
  the title (`:742-743`) — a blank document has nothing to read; after F3 lands, Read is also
  the state a saved document returns to.

## storybook.ts

Amend `pattern-schema-docs` (`:5175-5186`): the header-bar anatomy sentence gains Save/Cancel in
edit mode (today the entry enumerates the bar's contents without a save — the catalog currently
blesses the gap). If the founder wants edit-first for authors, that is a **RATIFY** recorded in
the entry as a stated exception — and it cannot stand while there is no Save.

## Explicitly not changing

- **Persistence is NOT-OURS** — the mirror has no server to POST to; the controls, the dirty
  state, the leave guard and the byline are ours and are what this decision ships.
- The `document.execCommand` engine (entry-sanctioned mirror wiring; Plate replaces it).
- The three-zone console, the list sheet, the tag/link rails.

## Members

S15-F3 (S1) · S15-F4 (S2).

## How to verify done

Type into a document, click another list row → a confirm appears; Cancel restores the loaded
body; arrive from a Browse tag mark → the document opens in Read under a visible Edit switch;
`Draft · not saved` can become saved; `pnpm ds-lint` and `pnpm typecheck` green.

---

## AMENDMENT 2026-08-14 — the reference is withdrawn; two clauses answered

**`SourceDetailView` is no longer the reference for the editable-object contract.** The S22–S24 pass
named it so on a source-only read of its `Cancel` handler, which is correct in isolation. Driving
the machine around it shows the contract broken: `setMode()` (`:307-317`) restores nothing and
re-captures `entryValues` on **every** entry into edit, so leaving edit via the `Read` segment keeps
the typed text, overwrites the baseline, and makes `Cancel` unable to get back. The same code is at
`DestinationDetailView.astro:279-289`. Registered as **S25-F1 (S1)**; the S23 "no findings" block in
`REGISTER.md` is corrected in place.

**Which reference D30 names instead: none, for now.** `schemaReadBody.ts:305-314`
(`pattern-panel-edit-mode`) — which this decision already cites first — is the nearest shipped
implementation of the *whole* contract and is the idiom to copy until **D38**'s
`lib/registry/registryEditMode.ts` lands. The citation of `SourceDetailView.astro:319-322` above is
downgraded from "the idiom" to "the correct half of a broken machine": Read mode, the Save+Cancel
slot placement and the `ConfirmModal` removal remain exemplary and are protected in D38's
"explicitly not changing".

**Clause "a dirty state gates every exit" is unshipped app-wide.** `grep -rn beforeunload
apps/web/src` → **0 hits**, re-verified this wave by three independent scouts, including in the file
D30 says it shipped in. Two answers, both now written down rather than accidental:

- **Editable-object surfaces** (registry detail, Docs, panels): the guard is real and D38 ships it
  for the registries. Until then D30 is **overstated**, not shipped, and should be read that way.
- **Create forms** (`SourceAddView`, `DestinationAddView`): **no guard** is the ruling. A create form
  has nothing committed to lose and `Cancel` leaving is correct (S20 established this). But it is
  now the *stated* answer, recorded in D38's new `pattern-object-registry` entry, so the next reader
  does not file it again — S24-F11 was filed exactly because the answer was silent.

**The open question left by S20-F1 is answered:** D30 clause 1 ("open in Read") governs **documents
and panels**, not forms. A settings row that commits on change (`settingsControls.ts:141-164`) and a
create form that commits on submit are both correct and neither adopts the Read→Edit switch. What
they owe instead is **visibility**: S32-F4 is registered because a `readonly` field is pixel-identical
to an editable one (same background, colour, border, `cursor: text`, width — only the attribute
differs), and a contract with no Edit switch must make "this cannot be edited" visible some other
way. `pattern-settings-row` gains that sentence.


---

## AMENDMENT 2026-08-14 (second) — the X11 lens, and the ruling on `beforeunload`

The X11 lens reached this decision's reference correction **independently and from different
evidence** than the fifth wave did, and confirmed it: `SourceDetailView` fails the contract it was
relayed as the reference for, and the replacement reference is **`entityPanelController.ts:157`
(`exitEdit`) with the footer anatomy at `schemaReadBody.ts:305-314`**. That correction stands,
confirmed twice.

**One addition to the rule text that D30 currently lacks:** *the read slot must render from the
**draft**, not from the loaded record* (`entityPanelController.ts:142`). That invariant is what makes
"the segment discards" **safe** rather than merely defined — without it, the read slot and the draft
can disagree and the user cannot see which one `Save` will commit.

### New members

- **X11-F1 (S1).** **Schema ▸ Docs is an editable surface with no save control of any kind.** The
  byline reads `Draft · not saved` and nothing in the file can change it; `setMode` (`:773-777`,
  lead-read in full) has an edit branch and a read branch and **no save branch**. Every route in
  overwrites `editor.innerHTML` unconditionally, destroying typed text. **This is D30's own subject
  and D30 has not shipped.**
- **X11-F3 (S1).** **The report definition page tracks dirty, lights `Unsaved changes`
  (`ReportDefinitionView.astro:399`), and puts a plain unguarded `<a href="/reports">Cancel</a>` on
  the very next line (`:404`).** Lead-verified: the two are adjacent. The page has already computed
  the predicate; it simply does not use it.
- **X11-F4 (S2).** **Four contracts do one job.** A user who edits a source, a report, a document and
  an automation panel in one session meets four different meanings for the same two buttons. C2, C4
  and C7 converge on C1. *Instances on this member:* **X11-F5** (`Cancel` carries three unrelated
  meanings — revert my edits · leave and discard everything · stop a running backup) and **X11-F8**
  (no `specs/` document states a save contract at all; **the D30 rewrite is the artefact**).
- **X11-F7 (S3, DEFER).** Closing an entity panel mid-edit discards the draft with no warning.
  **Trigger: the shared exit guard below landing** — mounting it here is then three lines, and a
  bespoke warning built first would be thrown away.

### Ruling — `beforeunload`, and where an exit guard belongs

**Lead-verified: `beforeunload` is 0 app-wide and `popstate` is 0 app-wide.** No exit is gated
anywhere except the wizard's link interceptor. That is not acceptable as a blanket state — **and
`beforeunload` is the wrong instrument for six of the eight contracts.** It renders a browser-chrome
dialog whose copy cannot be written, which the charter's tone rules cannot reach, and which fires on
every reload of a surface where the loss is a half-typed name. Adding it globally would be **the app
shouting where it currently whispers.**

**Where the guard belongs, in order:**

1. **Lift `IntegrationsSetupWizard.astro:862-886` into `lib/`.** It is already surface-agnostic in
   everything but its selectors: it takes a `somethingToLose()` predicate, a dialog id, and it
   rewrites the confirm href. Mount it on the two surfaces that can lose **authored work with no
   draft behind it**: **`SchemaDocs`** and **`ReportDefinitionView`** (which already computes `dirty`).
   Those two plus the wizard are the complete set. The registries and the entity panel lose one
   field's worth of typing, for which C1's discard-on-exit is the right contract and a dialog is noise.
2. **Add `popstate` to the same helper** — browser Back out of the wizard today walks straight past
   the guard the wizard just built.
3. **Add `beforeunload` on those same two surfaces only, as the last resort.** A tab close or ⌘W is
   the one exit a click interceptor cannot see, and losing an entire authored document to it is
   exactly the case the blunt browser dialog exists for. **Not** on the wizard (its loss is a set of
   re-pickable choices), not anywhere else.

**Not changing.** The wizard's exit guard itself — it ignores modified and new-tab clicks, ignores
untagged in-wizard links, ignores same-page and cross-origin hrefs, and rewrites its own confirm href
so it cannot trap the user inside itself. **It does not need improving; it needs mounting in two more
places.** And `exitEdit`'s one-line contract and its comment (`entityPanelController.ts:156-157`) —
the whole reference correction rests on that line existing and being documented.
