/**
 * Every documentation page, with the four things a machine-readable surface needs from it: where it
 * lives, what it is called, what it claims to be about, and its markdown source.
 *
 * WHY THIS IS ONE MODULE AND NOT THREE COPIES. `/llms.txt`, `/llms-full.txt` and the per-page `.md`
 * twins all need the same list. Three endpoints each calling `getCollection('docs')` and each doing
 * its own slug arithmetic is three chances to disagree about what the root page's URL is, and the
 * disagreement would be invisible: every one of them would still build, still serve 200, and still
 * be wrong in a different place.
 *
 * DERIVED, NEVER DECLARED. The list comes from the content collection at build time. This repo has
 * been bitten twice by a hand-written array of pages drifting from the pages that exist
 * (`documented-platforms.ts` carries that story), and a map of the documentation that omits a page
 * is worse than no map: a reader who trusts it stops looking.
 *
 * EVERY PAGE IS IN IT. There is no `stub`, `draft` or `provisional` flag in `content.config.ts` and
 * there must not be one — both prior flags were removed by ruling (the portal is a demonstration and
 * every page reads as finished), and `draft` in particular is a reserved Starlight key that DELETES
 * pages from production builds. So there is no classification here that the human surface does not
 * also make. If the sidebar shows it, this shows it.
 */
import { getCollection } from 'astro:content';

/* Read off `astro.config.mjs`'s `site`. Hard-coding it here would be a second place to change it,
   and llms.txt is specified in absolute URLs, so the two must not drift. */
export const SITE = 'https://support.baseout.com';

export interface DocsPage {
  /** Collection id with no extension, e.g. `start/getting-started`. `index` for the landing. */
  id: string;
  /** Site-relative page URL, with the trailing slash Starlight serves: `/start/getting-started/`. */
  path: string;
  /** Absolute page URL. */
  url: string;
  /** Site-relative URL of the markdown twin: `/start/getting-started.md`. */
  mdPath: string;
  /** Absolute URL of the markdown twin. */
  mdUrl: string;
  title: string;
  /** Frontmatter `description`, or undefined. All 90 pages carry one today; see below. */
  description?: string;
  /** Raw markdown source, frontmatter stripped. */
  body: string;
  /** Top-level path segment, e.g. `start`. Empty string for the root page. */
  segment: string;
}

/* THE SECTION HEADINGS ARE THE SIDEBAR'S, WITH ONE DELIBERATE DIFFERENCE, and the difference is
   worth stating because it is the one place this file does not mirror the human surface exactly.
   `astro.config.mjs` scatters the 27 platform pages INTO the chapters they belong to: `What we back
   up` sits inside `Backing up`, `Connecting` inside `Sources and destinations`, and so on (Oleh,
   2026-08-20: a shelf of platforms sorts by THING while every other group sorts by JOB). Reproducing
   that here would mean either importing and walking the sidebar config from an endpoint, or copying
   its nesting by hand into the exact declared array this file exists to avoid.
   llms.txt is a flat map. Its job is that every page appears exactly once under a heading that says
   what it is about, and `Platform specifics` does that without pretending to be the sidebar.

   ORDER IS DECLARED, MEMBERSHIP IS NOT. A segment missing from this map still gets a section (see
   `sectionLabel` below), so adding `src/content/docs/security/` can never make its pages vanish from
   the map; it appends a `Security` heading at the end and someone notices. That is the failure mode
   worth having. */
const SECTION_ORDER = [
  'start',
  'backups',
  'restore',
  'connections',
  'schema',
  'data',
  'reports',
  'notifications',
  'platforms',
  'account',
  'troubleshooting',
  'reference',
  'api',
  'mcp',
  /* Added when the changelog section landed on 2026-08-25. The fallback had already put it here —
     an unmapped segment is title-cased and appended, which is the designed behaviour and is why
     nothing broke — but "correct by accident" and "correct" read the same in a diff and only one of
     them survives the next section. Declared, so the position is a decision. */
  'changelog',
] as const;

const SECTION_LABELS: Record<string, string> = {
  start: 'Start here',
  backups: 'Backing up',
  restore: 'Restoring',
  connections: 'Sources and destinations',
  schema: 'Your schema',
  data: 'Your data',
  reports: 'Reports and notifications',
  notifications: 'Reports and notifications',
  platforms: 'Platform specifics',
  account: 'Your account',
  troubleshooting: 'Troubleshooting',
  reference: 'Reference',
  changelog: 'Changelog',
  api: 'API',
  mcp: 'MCP',
};

const sectionLabel = (segment: string): string =>
  SECTION_LABELS[segment] ??
  /* Unmapped segment: title-case it rather than drop the pages. A heading nobody wrote is a
     smaller defect than a page nobody can find. */
  segment.replace(/(^|[-/])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());

/* THE ROOT PAGE'S ID IS `index`, NOT THE EMPTY STRING, and that is Starlight's convention rather
   than a guess: `astro.config.mjs` addresses the landing as `{ slug: 'index' }` in the same sidebar
   array where every other row is a path. Nested overviews are the other shape — `schema/index.md`
   arrives as `schema`, addressed as `{ slug: 'schema' }` — so only the root needs unwrapping.
   Both `/index` forms are stripped anyway, because being wrong about this is silent: the URL would
   simply be `/schema/index/`, which serves 404 and is a link nothing else in the build points at,
   so the dead-link pass in `smoke-support.mjs` would never see it. */
const idToPath = (id: string): string => {
  const trimmed = id === 'index' ? '' : id.replace(/\/index$/, '');
  return trimmed ? `/${trimmed}/` : '/';
};

/* The twin's filename. The root page is `/index.md`: `/.md` is not a name, and `/index.md` is the
   one form a reader would guess. */
export const idToMdPath = (id: string): string => {
  const trimmed = id === 'index' ? '' : id.replace(/\/index$/, '');
  return trimmed ? `/${trimmed}.md` : '/index.md';
};

/**
 * Every docs page, sorted by section (in `SECTION_ORDER`) and then by path within it.
 *
 * `entry.body` is the file's source with the frontmatter block removed. It is NOT rendered HTML and
 * it is not sanitised: the two `.mdx` pages carry their `import` lines and the eight `.mdoc` pages
 * carry their `{% %}` tags verbatim. That is deliberate. The contract of a `.md` twin is "the source
 * this page was written from"; a model reading `{% aside %}` learns the page has an aside, whereas a
 * regex that stripped tags would silently eat their contents the first time one wrapped a paragraph.
 */
export async function getDocsPages(): Promise<DocsPage[]> {
  const entries = await getCollection('docs');

  const pages: DocsPage[] = entries.map((entry) => {
    const id = entry.id;
    const path = idToPath(id);
    const mdPath = idToMdPath(id);
    const segment = path === '/' ? 'start' : path.split('/')[1]!;
    return {
      id,
      path,
      url: SITE + path,
      mdPath,
      mdUrl: SITE + mdPath,
      title: entry.data.title,
      /* NO INVENTED DESCRIPTIONS. Every one of the 90 pages carries a frontmatter `description`
         today (checked 2026-08-24), so this branch never fires — but a page added without one must
         appear in the map with no colon-clause rather than with a sentence a build script made up
         out of its first paragraph. A summary nobody wrote is a claim nobody checked. */
      description: entry.data.description,
      body: entry.body ?? '',
      segment,
    };
  });

  const rank = (segment: string) => {
    const i = (SECTION_ORDER as readonly string[]).indexOf(segment);
    return i === -1 ? SECTION_ORDER.length : i;
  };

  return pages.sort((a, b) => {
    const bySection = rank(a.segment) - rank(b.segment);
    if (bySection !== 0) return bySection;
    /* Unmapped segments all share the same rank, so they need a tiebreak of their own or their
       relative order is whatever the loader happened to return. */
    if (a.segment !== b.segment) return a.segment.localeCompare(b.segment);
    /* The root page leads its section; `/` sorts before `/start/...` anyway. */
    return a.path.localeCompare(b.path);
  });
}

/** The same pages, grouped into the sections `/llms.txt` prints as `## ` headings. */
export async function getDocsSections(): Promise<{ label: string; pages: DocsPage[] }[]> {
  const pages = await getDocsPages();
  const out: { label: string; pages: DocsPage[] }[] = [];
  for (const page of pages) {
    const label = sectionLabel(page.segment);
    /* Two segments map to one label (`reports` + `notifications`), so this merges by LABEL rather
       than by segment. They are adjacent in `SECTION_ORDER`, which is what makes one heading
       possible; if they were ever separated the merge would produce two headings with the same
       text, which is a thing to notice rather than to defend against here. */
    const last = out[out.length - 1];
    if (last && last.label === label) last.pages.push(page);
    else out.push({ label, pages: [page] });
  }
  return out;
}
