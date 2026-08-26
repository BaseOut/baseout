/**
 * `/llms.txt` — the map of this documentation, for a machine.
 *
 * WHAT IT IS. The llmstxt.org convention: one `#` heading naming the product, one `>` blockquote
 * saying what it is, then `## ` sections of `- [Title](url): description` rows. A model that fetches
 * this once knows every page that exists and what each is about, and can then fetch the one it
 * needs. The alternative it falls back to without this file is guessing URLs off a sitemap, or
 * scraping rendered HTML and reading the sidebar, the header, the chat dock and the feedback widget
 * as if they were prose.
 *
 * THE DESCRIPTIONS ARE THE PAGES' OWN. They come from frontmatter, never from the body, and a page
 * without one prints as a bare link with no colon-clause. See `lib/docs-index.ts` for why.
 *
 * STATIC. This app declares no `output` and no adapter, so this endpoint runs at build time and
 * emits a file. Nothing here may read the request.
 */
import type { APIRoute } from 'astro';
import { getDocsSections, SITE } from '../lib/docs-index';

export const prerender = true;

/* The blockquote is the one sentence a model reads before anything else, so it names the product,
   the job and the three platforms rather than describing the documentation. "Support portal for a
   backup tool" is true of a hundred sites. */
const TAGLINE =
  'Baseout backs up, restores, and inspects the data in your Airtable, ClickUp, and Notion workspaces: scheduled backup runs to your own destination, point-in-time restores, and a browsable copy of your schema, records, attachments, and comments.';

/* The one thing a map cannot express in a link row: how to get the pages themselves. Both notes
   below are addresses, not prose, which is what keeps this file a map. */
const NOTES = [
  `Every page below is also available as raw markdown at the same URL with the trailing slash replaced by \`.md\`, for example ${SITE}/start/getting-started.md`,
  `The full text of every page, concatenated in one file: ${SITE}/llms-full.txt`,
];

export const GET: APIRoute = async () => {
  const sections = await getDocsSections();

  const lines: string[] = [`# Baseout Support`, ``, `> ${TAGLINE}`, ``];
  for (const note of NOTES) lines.push(note, ``);

  for (const section of sections) {
    lines.push(`## ${section.label}`, ``);
    for (const page of section.pages) {
      lines.push(
        page.description
          ? `- [${page.title}](${page.url}): ${page.description}`
          : `- [${page.title}](${page.url})`,
      );
    }
    lines.push(``);
  }

  return new Response(lines.join('\n'), {
    headers: {
      /* `text/plain` and not `text/markdown`, and this one is against the twins two files over.
         llms.txt is specified as a plain-text file with a `.txt` extension, and the point of it is
         that anything at all can read it. A `text/markdown` header on a `.txt` URL is the kind of
         mismatch that makes a fetcher hesitate. The `.md` twins are the opposite case and carry
         `text/markdown` for the same reason: the extension and the type agree.
         BOTH ARE ADVISORY IN THIS BUILD. Measured 2026-08-24: a static build emits a file and the
         server picks the type off the extension, so `astro preview` returns `text/plain` here
         regardless of this line. `[...slug].md.ts` carries the full note. */
      'content-type': 'text/plain; charset=utf-8',
    },
  });
};
