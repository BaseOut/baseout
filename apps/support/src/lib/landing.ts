/**
 * The landing page's content, held once and rendered by three different bodies.
 *
 * WHY A DATA MODULE: `/` currently ships three candidate layouts behind a switch (A path + tiles ·
 * B docs first · C path + list) so Oleh and Dan can compare them on the deployed portal rather than
 * in a description. Three copies of the same link list would drift within a day, and the comparison
 * would then be between three different *contents* rather than three layouts, which is not the
 * question being asked. Everything a variant renders comes from here; a variant owns arrangement
 * and nothing else.
 *
 * `written` IS NOT DECORATION. 25 of the 38 doc pages end in "Not written yet", and 16 of the 22
 * doc links this page exposes are among them (`research-landing-home-2026-08-19.md` §2). A card
 * promises more than a link does, so a variant that draws cards has to know which of its cards is
 * an empty room. No variant is required to show the flag, but every variant is required to be able
 * to: the moment a layout is chosen, this is the field that decides whether it leads with the
 * Backing up band or with Start here.
 *
 * THE ORDER OF THE BANDS IS THE READER'S SEQUENCE, not the sidebar's. Start, back up, put it back,
 * connect it, look inside it, fix it.
 */
import type { IconName } from './icons';
import { REQUESTS, type FeatureRequest } from '../data/requests';

export interface DocLink {
  label: string;
  href: string;
  /** One line, lower case start, no full stop: it completes the label rather than restating it. */
  blurb: string;
  /** False when the page ends in "Not written yet". Measured, not guessed. */
  written: boolean;
}

export interface Band {
  key: string;
  /** The uppercase chip. A VERB: what the reader is doing, never what the section is called. */
  verb: string;
  /** The sentence beside the chip. Retool puts one there and it is what makes a label a heading. */
  line: string;
  icon: IconName;
  items: DocLink[];
}

export const BANDS: Band[] = [
  {
    key: 'start',
    verb: 'Start',
    line: 'What Baseout does, and how it is put together.',
    icon: 'book-open',
    items: [
      {
        label: 'Get started',
        href: '/start/getting-started/',
        blurb: 'connect a Source and run your first backup',
        written: false,
      },
      {
        label: 'What Baseout is',
        href: '/start/what-baseout-is/',
        blurb: 'what it protects, and what it leaves to Airtable',
        written: false,
      },
      {
        label: 'How Baseout is organized',
        href: '/start/how-baseout-is-organized/',
        blurb: 'Organizations, Spaces, Connections, Bases',
        written: false,
      },
      {
        label: 'Signing in',
        href: '/start/signing-in/',
        blurb: 'passwordless sign-in and Airtable OAuth',
        written: false,
      },
    ],
  },
  {
    key: 'backup',
    verb: 'Back up',
    line: 'What a run captures, when it runs, and what it keeps.',
    icon: 'database-backup',
    items: [
      {
        label: 'How backups work',
        href: '/backups/how-backups-work/',
        blurb: 'what a run captures, and what starts one',
        written: true,
      },
      {
        label: 'Schedule and scope',
        href: '/backups/schedule-and-scope/',
        blurb: 'which bases, how deep, how often',
        written: true,
      },
      {
        label: 'Running a backup now',
        href: '/backups/running-a-backup/',
        blurb: 'off-schedule runs, pausing and cancelling',
        written: true,
      },
      {
        label: 'Reading a backup run',
        href: '/backups/reading-a-run/',
        blurb: 'statuses and the three-level audit trail',
        written: true,
      },
      {
        label: 'Retention and cleanup',
        href: '/backups/retention-and-cleanup/',
        blurb: 'the only thing that removes backed-up data',
        written: true,
      },
    ],
  },
  {
    key: 'restore',
    verb: 'Put it back',
    /* NOT "Getting data into Airtable again". A band LINE describes the section, and this one named
       one vendor on a page whose first block invites the reader to say they are on Notion — visible
       as a contradiction the moment the directory below it started answering that choice. The item
       blurbs under it still name Airtable where the PAGE they point at is genuinely Airtable's, and
       that stays: a link is allowed to be about one platform, a section heading is not. */
    line: 'Getting your data back into the platform it came from.',
    icon: 'rotate-ccw',
    items: [
      {
        label: 'Restoring a base',
        href: '/restore/restoring-a-base/',
        blurb: 'base by base, always into new tables',
        written: false,
      },
      {
        label: 'Restoring attachments',
        href: '/restore/attachments/',
        blurb: 'as files, or as links to your Destination',
        written: false,
      },
    ],
  },
  {
    key: 'connect',
    verb: 'Connect',
    line: 'The connection to your platform, and where the backups land.',
    icon: 'plug',
    items: [
      {
        label: 'Sources',
        href: '/connections/sources/',
        blurb: 'the Airtable connection your Spaces share',
        written: false,
      },
      {
        label: 'Destinations',
        href: '/connections/destinations/',
        blurb: 'where the backups actually land',
        written: false,
      },
      {
        label: 'Reconnecting',
        href: '/connections/reconnecting/',
        blurb: 'when authorization expires or is revoked',
        written: false,
      },
    ],
  },
  {
    key: 'inspect',
    verb: 'Look inside',
    line: 'Read what a backup captured, and the structure behind it.',
    icon: 'table-2',
    items: [
      {
        label: 'Schema overview',
        href: '/schema/',
        blurb: 'browse, visualize and monitor your structure',
        written: false,
      },
      {
        label: 'Browsing records',
        href: '/data/records/',
        blurb: 'reading what a backup captured',
        written: false,
      },
      {
        label: 'Attachments',
        href: '/data/attachments/',
        blurb: 'the media library across your bases',
        written: false,
      },
      {
        label: 'Presets and export',
        href: '/data/presets-and-export/',
        blurb: 'saved views and getting data out',
        written: false,
      },
    ],
  },
  {
    key: 'fix',
    verb: 'When it breaks',
    line: 'The four things that actually go wrong.',
    icon: 'triangle-alert',
    items: [
      {
        label: 'My backup failed',
        href: '/troubleshooting/backup-failed/',
        blurb: 'reading the error and what to do next',
        written: false,
      },
      {
        label: 'A connection needs reconnecting',
        href: '/troubleshooting/connection-needs-reconnecting/',
        blurb: 'the fastest route back to working',
        written: false,
      },
      {
        label: 'Bases missing from the picker',
        href: '/troubleshooting/missing-bases/',
        blurb: 'when Airtable shares only some of them',
        written: false,
      },
      {
        label: 'What Baseout cannot capture',
        href: '/troubleshooting/what-baseout-cannot-capture/',
        blurb: 'the honest limits of the API',
        written: true,
      },
    ],
  },
];

/*
 * THE ONBOARDING PATH MOVED to `lib/landing-steps.ts` on 2026-08-20, when its copy stopped being
 * three fixed sentences and became three sentences with a platform's own noun in them. The move is
 * not tidying: that module is imported by a CLIENT script so the strip can re-label itself when the
 * reader names a platform, and this file imports `data/requests` for the roadmap strip. Left here,
 * resolving one noun in the browser would have shipped the whole request board with it.
 */

/** The routes out of the documentation. Same three everywhere; only the placement differs. */
export interface WayOut {
  title: string;
  body: string;
  href: string;
  icon: IconName;
  /** True for the assistant: it opens the chat drawer instead of navigating. */
  opensChat?: boolean;
}

export const WAYS_OUT: WayOut[] = [
  {
    title: 'Ask the assistant',
    body: 'Ask a question and get an answer grounded in these docs.',
    href: '#',
    icon: 'sparkles',
    opensChat: true,
  },
  {
    title: 'Contact us',
    body: 'Something broken, a billing question, or anything else. No account needed, we reply to your email.',
    href: '/contact/',
    icon: 'ticket',
  },
  {
    title: 'Roadmap',
    body: 'What is planned, in progress and shipped. Vote for what you want next.',
    href: '/roadmap/',
    icon: 'map',
  },
];

/**
 * The roadmap strip.
 *
 * IT IS NOT CALLED "WHAT'S NEW", and that is a measurement rather than a preference. Retool's
 * What's new works because its top row is yesterday; our two Shipped items are stamped Jun 2026 and
 * Jul 2026. A block titled *new* whose newest row is two months old reads as abandoned, which is
 * the one impression a support portal for a BACKUP product cannot afford. Titled after the board it
 * comes from, the same three rows are honest: this is what is moving.
 *
 * The mix is deliberate: one in progress, one shipped, one planned. Progress and intent do not go
 * stale on a monthly clock the way a changelog does. If a real changelog ever lands, this strip
 * splits in two exactly as Retool's does.
 */
/**
 * ONE PER STATUS, AND NO TWO FROM THE SAME SUBJECT.
 *
 * THE SECOND HALF OF THAT RULE IS NEW, and it is a repair rather than a refinement. The strip used
 * to take the most recently raised row of each status and nothing else, which was correct on the
 * ten rows it was written against and stopped being correct when the fixtures grew to 27: the newest
 * `In progress` and the newest `Planned` are both ClickUp's, so the landing showed ClickUp, Airtable,
 * ClickUp. A page whose FIRST block asks "which platform are you backing up?" and whose roadmap
 * strip then shows one product twice is arguing against itself, and the recency rule will drift back
 * into that shape every time a batch of rows lands for one platform. So the spread is DERIVED, not
 * hand-picked: hand-picking three slugs is the same defect with a longer half-life.
 *
 * A SUBJECT IS A PLATFORM OR IT IS BASEOUT. An untagged row is about the product itself, which is
 * the board's own convention (`data/requests.ts`) and the majority of the board, so `baseout` is a
 * real fourth subject here rather than a null. Two untagged rows in the strip would be as narrow a
 * face as two ClickUp ones.
 *
 * IT ALWAYS RETURNS THREE. If every candidate for a status is already spoken for, the most recent
 * one is taken anyway. The strip's sub-line promises one of each status and nothing about the
 * spread, so the fallback can never make the page say something untrue.
 *
 * IT DOES NOT FOLLOW THE READER'S PLATFORM, and that was a real option. Two things ruled against it.
 * The landing's own law is that a choice RE-LABELS and ADDS, never subtracts, and most of this board
 * is untagged work that belongs to every reader; narrowing the strip would hide the product's own
 * roadmap from someone who named a platform. And the data cannot carry it: Notion has no shipped and
 * no in-progress row, so a Notion reader would get one card under a heading promising three.
 */
export interface RoadmapTile {
  item: FeatureRequest;
  href: string;
}

/** The board's own convention: an untagged request is about Baseout itself. */
const subjectOf = (r: FeatureRequest): string => r.platform ?? 'baseout';

const STRIP_STATUSES: FeatureRequest['status'][] = ['In progress', 'Shipped', 'Planned'];

function buildStrip(): RoadmapTile[] {
  const used = new Set<string>();
  const out: RoadmapTile[] = [];

  for (const status of STRIP_STATUSES) {
    /* PLATFORM CANDIDATES ARE NOT FEATURES, and a strip of three cards is the wrong place to
       discover that. `platform-notion` is titled "Notion", so under a rail that already reads
       NOTION the card said the word twice and its summary described a product rather than a piece
       of work. They have their own section on the board, where a row whose whole subject is a
       platform makes sense; here they read as a category error. */
    const candidates = REQUESTS.filter(
      (r) => r.status === status && r.kind !== 'platform',
    ).sort((a, b) => b.raised.localeCompare(a.raised));
    if (!candidates.length) continue;
    const item = candidates.find((r) => !used.has(subjectOf(r))) ?? candidates[0];
    used.add(subjectOf(item));
    out.push({ item, href: `/roadmap/${item.slug}/` });
  }

  return out;
}

export const ROADMAP_TILES: RoadmapTile[] = buildStrip();


/**
 * The per-platform half of the documentation directory.
 *
 * THE BANDS ABOVE ARE THE PAGES THAT ARE TRUE OF EVERYBODY. These ten topics are the other half:
 * each one exists once per platform under `/platforms/<id>/<slug>/`, and which of the three a
 * reader wants is exactly the question the chooser at the top of the page asks. In the `filter`
 * variant the directory answers it, so naming your platform makes its own pages appear in the band
 * they belong to rather than staying buried three levels down a collapsed sidebar group.
 *
 * NO LABELS HERE, ON PURPOSE. A link's text is the one thing it cannot afford to be wrong about,
 * so the label is read from the page's own `title` at build time (`LandingBody.astro`) rather than
 * typed a second time here. A topic whose page does not exist for a platform is skipped, so this
 * list can never mint a dead link — which is the defect this app shipped last.
 *
 * THE BLURB IS PER TOPIC, NOT PER PLATFORM, and that is deliberate rather than lazy. Each page's
 * own `description` is a full sentence about that platform's API; beside a four-word neutral blurb
 * it reads as a different kind of card. The topic line says what the page is FOR, which is the same
 * question on all three, and the title beside it already names the platform.
 *
 * `band` matches a `Band.key` above. The grouping is the sidebar's, so a reader who learns the
 * shape here finds the same shape when they open a page.
 */
export interface PlatformTopic {
  /** The path segment under `/platforms/<id>/`. */
  slug: string;
  /** The `Band.key` this topic belongs under. */
  band: string;
  icon: IconName;
  /** One line, lower case start, no full stop, true of all three platforms. */
  blurb: string;
}

export const PLATFORM_TOPICS: PlatformTopic[] = [
  {
    slug: 'what-we-back-up',
    band: 'backup',
    icon: 'database-backup',
    blurb: 'the objects a run captures, and the ones the API withholds',
  },
  {
    slug: 'limits-and-timing',
    band: 'backup',
    icon: 'clock',
    blurb: 'what sets the pace of a run',
  },
  {
    slug: 'deleted-items',
    band: 'backup',
    icon: 'circle-slash',
    blurb: 'what is left to find after something is deleted',
  },
  {
    slug: 'restoring',
    band: 'restore',
    icon: 'rotate-ccw',
    blurb: 'what comes back intact, and what needs a hand',
  },
  {
    slug: 'identifiers',
    band: 'restore',
    icon: 'list-checks',
    blurb: 'how a restore matches rows back to their originals',
  },
  {
    slug: 'connecting',
    band: 'connect',
    icon: 'plug',
    blurb: 'the two ways in, and what each one reaches',
  },
  {
    slug: 'permissions',
    band: 'connect',
    icon: 'lock',
    blurb: 'what bounds a connection, and how to widen it',
  },
  {
    slug: 'field-types',
    band: 'inspect',
    icon: 'table-2',
    blurb: 'which columns hold a value a backup can store',
  },
  {
    slug: 'attachments',
    band: 'inspect',
    icon: 'download',
    blurb: 'how files are captured, and why the bytes are kept',
  },
  {
    slug: 'comments',
    band: 'inspect',
    icon: 'message-circle-question-mark',
    blurb: 'what a comment carries, and what survives a restore',
  },
];
