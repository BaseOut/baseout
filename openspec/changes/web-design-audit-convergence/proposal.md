# web-design-audit-convergence — Proposal

**Umbrella change** tracking the design audit's ship order against `apps/web`.

## Why

The `ui-only@986f6c09` sync brought across Oleh's closed design audit — **514 register rows · 49 decisions · 74 S1s** — plus a rewritten `SHIP-ORDER.md` ordering 41 items by *cost of not fixing*, then *cost of fixing*, then *what unblocks what*. It lives at [`apps/design/audit/`](../../../apps/design/audit/) and its own closing line is *"Not more auditing. Start at `audit/SHIP-ORDER.md`, item 1."*

The `2bb5b46a` promotion then landed **the vessels** — `Table.astro` ("one listing chrome"), `Alert.astro` rebuilt as a superset, and eleven shared libs (`escapeStack`, `exitGuard`, `drawerDialog`, `toolbarFit`, `wireRowKeys`, `table/{contract,tableA11y}`, `connect/failureCopy`, `registry/*`). **It did not land the sweeps that migrate call sites onto them.** A vessel with no adopters retires nothing; it just adds a file.

This change owns that residue. It is deliberately an umbrella rather than a per-item change because the audit's own batching — *"a PR touches one surface family at a time"* — is the right unit, and because several items are explicitly ordered against each other (item 5 must precede 10, 29 and 38; item 17 is a hard gate on everything from 18 up).

## ⚠️ First task is a re-census, because the promotion silently closed rows

The audit was written against the **fork's** tree. Our tree has since diverged in both directions, so a chunk of the ship order is already satisfied here and a chunk of it never applied. Spot-checking five of the first eleven items found:

| item | audit says | our tree, verified |
|---|---|---|
| 3 — Settings invents a Space | S1, module constant rendered unconditionally | **already fixed** — `settingsCatalog.ts:166` guards `!space` with a real "No Space yet" state |
| 4 — the logs stop guessing | S1, six `?? statusMeta.cancelled` fallbacks asserting an action | **already fixed** — all four live sites carry the corrected map plus a comment recording what it used to be |
| 9 — the neutral KPI dot | S1, class assembled by interpolation so Tailwind never emits it | **already fixed** in the in-flight Reports work — `toneDotOf`, a map of static literals, with the `X08-F7` note |
| 5 — `.ph-panels` has no width | S1, one declaration, five hosts | **NOT fixed** — `PanelHost.astro:623` has `top/right/bottom` and no `left`, so it shrink-to-fits |
| 1, 6 — the auth shell + refusals | S1 ×2 | **NOT fixed** — owned by [`web-auth-convergence`](../web-auth-convergence/) |

Five samples, three already closed. Extrapolating that to 74 S1s is exactly the kind of guess the audit itself warns against, so **task 1 is a census, not a fix** — and it must be run with the audit's own instrument rules (`/usr/bin/grep -a`, because two NUL bytes at `DataBrowse.astro:936` made one file invisible to every binary-classifying grep and produced six drifting counts in the audit itself; device-metrics emulation rather than window resize for any viewport claim).

Without that census this change would re-fix fixed things and report progress it did not make.

## What Changes

- **Item 5 first, because it is also the delta.** `components/ui/PanelHost.astro` is the *only* web-layer file in the new `986f6c09..252005be` fork delta, and it carries item 5: `.ph-panels` gains `left: 0` (and `pointer-events: none`, so the page stays clickable behind a box that now spans the viewport). Today the first panel paints **288.79px at x=101.21** instead of the documented 350 at x=40 — **identically at 390 and at 425**, which is the tell: a panel whose width does not change when the screen changes by 35px is a content measurement, not a responsive rule. Five hosts; it must land before items 10, 29 and 38 touch the same file.
- **A census** (task 1) reconciling all 74 S1s and the 41 ship items against our tree, producing a live worklist. Items already satisfied are struck **with the evidence**, not silently.
- **The vessel-adoption sweeps** — the substance. `Alert` onto the 58 `role="alert"` sites it can own (and the *second, smaller* answer for the other 21, which are not alert vessels — `TextInput`/`Select` already have an `error` prop); `EmptyState` across the 26-of-28 families; `Badge` as the only path against 243 raw class strings; `wireRowKeys` replacing 11 copied keyboard blocks and reaching the 3 tables that never got one; `setButtonLoading` onto the 6 divergent busy idioms.
- **The a11y items that are not consistency items**: focus never enters the panel overlay (zero `.focus()` calls; Tab walks the page behind it), and `Drawer` asserts `aria-modal="true"` twice with no trap, no `inert`, and no restore — the one place in the app where the markup contradicts the code.
- **Delegated, not duplicated.** Items owned by a surface change ride there and are struck here with a pointer: items 1 + 6 → [`web-auth-convergence`](../web-auth-convergence/); item 11 (Automations and Interfaces destroying in one click) → [`web-automations-interfaces-tabs`](../web-automations-interfaces-tabs/); item 20 (the support dead end) → [`support`](../support/); items 12/16's Reports halves → [`web-reports-page`](../web-reports-page/).
- **Documentation corrections (item 19) flow UP, not here.** `specs/16-responsive.md` §8 certifies the 350/40 panel geometry the app does not paint, and §3 describes a padding split that no longer exists. Those are the *designer's* specs; our copies under `apps/design/specs/` are reference. The corrections go back via `/sync-reconcile`, which keeps this change single-app (§3.6).

## Capabilities

### Modified Capabilities

- `system-component-governance`: the shared vessels gain their adopters, so the catalog's claims become true. Several `ds-checks` rules can be switched from advisory to enforcing once their call sites converge (the badge pair regexes in particular — switch them on **in the same PR** as the three files they redden, and fix those files rather than `ds-ok`-ing them).

## Impact

- **App:** `apps/web` only, by design — see the item-19 note above. Wide but shallow: `components/ui/*`, `components/patterns/*`, `views/*`, `styles/global.css`, `lib/*`.
- **The diff is large and must not land as one PR.** The audit is explicit that item 15 (Badge) alone is the largest diff in the whole register. Batch by surface family — Schema, Data, Backups/Restore, Reports, registries.
- **⛔ A hard gate sits between items 17 and 18.** Decision `D15` (`Table.astro` as a bound vessel) is *deferred, not rejected*, and four register rows are filed against it that get **dropped silently** if nobody re-opens it. Oleh's ruling 9: *"D15 must be re-opened after item 16 and must not be allowed to remain deferred by default."* Deliverable is either an amended `decisions/15-one-table.md` binding a vessel, or a **written ACCEPT** declining those four rows and saying why. Either is acceptable; silence is not. Nothing from item 18 up starts until it is answered in writing.
- **Security:** no new secret, route, SQL surface, or external integration. Two items touch security-adjacent behaviour and neither widens a boundary: the focus trap (a11y), and `connect/failureCopy` replacing `error_code:` strings printed to the user — which **narrows** what the UI discloses.
- **Governance:** every vessel migration must keep `pnpm --filter @baseout/web audit:components` at exit 0, and each `ui/*` change extends its story in the same commit.

## Open Questions

1. **The D15 gate** — above. A scheduled re-open with a named deliverable, not a finding.
2. **`.hm-conn-badge`** — the audit deliberately did not decide this one. It is `1rem` square, so lifting its glyph to 12px may be a *badge-size* decision rather than an icon one. Must be decided at the element, not from a register row.
3. **Item 30 (one button height)** is not a defect fix — zero off-tier buttons were measured. It removes the 40px `md` carve-out from 17 views, so the page CTA would carry emphasis by colour and position alone. **Review it as a design change, not a cleanup**, and get a yes before sweeping it.
