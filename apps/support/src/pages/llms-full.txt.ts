/**
 * `/llms-full.txt` — every documentation page's markdown, in one file.
 *
 * WHY BOTH THIS AND `/llms.txt`. The map is for choosing; this is for reading. A model with a large
 * context window and a question about Baseout can take this one file and stop fetching, which is the
 * whole reason the convention has two halves. A model with a small one takes the map instead and
 * fetches the two pages it needs. Neither is the other's fallback.
 *
 * ORDER MATTERS AND IT IS THE MAP'S. Same sections, same sequence as `/llms.txt`, so the two files
 * describe one documentation set rather than two shuffles of it, and a reader who has seen the map
 * can predict where in this file a page will be.
 *
 * EACH PAGE IS PRECEDED BY ITS TITLE AND ITS CANONICAL URL. The URL is what makes this file citable:
 * a model that answers out of it can point a person at the page the sentence came from. Without it
 * the answer is unattributable, which for support documentation is most of its value gone.
 *
 * ONE PAGE IN HERE IS NEARLY EMPTY AND THAT IS CORRECT. `index.mdx` is the landing: a `template:
 * splash` page whose whole body is an import of `SupportLanding.astro`, so its markdown source is
 * two lines of JSX and no prose. It is included anyway, because the alternative is a rule that
 * decides which pages are "real" documentation, and this portal already ruled that every page reads
 * as finished (`content.config.ts` carries the history of the two flags that were removed for
 * saying otherwise). A model that reads `<SupportLanding />` and moves on has lost nothing; a model
 * told the landing does not exist has been misinformed about the site.
 *
 * THE PAGE BOUNDARY IS A RULE OF EIGHTY `=`, AND THAT IS NOT DECORATION. The first version used
 * `---` between pages with `Source: <url>` as the header line, and both are strings a markdown BODY
 * can produce. `---` is a horizontal rule and a frontmatter fence; it happened to appear exactly 90
 * times for 90 pages, which looked like proof and was luck. `Source:` is worse, because **Source is
 * a first-class noun in Baseout's data model** — Organization, Space, Source, Destination, Base — so
 * sentences about it are everywhere, and one has already soft-wrapped a line to start with
 * `Source: ` in `start/signing-in`. A consumer splitting on the obvious field there reads 91 pages
 * out of 90 and cuts a paragraph in half.
 *
 * Eighty `=` at column zero is not something prose produces, and the loop below REFUSES TO BUILD if
 * a body ever contains it rather than emitting a file that silently mis-splits. The header fields
 * stay where they are; they are for a human reading the file, and the machine boundary is the rule.
 *
 * THE BODIES ARE RAW SOURCE. `.mdx` import lines and `.mdoc` `{% %}` tags appear verbatim;
 * `lib/docs-index.ts` argues why stripping them would be worse.
 */
import type { APIRoute } from 'astro';
import { getDocsPages, SITE } from '../lib/docs-index';

export const prerender = true;

/** The page boundary. Eighty `=` at column zero: see the header for what it replaced and why. */
const SEPARATOR = '='.repeat(80);

export const GET: APIRoute = async () => {
  const pages = await getDocsPages();

  const parts: string[] = [
    `# Baseout Support: full documentation`,
    ``,
    `> The complete text of every page at ${SITE}, ${pages.length} pages, concatenated.`,
    `> The map of the same pages, with one-line descriptions, is at ${SITE}/llms.txt`,
    ``,
  ];

  for (const page of pages) {
    /* FAIL THE BUILD RATHER THAN EMIT A FILE THAT MIS-SPLITS. If a page ever contains the separator,
       every consumer downstream of this reads one page as two and neither half is attributable. A
       throw here stops `astro build` with the offending page named — this is an endpoint, not a
       component rendered from MDX, so the throw is not swallowed and the failure is loud. */
    if (page.body.includes(SEPARATOR)) {
      throw new Error(
        `llms-full.txt: the body of ${page.url} contains the page separator (80 '='), which would ` +
          `split it into two unattributable halves. Change the separator here, not the page.`,
      );
    }

    /* The H1 that follows the rule is the page title. A page body starts at H2 in this documentation
       (Starlight renders the frontmatter title as the H1), so promoting the title to H1 here keeps
       one heading hierarchy across the whole file instead of 90 documents whose top level is H2. */
    parts.push(
      SEPARATOR,
      ``,
      `# ${page.title}`,
      ``,
      `Source: ${page.url}`,
      ...(page.description ? [``, page.description] : []),
      ``,
      page.body.trim(),
      ``,
    );
  }

  return new Response(parts.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
};
