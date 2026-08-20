# D44 — `Badge.astro` is the only path for a status badge

**Rule:** Every status pill in the product is rendered by `components/ui/Badge.astro`, which takes a
registry entry (`{ label, tone }`) rather than a class string; no view composes `badge-*` classes by
hand, no colour is built by string interpolation, and the badge entry's colour reservations are
enforced by a check rather than by prose.

## Why this option, and what was rejected

**Oleh bound this on 2026-08-14: `Badge.astro` is the only path.** The measurement behind the ruling:
the component is the catalog's declared `reference:` for the `badge` entry, described as *"the pattern
every view should converge on"* — and it has **10 call sites in 6 files against 175 raw `badge-soft`
and 68 raw `badge-ghost` class strings** (all four counts lead-verified). The declared reference
renders ~5% of the app's badges. Two of its ten variants (`secondary`, `tertiary`) occur exactly once
app-wide: their own map line.

**Why the component must take a registry entry and not just a variant.** The component as it stands
cannot express what the app most needs, so all 28 registries re-implement the class strings — which
is the mechanism that produced 12 words for "it succeeded", 10 for "it failed", and five words that
change colour between surfaces. A `variant` prop would have `Badge` render the same 243 hand-decided
strings through a nicer door. This is the sub-clause of D19's blocking ruling #1 that the lead binds.

**Rejected: RATIFYing the class-string idiom and demoting `Badge.astro` from "reference".** That was
a live option — the app is 96% one way and the charter says RATIFY is not a lesser choice. It loses
on one measurement: **X08-F7**. A hand-composed dot builds its colour by string interpolation, and
`bg-base-content/40` has **zero literal occurrences** anywhere in `apps/web` or `apps/design`
(lead-verified), so Tailwind v4 never emits the utility and the neutral tone paints nothing — beside
a bare number, with no label and no `aria-label`, so the tone is the dot's only carrier of meaning.
A class-string idiom cannot be made safe against that; a component can, because the map is one place
and it is literal. The idiom is not merely inconsistent, it is capable of being **invisible**.

**Rejected: documenting the two dead variants.** They have no callers and no use case. `Badge.astro`'s
own header comment already records the right instinct — `outline` was removed as a prop because *"a
primitive that still OFFERS it hands out the violation the rule exists to prevent"*. The same argument
deletes `secondary` and `tertiary`.

## The concrete changes

1. **`Badge.astro` takes `{ label, tone }`**; `secondary` and `tertiary` are deleted; the dot is the
   component's, composed as `size-1.5 rounded-full bg-current` from a **literal static map**.
2. **`ReportBodyKpi.astro:164`'s interpolation is replaced by a static map** — four lines, and
   `connection-health-banner.ts:73-77` already does exactly this for the same four tones. Its dot is
   `size-2` where every other dot in the app is `size-1.5`; that goes with it.
3. **The banned pair is removed from the three live sites** — `badge-soft badge-neutral`, measured by
   the catalog at 1.34:1 text and 1.02:1 for the pill on dark ("the chip is invisible, shape and
   all"), currently drawing `Won't retry` on two lists of **permanently failed files**, where
   invisibility loses the one word saying the failure is final: `BackupRunDetailView.astro:530`,
   `BackupRunBaseView.astro:325`, `SchemaCanvas.tsx:646`. `inbox.ts:137` quotes the ban.
4. **Colour reservations are applied, one sweep:** `text-error` comes off the 13 benign
   `Clear filters` buttons (clearing a filter destroys nothing) and they become plain ghost;
   `badge-error badge-soft` comes off the Inbox count; `badge-soft badge-primary` comes off `Pro+`
   (a tier gate — D14), `Recommended` and `Always on`.
5. **The 243 raw class strings migrate to `<Badge>`, batched by surface.** This is the largest diff
   in the wave and it must not land as one PR: Schema, then Data, then Backups/Restore, then
   Reports, then the registries.

## Surfaces changed

Effectively every listing surface. **Order the batches so the S1 (`ReportBodyKpi`) and the three
banned-pair sites ship first, alone, in a small PR** — they are four files and they are the two
truth defects; the 243-site migration is cosmetic by comparison and can follow at its own pace.

## storybook.ts

- `badge`: `Badge.astro` is the only path, stated as a rule not a recommendation; the registry-entry
  signature; the deletion of the two variants recorded with the reason.
- **Fold `status-dot` into `badge`** (the X08-F2 RATIFY): `grep "status status-"` over `apps/web/src`
  → **0**; daisyUI's `status` component has never been used here and every dot is the hand-composed
  `bg-current` span the `badge` entry already prescribes. Two entries describe one thing and one has
  no callers. Mark `status-dot` "not used in Baseout — see `badge`".
- The colour-reservation table gains the instance list, so the clause stops reading as advisory.

## The three D19 rulings, and where they stand

1. **Badge as the only path — BOUND by Oleh, 2026-08-14.** This decision is that ruling's body.
2. **Is `Running` primary (catalog, 0 adopters) or warning (8 live sites)? — OPEN, Oleh only.** The
   `decision-density-sm-is-default` precedent says the shipped surfaces win and the catalog changes;
   the cost is that amber then carries in-progress *and* paused *and* degraded *and* stale *and*
   removed *and* tier-gate, i.e. "not green", which is not a meaning. **The lead will not bind a
   colour with that trade in it.** Until it lands, D19's state-word table has a word column and no
   colour column.
3. **Do the badge entry's prose rules become checks in `.claude/hooks/ds-checks.mjs`? — OPEN, Oleh
   only** (it is his gate, and switching on the `badge-soft badge-neutral` check turns `ds-lint` red
   in three files nobody is touching). **Recommendation: yes, for the two mechanically-detectable
   rules** — the banned pair, and error-red on a literal non-failure set. X08-F6 is a stated ban live
   in three files with every gate green; prose in the catalog is not enforcement.

## Not changing

The soft + semantic rule itself. · `Badge.astro`'s header comment (`:11-13`) — its argument for
removing `outline` is the argument for this whole decision and should be extended, not replaced. ·
The running-status spinner inside a status badge (`BackupsListView.astro:232` and six siblings): it
answers a different question from a button spinner — *the object* is working, not *your click* — and
it is consistent everywhere. Leave it.

## Verify

`grep -rn 'badge-soft badge-neutral\|badge-neutral badge-soft' apps/web/src` → 0 ·
`grep -rn 'bg-\${' apps/web/src` → 0 · `grep -c '<Badge' apps/web/src` approaches the badge count and
`grep -ro 'badge-soft' apps/web/src | wc -l` falls toward zero per batch · **and the measurement that
proves the S1: open `/reports` with a `neutral`-tone stat and read the computed `background-color` of
the KPI dot. `transparent` / `rgba(0,0,0,0)` before the fix, a real colour after. Nobody has taken
this reading yet.**


---

## AMENDMENT 2026-08-14 — the gate is switched on, the catalog gains the light theme, and `Running` is blue

### X-M20 (S3) — the two badge rules become checks. Oleh, ruling 6: **ENABLE**

The banned `badge-soft badge-neutral` pair, and error-red on a literal non-failure set. **A ban stated
in the catalog, live in three files, with every gate green, is not enforcement — it is prose.**
**Expect `ds-lint` to go red in three files nobody is touching** (`BackupRunDetailView.astro:530` ·
`BackupRunBaseView.astro:325` · `SchemaCanvas.tsx:646`) **and fix those three in the same PR rather
than `ds-ok`-ing them** — that is the point of switching it on. Add the **`rem`-literal sub-12px
check** in the same edit (D23 / X-M15 exists because `ds-checks.mjs` looks only for `*-xs` and ~10px).

### X-M21 (S2) — the ban's evidence documents one theme and the pair fails in both

`storybook.ts:732` gives 1.34:1 text and 1.02:1 pill *"on the dark theme"*, then says `badge-ghost` is
"17.4:1 in **BOTH** themes" — so the sentence's own shape invites the reading that light is fine.
Measured on the live element, canvas-resolved through `oklab` and computed to WCAG 2.x:

| | dark (`baseout`) | light (`baseout-light`) |
|---|---|---|
| text vs pill | **1.34** | **4.35** |
| pill vs page behind | **1.02** | **1.11** |
| `badge-ghost` in the same slot | 17.40 | 16.29 |

**Fails AA 4.5:1 for text in both** (12px/600 is not large text, so light misses by 0.15) **and the
3:1 UI threshold for the pill in both — the chip has no readable text and no discernible shape in
either theme.** The dark figures reproduced the catalog's **to the digit** by an independent method, so
the entry needs the light numbers **added, not revised**. The invisible word is `Won't retry` on two
lists of permanently failed files — **the copy is correct, terse and must not be "fixed"; the colour is
what destroys it.** `badge-ghost` is confirmed as the right replacement in both themes.

**Citation correction:** the dark theme is `data-theme="baseout"`. **There is no `baseout-dark`**
(`lib/theme.ts:13-14`) — see D20 / X-M12.

### `Running` is **primary (blue)**. Oleh, ruling 5

D19 is complete and its state-word table now has a colour column. **Eight live amber sites change, and
the eighth is a different word for the same state:** seven `Running` sites
(`BackupsListView.astro:45` · `BackupRunDetailView.astro:183`, `:199` · `BackupRunBaseView.astro:103`,
`:111` · `RestoreHistoryView.astro:60` · `RestoreView.astro:534`) plus
**`ReportDefinitionView.astro:235`, `Generating`**. **The ruling covers the STATE, not the string.**
The colour lives in the registry this component reads — **do not do the eight edits by hand ahead of
the component, that is the same edit twice.**

**Count corrected:** raw `badge-soft` is **176**, not 175 (`/usr/bin/grep -a`; the extra site is
`DataBrowse.astro`, register row X-M19). `badge-ghost` 68 ✓, `<Badge` 10 call sites in 6 files ✓.
