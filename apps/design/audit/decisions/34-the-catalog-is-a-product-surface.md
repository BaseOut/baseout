# D34 — The catalog is a product surface

**Rule in one sentence:** `storybook.ts` and `/styleguide` are held to the rules they publish —
`ds-lint`'s scope extends to them, and the page is readable and searchable on the machine an
implementer reads it on.

## Why this option, not the alternative

The rejected alternative — "it lives in `apps/design`, it is scaffolding, leave it" — is refuted by
`CLAUDE.md` itself: `apps/design/src/lib/storybook.ts` is **the single source of truth** the whole
build sequence points at. The mechanism is verified: `.claude/hooks/ds-lint.mjs:40-50` walks
`apps/web/src` and nothing else, so **the file that defines the rules `ds-lint` enforces has never
had a line inspected by it**. The cost was measured on the page itself: `.sb-guide-default` at
**9.5px**, `.sb-nav-head` **10.5px**, four more at 11px — five sizes below the 12px floor the same
page publishes — and a class-less `<input>` beside its own `input` entry.

Readability is the same failure in a different register. `.sb-shell` is `264px 1fr`
(`styleguide.astro:312`), so the entry column measures **126px at 390** and 504px at 768 while the
sidebar holds 264px unchanged; `.sb-guide-wrap` needs 561px of min-content in a 44px client box with
`overflow-x: hidden`, and `body.sb { overflow: hidden }` means the page cannot pan either. The one
document an implementer must read cannot be unreadable on the machine they read it on. And 112 of
113 entries carry `hidden`, so find-in-page over the rules returns nothing — the catalog can be read
one entry at a time or not at all.

I judged this **one decision, not three**: all three clauses land in the same two files, for the
same reader, in one PR, and none of them ports to the client monorepo.

## Surfaces changed

- `.claude/hooks/ds-lint.mjs` — scope gains `apps/design/src/lib/storybook.ts` and
  `apps/design/src/pages/styleguide.astro`. Expect a first red run; fix the six known sites, do not
  add `ds-ok`.
- `apps/design/src/pages/styleguide.astro` — the five sub-floor sizes to the floor; the search input
  onto the catalog's `input`; `.sb-side` collapses below ~900; `.sb-guide-wrap` gets
  `overflow-x: auto`; the fixed 40px canvas padding drops at narrow.
- Same file's search script — filter entry **text**, not only `data-name`, or offer "expand all".
- `audit/01-charter-ux.md:36` — "96 entries" → **113** (verified: `grep -c "^    id: '"` = 113).

## storybook.ts

No entry changes here — this decision is about the vessel the entries live in. The entries this wave
*adds* are named in D35 (`pattern-auth-screen`) and D38 (`pattern-object-registry`).

## Explicitly not changing

- The decision-table format (Use / When / Why with the Default row marked), the Do/Don't columns,
  the provenance tag, the live-preview-above-copyable-code order, and the `#<entry-id>` deep link
  with `hashchange`. At ≥1024 this is a genuinely strong reference document and every finding here
  is about the frame around it.
- `apps/web`. **No client PR comes out of this decision.**

## Members

S36-F14 (S2) · S36-F4 (S2, downgraded from S1 — see register) · S36-F15 (S2) · S36-F22 (S4).

## How to verify done

`node .claude/hooks/ds-lint.mjs --all` inspects `storybook.ts` (file count rises above 208) and
exits 0 · at 390 `.sb-guide-wrap` scrolls sideways and no WHY column is clipped mid-word · browser
find-in-page for a phrase inside an entry finds it · the charter says 113.


---

## AMENDMENT 2026-08-14 — the sharpest measurement of this decision yet (X01-F15), plus five catalog corrections

**X01-F15 (S3).** `pattern-table-toolbar`'s usageDont says *"Don't hand-copy the pager markup"* — and
**its own example hand-types a different pager**: text `Prev`/`Next` on `btn-outline`, a variant
`decision-button-system` deprecated, where the real one (`TablePager.astro:31-45`) is two square-ghost
chevrons. The same example also carries `checkbox-xs` and `badge-xs`, both below the SM/12px floor,
and a raw inline `style="background:color-mix(…)"`, which the no-raw-colour rule bans. **One example
breaks four of the catalog's own rules while forbidding the thing it demonstrates.** This is not a new
finding — it is a measurement of D34, and it is the one to quote.

**Corrections the sixth wave found while measuring. Each is a fact in `storybook.ts` that is wrong:**

| entry | says | is |
|---|---|---|
| `table` | `.tbl-colhead` is at `global.css:809` | **1851** |
| `table` | the label opacity is **50%** | the CSS says **`/.55`** |
| `table` | "20 files declared their own `<th>`" | **24** (and it was 23 four days ago) |
| `table`, `pattern-audit-table`, `pattern-table-toolbar` | all three examples demonstrate `<tr class="text-xs uppercase tracking-wider text-base-content/60">` | that is **not** `.tbl-colhead`, and `SpaceHomeView.astro:269` is this example copied verbatim — **the catalog is the source of the ninth header construction** |
| `pattern-segmented-control` | `reference:` names `.sb-segtrack` | `grep -rn segtrack apps/` → **0** (found in the fifth wave, restated here because it is the same class of defect) |
| `breadcrumbs` | `reference:` names `components/ui/Breadcrumbs.astro` | the component has **zero importers in `apps/web`** (D47) |
| `alert` | — | it is the **only Primitive with no `reference:` key at all** (D42) |
| `status-dot` | documents daisyUI's `status status-*` | `grep "status status-"` over `apps/web/src` → **0**; the product has never used it (D44) |

**The pattern across all eight is one thing:** the catalog's *rules* are good and its *facts* are
stale, because **`ds-lint` has never inspected `storybook.ts`** — it lives in `apps/design`, so the
file defining the rules `ds-lint` enforces is the one file exempt from them. That is D34's thesis and
these are its instances.
