# D33 — The render gate walks states, not labels

**Rule in one sentence:** A declared smoke variant must reach a **different render**; a route that
reads a query parameter declares it, and a declared parameter the route does not read is a bug in
the gate, not a passing test.

## Why this option, not the alternative

The rejected alternative — "add the missing variants" — treats three separate symptoms and leaves
the mechanism. Three legs, all verified today:

1. **`/settings` declares six variants and none is a fixture** (`smoke.mjs:225` —
   `tab=security|billing|state=1|notifications|organization|developer`). `?fixture=trial|empty` is
   served by the harness and walked by nothing. **This is exactly how S32-F1 survived**: a Space
   invented for a user who has none, with a Delete Space button, on a route the gate calls covered.
2. **`/integrations/configure/bases` declares `fixture=empty`** (`smoke.mjs:243`) and
   `bases.astro:16-20` branches only on `capped` / `fits` — verified: `empty` falls through to the
   50-base fixture. The gate has been requesting the default page under an empty label since the
   variant was added, and reporting it green.
3. **`/login` and `/register` declare zero variants**, leaving ten guarded branches
   (`?state=sent|sso-error|challenge|wrong-code|lockout|backup-code|trusted-device|assoc|assoc-pending`
   plus `&entry=sso`) requested by nothing — each a different render behind a `switch`, which is
   what the VARIANTS table exists for. `/welcome`'s declared `fixture=trial` is a fourth instance:
   `resolveWelcome` reads only `?state=`, so the variant walks the bare route.

This is the **fourth** recorded gate blind spot (with `ds-audit`/`SchemaCanvas.tsx`,
`typecheck`/`.astro <script>`, and R-C's HTTP-200 not-found). The register now carries gate rows;
this is one of them.

## Surfaces changed

`.claude/hooks/smoke.mjs` only — the VARIANTS table plus one assertion pass:

- add `/login` and `/register` variants (all ten states, `&entry=sso`);
- add `fixture=trial` and `fixture=empty` to `/settings`;
- either give `bases.astro` an `empty` branch **or** drop the variant — declaring one the route
  cannot serve is worse than declaring none;
- drop or fix `/welcome`'s `fixture=trial`;
- one **content assertion** per declared variant (the file already has the shape at `smoke.mjs:366`,
  `{ path, present }`), so a variant that renders the same bytes as the bare route fails.

## storybook.ts

None. This is a gate, not a catalog element. Recorded in the register's gate track.

## Explicitly not changing

- `smoke`'s route derivation from `apps/design/src/pages/**` — that half is right and a new page is
  covered the moment it exists.
- `apps/web`. **No client PR comes out of this decision.** It is repo tooling, and it is the
  cheapest row in the wave.

## Members

Gate row **G-A** (this decision's own row) · causally: S32-F1 (S1), S28-F10 (S2), S36-F2's ten
unwalked branches. Those three stay filed on their own surfaces; this decision is why they were
invisible.

## How to verify done

`pnpm smoke` prints a variant count higher than today's and **fails** when
`/integrations/configure/bases?fixture=empty` returns the 50-base body; `/login?state=lockout`
appears in the printed route/variant list. Read the counts, not the tick.


---

## AMENDMENT 2026-08-14 — two more states the gate is green on and never reaches (X12-F4, X12-F6)

Both are harness-only. **No client PR**, so they can run in parallel with everything else and should
land before the fix waves — a gate that does not walk a state is not watching the fix.

- **X12-F4 (S3).** `/schema` declares seven variants (`fixture=empty` · `fixture=thin` · `ai=locked`
  · `ai=no-credits` · `wsgroup=0/1` · `detail=full/inventory/unknown`) and **zero `tab=`**, so **eight
  of Schema's nine tabs are requested by nothing** — the largest section in the product, walked at one
  tab. Compare `/reports/def-full` (`smoke.mjs:201`), which declares three `tab=` variants including a
  deliberately stale key. Add nine `tab=` lines.
- **X12-F6 (S3).** `/reports/[id]` reads **no `?fixture=`** — `apps/design/src/pages/reports/[id].astro`
  imports fixtures directly and `smoke.mjs:66` declares four ids and no fixture. So the report
  definition page has **no empty and no no-backups render at all**, in a repo whose entire preview
  model is `?fixture=`. This is why D13's empty states have never been seen by anyone.

**Note the compounding.** D17's verification is blocked on the same class of gap: three of the 28
empty-state families have never been seen empty because `/restore` ignores `?fixture=`, `bases.astro`
has no `empty` branch and `/settings` declares no fixture variant. **D33 is not tooling hygiene — it
is the precondition for verifying D17.**
