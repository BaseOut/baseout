# React islands — governance carve-out

These `.tsx` files are **React islands**, hydrated `client:visible`. They exist
**only** for the Schema Docs feature (`openspec/changes/shared-schema-docs §5`):

- `DocBodyEditor.tsx` — the **Plate** ([platejs.org](https://platejs.org)) rich-text editor for a document body.
- `DocDiagram.tsx` — the **React Flow** ([@xyflow/react](https://reactflow.dev)) mini-diagram canvas saved with a document.
- `DocsTab.tsx` — the self-contained Docs authoring island (list + editor + tags + links + diagrams), mounted in `views/SchemaView.astro`.

## Why these are an exception to §4.2 (Storybook/daisyUI-first)

The `apps/web` component governance (CLAUDE.md §4.2, enforced by
`src/components/component-classification.test.ts`) requires every
`src/components/**/*.astro` to be a Storybook-cataloged primitive/pattern or
direct daisyUI markup — **no custom components**. daisyUI provides **neither a
rich-text editor nor a node-graph canvas**, so these surfaces cannot be built
from daisyUI primitives. They are a **documented carve-out**:

- Islands are authored as **`.tsx`, never `.astro`** — so they are intentionally
  outside the `.astro`-only classification audit. `islands-governance.test.ts`
  asserts no `.astro` ever lands here (which would silently bypass the
  daisyUI-first gate).
- The feature's UI (incl. these islands + the carve-out) is documented in the
  design spec at `apps/design/specs/10a-schema-docs.md`.
- Astro's Container API (used by Storybook here) can't render `.tsx` islands and
  doesn't run scripts, and these libs are client-only — so the island's pure
  logic is unit-tested (`src/lib/schema-docs/editor-logic.test.ts`) and the
  rendered editor/canvas is validated in the live app, not Storybook.

## Rules for new islands here

1. Add islands **only** when daisyUI/Storybook genuinely can't express the
   surface (rich text, canvas, etc.). Reach for daisyUI first.
2. Keep them scoped to the feature that needs them, hydrated `client:visible`,
   so the heavy bundle never loads on unrelated pages.
3. Style with daisyUI/theme tokens — no bespoke CSS frameworks.
4. Never add an `.astro` file to this directory.
