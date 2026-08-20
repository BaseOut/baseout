# CONTINUE HERE — session state, 2026-08-14

**Written before a usage-limit interruption, and kept current since.** Everything below is on disk.

**Superseded 2026-08-14: the work IS committed and pushed.** `2cc56b4` carries the first wave (ten
of eleven release blockers plus the vessels), `90ffdb2` the prototype and handoff cleanup, `51c1063`
the component findings. Pushing to `main` auto-deploys the preview at `ui.baseout.dev` in about a
minute. A later wave (batches O · P · Q · R · S) may still be uncommitted when you arrive — check.

## First thing to do in a new session

1. `git status --short` — a clean tree means the last wave landed; a dirty one means a batch was
   interrupted. Either is fine; **do not reset it**.
2. Run all four gates yourself and read the **counts**, not the tick:
   `corepack pnpm@11.1.1 -r --parallel run typecheck` · `pnpm ds-lint` · `pnpm css-guard` ·
   `pnpm smoke` (needs `pnpm design` running on `http://localhost:4332` — **`http://`, never https**).
   Last known good: typecheck 0 · ds-lint clean · css-guard clean (2554 rules / 8124 declarations) ·
   smoke green 44 routes / 172 requests · `ds-audit` **5**, all `unsized control = md`.
3. **Do not trust a red gate until you know no agent is mid-write** — a `smoke` run during another
   agent's in-flight edit reported `/login` and `/welcome` at HTTP 500; both were 200 a minute later.

## ✅ RESOLVED — what the four batches actually landed (verified 2026-08-14 after the limit hit)

**Batches G and H were killed mid-run by the monthly spend limit. The tree is NOT broken** — I
re-ran every gate afterwards: `typecheck` **0** · `ds-lint` clean (57 files) · `css-guard` clean
(2953 rules / 9090 declarations) · `smoke` green, **44 routes / 212 requests**.

| | landed? | evidence I checked myself |
|---|---|---|
| **E** — 404 in the shell · registry entry · `DRAWER_MODEL` rewrite | **complete** | `/404` and a random path both return **HTTP 404** with the new markup and **77** sidebar markers in the body — a panel inside the shell, not a takeover. `ds-audit` 5 → 4 |
| **F** — caption 12px app-wide · `aria-disabled` · catalog | **complete** | rule shipped as a **selector list** `.fieldset-label, .fieldset .fieldset-label` (`global.css:283-284`) at 0,2,0 — a bare `.fieldset-label` would have LOST to the vendor's unlayered 0,2,0 rule and been a silent no-op with all gates green |
| **G** — item 7 rename | **landed** | `&name=${encodeParam(…)}` at `DestinationsView.astro:72` and `SourcesView.astro:76` |
| **G** — item 11 destroy-in-one-click | **landed** | `ConfirmModal` + `CONFIRM_DESTRUCTIVE` imported and rendered in `SchemaAutomations.astro:349` / `SchemaInterfaces.astro:341`; `showUndoToast` wired in `schemaAutomations.ts:9` |
| **G** — item 16 double-submit | **landed** | `setButtonLoading` present 6× across the two controllers |
| **H** — item 8, the gate walks states | **landed** | `smoke.mjs` `fixture=` declarations **16 → 23**; declared variants **125 → 165**, requests **172 → 212** |
| **H** — item 10b, `Drawer`'s false modality | **landed** | `Drawer.astro` now asserts **`aria-modal="false"`** — *asserted, not omitted* — at `:55` and `:76`, with the D45 ruling written above it at `:13` |
| **H** — item 10a, focus enters the panel | **DONE — measured 2026-08-15, this row used to say NOT DONE** | See below. |

**Item 10a is CLOSED, and the "NOT DONE" above was already stale when it was written.** The keyboard
contract does not live in `PanelHost.astro` — grepping that file for `.focus(` returns nothing and
always will, which is the design, and is what the audit misread. It lives once in
`components/ui/panelStack.ts`: `focusPanel` (`:293`), `restoreFocus` (`:307`), a capture-phase Tab
handler (`:339`) and the `opener` field on `StackPanel`.

Measured in the browser at 1440 on `/schema?tab=interfaces`, not read from source:

| | result |
|---|---|
| focus on open | lands on `ASIDE.ep-sheet.ps-focus`, inside the host |
| Tab ×4 | every stop stays inside the host — containment, not a trap |
| Escape | closes the panel |
| focus on close | restored to `DIV.if-parent.if-row`, the row that opened it |

**A trap in how you test it, which cost me a wrong reading first.** Dispatching
`new KeyboardEvent('keydown', {key:'Escape'})` on `document` did NOT close the panel; dispatching the
same event on `document.activeElement` did. The handlers guard on `ev.target.closest(…)`, and a real
keypress always targets the focused element — so a synthetic event aimed at `document` skips guards a
user never skips. **Dispatch on the focused element or the result is about your test, not the app.**

`Drawer` remains ruled non-modal — do not bolt a focus trap onto it to match a withdrawn claim.

## The four batches, as briefed (kept for their scope)

If they finished, their reports are gone with the session but **their edits are on disk**. Verify by
reading the diff rather than re-running them, and re-run only what the diff shows is missing.

| batch | items | owns |
|---|---|---|
| **E** | 404 page **in the app shell** (Oleh's ruling) · flow-registry entry for the unknown-path 404 · **rewrite `DRAWER_MODEL`** in `handoff.astro` against the real stack | `NotFoundView.astro`, `404.astro`, `[...slug].astro`, `handoff.astro`, `flow-registry.ts` |
| **F** | field caption **12px app-wide** (`.fieldset-label` has no `font-size` at all) · `aria-disabled` as the app's "not yet" · 3 catalog entries · dedupe the doubled `id: 'tooltip'` | `global.css`, `overrides.css`, `auth.css`, `storybook.ts` |
| **G** | ship item 7 (stop renaming the created object) · item 11 (destroy-in-one-click) · item 16 (double submit) | registry views + Schema Automations/Interfaces + `.ts` twins |
| **H** | ship item 8 (`smoke.mjs` walks real states) · item 10 (focus enters the panel; `Drawer` drops its false `aria-modal`) | `smoke.mjs`, `PanelHost`, `Drawer`, `panelStack`, panel controllers |

**How to tell whether a batch landed:** E → does `/404` render the rays treatment inside
`SidebarLayout`? F → is a caption 12px on `/sources/new` (was 16)? G → does
`/destinations/detail?...` keep the typed name? H → does `smoke` report **more** than 125 declared
variants, and does Tab enter an open panel on `/schema`?

## What is done and verified (do not redo)

Ship-order items **1, 2, 3, 4, 5, 9** are complete and I measured each myself:
auth shell scrolls (844×390: card top +16, maxScroll 171, `Continue` bottom 374.5, hit-testable) ·
`Cancel` cancels again (extracted to `lib/registry/registryEditMode.ts`) · Settings stops inventing a
Space · the logs stop guessing (8 fallbacks + 2 throwing lookups) · `.ph-panels` has a width
(350@x=40 at 390, 385@x=40 at 425, 480@x=960 at 1440, page behind still clickable) · the neutral KPI
dot paints. Item 6 is **half** done (auth refuses; the 19-code connect deck is not built) and item 8
is **half** done (NUL bytes fixed; smoke variants were batch H's job).

Also done: the segmented control converged **7 → 1** (`sb-segtrack`/`sb-seg`, the class the catalog
had promised and never built) · the stepper distributes (row 1 was wasting 129 of 336px, now 0) ·
base columns pan 298 → 106px at 390 · the auth rays asset re-derived 478 KB → **28 KB**.

## Still open, in priority order — REWRITTEN 2026-08-14 (the list below it had gone stale)

**Everything the previous version of this section listed as open is now DONE and pushed.** Ship
items 1–17 are complete, all four vessels are built (`Alert` · `EmptyState` · `Badge`-as-the-only-path
· `Table`), the six-batch table migration has finished, and every one of Oleh's ten rulings is built.
`ds-audit` reached **0 across 224 files** — the first clean whole-tree run this project has had.

What is genuinely left:

1. **The catalog's own 77** — see the NEXT TASK section at the foot of this file. This is the head of
   the queue.
2. **Four tables the vessel could not express**, each with a call site rather than a shrug:
   `DataBrowse` and `StaticImport` build columns at runtime from Airtable fields while the vessel
   takes them server-side · `DataMedia` sorts by *name* where the vessel emits an index ·
   `RestoreView` step 3 is one logical table rendered N times sharing one external pager ·
   `SchemaInterfaces` is a `<span>` grid needing a data-shape decision, not a swap.
3. **Escape — eleven `document` listeners, not the five the audit filed.** One press was measured
   reaching 24 listeners with 13 firing *after* a `stopPropagation()`, because siblings on one target
   cannot stop each other. Converging them needs `lib/escapeStack.ts` and a per-site depth that must
   be **argued, not guessed** (is a tag typeahead above or below an open description editor?).
4. **`PAGER_ROWS = 25` is a convention wearing a measurement's clothes** — derived from the app's
   smallest existing page size, not from when a human stops scrolling. Accept it explicitly or
   measure it once against the registries.
5. **Ship-order items 18–41's remainder** — the sweeps. Several are already absorbed (18, 19, 22, 28,
   30, 40); read the file rather than the numbers.

## Waiting on Oleh

- **Five wizard elements with no catalog entry** (THE SEQUENCE branch 3, his call, not ours):
  provider/type picker tile + grid (two implementations, zero entries; D38 names the family) ·
  two-stage drawer · section heading inside a drawer body · in-panel back-step control ·
  form-level failure region in a drawer (that one is D32).
- **The five client questions for Dan**, assembled in `audit/CLIENT-QUESTIONS-PENDING.md` and held by
  him. **#4 blocks all of Billing, #6 blocks all of Help**, and #6 has never been asked.
- **Two catalogues of one object**: the first-run drawer offers 6 destination types,
  `/destinations/new` offers 9.

## Working agreements that produced most of the real findings

- **A screenshot at 390 is part of "done", not a written conclusion** — and measurement is the other
  half. Three defects were found only by looking, three only by measuring, and **neither method finds
  the other's class**. Today a screenshot corrected a contrast number I had measured wrong.
- **Use `emulate`, never `resize_page`** — a Chrome window floors at ~500px on macOS, so every
  "390" screenshot taken with `resize_page` is a 500-wide crop. Return `window.innerWidth` inside
  every measurement payload.
- **Never quote a count from the bare `grep`** — it is a `ugrep -I` shim. Use `/usr/bin/grep -a`.
- **Partition parallel agents by file AND by browser** — Chrome MCP's selected page is global server
  state and `isolatedContext` does not isolate it.
- Do not review your own work against your own criteria.

---

## Seven unimported UI components — a findings list, NOT a delete list (2026-08-14)

Checked by import shape (`from '…ui/<N>'`), not by bare name — a bare-name grep calls `Toggle`
alive because `classList.toggle` exists. **Every one of these has zero importers anywhere,
including the styleguide.** Three are already understood and must NOT be deleted:

| component | verdict |
|---|---|
| **`Breadcrumbs.astro`** | **DO NOT DELETE — it is the defect.** Breadcrumbs are computed on 25 pages, serialised and parsed, and painted by nothing (commit `7d19c1a`). Deleting the component cements that; the fix is to render it. |
| **`Tabs.astro`** | **Deliberate keep**, already recorded: it is `<input type="radio" class="tab">` whose label comes from `aria-label` via `::before`, so it **structurally cannot hold an icon** — which is why the wizard's tabs had to become buttons. Catalog entry already re-pointed. |
| **`SocialButton.astro`** | **Variance, not dead weight.** `LoginView.astro:71` hand-rolls the same control — `btn btn-soft btn-primary btn-sm w-full gap-2` plus a raw glyph span — while this 66-line component sits unused. Decide whether the component fits the Airtable case (it was built for Google/Apple) and either adopt it or delete it **with a reason**, not silently. |
| `Divider` · `ProgressBar` · `FeatureBadge` · `Toggle` | Unexamined. `ProgressBar` is worth a look first: the audit found `progress`/`radial-progress` appear **zero times** on the running-run screen although the catalog's own entry names that exact use and forbids a spinner when the percentage is known. That is the same shape as Breadcrumbs — a component exists, the surface that needs it does not use it. |

**The pattern across all four judged so far is one thing, not four:** a component exists, and the
surface that needs it wrote its own or rendered nothing. That is the same law the audit measured
everywhere else — convergence happens where a component is *used*, not where it merely *exists*.
A dead-component sweep that only deletes would remove the evidence and keep the divergence.


---

## NEXT TASK — the catalog's own 77 (opened 2026-08-14, agent died on a usage limit having written nothing)

`ds-lint` now reads `apps/design/src/lib/storybook.ts` and `pages/styleguide.astro` (commit
`1d6adfc`). First run: **77 findings**, all in those two files.

```
31  off-grid spacing (not a multiple of 4)
22  unsized control = md   ← teaching the 40px carve-out Oleh's ruling 1 deleted
12  font-size off the ladder (11·12·13·14·16·18·20·24·32)
 4  coloured checkbox variant
 3  *-outline is deprecated
 2  alpha off the ladder
 2  below the SM/12px floor
 1  raw hex colour
```

**FIX them; do not `ds-ok` them.** `ds-ok` is the escape for a deliberate exception in *product*
code. In the catalog it reads as "the rulebook is exempt from the rule", which is how a rulebook
stops being believed. Any `ds-ok` needs a sentence at the line saying why the catalog is the
exception — and if that sentence cannot be written, it is a fix.

Two need judgement rather than mechanics:
- **The 22 unsized controls.** Some may be `<code>` blocks quoting the old rule as *prose*; a regex
  cannot tell markup from a quotation. Where it is prose describing the deleted 40px carve-out, the
  fix is the prose.
- **The 3 `*-outline`.** Deprecated app-wide since 2026-07-24 and `Badge.astro`'s `outline` prop was
  deleted. If one sits inside a "Don't" example **on purpose**, that is the single legitimate
  `ds-ok`, and it still needs the sentence.

**Verify by looking as well as by the gate.** 31 spacing and 12 type changes can add up to a page
that lints clean and reads worse. Screenshot `/styleguide` at 1440 before and after; if something
got worse, keep the finding and report it rather than shipping a tidy regression.
