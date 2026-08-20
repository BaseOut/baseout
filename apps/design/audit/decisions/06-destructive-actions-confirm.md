# D06 — Destructive actions confirm and name the consequence

**Rule:** Anything irreversible or externally visible — restore, delete report, remove
source/destination, delete account/Space, abandon a multi-step setup — goes through `ConfirmModal`
with the consequence stated in a soft alert, and is followed by an undo toast where undo is
actually possible; where it is not, the dialog says so.

## Why this option

The app already owns the recipe: Pause and Cancel — both *less* consequential than anything in
this list — route through `ConfirmModal` and state their consequence (`BackupRunDetailView.astro:
292,301`). The rejected alternative (per-surface judgement calls) produced the current absurdity:
cancelling a backup asks "are you sure"; writing thousands of records into a live Airtable base
(J04-F2), deleting a report with a live external mailing (J07-F3), and removing a destination
(J08-F9) ask nothing. `pattern-undo-toast` already states the division of labour: "Reserve dialogs
for what cannot be undone."

## The concrete changes

1. **Restore confirm** — the D05 copy (scope, source date, target, effect on existing data,
   irreversibility, permission, credits). (J04-F2, F11)
2. **Delete report** — `ConfirmModal` naming the report, its run count and its schedule's
   recipients; then the undo toast. (J07-F3)
3. **Remove source/destination** — `ConfirmModal` stating what happens to written backups,
   schedules and report definitions that depend on it (the in-use guard already covers the guarded
   case; this covers `inUseCount === 0`). (J08-F9)
4. **`Delete account` / `Delete Space`** — a `destructive` control kind in `pattern-settings-row`:
   `btn-outline btn-error`, danger card with the error border the registries already use. (J08-F16)
5. **Wizard exit guard** — leaving mid-setup confirms ("Your setup so far will be discarded"); the
   recorded no-draft decision stands, the silence does not. (J01-F9)

## Surfaces changed

`RestoreView` · `ReportsView` + `ReportDefinitionView` · `SourceDetailView` ·
`DestinationDetailView` · `SettingsView` · `IntegrationsSetupWizard`.

## storybook.ts

`confirm-modal`: add the enumerated trigger list above to usageDo ("every destructive or costly
act, including abandoning multi-step input"). `pattern-settings-row`: add the `destructive` control
kind.

## Not changing

The in-use guard on Remove (correct — keep) · the never-disabled wizard gate model · Pause/Cancel
confirms (the reference).

## Verify

Each of the five actions opens `ConfirmModal` in the preview; the dialog names the consequence;
report deletion shows an undo toast; `Delete account` renders the error recipe.


---

## AMENDMENT 2026-08-14 — three members from the X10 lens, one of them the wave's cheapest S1

- **X10-F1+F2 (S1).** **Automations and Interfaces destroy a record on one click** — no confirm, no
  undo, no way back. The Delete control is invisible until hover/focus and sits one Tab from a row
  whose Enter merely *opens* it, so the destructive control is harder to see than the benign one and
  adjacent to it. Nothing un-removes either: the edit modal re-reads the existing status on save and
  the removed row no longer renders a control. **The app's own rule, in its own source
  (`panelStack.ts:512-520`), is that a bulk verb which cannot be taken back is not shippable** — and
  `ReportsView.astro:242` puts both a dialog *and* an undo toast on a strictly less destructive act,
  one file away. Evidence: `schemaAutomations.ts:253`→`:381`, `schemaInterfaces.ts:260`→`:383`,
  reveal `row-actions.css:33-35`, row Enter `schemaAutomations.ts:265-271`, no-undo `:326`, row `:354`.
- **X10-F3 (S2).** The **panel footer's** Delete for the same two kinds also destroys with no confirm
  — and **closes the panel first**, so the record disappears from under the user. Separate code path
  (`entityPanelController.ts:581`), so a fix applied only to the row controller leaves this live.
- **X10-F5 (S2).** **`Restore into Airtable?` — the most consequential dialog in the product — is the
  one whose cancel label is bare `Cancel`.** Every less consequential sibling names what staying
  preserves: `Keep running` (`BackupRunDetailView.astro:501`), `Keep it` (`SettingsView.astro:247`),
  `Keep editing`, `Stay in setup`. `RestoreView.astro:481` should join them.
- **X10-F4** is recorded as an instance of X06-F6 (D45): `SchemaDocs`'s bespoke `<dialog>` also uses a
  **solid** `btn-error` confirm where all eight siblings use `CONFIRM_DESTRUCTIVE`'s outline
  (`lib/ui.ts:15`).

**Not changing.** `ConfirmModal` + `CONFIRM_DESTRUCTIVE` — one component, one constant, a `confirm`
slot, a `confirmHref` path, eight agreeing call sites. **This is the thing everything above moves
*onto*, not something to redesign.** And `RestoreView.astro:481-508` stays the standard: seven named
facts in a `<dl>`, the snapshot caveat in a soft warning alert, irreversibility in a soft error alert,
and every string derived from the same request object the page renders rather than authored in the
dialog. It is the best destructive dialog in the product; only its cancel label is wrong.
