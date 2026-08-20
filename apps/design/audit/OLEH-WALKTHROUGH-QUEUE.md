# Oleh's walkthrough feedback — running queue

**Opened 2026-08-14.** Oleh is walking the five zones the audit never covered and reporting as he
goes. This file is the queue so nothing drops between batches. Batches A and B (audit ship-order
items 1–6) are applied and verified; C and D are his feedback.

Status key: **▶ running** · **✔ done** · **▷ queued**

---

## ▶ Batch C — the first-run setup zone

| | item | measured before starting |
|---|---|---|
| C1 | **Segmented control → soft-primary, everywhere.** Converge six implementations. | 6 rules, 4 paints: canonical `primary 14%` ✅ · `.reg-seg-opt` `primary .16` ✅ (Oleh approved this one on sight) · `.ff-modeseg-btn` and `.dcp-tab` `base-100`+primary text ◐ · `.dv-tab` and `.method-tab` **grey-on-grey** ❌ |
| C2 | Three drawers audited against the catalog: `Add an Airtable source`, `Add a destination`, `Connect Google Drive` | — |
| C3 | Review step: the green checks sit off the connector's centre line | — |
| C4/C5 | Space-home hero: drop the duplicate description at narrow, **keep the vertical rhythm** | the line duplicates what the hero says two rows below |
| C6 | Stepper: let steps use the full track; give wrapped rows a real gap | `gap: 0px`; row 1 uses **206.8 of 336 — 129.2px thrown away**; `row-gap: 0` is why the two rows have no separation |
| C7 | Base-selection: compress the columns, too much slack at narrow | — |
| C8 | The source drawer at 390 and 375 | prior faults in `S28-S31.md`: 4-row 147px tab column · Auto-add switch clipped 33→27px with its **label at 0px** · first base row at y=646 of 844 · **`ConfirmModal` controls 38→27px, a shared component that reaches every dialog** |

**The systemic point behind C1:** the canonical rule's own comment records grey-on-grey as *fixed on
2026-07-24* and warns *"a local copy is how Docs ended up grey-on-grey."* It then happened twice
more. This is not a restyle — it is deleting five private copies. `decision-button-system` already
says **Secondary = SOFT**, so Oleh is asking for what the system decided.

## ▶ Batch D — the auth screens

| | item | measured before starting |
|---|---|---|
| D1 | The two lines under the submit button disagree | `.auth-form-note` **12px / start** vs `.auth-footer-text` **14px / center**, stacked directly on each other |
| D2 | The error caption is enormous | `#login-error` computes **16px/24px**. Cause: it carries `fieldset-label`, and **that class matches ZERO rules in the compiled stylesheet** — written, never existed, so it inherits the card's 16px. Invisible to `css-guard` by construction: nothing is shadowed, there is no cascade to model |
| D3a | `Continue` must not read as ready before the form is | renders `btn-primary` from first paint |
| D3b | Errors must sit at the field that caused them | one summary line above the button; on a six-field form the user maps a sentence back to a field |

Constraint carried in: batch B fixed `showFormError` to **reveal first, then write** — a `role="alert"`
region is out of the a11y tree while `hidden`, so writing first announces nothing. Any per-field
mechanism must keep that order.

## ✔ The auth background image

Oleh supplied the RGBA original; the shipped WebP had degraded.

| | max | mean | size |
|---|---|---|---|
| was in the tree | 73 | 7.626 | **478 KB** |
| now, derived from his source | 64 | 7.556 | **28 KB** |

Same artwork to within 1% of mean, at **17× fewer bytes**. `auth.css` claimed "32 KB of WebP" the
whole time and the file had drifted to 478 KB — **no gate measures an asset**, so nothing caught it.
Original archived at `apps/web/design-assets/` (deliberately **not** `public/`, which ships to
users) with the re-export command and the verification statistics.

---

## ▷ Queued — the 404 page

Oleh: *"треба в handoff додати і створити сторінку 404. Якусь гарну в стилі Baseout — можна взяти
оцю ліву панель, яка зараз на авторизації, ці стилі, ці зображення, а посередині 404 і якийсь
меседж."*

**Read this before building it — the component does two jobs and only one of them is in scope.**

`views/NotFoundView.astro` branches on props:

1. **No props — an unknown PATH.** Rendered by `pages/404.astro` and `pages/[...slug].astro`.
   **This is the one Oleh means.**
2. **With props — a known page whose OBJECT is missing** (a source/destination/report/run id that no
   longer resolves). Rendered by four detail routes.

**Job 2 must not get the treatment.** Its header comment argues why (audit X-B, the not-found
contract): telling that reader "the page doesn't exist" is a lie, and sending them Home throws away
the list they came from. A full-bleed branded panel for a missing report would re-introduce exactly
the defect that contract was written to remove. It stays the documented empty-state card —
`pattern-empty-state` condition 1: 48px tile · 16px/650 title · one mechanism sentence at 44ch ·
exactly one exit at `btn-sm`.

**The fork to settle first, because it is architectural and not a style choice.** Both true-404
routes wrap in **`SidebarLayout`** with breadcrumbs `Home / 404`, so today the 404 renders *inside
the app shell*. The auth left panel lives in `AuthLayout` and is full-bleed and shell-less. So:

- **(a)** the 404 leaves the shell and becomes a full-bleed branded page — striking, but it strands
  a signed-in user who merely mistyped a URL: no sidebar, no way back into the product except one
  link; or
- **(b)** the shell stays and the rays treatment is applied to the *content area* — keeps the user
  oriented, and the brand moment is smaller.

An unknown path can be hit **signed-out as well as signed-in**, and those are different readers.
Worth deciding once rather than per-route.

**What comes with it either way:**
- `NotFoundView.astro:50` is a live `ds-audit` finding — an unsized `btn-primary`. Under Oleh's
  ruling 1 (all buttons converge to 32) it becomes `btn-sm`.
- The 404 is one of the zones the audit **never covered at narrow** — it needs a 390 pass, not just
  a desktop look.
- **A flow-registry entry.** `flow-registry.ts:745` covers the *stale deep-link* story (job 2). Job 1
  has no entry at all — that is precisely the "add it to the handoff" half of Oleh's ask, and the
  registry is what ties spec ↔ URL ↔ code ↔ status.
- The rays asset is now 28 KB (above), so reusing it costs almost nothing.

## ▷ Queued — still open from earlier

- **The five uncovered zones** Oleh is still walking: Integrations (in progress via C), creation
  forms, auth (D), Data Browse at 390, styleguide/404.
- **`storybook.ts` breaks three of its own stated rules** and has never been linted — it lives in
  `apps/design`, so `ds-lint` has never inspected the file that defines the rules `ds-lint`
  enforces (D34).
- **The styleguide destroys its own content below 1024** — a 561px min-content decision table inside
  a 44px box with `overflow-x: hidden`, while its own `pattern-responsive` says *compare down a
  column → pan*.
