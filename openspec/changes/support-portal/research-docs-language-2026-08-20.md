# Research + plan — the documentation's visual language (2026-08-20)

**Status: research recorded, work DEFERRED at Oleh's instruction (2026-08-20).** Nothing below is
built except the four items marked SHIPPED. Read this before picking the task back up.

The trigger: Oleh compared our pages to GitHub Docs and Stripe Docs and said ours "read like dumb
text in a row", and proposed dropping the body font to 14px.

---

## 1 · The finding that reframes the whole task

**Our typography already matches both references to within two pixels.** Measured against their
published CSS, ours read from `@astrojs/starlight/style/props.css` plus the brand bridge:

| | GitHub Docs | Stripe Docs | **Baseout** |
|---|---|---|---|
| Body size | 16px | 16px | **16px** |
| Line height | 24px (1.5) | 26px (1.625) | **28px (1.75)** |
| Content column @1440 | 720px | 814px | **736px** |
| Paragraph gap | 16px | 12px | **16px** |
| Paragraph → next h2 | 40px | 32px | **36px** |
| h1 | 32 / 600 | 32 / 700 | **32 / 600** |
| h2 | 24 / 600 | 21 / 700 | **24 / 600** |
| h3 | 20 / 600 | 16 / 700 | **18 / 600** |
| Inline code | 13.6px, no border | 14.4px, 1px border | **14px** |
| Callout | `border-left: 4px`, no fill | `border-left: 4px`, no fill | 4px + **background tint** |

So the font size was the wrong suspect, and **shrinking it would have made the one real typographic
defect worse.** That defect was the measure: 16px in a 733px column is 90 characters per line, and
`DESIGN.md` caps documentation prose at 65 to 75. A narrower character fits *more* of them on the
same line, so 14px in the same column gives roughly 103. The lever is the column, not the type.

Oleh's ruling after seeing the numbers: **body stays 16px.**

One value is still open and needs a computed read rather than an opinion: our line height of 1.75 is
the loosest of the three, and looser leading spreads an already-unbroken block further apart. GitHub
holds 1.5 at a similar measure.

## 2 · What is actually missing, in numbers

Counted across the whole tree, 49 pages and 17,833 words:

| | ours | GitHub, for comparison |
|---|---|---|
| Numbered procedures | **2 pages, 12 steps in total** | every task page |
| Inline code spans | **8** (against 91 bold spans in six sampled pages) | 1,526 on one reference page |
| Callouts | **6 across 49 pages** | 1 to 4 per page |
| Screenshots | 3 pages | ~1 per 9 steps |
| `<h3>` | **0 outside one page**, which is why the "on this page" rail is flat | on every long page |
| Tables | 7 pages | reference pages only |

The sharpest single example: `platforms/airtable/connecting.md`, a page called *Connecting
Airtable*, is 349 words of unbroken prose with no procedure, screenshot, callout or table.

**And one straight misuse of the convention both references share.** Bold means *a thing you click*;
inline code means *a literal or a stored value*. `reference/statuses.md` writes every status as
`**Connected**`. A status is not clickable. Every status in the portal should be `` `connected` ``.

## 3 · What Starlight already ships (read from the installed 0.40.0, not the latest docs)

The complete built-in set is ten components: `Aside · Badge · Card · CardGrid · FileTree · Icon ·
LinkButton · LinkCard · Steps · Tabs/TabItem`. Notes that matter:

- **`<Steps>` exists and is good.** A 28px circular numbered bullet in a left gutter, a 1px hairline
  connecting consecutive steps, content indented 44px, and anything Markdown works inside a step
  including images, tables and asides. `--sl-steps-start` continues numbering across a split.
  Neither GitHub nor Stripe has a step component (both use a bare `<ol>`), but they earn their
  procedure-ness through screenshot density and `## Step N:` headings, which we do not have. Take
  the free gutter.
- **Asides cannot gain a fifth type.** Colour is bound to `note | tip | caution | danger` in
  `asides.css`. A fifth semantic needs our own CSS.
- **Expressive Code is already installed** (`0.43.1`) with frames, titles, line and text
  highlighting, diff markers and a copy button, all with no setup.
- **Tables have nothing beyond plain Markdown.** No caption, no responsive wrapper.
- **The ToC is `{ minHeadingLevel: 2, maxHeadingLevel: 3 }`** and overridable per page. Ours is flat
  because the content has no h3, not because of configuration.
- Community plugins worth having: **`starlight-image-zoom`** (both references zoom screenshots) and
  **`starlight-links-validator`** (build fails on a broken internal link; we have 49 cross-linked
  pages).

## 4 · The two conventions worth copying verbatim

**Marking things in running text.** Both sites hold the same line and never mix it:

| Treatment | Means |
|---|---|
| `**bold**` | a thing you click |
| `` `code` `` | a literal you type, or a value the system stores |
| `"quotes"` | a field label you read but do not click |
| italic | a domain term on first use |

The ratio flips completely with the kind of page and never blends: a GitHub UI walkthrough has 0
code spans and 22 bold; their workflow reference has 1,526 code and 10 bold.

**Zero pills or badges in running prose on either site.** Both keep badges inside table cells.

**Callout taxonomy.** GitHub: fixed types, title derived from the type, and 129 Notes to 20 Warnings
to 12 Tips across twelve pages, with Warning reserved for irreversibility. Stripe: four colours and
a free-text title written by the author (*"Common mistake"*, *"Don't use real card details"*). With
more than one author, GitHub's fixed taxonomy is the safer one, and it is what free text degrades
into anyway. For us, `caution` is reserved for the two irreversible things: restore and cleanup.

## 5 · The decision that blocks half of it

`<Steps>`, `<Tabs>`, `<Card>`, `<LinkCard>` and `<FileTree>` **all require `.mdx`**. Only the `:::`
aside syntax and Markdown tables work in plain `.md`, and **47 of our 49 pages are `.md`**.

Three routes, and this is Oleh's call, to be made BEFORE any page is converted:

1. **Rename to `.mdx`.** No new dependency (`@astrojs/mdx` is already installed, two pages use it),
   but every file gains an `import` block, and inline JSX becomes possible, which over time means it
   will happen.
2. **Add the Markdoc preset.** `{% steps %}` with no import line. Costs one dependency and
   permanently forecloses inline JSX. Better fit for a portal written as prose by people who are not
   writing JSX.
3. **Convert only the pages that need a component**, leaving the rest `.md`. Cheapest now, and it
   means two authoring models in one tree forever.

## 6 · The plan, ordered by ratio of improvement to cost

**SHIPPED already, because none of it needed the decision above:**

- **The measure.** Prose and headings capped at 38rem, 75 characters. Tables, figures and code keep
  the full column, which is what both references do. The platform tab block was escaping the cap and
  running at 86 characters inside a frame; fixed.
- **A lede on every page.** Both references put exactly one summary sentence under the title. All 49
  of our pages already had it written in `description`, and Starlight was sending it to a `<meta>`
  tag where no reader would see it. Rendered in `DocsPageTitle.astro`. No content was edited.
- **Sidebar hierarchy.** A nested group was competing with its own chapter; size alone did not fix it
  because the eye reads register before size. Chapter stays sentence case, group is an uppercase
  caption **at the rows' own 13px** (11px/700 measured smaller and read larger: caps have no
  descenders and 700 against 400 outweighs two pixels).
- **Group names are subjects, not mechanisms.** "What we back up", "Restoring your data",
  "Connecting" over their three platforms, instead of "By platform".

**NEXT, in this order:**

1. **Inline code for every status, field and stored value.** Works in plain `.md`, no migration, no
   component. Convert the ~17 bold statuses in `reference/statuses.md` and the 24 in
   `reading-a-run.md`. Highest ratio on the list.
2. **`reference/statuses.md` restructured into Stripe's shape**: `Status | What it means | What you
   can do`, column one an anchor-linked code token, column three a bulleted list inside the cell.
   This is the page a reader hits when a run says `failed`.
3. **h3 subheadings** through the long pages, which also fills the empty "on this page" rail.
4. **Callout discipline**: raise the count from 6 across 49 pages toward GitHub's 1 to 4 per page,
   with `caution` reserved for restore and cleanup. **Open question:** both references use
   `border-left: 4px` with no fill, and `DESIGN.md` bans a coloured left border wider than 1px by
   name. That conflict needs a ruling before the aside is restyled.
5. **`<Steps>` on the procedure pages** — needs §5 decided first.
6. **A `<Screenshot>` component** wrapping the `<figure class="bo-shot">` markup that is already
   hand-written three times, plus `starlight-image-zoom`. Adopt GitHub's placement rule: the shot
   goes **inside the step**, right after the sentence it illustrates, and the alt text names the
   annotation.
7. **`<LinkCard>` grids** on the six section index pages, which are currently 140 words of prose and
   four bullets.
8. **GitHub's opening and closing bracket**: *"In this guide, you will:"* plus a list, mirrored by
   `## Next steps`. Costs nothing, needs no component, and is what makes their tutorials feel
   finished rather than stopped.

**Explicitly recommended against**, because zero instances exist across 24 reference pages:
`<details>` accordions, badges in running prose, and manufacturing code blocks to look technical.
