/**
 * The platforms this portal actually has documentation for — DERIVED, never declared.
 *
 * WHY THIS FILE EXISTS. `lib/platforms.ts` is the catalogue of platform IDENTITIES: name, mark,
 * colours, vocabulary. It is deliberately allowed to hold a platform we ship no pages for — the
 * `/handoff` comparison needs five identities to show what the portal looks like as platforms
 * scale, and Smartsheet and monday.com were added on 2026-08-21 for exactly that.
 *
 * The moment it did, four links on the landing began pointing at pages nobody has written:
 * `/platforms/smartsheet/connecting/`, `/platforms/monday/connecting/` and both
 * `/what-we-back-up/` — caught by `pnpm smoke-support`, invisible to `astro check` and to
 * `css-guard`. `PlatformStart.astro` was mapping over the whole catalogue to build hrefs, on the
 * assumption that an identity and a documentation tree are the same thing. They are not, and the
 * assumption was only ever true by accident.
 *
 * DERIVED, NOT A FLAG ON THE ENTRY. A `documented: true` field would be one more declared value
 * that nothing verifies — the failure recorded in `infra-declared-frontmatter-field-renders-nothing`
 * (`provisional: true` sat on seven pages, read by no component, every gate green). This reads the
 * filesystem at build time instead: a platform is documented when its `connecting` page exists.
 * Write the page and the card appears; delete it and the card goes, with nothing to remember.
 *
 * `import.meta.glob` is lazy here — it returns the PATHS and never pulls a page's content into a
 * bundle. Server-rendered components only; nothing here belongs in a client controller.
 */
import { PLATFORMS, type Platform, type PlatformId } from './platforms';

/* The `connecting` page is the test rather than the directory, because it is the page every card on
   the landing links to. A directory holding only an unlinked page would still produce a dead card. */
/* EVERY EXTENSION A PAGE CAN HAVE, and the list is the fragile part rather than the glob.
   Measured 2026-08-24: the three `connecting` pages were renamed `.md` → `.mdoc` when Markdoc
   landed, this pattern did not name `mdoc`, so the derived set went EMPTY — three pickers drew
   zero options, the landing strip drew zero cards, and the narrowed paragraph showed while nothing
   was narrowed. Deriving from the filesystem is still right; what was wrong was encoding an
   assumption about file extensions inside the derivation. Add any new content extension here the
   same day it is introduced. */
const CONNECTING = import.meta.glob('../content/docs/platforms/*/connecting.{md,mdx,mdoc,markdoc}');

const documentedIds = new Set<string>(
  Object.keys(CONNECTING)
    .map((path) => path.match(/platforms\/([^/]+)\/connecting\./)?.[1])
    .filter((id): id is string => Boolean(id)),
);

/** Platforms with a documentation tree, in catalogue order. Anything a VISITOR can click uses this. */
export const DOCUMENTED_PLATFORMS: Platform[] = PLATFORMS.filter((p) => documentedIds.has(p.id));

export const DOCUMENTED_PLATFORM_IDS: PlatformId[] = DOCUMENTED_PLATFORMS.map((p) => p.id);

export const isDocumented = (id: PlatformId): boolean => documentedIds.has(id);

/**
 * The English word for how many platforms are documented, for copy that counts them out loud.
 * `Show all three` was hard-typed in `PlatformStart.astro` and became a lie the hour a fourth
 * identity landed — a string that has to be remembered is a string that will not be.
 */
const WORDS = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'] as const;
export const documentedCountWord = (): string =>
  WORDS[DOCUMENTED_PLATFORMS.length] ?? String(DOCUMENTED_PLATFORMS.length);
