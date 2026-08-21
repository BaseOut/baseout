# D16 — The catalog already rules: converge on existing entries

**Rule:** Where a `storybook.ts` entry or recorded decision already names the pattern, the app
converges on it — no new design work, one batch PR per entry.

## Why this option

These findings need no ruling: the rule exists, is written, and the app drifts from it. Batching by
entry (not by finding) keeps each PR reviewable in the client's monorepo. The rejected alternative
— 20 independent micro-PRs — is the register-of-micro-fixes failure mode this audit exists to
avoid.

## The batches

1. **`pattern-segmented-control`** — both grey-on-grey switches move to the documented track
   (`sb-segtrack`/`sb-seg-on`, soft-primary selection) with `role="group"` + `aria-pressed`:
   `IntegrationsSetupWizard.astro:576-579` and `SourceAddView.astro:40-43` (which is also a
   `role="tablist"` with no tabs). (J01-F6 + merged J08-F12)
2. **`pattern-row-actions`** — clickable rows get the full anatomy (`role="button"`, `tabindex`,
   Enter/Space): Home history, `SourceDetailView:99`, both registries. (J02-F7 + instances)
3. **`tooltip`** — the native `title=` on truncated destination paths becomes `data-tip` (it is
   load-bearing: the visible text is clipped). (J03-F12)
4. **`alert`** — error alerts carry a recovery action (the entry's own usageDo):
   run/base error alerts, `/sources`' needs-reconnecting banner. Semantic colours: info for the
   neutral heads-up, warning only for the gate (J01-F5); the wizard's amber double-duty ends.
5. **`pattern-export-control`** — Reports' two bespoke export dropdowns become `ExportControl`;
   the soft-primary trigger the entry forbids goes. (J07-F6)
6. **Button system (`decision-button-system` + `decision-density-sm-is-default`)** — one emphasis
   per action (Restore soft in both places, J02-F16; Run now solid at every appearance, J07-F15);
   `md`-where-`sm` instances drop to `sm` (J01-F22 + Home/restore/report instances); `btn-lg` in
   empty states goes (J02-F12, J07-F16 — with D17).
7. **Icon rules (`decision-entity-glyphs` + Lucide-only)** — one destination glyph
   (`hard-drive`, J01-F15); the three literal `→` glyphs become Lucide (J02-F20).
8. **Sizing floor** — `.cl-daylabel` to 12px (S2: a reference surface breaking a stated rule,
   J05-F17); J07's five under-floor sizes lifted or `ds-ok`'d with reasons, the recipient error
   hint lifted, not excused (J07-F17).
9. **`TextInput` / form anatomy** — Welcome's error placement moves to the fields
   (required-marker, `aria-invalid`, adjacent error; J01-F16); create forms per D12.
10. **Wizard/Home polish batch** (ride along with 1/4/6): drawer group-gap ≥ 12px (J01-F18),
    Managed-badge tile wrap (J01-F19), duplicate headings (J01-F23), heading registers (J01-F26),
    hero motion + radial gradient stripped, static diagram kept (J01-F24, per `specs/00`).

## Surfaces changed

Listed per batch above; each batch is one PR.

## storybook.ts

No new entries — that is the point. Where an entry's example is stale it is corrected in D20.

## Not changing

The entries themselves · the wizard's gate model · anything in the findings' "What is good" lists.

## Verify

Per batch: the entry's usageDo/usageDont read against the changed surfaces; `ds-lint` green on
changed files; a screenshot pass on the two segmented controls and the wizard drawers.


---

## AMENDMENT 2026-08-14 — **register row `X-C` is superseded by X07-F4 / D46**

`X-C` recorded "row navigation by `onclick=\"window.location=…\"`, eight sites" against this decision
and issued no ruling — three passes asked for an id and none was issued. The X07 lens counted the
sites properly and produced the ruling.

**Corrected facts:** it is **twelve** sites, not eight, verified by the lead at every cited line
(`grep -c` tree-wide = 12). **The ruling is two-part and lives in D46:** the whole-row click is a
button, and the row's lead cell is additionally a real `<a href>` with `stopPropagation` — which
`BackupRunDetailView.astro:446` already implements, and which is the one site in the app where
⌘-click works.

`X-C` stays in the register as the historical id; **its disposition now points at D46.** Do not fix
it here.
