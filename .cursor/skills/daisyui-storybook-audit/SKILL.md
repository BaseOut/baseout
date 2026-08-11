---
name: daisyui-storybook-audit
description: Audit Baseout UI changes for Storybook-first, daisyUI-second governance. Use when authoring, reviewing, or refactoring UI in apps/web or apps/design; when adding components, changing Astro views, writing Storybook stories, updating /styleguide, or checking whether custom CSS/components are justified.
---

# daisyUI Storybook Audit

## Apply This Order

For every UI change:

1. **Storybook first** — Check `apps/web/src/components/ui/` and
   `apps/web/src/components/patterns/` and the matching `*.stories.ts`. Reuse an
   existing component before writing markup.
2. **daisyUI second** — If no Storybook component exists, use daisyUI markup/classes
   directly and update `apps/design/src/lib/storybook.ts` if the pattern belongs
   in `/styleguide`.

There is no third tier: no custom Astro wrappers, no scoped `<style>` blocks, and
no bespoke CSS for UI that Storybook or daisyUI already covers.

## Required Checks

- Open or inspect the relevant Storybook story before changing a tracked component.
- Inspect `/styleguide` data in `apps/design/src/lib/storybook.ts` for usage
  rules and provenance tags.
- Check daisyUI docs for a matching primitive before adding new markup.
- If adding `apps/web/src/components/**/*.astro`, update
  `apps/web/src/components/component-classification.json`.
- If adding or changing a tracked component, add or update the sibling
  `*.stories.ts` in the same change.
- Views must import UI only from `components/ui/*` or `components/patterns/*`.

## Verification

Run:

```bash
pnpm --filter @baseout/web audit:components
pnpm --filter @baseout/design typecheck
```

For behavior-bearing UI, also smoke it in `apps/design`; Storybook validates
structure and styling, not full Astro client-script behavior.

## Audit Output

When reviewing, report:

- **Reuse:** Which existing Storybook component or daisyUI primitive is used.
- **Catalog:** Which Storybook story and `/styleguide` entry cover the change.
- **Gaps:** Missing story, missing classification, missing styleguide entry, raw
  view markup, or behavior that only works outside Storybook.
