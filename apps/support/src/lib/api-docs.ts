/**
 * THE MANUALS — which paths belong to each one, what its sidebar groups are called, and where its
 * header item points.
 *
 * WHY IT EXISTS. Dan, 2026-08-21: "API and MCP documentation is a little different than 'how to use
 * the app' documentation. I'm thinking those may need their own top level menu links and their own
 * sidebars. I think we could create 1 new menu for 'API/MCP' and then have sections for both."
 *
 * Three places have to agree on the answer and none of them can see the other two: the header's
 * `isCurrent` (or `Docs` lights up while the reader is inside the API manual), `routeData.ts` (which
 * partitions the one configured sidebar into the ones the reader sees), and `DocsSidebar.astro`
 * (which must not offer a platform filter over a tree that holds no platform pages). So the answer
 * is held once, here — the same shape as `service-routes.ts`, and for the same reason.
 *
 * IT WAS A BOOLEAN UNTIL 2026-08-25 (`isApiDocsPath` and nothing else), because two manuals is the
 * one count at which a boolean is the honest model. Changelog is the third, so the model is a
 * REGISTRY now: every manual other than the product one declares its path prefixes and its
 * top-level sidebar group labels in the array below, and both consumers ask which manual a thing is
 * in rather than whether it is the special one. Adding a fourth is one entry here plus a sidebar
 * group in `astro.config.mjs`.
 *
 * THE FILE IS STILL CALLED `api-docs.ts` AND THAT NAME IS NOW TOO NARROW. It is kept because
 * `DocsSidebar.astro` imports `isApiDocsPath` from this path and that file was being edited by
 * somebody else while this was written; a rename is a two-line follow-up (this file plus that
 * import), not a decision to re-take.
 *
 * WHAT MUST STAY TRUE is that every `groupLabels` entry matches the `label` of a top-level group in
 * `astro.config.mjs` EXACTLY — the partition is by label, because that is the only identity a built
 * sidebar group carries. A rename in the config and not here silently puts that manual's groups back
 * into the product manual's sidebar, and every gate stays green. `smoke-support.mjs` names each
 * manual's routes in `REQUIRED_ROUTES` for exactly that reason.
 */

/** A manual that is NOT the product manual. The product manual is defined as the remainder. */
interface Manual {
  id: string;
  /** Path prefixes that put a reader inside this manual. */
  prefixes: readonly string[];
  /** Top-level sidebar group labels belonging to it, verbatim from `astro.config.mjs`. */
  groupLabels: readonly string[];
  /** The one page this manual's header item points at. */
  href: string;
}

const MANUALS: readonly Manual[] = [
  { id: 'api', prefixes: ['/api', '/mcp'], groupLabels: ['API', 'MCP'], href: '/api/' },
  /* ONE GROUP, NOT ONE PER YEAR. The years are `autogenerate`d out of `content/docs/changelog/`'s
     subdirectories, so `2027/` becomes a second year group without anybody editing a config — and
     without it having to be added here either, because the partition only ever sees the one
     top-level label above it. That is the whole reason the year groups are nested rather than
     declared at the top level: a top-level year would be a label to remember every January. */
  { id: 'changelog', prefixes: ['/changelog'], groupLabels: ['Changelog'], href: '/changelog/' },
];

const inManual = (m: Manual, pathname: string): boolean =>
  m.prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));

/** Which manual a path is in. `'product'` is the remainder, and is never declared. */
export const manualForPath = (pathname: string): string =>
  MANUALS.find((m) => inManual(m, pathname))?.id ?? 'product';

/** Which manual a top-level sidebar group belongs to, by its label. */
export const manualForGroupLabel = (label: string): string =>
  MANUALS.find((m) => m.groupLabels.includes(label))?.id ?? 'product';

/** The one page the API/MCP nav item points at. */
export const API_DOCS_HREF = '/api/';

/** The one page the Changelog nav item points at. */
export const CHANGELOG_HREF = '/changelog/';

/* Kept as its own export because `DocsSidebar.astro` and the header's `isCurrent` both ask exactly
   this question, and because "is the API manual current" is a different question from "is this
   documentation" — see the `isDocs` note in `Header.astro`. */
export const isApiDocsPath = (pathname: string): boolean => manualForPath(pathname) === 'api';
