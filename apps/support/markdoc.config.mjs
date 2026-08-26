// @ts-check
import { defineMarkdocConfig, component } from '@astrojs/markdoc/config';
import starlightMarkdoc from '@astrojs/starlight-markdoc';

/**
 * MARKDOC IS THE PORTAL'S COMPONENT SYNTAX, AND THE REASON IS WHAT IT FORBIDS.
 * ---------------------------------------------------------------------------
 * Oleh, 2026-08-24, deciding §5 of `openspec/changes/support-portal/research-docs-language-2026-08-20.md`.
 * The tree is 47 pages of prose written by people who do not write JSX. `.mdx` would give every one
 * of them an `import` block and — the part that actually decides it — would make inline JSX legal
 * forever, which over a documentation tree's life means it happens. Markdoc's `{% tag %}` syntax
 * needs no import line and has no escape hatch into code. That is the property being bought; one
 * dependency and a non-standard syntax are what it costs.
 *
 * THE EXTENSION IS `.mdoc`, NOT `.md`, AND THIS IS NOT CONFIGURABLE.
 * `@astrojs/markdoc@1.0.6` registers its content-entry type with `extensions: ['.mdoc']`
 * (`dist/content-entry-type.js:18`) — one hard-coded extension, no option to widen it. A `{% %}`
 * tag written in a `.md` file is not an error: it is passed through to the reader as literal text.
 * Starlight's `docsLoader()` adds `mdoc` to its glob only when it finds an integration named
 * `@astrojs/markdoc` in `context.config.integrations` (`loaders.ts:46-53`), so the integration in
 * `astro.config.mjs` is what makes these pages exist at all.
 *
 * MIXED EXTENSIONS ARE THE ACCEPTED STATE, and they are cheaper here than under `.mdx`: Markdoc is
 * a superset of Markdown that adds only `{% %}`, so renaming any remaining `.md` is a rename and
 * nothing else — no import block, no syntax to escape. Convert a page when it needs a tag.
 *
 * VERSIONS ARE PINNED BY WHAT IS INSTALLED, NOT BY WHAT IS LATEST. This app runs Astro 6.4.8 and
 * Starlight 0.40.0. `@astrojs/markdoc@2.x` peers `astro@^7`; `@astrojs/starlight-markdoc@0.7.0`
 * peers `@astrojs/starlight >=0.41.0`. Neither can be used here. The pair that fits is
 * `@astrojs/markdoc@1.0.6` (peer `astro@^6.0.0`) and `@astrojs/starlight-markdoc@0.6.0`
 * (peers `@astrojs/markdoc@^1.0.0`, `@astrojs/starlight >=0.38.0`). Raising either one means
 * raising Astro or Starlight first.
 *
 * THREE TAGS AND NO MORE (Oleh, same ruling). A documentation tree with a tag per idea becomes a
 * component library nobody reads:
 *   - `{% steps %}` — from the Starlight preset below, not ours. Numbered procedures.
 *   - `{% screenshot %}` — ours. The `<figure class="bo-shot">` markup three pages hand-write.
 *   - `{% linkcards %}` — ours. The end-of-page "Next" list, as a grid.
 * The preset also carries `aside · badge · card · cardgrid · code · filetree · icon · linkbutton ·
 * linkcard · tabitem · tabs`. Those are Starlight's own catalog, they arrive for free with the
 * preset, and they are not ours to prune. `{% linkcards %}` overlaps `{% cardgrid %}` +
 * `{% linkcard %}` DELIBERATELY: the preset pair asks an author to write two tag names and three
 * attributes per card, and ours takes the Markdown link list the pages already end with. If that
 * trade reads wrong on review, delete `linkcards` and use the preset pair — nothing else depends
 * on it.
 */
export default defineMarkdocConfig({
  extends: [starlightMarkdoc()],
  tags: {
    /* A product screenshot. Every shot exists TWICE — a raster cannot follow a theme — and
       `styles/support.css` (`.bo-shot`) does the swapping for all four states Starlight can be in.
       `src` is the path WITHOUT the `-light.png` / `-dark.png` suffix, which is the naming the
       three hand-written figures in `backups/` already use. */
    screenshot: {
      render: component('./src/components/markdoc/Screenshot.astro'),
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, required: true },
        width: { type: Number, required: true },
        height: { type: Number, required: true },
        caption: { type: String, required: false },
      },
    },
    /* Wraps a Markdown list of links and lays it out as cards. The children stay ordinary Markdown
       on purpose: a section index is written by whoever writes the section, and an attribute-shaped
       card is a different job from writing a sentence. */
    linkcards: {
      render: component('./src/components/markdoc/LinkCards.astro'),
      attributes: {},
    },
  },
});
