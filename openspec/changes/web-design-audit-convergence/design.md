# web-design-audit-convergence — Design

## Context

The audit is closed and its ship order is written. What is *not* written is how that order maps onto **our** tree, which has diverged from the fork in both directions: `2bb5b46a` landed the vessels and independently fixed several S1s, while other rows never applied here at all. So the design problem is sequencing and bookkeeping, not discovery.

Two properties of the audit constrain everything below:

- **It was written against the fork.** Every count in it is a count of fork files. A spot-check of five of the first eleven items found three already satisfied in our tree.
- **It documents its own instrument failures.** Two NUL bytes at `DataBrowse.astro:936` made one file invisible to every binary-classifying grep, producing six drifting counts *inside the audit* and hiding an 8th `document`-level Escape listener. Every "390" claim in waves 1–6 was taken with a window resize, which macOS floors at ~500px — so those are 500-wide layouts mislabelled.

## Goals / Non-Goals

**Goals**
- The shared vessels acquire their adopters, so the catalog stops describing an aspiration.
- The four genuine a11y defects (overlay focus, `Drawer`'s false modality claim, Enter-on-row, Escape ownership) are fixed.
- Every struck row is struck **with evidence**, so the next reader can tell "fixed" from "forgotten".

**Non-Goals**
- Re-auditing. The register is input, not something to reproduce.
- Anything a surface change owns (auth, Automations/Interfaces, support, Reports).
- Correcting the designer's own spec docs — those flow up via `/sync-reconcile`.
- Deciding `D15`. This change *forces* the decision at the gate; it does not pre-empt it.

## Decisions

### D1 — Census before fixes, and it is a real deliverable

Task 1 produces `apps/design/audit/OUR-TREE-STATUS.md`: one row per S1 and per ship item, with a verdict of `already-satisfied` / `outstanding` / `never-applied-here` / `owned-by-<change>`, **each carrying its evidence** (file:line, or a computed value, or the change that owns it).

Run it with the audit's own instrument rules, because they were earned:
- `/usr/bin/grep -a` for any count that will be quoted. The shell's default `grep` skips a binary-classified file *with exit code 0*.
- Device-metrics emulation for any viewport claim, never `resize_page`.
- Verify a responsive fix by **computed value at the width the rule claims to act on**. A green cascade check only proves the cascade agrees with the source — item 5 is a rule whose cascade was correct and whose *containing block* was wrong.

*Rejected:* trusting the register's counts. They are fork counts, and three of five sampled items were already closed here.

### D2 — Item 5 goes first because it is both cheapest and a prerequisite

`.ph-panels` is `position: absolute` with `top/right/bottom` and **no `left` and no `width`**, so it shrink-to-fits from its own content — and the five sheets' `width: calc(100% - 40px)` then resolves against a box sized by the very child it is sizing. The fork's fix adds `left: 0`, and with it `pointer-events: none` (the box now spans the viewport, so it must stop swallowing clicks; the panels themselves re-enable pointer events).

Why it must precede items 10, 29 and 38: all three touch `PanelHost`, and item 38's panel-width contract is *not actually in effect* until `.ph-panels` has a width.

Why it hid for so long: opening a *second* panel clamps the box to `100vw` and the documented number appears — which is why the same declaration is correct on `/data` and wrong on `/schema`. Keep `EntityPanel.astro:307-314`'s comment intact; it is the trap this fix can re-open.

### D3 — Vessel adoption is batched by surface family, never by vessel

The tempting shape is "one PR per vessel". The audit says otherwise, and it is right: a Badge sweep across 243 sites in one PR is unreviewable, while *Schema's* Badge + Alert + EmptyState + header convergence in one PR is one coherent visual diff on one surface. Order: Schema → Data → Backups/Restore → Reports → registries.

Two consequences:
- **`Alert` is two scopes, not one.** It closes 58 of the 79 `role="alert"` sites; the other 21 are not alert vessels and need the smaller answer (`TextInput`/`Select` already own an `error` prop — the five `.reg-err` boxes should *be* that prop).
- **The vessel's job is bigger than its class list.** It must own the write/reveal **order** (un-hide, then write), write only on change, and refuse a live role to a banner present at first paint or inside a focus-taking modal. 13 of 17 written sites currently write while `hidden` then reveal — the order that *suppresses* the announcement — and 39 sites are SSR-static, where the role can never fire at all.

### D4 — Enforce the gate in the same PR that makes it pass

For any `ds-checks` rule switched from advisory to enforcing, the flip and the fixes land together, and the reddened files are **fixed rather than `ds-ok`-ed**. An `ds-ok` with no stated reason is how a check becomes decorative.

### D5 — The D15 gate is modelled as a blocking task with a written deliverable

Task 8 is a stop, not a checklist item. It passes only when either an amended `decisions/15-one-table.md` binds a vessel, or a written ACCEPT declines `S25-F4`'s structural half, `S25-F12`, `X01-F2`'s component half, and the `X01-F1/F5` residue — naming them. By that point items 18–26 and 36 will have established how much of the table job is already shared, so the vessel can be designed against the residue rather than a guess.

### D6 — Items that are design changes are flagged as design changes

Item 30 (one button height) fixes no measured defect — zero off-tier buttons were found. It deletes the 40px `md` carve-out from 17 views, so the page CTA thereafter carries emphasis by colour and position alone. That needs a yes, not a sweep. Same for item 15's `Running` → primary (blue), which changes eight live sites: it is already **bound** by Oleh's ruling 5, so it ships — but it ships as a visible product change with its own screenshots.

## Risks

- **Reporting progress that did not happen.** The single largest risk, and D1 is the mitigation. Struck-without-evidence is the failure mode.
- **A sweep that is 90% mechanical and 10% judgement.** Badge and Alert both have exception sites. Batching by surface keeps a human reading each one; batching by vessel would not.
- **Item 28's threshold change is visible product-wide.** `toolbarFit`'s `NARROW_AT = 1440` runs against a column that is 1184 on the target hardware, so `data-narrow` is permanently on and the nine `.sch-tb` surfaces have only ever had one rendering. Fixing the threshold brings button words and the full search field back **everywhere at once**. Screenshot every dense toolbar at 1440 after the change — this is not a quiet fix.
- **`stopPropagation` cannot arbitrate the Escape problem.** All eight listeners are on `document`, so 24 deliveries happen per press and 13 land *after* the one `stopPropagation()`. The fix is a single delegating owner, not a priority tweak.

## Migration

No DB, route, or contract change. Every phase is independently revertable, and the batching is chosen so a revert takes back one surface family rather than one vessel across the app.
