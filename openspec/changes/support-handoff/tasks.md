# Tasks

## 1. The registry and the route

- [ ] 1.1 `src/lib/handoff-registry.ts`: the types from `design.md` §6 plus every row in §5, with
      the built ones carrying real `href`s and the planned ones carrying `null`.
- [ ] 1.2 `src/pages/handoff.astro`: grouped by surface, status legend, one line per row, the URL
      shown and copyable. Standalone chrome — it is a meta page, not a docs page.
- [ ] 1.3 Exclusions: `noindex`, out of the sitemap, path added to `search-modal.ts`'s exclusion,
      absent from `Header.astro`.

## 2. The comparisons

- [ ] 2.1 The platform-count row: 1 · 2 · 3 columns over live iframes carrying `?platform=`, lazy,
      each labelled with what to look at. Four surfaces: landing strip · docs sidebar · search
      modal · roadmap scope.
- [ ] 2.2 The auth row: signed-out vs signed-in against the same contact door, side by side.
- [ ] 2.3 A width control on each comparison (the portal's own breakpoints, not arbitrary numbers)
      so the client can see the narrow case without resizing the window.

## 3. Keep it honest

- [ ] 3.1 Add every non-null `href` in the registry to `pnpm smoke-support`'s route list, so a row
      that stops reproducing its state fails a gate instead of aging quietly.
- [ ] 3.2 Verify in a real browser at 1440 and 390 — the page is a grid of iframes, which is exactly
      the shape that measures fine and looks wrong.

## 4. Blocked on a decision

- [ ] 4.1 The fifth column: two more platform identities in `platforms.ts` (name, mark with sourced
      provenance, vendor colours, vocabulary). Recommendation Smartsheet + Monday.com — `design.md`
      §7 Q1.
