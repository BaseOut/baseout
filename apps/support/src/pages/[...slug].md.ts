/**
 * `/<slug>.md` — the markdown twin of every documentation page.
 *
 * WHY. A model handed `https://support.baseout.com/backups/reading-a-run/` gets 180KB of HTML in
 * which the answer is wrapped in the header, the docs tree, the platform chips, the page-contents
 * rail, the chat dock, the feedback widget and the footer. The same page as `.md` is the prose and
 * nothing else, at the address a person can guess from the one they are already on. This is the
 * pattern Stripe, Anthropic and Vercel all settled on, and it is the only one of the three surfaces
 * here that a HUMAN also uses: paste the `.md` URL into a chat and the answer is grounded in the
 * page rather than in a summary of it.
 *
 * ── THE ROUTING QUESTION, AND WHAT WAS ACTUALLY FOUND ────────────────────────────────────────────
 * The worry was that `src/pages/[...slug].md.ts` collides with the `[...slug]` route Starlight
 * injects for the docs collection, since both claim the whole path space from the site root.
 * IT DOES NOT, and the reason is that Astro's route pattern for this file is `/[...slug].md`, not
 * `/[...slug]`: the `.md` is a literal suffix in the pattern, so the two routes are distinct and
 * `astro build` reports no collision. Checked by building: 90 `.md` files are emitted beside the 90
 * page directories, and `dist/account/billing.md` sits happily next to `dist/account/billing/`,
 * which is the one case in this tree where a page and a directory share a name.
 *
 * The failure this WOULD have had is worth writing down because it is silent rather than loud. Had
 * Starlight's route won the match, `/backups/reading-a-run.md` would have rendered the docs page for
 * slug `backups/reading-a-run.md`, which does not exist, so Starlight's 404 page would have served
 * at HTTP 200 in a static build. Not a build error, not a 404 in the gate, just a map page where the
 * markdown should be. That is why `smoke-support.mjs` asserts the BYTES of one twin start with the
 * YAML header below, and not merely that the route answers.
 *
 * ── FRONTMATTER: EMITTED, NOT PASSED THROUGH ─────────────────────────────────────────────────────
 * `entry.body` has the source frontmatter stripped, so a twin without a header of its own is a
 * nameless slab of prose: whoever opens it has to infer the page from the first heading, and there
 * is no heading, because Starlight renders the title from frontmatter and the bodies here start at
 * H2. So a small YAML header is emitted with the three facts the reader needs: what the page is
 * called, what it claims to be about, and the URL it came from.
 * It is NOT the file's own frontmatter re-serialised. `template: splash`, `prev: false`,
 * `platform: notion` and the sidebar keys are directives to Starlight about how to draw a page, and
 * a file that is not being drawn should not carry them: they would read as facts about the subject.
 * `source` is the one field here that no source file has, and it is the one that matters most, since
 * it is what makes a quotation out of this file traceable back to a page a person can open.
 */
import type { APIRoute, GetStaticPaths } from 'astro';
import { getDocsPages } from '../lib/docs-index';

export const prerender = true;

/* Double-quoted YAML, because a description is a sentence and sentences carry colons. Plain (bare)
   scalars break on `: `, and single quotes only escape themselves, which leaves a backslash in a
   Windows path to be misread by a strict parser. Escaping `\` then `"` covers the whole of what a
   double-quoted YAML scalar treats specially in this content, and the newline guard is there
   because a folded multi-line `description:` in a source file would otherwise emit a broken header
   rather than a wrong one. */
const yamlString = (value: string): string =>
  `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;

export const getStaticPaths: GetStaticPaths = async () => {
  const pages = await getDocsPages();
  return pages.map((page) => ({
    /* `params.slug` is the path with no leading slash and no `.md`: `backups/reading-a-run`. The
       root page is `index`, which is what `docs-index.ts` already calls it, so `/index.md` is its
       twin. An empty rest param would emit `/.md`, which is a dotfile named `md`. */
    params: { slug: page.mdPath.slice(1).replace(/\.md$/, '') },
    props: { page },
  }));
};

export const GET: APIRoute = async ({ props }) => {
  const { page } = props as { page: Awaited<ReturnType<typeof getDocsPages>>[number] };

  const header = [
    '---',
    `title: ${yamlString(page.title)}`,
    ...(page.description ? [`description: ${yamlString(page.description)}`] : []),
    `source: ${page.url}`,
    '---',
    '',
  ].join('\n');

  /* THIS HEADER DOES NOT SURVIVE THE BUILD, and it is here anyway. MEASURED 2026-08-24: the build
     writes `dist/backups/reading-a-run.md` as a file, and whatever serves `dist/` chooses the type
     from the extension. `astro preview` answered `Content-Type: text/markdown` (no charset), not the
     string below. So the `.md` extension is what actually delivers the promise, and the only place
     the real header can be checked is a request against the deployed site.
     Kept because it is the correct answer for this route and the day this app gains an adapter it
     becomes load-bearing without anyone remembering to add it. */
  return new Response(`${header}\n${page.body.trim()}\n`, {
    headers: { 'content-type': 'text/markdown; charset=utf-8' },
  });
};
