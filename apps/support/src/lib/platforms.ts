/**
 * The platforms Baseout backs up, held once.
 *
 * WHY A DATA FILE AND NOT PROSE. We measured it before building anything: across the 38
 * documentation pages, "Airtable" appears in 60 sentences on 22 pages, and the large majority are a
 * NOUN SWAP — "Baseout reads your Airtable and does not change it" is true of ClickUp with one word
 * changed. Those 22 pages are a distributed exception list, and the moment a second platform lands,
 * adding it doubles each MENTION rather than each page, which no page-level tool can see. This file
 * is what stops a fact of that kind being hand-typed in twenty-two places.
 *
 * It is the same mechanism Segment's connector docs use (a catalog file feeding a dossier block),
 * minus the API call, and Nango's (`providers.yaml`). In every one of those systems the generated
 * part is the BOXES and the prose stays hand-written. That division holds here too.
 *
 * THE VOCABULARY IS THE POINT. The steps are identical on every platform; what each one calls the
 * thing you are choosing between is not. A reader who knows Airtable reads "Base" and pictures the
 * right object; the same sentence with "Teamspace" means nothing to them and everything to a Notion
 * reader. Anything that needs the reader's own noun reads it from here.
 *
 * BRAND MARKS ARE THE ONE ICON EXEMPTION. `DESIGN.md` is Lucide-only for UI, "the only exception is
 * brand/social logos, which have no Lucide equivalent". A platform's own mark is exactly that, and
 * it is what lets a reader recognise a chip without reading it.
 *
 * THEY WEAR THEIR OWN COLOURS, and every value here is the vendor's, never ours (Oleh, 2026-08-20:
 * "let it be the official colour from those apps' documentation, do not invent random ones").
 * Provenance, because a brand colour taken on trust is a brand colour that drifts:
 *
 *   Airtable — the full-colour mark ALREADY IN THIS REPO at `apps/web/public/airtable.svg`, three
 *     shapes plus a fold shadow: #ffbf00, #26b5f8, #ed3049. It shipped with the product; there was
 *     no reason to go looking for another one.
 *   ClickUp — geometry from Simple Icons, colours from ClickUp's own brand guidance: the mark is an
 *     upward arrow over a semi-circle, the arrow carrying a pink-to-orange gradient and the arc a
 *     blue one. #FF02F0, #FC6D2D, #6647F0 and #0091FF are their published brand hexes. Their asset
 *     URLs all serve an app shell rather than the SVG, so the shapes are Simple Icons' and only the
 *     paint is ours to place.
 *   Notion — deliberately monochrome, and that IS the brand: black on light, white on dark. Its
 *     paths carry no fill so `currentColor` governs them, and the per-theme rule that sets that
 *     colour is `.bo-mark-notion` in `support.css` (#191919 on light, near-white on dark — their
 *     published near-black, not a pure #000). The value lives in the stylesheet rather than here
 *     because it has to change with the theme and these fills cannot; this line is the pointer, so
 *     the provenance record is complete in one place even though the paint is not.
 *     Painting it in a hue to "match" the others would be the only invention on this list.
 */
export type PlatformId = 'airtable' | 'clickup' | 'notion';

/** One shape of a brand mark. `fill` absent means `currentColor`, which is how a monochrome brand
 *  follows the theme. */
export interface MarkPath {
  d: string;
  fill?: string;
  opacity?: string;
}

export interface Mark {
  viewBox: string;
  /** Gradient definitions, verbatim SVG. Ids are global to the document, so they are namespaced. */
  defs?: string;
  paths: MarkPath[];
}

export interface Platform {
  id: PlatformId;
  name: string;
  mark: Mark;
  /** What the platform calls its own furniture, outermost first. */
  vocab: {
    /** The thing you pick when choosing what to protect. */
    top: string;
    /** What that thing holds. */
    mid: string;
    /** One row of data. */
    row: string;
    /** One column of data. */
    col: string;
  };
}

export const PLATFORMS: Platform[] = [
  {
    id: 'airtable',
    name: 'Airtable',
    mark: {
      viewBox: '0 0 256 215',
      paths: [
        {
          d: 'M114.259 2.701L18.86 42.176c-5.305 2.195-5.25 9.73.089 11.847l95.797 37.989a35.54 35.54 0 0 0 26.208 0l95.799-37.99c5.337-2.115 5.393-9.65.086-11.846L141.442 2.7a35.55 35.55 0 0 0-27.183 0',
          fill: '#ffbf00',
        },
        {
          d: 'M136.35 112.757v94.902c0 4.514 4.55 7.605 8.746 5.942l106.748-41.435a6.39 6.39 0 0 0 4.035-5.941V71.322c0-4.514-4.551-7.604-8.747-5.941l-106.748 41.434a6.39 6.39 0 0 0-4.035 5.942',
          fill: '#26b5f8',
        },
        {
          d: 'm111.423 117.654l-31.68 15.296l-3.217 1.555L9.65 166.548C5.411 168.593 0 165.504 0 160.795V71.72c0-1.704.874-3.175 2.046-4.283a7.3 7.3 0 0 1 1.618-1.213c1.598-.959 3.878-1.215 5.816-.448l101.41 40.18c5.155 2.045 5.56 9.268.533 11.697',
          fill: '#ed3049',
        },
        /* The fold. Black at 25% rather than a fourth hue, which is how the source asset draws it. */
        {
          d: 'm111.423 117.654l-31.68 15.296L2.045 67.438a7.3 7.3 0 0 1 1.618-1.213c1.598-.959 3.878-1.215 5.816-.448l101.41 40.18c5.155 2.045 5.56 9.268.533 11.697',
          fill: '#000000',
          opacity: '.25',
        },
      ],
    },
    vocab: { top: 'Base', mid: 'Table', row: 'Record', col: 'Field' },
  },
  {
    id: 'clickup',
    name: 'ClickUp',
    mark: {
      viewBox: '0 0 24 24',
      defs:
        '<linearGradient id="bo-cu-arc" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#6647F0"/><stop offset="1" stop-color="#0091FF"/>' +
        '</linearGradient>' +
        '<linearGradient id="bo-cu-arrow" x1="0" y1="1" x2="1" y2="0">' +
        '<stop offset="0" stop-color="#FF02F0"/><stop offset="1" stop-color="#FC6D2D"/>' +
        '</linearGradient>',
      paths: [
        /* The arc. Blue, per their guidance that the semi-circle runs dark blue to bright. */
        {
          d: 'M2 18.439l3.69-2.828c1.961 2.56 4.044 3.739 6.363 3.739 2.307 0 4.33-1.166 6.203-3.704L22 18.405C19.298 22.065 15.941 24 12.053 24 8.178 24 4.788 22.078 2 18.439z',
          fill: 'url(#bo-cu-arc)',
        },
        /* The arrow. Pink into orange, the other half of their gradient pair. */
        {
          d: 'M12.04 6.15l-6.568 5.66-3.036-3.52L12.055 0l9.543 8.296-3.05 3.509z',
          fill: 'url(#bo-cu-arrow)',
        },
      ],
    },
    vocab: { top: 'Space', mid: 'List', row: 'Task', col: 'Custom Field' },
  },
  {
    id: 'notion',
    name: 'Notion',
    mark: {
      viewBox: '0 0 24 24',
      paths: [{ d: 'M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.634-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z' }],
    },
    vocab: { top: 'Teamspace', mid: 'Database', row: 'Page', col: 'Property' },
  },
];

export const PLATFORM_IDS = PLATFORMS.map((p) => p.id);

export function platform(id: PlatformId): Platform {
  const found = PLATFORMS.find((p) => p.id === id);
  /* Loud rather than silent: a typo in a frontmatter field would otherwise render an empty chip and
     look like a styling bug for a week. */
  if (!found) throw new Error(`Unknown platform: ${id}`);
  return found;
}

/**
 * Returns the mark with every gradient id suffixed, so one document can hold many copies.
 *
 * WHY THIS IS NOT OPTIONAL. An SVG paint server is referenced by a document-global id, and a page
 * renders these marks six or more times. The first version of `PlatformMark.astro` argued that
 * duplicate ids were harmless "since every definition here is byte-identical, the result is the
 * same paint either way". That is wrong, and it cost the ClickUp mark on the whole roadmap: the
 * browser resolves `url(#…)` to the FIRST element with that id, the first copy on that page sits
 * inside Starlight's `.sidebar` — which the roadmap renders and hides with `display: none` — and a
 * gradient in a hidden subtree is not a paint server. So the fill resolved to nothing and only
 * ClickUp, the one brand of the three drawn with gradients, painted blank. Airtable's flat fills
 * and Notion's `currentColor` were never at risk, which is why it read as "one logo is missing"
 * rather than as a systematic fault.
 *
 * Uniqueness only has to hold WITHIN one document, so any per-instance token will do.
 */
export function uniquifyMark(mark: Mark, token: string): Mark {
  if (!mark.defs) return mark;
  const suffix = `-${token}`;
  return {
    ...mark,
    defs: mark.defs.replace(/id="(bo-[\w-]+)"/g, (_m, id: string) => `id="${id}${suffix}"`),
    paths: mark.paths.map((p) =>
      p.fill
        ? {
            ...p,
            fill: p.fill.replace(/url\(#(bo-[\w-]+)\)/g, (_m, id: string) => `url(#${id}${suffix})`),
          }
        : p,
    ),
  };
}

/**
 * One counter for every mark rendered anywhere, because an `.astro` frontmatter block is NOT module
 * scope: it re-executes for each instance, so a `let seq = 0` beside the component resets on every
 * render and hands out `1` forever. It has to live in a real module to count.
 */
let markSeq = 0;
export const nextMarkToken = (): string => String(++markSeq);

/** The key the reader's choice is remembered under. */
export const FILTER_KEY = 'bo-platforms';

/**
 * Fired on `document` whenever the preference changes, so every surface reading it re-applies.
 *
 * TWO SURFACES SET THIS ONE VALUE — the sidebar chips and the search modal's chips — and Oleh's
 * requirement is that they ARE the same filter, not two that resemble each other. A second copy of
 * "which platforms is this reader interested in" would disagree with the first the moment somebody
 * used both, and the disagreement would be invisible: each surface would look right on its own.
 */
export const FILTER_EVENT = 'bo:platforms';

const isPlatformId = (v: unknown): v is PlatformId =>
  typeof v === 'string' && (PLATFORM_IDS as string[]).includes(v);

/**
 * The reader's current choice, or null when they have not made one.
 *
 * `?platform=` BEATS STORAGE, deliberately: a link that names its platforms is somebody sending a
 * colleague to a specific view, and a stored preference from last week must not silently rewrite
 * what they were sent. It is the same precedence Docusaurus settled on for its own tab groups.
 */
export function readPlatformPreference(): Set<PlatformId> | null {
  const fromUrl = new URLSearchParams(window.location.search).get('platform');
  if (fromUrl) {
    const ids = fromUrl.split(',').map((s) => s.trim()).filter(isPlatformId);
    if (ids.length) return new Set(ids);
  }
  try {
    const raw = window.localStorage.getItem(FILTER_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed.filter(isPlatformId);
    /* An empty stored set would leave a reader with a documentation site showing nothing and no
       memory of having asked for it. Treat it as absent. */
    return ids.length ? new Set(ids) : null;
  } catch {
    return null;
  }
}

/** Stores the choice and tells every other surface. */
export function writePlatformPreference(on: Set<PlatformId>): void {
  try {
    window.localStorage.setItem(FILTER_KEY, JSON.stringify([...on]));
  } catch {
    /* storage disabled: the filter still works, it just does not survive the next page */
  }
  document.dispatchEvent(new CustomEvent(FILTER_EVENT, { detail: [...on] }));
}
