/**
 * The three-step path on `/`, and the one thing about it that varies by platform.
 *
 * IT MOVED OUT OF `landing.ts` FOR ONE REASON: this module is imported by a CLIENT script, and
 * `landing.ts` imports `data/requests` for the roadmap strip. Leaving the steps there would have
 * shipped the whole request board into the landing's browser bundle to resolve one noun. Nothing
 * here imports anything but the platform catalogue, which the landing already ships (the chooser
 * writes the site-wide preference through it).
 *
 * THE STEPS ARE THE SAME ON EVERY PLATFORM AND THE NOUNS ARE NOT. That is the whole thesis of this
 * documentation set, and it is also the reason the copy could not just be written three times: three
 * strings drift, and the day a fourth platform lands the sentence has been re-argued four times.
 * So a step owns ONE sentence with ONE `{noun}` marker, and the marker is resolved from
 * `lib/platforms.ts` — the same `vocab` the sidebar, the search modal and the docs pages read.
 *
 * THE NEUTRAL READING IS NOT A PLATFORM'S READING. Before a visitor names their platform the
 * sentence has to be true for all three, so the neutral word is ordinary English ("what", "row",
 * "your platform") rather than a fourth vendor's noun. Defaulting the neutral to Airtable's words
 * would have been the easy version and it would have told a Notion reader, on first paint, that
 * this documentation is about somebody else.
 *
 * ONLY STEP 1 CHANGES WHERE IT GOES. "Connect a Source" is the one step whose page genuinely
 * differs per platform (`/platforms/<id>/connecting/`); scheduling and reading a run are one page
 * each for everybody. A step that re-pointed at a per-platform page that does not exist would be
 * the same dead-link defect this app shipped once already.
 */
import { platform, type Platform, type PlatformId } from './platforms';

/** Which word of a platform's furniture a sentence wants. `name` is the platform itself. */
export type NounSource = 'name' | 'top' | 'mid' | 'row' | 'col';

export interface StepNoun {
  /** How the sentence reads while nobody has named a platform. Ordinary English, nobody's brand. */
  neutral: string;
  from: NounSource;
  /** Words that exist only once there IS a proper noun ("which " before "Bases"). */
  lead?: string;
  /** Naive `+ s`. Every noun in the catalogue pluralises that way; assert it when adding one. */
  plural?: boolean;
}

export interface Step {
  n: number;
  title: string;
  /** One sentence carrying exactly one `{noun}` marker. */
  body: string;
  noun: StepNoun;
  /** Where the step goes before a platform is named. */
  href: string;
  /** Set only on the step whose destination is per-platform: `/platforms/<id>/<platformPath>/`. */
  platformPath?: string;
  /** Base name under `/screens/`; `-light.png` and `-dark.png` are appended. */
  shot: string;
  alt: string;
  /**
   * Which rows of the glossary card this step is about.
   *
   * WITHOUT IT THE THREE CARDS ARE ONE CARD DRAWN THREE TIMES, and a row of three identical
   * panels reads as a template rather than as three steps — the exact impression a substitute for
   * a screenshot cannot afford, because the screenshots it replaces are three different pictures.
   * The rows named here stay at full strength and the rest step back. Nothing is hidden: every
   * card still carries the whole vocabulary, which is the point of it.
   */
  glossaryFocus: Exclude<NounSource, 'name'>[];
}

export const STEPS: Step[] = [
  {
    n: 1,
    title: 'Connect a Source',
    body: 'Authorize {noun} once. Baseout sees only what you share with it, and nothing else in your account.',
    noun: { neutral: 'your platform', from: 'name' },
    href: '/connections/sources/',
    platformPath: 'connecting',
    shot: 'connect',
    alt: 'Choosing which Airtable bases a Space will back up',
    /* Connecting is where you name the outermost thing and nothing below it. */
    glossaryFocus: ['top'],
  },
  {
    n: 2,
    title: 'Set the schedule',
    body: 'Pick {noun} to back up, how deep each run goes, and how often. Schema and data can run apart.',
    /* `top` rather than `mid`, and that is the data model rather than a preference: `vocab.top` is
       documented as "the thing you pick when choosing what to protect". For Airtable that is a
       Base; for Notion it is a Teamspace, not a Database. Scope is chosen at the outer level on
       every platform, and a sentence that named the inner one would be wrong about the product. */
    noun: { neutral: 'what', from: 'top', lead: 'which ', plural: true },
    href: '/backups/schedule-and-scope/',
    shot: 'schedule',
    alt: 'The backup schedule, with separate cadences for data and schema',
    /* Scope is what to take and how deep to go, which is exactly these two levels. */
    glossaryFocus: ['top', 'mid'],
  },
  {
    n: 3,
    title: 'Read the run',
    body: 'Every run says what it captured, down to the {noun}, and names anything it could not.',
    noun: { neutral: 'row', from: 'row' },
    href: '/backups/reading-a-run/',
    shot: 'run',
    /* Written against the frame that exists, not the frame that was asked for: the shot is the run
       detail (per-BASE rows plus the attachment warning), because the per-table view one level down
       is four rows above 350px of empty page. An alt that promises a table-by-table breakdown would
       be describing a different screen. */
    alt: 'A finished backup run: succeeded, six bases, and a warning that two attachments failed',
    /* A run reports in counts, and the two things it counts are these. */
    glossaryFocus: ['row', 'col'],
  },
];

/** The sentence either side of its marker, so a view can wrap the noun in its own element. */
export function bodyParts(step: Step): { before: string; after: string } {
  const i = step.body.indexOf('{noun}');
  /* Loud rather than silent: a step whose marker was lost in an edit would otherwise render a
     sentence with a hole in it and no platform reading at all, on the landing page, forever. */
  if (i < 0) throw new Error(`Step ${step.n} has no {noun} marker`);
  return { before: step.body.slice(0, i), after: step.body.slice(i + '{noun}'.length) };
}

/** How the marker reads for one platform, or `null` for the neutral reading. */
export function nounFor(noun: StepNoun, p: Platform | null): string {
  if (!p) return noun.neutral;
  const word = noun.from === 'name' ? p.name : p.vocab[noun.from];
  return `${noun.lead ?? ''}${noun.plural && noun.from !== 'name' ? `${word}s` : word}`;
}

/** Every reading of one step's noun, keyed the way the markup and the stylesheet key them. */
export function nounReadings(step: Step): { key: string; text: string }[] {
  return [
    { key: 'neutral', text: nounFor(step.noun, null) },
    ...(['airtable', 'clickup', 'notion'] as PlatformId[]).map((id) => ({
      key: id,
      text: nounFor(step.noun, platform(id)),
    })),
  ];
}

/** Where a step goes, given the platform the reader has named (or has not). */
export function stepHref(step: Step, id: PlatformId | null): string {
  return step.platformPath && id ? `/platforms/${id}/${step.platformPath}/` : step.href;
}

/**
 * The glossary card variant C shows in place of a screenshot.
 *
 * WHY THERE IS NO CLICKUP OR NOTION SCREENSHOT AND NEVER WILL BE: the product does not have those
 * features yet, and a fabricated screenshot of a screen that does not exist is the one thing a
 * support portal cannot survive being caught at. The three files under `public/screens/` are real
 * Baseout UI with Airtable's nouns baked into the pixels — "Which bases to back up", the
 * `WORKSPACE / BASE` column headers, the Airtable logo in a row. No caption rescues that for a
 * Notion reader. So the frame holds the reader's own vocabulary instead, which is a real thing we
 * know and can print.
 */
export const GLOSSARY_ROWS: { label: string; from: Exclude<NounSource, 'name'> }[] = [
  { label: 'You pick', from: 'top' },
  { label: 'It holds', from: 'mid' },
  { label: 'One row', from: 'row' },
  { label: 'One column', from: 'col' },
];
