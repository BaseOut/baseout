/**
 * A COMPLETE ANSWER SET FOR THE REVIEW PANEL. REVIEW ONLY — GOES OUT WITH THE JUMP PANEL.
 *
 * The panel's finish-page links used to be plain hrefs, so what they showed depended on whatever
 * happened to be left in the tab from the last walkthrough: a half-filled report, or an empty one.
 * Oleh, 2026-08-27: *"щоб тут все було заповнено, щоб я чітко міг розуміти, як воно відбувається,
 * не залежало від вибору моїх питань."* Each link now seeds this set first.
 *
 * GENERATED FROM THE BANK, NOT TYPED OUT. Eighty-two hand-written answers would be eighty-two
 * things to forget the next time a question is added or an option is reworded — and a demo that has
 * silently drifted from the instrument is worse than no demo, because it looks authoritative. So
 * the set is walked out of `questions.ts` itself: every question gets a deterministic answer, and a
 * short table of OVERRIDES pins the handful the finish page actually reads.
 *
 * The conditionals are honoured as they are walked, exactly as the survey does it, so the set can
 * never contain an answer to a question the respondent would not have been shown.
 */

import {
  questions,
  AGENCY_ROLE,
  AGENCY_RELATIONSHIP,
  SCREENED_OUT,
  type Answers,
  type Question,
} from './questions';

/**
 * The answers the finish page reads, pinned.
 *
 * The six scored ones total 12 of 18, which is the 67 Oleh asked to see. WHICH six carry that 12
 * is the more interesting choice: two of them are weak on purpose. One weak practice gives the
 * summary a single clause and section 04 a single line, and a review screen that only ever shows
 * the one-item case does not show how the page behaves. Two exercises the plural wording in both.
 *
 * `self_assessment` is set one rung ABOVE the measurement on purpose: the confidence gap is the
 * bank's headline chart, and a demo where the two agree shows nothing.
 */
const OVERRIDES: Answers = {
  // Screener and role: an agency, so the founding-partner block is part of what gets reviewed.
  relationship: AGENCY_RELATIONSHIP,
  role: AGENCY_ROLE,

  // The six scored practices. 3 + 3 + 2 + 1 + 2 + 1 = 12 of 18 -> 67, with two weak.
  backup_method: ['A third-party backup tool (On2Air, etc.)'],
  restore_speed: 'Under an hour',
  restore_tested: 'Yes, once or twice',
  schema_tracking: 'Docs we maintain by hand (Notion, Google Docs, etc.)',
  change_attribution: 'Possible, but slow and painful',
  change_testing: 'We test in the live base carefully (off-hours, small batches)',

  // Read by the report's own sections rather than by the score.
  self_assessment: 'Engineered. We’d pass an audit tomorrow',
  backup_coverage: [
    'Records (the data itself)',
    'Base structure (tables, fields, field types)',
    'Views and their configurations',
  ],
  priorities: [
    'Fast, easy restore when something breaks',
    'Schema visibility (diagrams, changelog, docs)',
    'Change alerts & monitoring',
  ],
  email: 'reviewer@example.com',
};

/** Options that would answer a question by declining it. A demo set should not be full of them. */
const DECLINING = /^(none|nothing|not sure|no,|we don|i don|didn|never heard)/i;

function pick(q: Question): string | string[] {
  const options = (q.options ?? []).filter((o) => !DECLINING.test(o));
  const all = q.options ?? [];

  switch (q.kind) {
    case 'single':
      // The second real option, which is mid-ladder on most of this bank's questions and so reads
      // as an ordinary respondent rather than a best or worst case.
      return options[1] ?? options[0] ?? all[0] ?? '';
    case 'multi':
      return options.slice(0, 2);
    case 'rank':
      return all.slice(0, q.rankPick ?? 3);
    case 'matrix':
      return all.map(() => '4');
    case 'scale':
      return '4';
    case 'email':
      return 'reviewer@example.com';
    case 'number':
      return '12';
    case 'date':
      return '2026-08-01';
    case 'short':
      return 'A sample answer, for review.';
    case 'long':
      return 'A sample answer, written here so the review panel shows a filled page rather than an empty one.';
    default:
      return '';
  }
}

/**
 * Every question the survey would have asked this respondent, answered.
 *
 * Walked in bank order with the conditionals evaluated against what is already answered, which is
 * how the survey itself decides. An override wins wherever one exists.
 */
export function demoAnswers(): Answers {
  const answers: Answers = {};
  for (const q of questions) {
    if (q.showIf && !q.showIf(answers)) continue;
    answers[q.id] = OVERRIDES[q.id] ?? pick(q);
  }
  return answers;
}

/**
 * The screener's exit, which is a different page and needs its own set: the bank sends these
 * respondents to a thank-you with no score, because nothing was measured.
 */
export function screenedOutAnswers(): Answers {
  return {
    relationship: SCREENED_OUT[SCREENED_OUT.length - 1]!,
    tenure: 'Under 1 year',
    email: 'reviewer@example.com',
  };
}
