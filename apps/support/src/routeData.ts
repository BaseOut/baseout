/**
 * THREE SIDEBARS OUT OF ONE CONFIGURED TREE.
 *
 * HOW STARLIGHT 0.40 ACTUALLY DOES THIS. There is no per-section sidebar option: `sidebar` in
 * `astro.config.mjs` is one global tree, and the only per-page escape hatch Starlight documents is
 * the `sidebar` prop on `<StarlightPage>`, which is for hand-written `.astro` pages and cannot
 * reach a content-collection entry. The supported mechanism for a content page is ROUTE MIDDLEWARE
 * (`routeMiddleware:` in the config, `defineRouteMiddleware` here): it runs on every render with the
 * fully-built route data in hand, and `starlightRoute.sidebar` is a documented, writable field.
 *
 * SO WE FILTER RATHER THAN BUILD. The API, MCP and Changelog groups are declared in
 * `astro.config.mjs` beside the ten product groups, which means Starlight resolves their slugs,
 * hrefs, labels, `isCurrent` flags and collapse state exactly as it does for every other group. This
 * file only decides which part of that tree the reader is standing in. Building a second tree by
 * hand would mean owning href formatting, the current-page test and the collapse state to gain
 * nothing.
 *
 * IT WAS A BOOLEAN AND IS NOW A NAME (2026-08-25). With two manuals the filter could read
 * `isApiGroup === isApiPath` and be right; a third manual makes that expression quietly wrong in
 * both directions — a changelog reader would have got the ten product chapters, and a product
 * reader the changelog. So both sides now ask `lib/api-docs.ts` WHICH manual they are, and the
 * filter is an equality between two names. `'product'` is the remainder and is never declared,
 * which is what keeps a newly added product chapter working without being registered anywhere.
 *
 * THE CHANGELOG'S YEAR GROUP IS RE-NESTED BY MONTH (2026-08-26), and this is the one place in the
 * file that BUILDS rather than filters. `lib/changelog.ts` carries the argument for deriving the
 * month instead of filing entries in month directories; what belongs here is why the rebuild is
 * safe. Every link inside the new month groups is the object Starlight already resolved — same
 * href, same label, same `isCurrent` — so nothing about a link is re-derived, only which group
 * holds it. The pruning below then reads the rebuilt tree, which is why this runs before it.
 *
 * PAGINATION IS PRUNED, NOT RECOMPUTED, and that is deliberate. Starlight computes prev/next from
 * the WHOLE sidebar before this runs, so each seam between manuals produces two wrong links: the
 * last page on one side offers the first page on the other as "next", and vice versa. Dropping any
 * link that is no longer in this page's own sidebar fixes every seam at once — including the two the
 * changelog just added — and leaves every `prev:`/`next:` frontmatter override (`index.mdx` sets
 * both to `false`) untouched, which a recompute would silently overwrite.
 */
import { defineRouteMiddleware } from '@astrojs/starlight/route-data';
import type { StarlightRouteData } from '@astrojs/starlight/route-data';
import { manualForGroupLabel, manualForPath } from './lib/api-docs';
import { changelogPlacementBySlug, type ChangelogMonth, type ChangelogPlacement } from './lib/changelog';

type SidebarEntry = StarlightRouteData['sidebar'][number];
type SidebarLink = Extract<SidebarEntry, { type: 'link' }>;

const flatten = (entries: SidebarEntry[]): SidebarLink[] =>
  entries.flatMap((entry) => (entry.type === 'group' ? flatten(entry.entries) : [entry]));

type SidebarGroup = Extract<SidebarEntry, { type: 'group' }>;

const slugOf = (href: string): string => href.split('/').filter(Boolean).pop() ?? '';

/**
 * One year group in, one group per month out, newest first.
 *
 * A MONTH IS OPEN WHEN IT HOLDS THE READER OR WHEN IT IS THE NEWEST, and collapsed otherwise. The
 * first half is not a nicety: Starlight marks the current page with `isCurrent` and paints it, and
 * a collapsed parent would hide the one row the reader is standing on. The second is what keeps
 * `/changelog/` useful on arrival — the latest month is the reason anybody opens a changelog, and
 * a tree that greets them fully closed asks for a click to say nothing.
 *
 * A link whose slug is in no month keeps its place directly under the year rather than being
 * dropped. That is the undated entry `lib/changelog.ts` refuses to throw on, and losing it from the
 * sidebar while it still renders on the hub would be the two surfaces disagreeing — the failure the
 * whole derived-list rule exists to prevent.
 */
const nestByMonth = (
  year: SidebarGroup,
  placements: Map<string, ChangelogPlacement>,
): SidebarGroup => {
  const grouped = new Map<string, { month: ChangelogMonth; links: { entry: SidebarEntry; rank: number }[] }>();
  const ungrouped: SidebarEntry[] = [];

  for (const entry of year.entries) {
    const placement = entry.type === 'link' ? placements.get(slugOf(entry.href)) : undefined;
    if (!placement) {
      ungrouped.push(entry);
      continue;
    }
    const bucket = grouped.get(placement.month.key);
    if (bucket) bucket.links.push({ entry, rank: placement.rank });
    else grouped.set(placement.month.key, { month: placement.month, links: [{ entry, rank: placement.rank }] });
  }

  if (grouped.size === 0) return year;

  const newest = [...grouped.keys()].sort((a, b) => b.localeCompare(a))[0];

  const entries: SidebarEntry[] = [...grouped.values()]
    .sort((a, b) => b.month.key.localeCompare(a.month.key))
    .map(({ month, links }) => {
      const ordered = links.sort((a, b) => a.rank - b.rank).map(({ entry }) => entry);
      return {
        type: 'group',
        label: month.label,
        entries: ordered,
        collapsed: month.key !== newest && !flatten(ordered).some((link) => link.isCurrent),
        badge: undefined,
      };
    });

  return { ...year, entries: [...entries, ...ungrouped] };
};

export const onRequest = defineRouteMiddleware(async (context) => {
  const route = context.locals.starlightRoute;
  const manual = manualForPath(context.url.pathname);

  route.sidebar = route.sidebar.filter((entry) => manualForGroupLabel(entry.label) === manual);

  if (manual === 'changelog') {
    const placements = await changelogPlacementBySlug();
    route.sidebar = route.sidebar.map((entry) =>
      entry.type === 'group'
        ? { ...entry, entries: entry.entries.map((child) => (child.type === 'group' ? nestByMonth(child, placements) : child)) }
        : entry,
    );
  }

  const reachable = new Set(flatten(route.sidebar).map((link) => link.href));
  const { prev, next } = route.pagination;
  route.pagination = {
    prev: prev && reachable.has(prev.href) ? prev : undefined,
    next: next && reachable.has(next.href) ? next : undefined,
  };
});
