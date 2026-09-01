/**
 * THE DOAP SCORE.
 *
 * Dan, on the video: *"brand this as like your score, and this would range from like zero to a
 * hundred. And then instead of bands or whatever, it kind of is like buckets you based off of your
 * score."* So the number comes first and the band is a bucket cut out of it, which is the reverse
 * of what this file used to do.
 *
 * WHERE THE NUMBER COMES FROM, AND WHY IT IS NOT INVENTED HERE.
 *
 * The question bank's builder notes already define the arithmetic and make it canonical: *"The
 * 6-question core index (C1/C4/C5/D1/D3/D4 <-> 4.1/6.1/6.2/8.1/7.6/7.3) stays canonical for
 * cross-survey comparability, score it identically to Appendix B of the report."* Those six
 * questions are the ones scored below, each on 0 to 3, for a raw total of 0 to 18. The DOAP Score
 * is that total expressed out of 100.
 *
 * Six questions rather than fifty is deliberate and is the bank's decision, not a shortcut: the
 * core index is the only thing that merges with the other two surveys and with next year's run.
 * The bank also describes an EXTENDED index over eight further questions, reserved for the report's
 * deep-dive chapter. It is not computed here, because the number on screen has to be the number in
 * the report and the report's headline is the core one.
 *
 * TWO THINGS ARE PROVISIONAL AND ARE MARKED SO IN THE CODE.
 *
 *   · THE PER-OPTION POINTS. Appendix B has not been written yet. The ladders below are ordinal in
 *     the direction the bank's own analysis notes argue for, and each carries its reasoning. They
 *     are the honest reading of an unwritten rubric, not the rubric.
 *   · THE BUCKET CUTOFFS. Even quarters of the range. The bank says to "validate that band cutoffs
 *     produce interpretable clusters before publishing", which cannot be done before there is data.
 *
 * Both are open question O-2 for Dan. Neither may be cited in the report until he confirms it.
 * `IS_PROVISIONAL` is exported so the UI can say so out loud for as long as it is true, the same
 * way `distribution.ts` handles its placeholder shares.
 */

import type { Answers } from './questions';

export const IS_PROVISIONAL = true;

export type Band = 'Ad hoc' | 'Aware' | 'Managed' | 'Engineered';

/** The scale renders all four, in order, with the respondent's own marked. */
export const BANDS: Band[] = ['Ad hoc', 'Aware', 'Managed', 'Engineered'];

/** One line per band, addressed to the respondent once their answers are in. */
const BLURBS: Record<Band, string> = {
  'Ad hoc':
    'Almost nothing stands between a wrong click and your data, so the first bad day is the one that decides how much you keep.',
  Aware:
    'You have copies. What you do not have is proof any of them come back, or a record of what changed before they were needed.',
  Managed:
    'The safety net runs on its own and someone owns it. The gaps left are the ones you only find under pressure.',
  Engineered:
    'You test restores, you can see what changed, and risky work happens somewhere other than production.',
};

/**
 * The six dimensions of the core index, in the bank's own order.
 *
 * `key` is the answer key, `ref` is the bank number and the merge key, `label` is what the audit
 * calls this line, and `advice` is what gets said when the dimension scores badly. Keeping the
 * advice beside the rubric is what stops the two drifting: a recommendation written somewhere else
 * would go on being shown after its ladder had changed underneath it.
 */
interface Dimension {
  key: string;
  ref: string;
  label: string;
  /** 0 to 3, from the answer. */
  score: (a: Answers) => number;
  /** Shown when the dimension scores at or below `adviceAt`. */
  advice: string;
  adviceAt: number;
  /**
   * Two half-sentences the summary builds prose out of: what this practice being in good shape
   * MEANS, and what falling short of it means. Clauses, not sentences, so `report.ts` can join
   * several into one readable line rather than printing six bullet points at somebody who has just
   * answered eighty-two questions.
   *
   * EACH ONE DESCRIBES A BAND, NOT AN ANSWER, and that is a deliberate limit. `gap` is used for a
   * score of 0 OR 1, so it cannot say what the worst answer says — a first pass had schema
   * visibility reading "lives in somebody's head" for a respondent who had answered "docs we
   * maintain by hand", which is a stronger claim than they made. The clauses generalise; the table
   * directly under the summary prints the respondent's exact words, so the two are on the same page
   * and the precise version is never more than a line away.
   */
  holds: string;
  gap: string;
}

/** A single-select ladder: the first matching option wins, anything unlisted scores 0. */
const ladder =
  (key: string, points: Record<string, number>) =>
    (a: Answers): number => {
      const value = a[key];
      return typeof value === 'string' ? (points[value] ?? 0) : 0;
    };

const BUILT_IN_ONLY = 'Airtable’s built-in snapshots / revision history only';
const THIRD_PARTY = 'A third-party backup tool (On2Air, etc.)';
const SCRIPTS = 'Custom scripts / API export we built ourselves';
const CSV = 'Manual CSV exports';
const SYNC = 'Zapier / Make syncing to another system';

export const DIMENSIONS: Dimension[] = [
  {
    key: 'backup_method',
    ref: '4.1',
    label: 'Backups',
    /**
     * 4.1 is a multi-select, so the ladder is applied to each choice and the BEST one counts: a
     * team running a third-party tool is not scored down for also taking the occasional CSV.
     *
     * The order is about where the copy lives and who controls it, which is the distinction the
     * bank's analysis notes keep returning to. Built-in snapshots and manual exports both score 1:
     * something exists, but one of them never leaves Airtable and the other only exists when
     * somebody remembers. A sync to another system scores 2, because the copy is outside and
     * automatic but was not built to be restored from.
     */
    score: (a) => {
      const chosen = Array.isArray(a.backup_method) ? a.backup_method : [];
      const POINTS: Record<string, number> = {
        [THIRD_PARTY]: 3,
        [SCRIPTS]: 3,
        [SYNC]: 2,
        [BUILT_IN_ONLY]: 1,
        [CSV]: 1,
      };
      return chosen.reduce((best, option) => Math.max(best, POINTS[option] ?? 0), 0);
    },
    advice:
      'Get one copy of your data outside Airtable, on a schedule nobody has to remember. Built-in snapshots live inside the thing you are protecting against.',
    adviceAt: 1,
    holds: "a copy of your data leaves Airtable without anyone remembering to make it",
    gap: "the copies you have either never leave Airtable or depend on somebody remembering",
  },
  {
    key: 'restore_speed',
    ref: '6.1',
    label: 'Recovery time',
    score: ladder('restore_speed', {
      'Under an hour': 3,
      'Same day': 2,
      'A few days': 1,
      // "A week or more", "We might never fully recover" and "No idea" all score 0. Not knowing is
      // not a middle position: an untimed recovery is an unplanned one.
    }),
    advice:
      'Put a number on how long you could be down, then find out whether you can actually hit it. An unmeasured recovery time is usually the one that surprises everybody.',
    adviceAt: 1,
    holds: "you could be working again the same day",
    gap: "getting back to a working state is either days away or has never been measured",
  },
  {
    key: 'restore_tested',
    ref: '6.2',
    label: 'Tested restores',
    score: ladder('restore_tested', {
      'Yes, regularly': 3,
      'Yes, once or twice': 2,
      'No, but we have backups': 1,
      'No, we have no backups to test': 0,
    }),
    advice:
      'Restore one base into a copy this month. A backup nobody has restored is a claim, and this is the single cheapest thing on this list to fix.',
    adviceAt: 1,
    holds: "you have actually restored from a backup rather than assumed you could",
    gap: "no one has restored one of your backups to find out whether it works",
  },
  {
    key: 'schema_tracking',
    ref: '8.1',
    label: 'Schema visibility',
    score: ladder('schema_tracking', {
      'A tool that auto-generates schema documentation': 3,
      'A diagramming tool (Whimsical, Lucidchart, etc.) updated manually': 2,
      'Docs we maintain by hand (Notion, Google Docs, etc.)': 1,
      'It’s all in my head, or the builder’s head': 0,
      'We don’t, we open the base and look': 0,
    }),
    advice:
      'Write down how the important bases are put together, or generate it. Structure that only exists in one person’s head leaves when they do.',
    adviceAt: 1,
    holds: "how the bases are built is written down somewhere other than a head",
    gap: "how the bases are built is not recorded anywhere that keeps up with them",
  },
  {
    key: 'change_attribution',
    ref: '7.6',
    label: 'Change history',
    score: ladder('change_attribution', {
      'Easy, we have change history we trust': 3,
      'Possible, but slow and painful': 2,
      // "Never needed to" scores 1, not 0 and not 2: it is untested rather than absent, and ranking
      // it level with a trusted history would reward never having had a bad day.
      'Never needed to': 1,
      'Basically impossible': 0,
    }),
    advice:
      'Make "what changed, when, and who did it" answerable before you need the answer. Every hour of an outage spent guessing is spent twice.',
    adviceAt: 1,
    holds: "you can answer what changed and when",
    gap: "what changed, when, and who did it is not something you can answer quickly",
  },
  {
    key: 'change_testing',
    ref: '7.3',
    label: 'Safe changes',
    score: ladder('change_testing', {
      'We have a formal dev / staging / prod-style process': 3,
      'We duplicate the base and test in the copy': 2,
      'We test in the live base carefully (off-hours, small batches)': 1,
      // "Not applicable, we rarely make risky changes" scores 1. It is a real answer for a small,
      // stable base, and scoring it 0 would rank a team that takes no risks below one that takes
      // them carelessly.
      'Not applicable, we rarely make risky changes': 1,
      'We just make the change and watch': 0,
    }),
    advice:
      'Try risky changes somewhere that is not production. Duplicating the base costs a minute; App Sandbox does it properly if your plan has it.',
    adviceAt: 1,
    holds: "risky work happens somewhere other than the base people are using",
    gap: "risky changes happen in the base people are using",
  },
];

/**
 * The prose clauses, keyed by answer key.
 *
 * `report.ts` composes the summary and has no business knowing the rubric; the rubric has no
 * business composing prose. This is the seam between them, and it is derived rather than a second
 * list, so a dimension can never be scored here and unmentionable there.
 */
export const DIMENSION_CLAUSES: Record<string, { holds: string; gap: string }> = Object.fromEntries(
  DIMENSIONS.map((d) => [d.key, { holds: d.holds, gap: d.gap }]),
);

/** The best raw total the six dimensions can produce. */
const MAX_RAW = DIMENSIONS.length * 3;

export interface DimensionResult {
  key: string;
  ref: string;
  label: string;
  score: number;
  /** Out of 3, as a share, for drawing the audit's bars. */
  share: number;
  /**
   * What the respondent actually said, verbatim.
   *
   * A score with no answer beside it asks the reader to take the number on faith. Printing the
   * sentence they chose is what turns the audit from a grade into a record they can check, and it
   * costs nothing: the answer is already in hand.
   */
  answer: string;
}

export interface SurveyResult {
  /** The DOAP Score, 0 to 100. */
  score: number;
  band: Band;
  blurb: string;
  dimensions: DimensionResult[];
  /** Up to three things to fix, weakest first. */
  recommendations: string[];
}

/**
 * The buckets. Even quarters of the range, cut on the LOW edge, so 25 is Aware and 24 is Ad hoc.
 *
 * Provisional, per the file header: the bank asks for cutoffs validated against real clusters and
 * there is no data yet. They are kept even for now precisely so that nothing about them looks like
 * a finding.
 */
const CUTOFFS: { band: Band; from: number }[] = [
  { band: 'Engineered', from: 75 },
  { band: 'Managed', from: 50 },
  { band: 'Aware', from: 25 },
  { band: 'Ad hoc', from: 0 },
];

export function bandOf(score: number): Band {
  return CUTOFFS.find((c) => score >= c.from)?.band ?? 'Ad hoc';
}

/** The lowest score that still lands in a band. Used to draw the bucket edges on the meter. */
export function bandFloor(band: Band): number {
  return CUTOFFS.find((c) => c.band === band)?.from ?? 0;
}

/** The respondent's own words for one answer key. Multis read as a list. */
export function answerText(answers: Answers, key: string): string {
  const value = answers[key];
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return typeof value === 'string' ? value : '';
}

export function scoreSurvey(answers: Answers): SurveyResult {
  const dimensions = DIMENSIONS.map((d) => {
    const score = Math.max(0, Math.min(3, d.score(answers)));
    return {
      key: d.key,
      ref: d.ref,
      label: d.label,
      score,
      share: score / 3,
      answer: answerText(answers, d.key) || 'Not answered',
    };
  });

  const raw = dimensions.reduce((sum, d) => sum + d.score, 0);
  const score = Math.round((raw / MAX_RAW) * 100);
  const band = bandOf(score);

  /**
   * The audit half of the finish page. Dan: *"maybe like recommendations for improvement, so it's
   * almost like an audit, kind of where they're at and room for improvement."*
   *
   * Weakest first, capped at three. Three is not a rounding of "a few": a list of six things to fix
   * handed to somebody who just told you they fix nothing is a list that gets closed, and the two
   * weakest dimensions are where the next hour of their time is worth most.
   */
  const recommendations = DIMENSIONS.map((d, i) => ({ d, score: dimensions[i]!.score }))
    .filter(({ d, score: s }) => s <= d.adviceAt)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3)
    .map(({ d }) => d.advice);

  return { score, band, blurb: BLURBS[band], dimensions, recommendations };
}
