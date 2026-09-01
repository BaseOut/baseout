/**
 * WHAT ELSE THE ANSWERS ALREADY KNOW.
 *
 * `maturity.ts` scores six questions. The respondent answered eighty-two, and the finish page was
 * showing six bars: a page that asks for fifteen minutes and hands back a grade reads as thin,
 * which is exactly what Oleh said about it on 2026-08-27.
 *
 * Everything below is DERIVED FROM THEIR OWN ANSWERS. Nothing here is a benchmark, an average or a
 * comparison against other respondents, because no responses have been counted yet: that is
 * `distribution.ts`'s problem and it carries a placeholder marker for as long as it is unsolved.
 * The material here needs no such marker, because it is the reader's own record read back.
 */

import type { Answers } from './questions';
import { answerText } from './maturity';
import type { Band } from './maturity';

/** Hidden fields ride in the same record under a prefix; they are not answers. */
const isHidden = (key: string): boolean => key.startsWith('_');

/** How many questions they actually answered, ignoring blanks and the hidden fields. */
export function answeredCount(answers: Answers): number {
  return Object.entries(answers).filter(([key, value]) => {
    if (isHidden(key) || key.endsWith('_other')) return false;
    if (Array.isArray(value)) return value.some((v) => v !== '');
    return typeof value === 'string' && value !== '';
  }).length;
}

/**
 * THE CONFIDENCE GAP.
 *
 * The bank's builder notes make this its headline chart: *"self-assessed maturity (11.5) vs.
 * computed index — expect systematic overconfidence"*. It is the one comparison the page can make
 * honestly today, because both halves come from the same respondent.
 */
const CLAIMED_BAND: Record<string, Band> = {
  'We wing it': 'Ad hoc',
  'We have the basics, with gaps': 'Aware',
  'Solid. Automated and documented': 'Managed',
  'Engineered. We’d pass an audit tomorrow': 'Engineered',
};

const ORDER: Band[] = ['Ad hoc', 'Aware', 'Managed', 'Engineered'];

export interface ConfidenceGap {
  /** Their own words from 11.5. */
  claimed: string;
  claimedBand: Band;
  measured: Band;
  /** Rungs between the claim and the measurement. Positive means they rated themselves higher. */
  rungs: number;
}

export function confidenceGap(answers: Answers, measured: Band): ConfidenceGap | null {
  const claimed = answerText(answers, 'self_assessment');
  const claimedBand = CLAIMED_BAND[claimed];
  if (!claimed || !claimedBand) return null;
  return {
    claimed,
    claimedBand,
    measured,
    rungs: ORDER.indexOf(claimedBand) - ORDER.indexOf(measured),
  };
}

/**
 * WHAT THE BACKUPS HOLD.
 *
 * Bank 4.4 asks respondents to "check everything you are confident is captured", which makes an
 * unticked box mean *not confirmed* rather than *known to be missing*. The two lists below keep
 * that distinction, and the page has to keep it in its wording too: this is the bank's "coverage
 * illusion" chart, and overstating it would be the one place this page invented a finding.
 */
const COVERAGE_OPTIONS = [
  'Records (the data itself)',
  'Attachment files (the actual files, not just links)',
  'Base structure (tables, fields, field types)',
  'Views and their configurations',
  'Automations',
  'Interfaces',
  'Comments',
];

/** Short labels, because the full option text is written for a question, not for a chip. */
const COVERAGE_SHORT: Record<string, string> = {
  'Records (the data itself)': 'Records',
  'Attachment files (the actual files, not just links)': 'Attachment files',
  'Base structure (tables, fields, field types)': 'Base structure',
  'Views and their configurations': 'Views',
  Automations: 'Automations',
  Interfaces: 'Interfaces',
  Comments: 'Comments',
};

export interface Coverage {
  captured: string[];
  notConfirmed: string[];
}

export function coverage(answers: Answers): Coverage | null {
  const value = answers.backup_coverage;
  if (!Array.isArray(value) || value.length === 0) return null;
  const captured = COVERAGE_OPTIONS.filter((o) => value.includes(o));
  // Somebody who ticked only "Not sure what it includes" has told us something real, and it is not
  // that six things are missing. No lists rather than two misleading ones.
  if (captured.length === 0) return null;
  return {
    captured: captured.map((o) => COVERAGE_SHORT[o] ?? o),
    notConfirmed: COVERAGE_OPTIONS.filter((o) => !value.includes(o)).map((o) => COVERAGE_SHORT[o] ?? o),
  };
}

/** Their ranked top three from 11.1, in order, blanks dropped. */
export function priorities(answers: Answers): string[] {
  const value = answers.priorities;
  return Array.isArray(value) ? value.filter(Boolean) : [];
}

/**
 * THE SUMMARY, WRITTEN OUT OF THEIR OWN SCORES.
 *
 * "Мені подобається, що першим кроком йде in short, типу як самарі, яке розказує щось юзеру" —
 * Oleh, 2026-08-27, on the direction he picked. The mock had a paragraph; this composes the real
 * one, and it composes it out of the six practices rather than out of adjectives.
 *
 * TWO CLAUSES EACH SIDE, NOT SIX. A reader who has just answered eighty-two questions will read one
 * paragraph, not a list. So the two strongest and the two weakest speak, and the table in section
 * 02 carries the rest — which is also why the weak half ends by pointing at section 04 rather than
 * repeating the advice here.
 *
 * NO COMPARISON IN THIS PROSE. The mock's version said "which puts you ahead of most teams", and
 * that is a claim nothing has counted yet. The one comparison on the page is the sentence beside
 * the score, and it wears `distribution.ts`'s placeholder marker.
 */
import type { DimensionResult } from './maturity';

const list = (parts: string[]): string =>
  parts.length < 2 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;

export interface Summary {
  text: string;
  /** True when at least one practice scored badly, so the page can point at what to do about it. */
  hasGaps: boolean;
}

export function summarise(
  dimensions: DimensionResult[],
  clauses: Record<string, { holds: string; gap: string }>,
): Summary | null {
  const strong = dimensions
    .filter((d) => d.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map((d) => clauses[d.key]?.holds)
    .filter((c): c is string => Boolean(c));

  const weak = dimensions
    .filter((d) => d.score <= 1)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2)
    .map((d) => clauses[d.key]?.gap)
    .filter((c): c is string => Boolean(c));

  if (strong.length === 0 && weak.length === 0) return null;

  // THE HINGE HAS TO MATCH THE CLAUSES. A first pass wrapped the weak half in "What is not yet
  // true is that …", which negates clauses that are already statements of a problem: it produced
  // "what is not yet true is that how the bases are built lives in somebody's head", which says the
  // opposite of what the score means. The clauses stay positive statements of the problem, and the
  // hinge is a contrast rather than a negation.
  const sentences: string[] = [];
  if (strong.length > 0) sentences.push(`${capitalise(list(strong))}.`);
  if (weak.length > 0) {
    sentences.push(strong.length > 0 ? `Against that, ${list(weak)}.` : `${capitalise(list(weak))}.`);
    sentences.push(
      weak.length > 1
        ? 'Those are the failures that show up on the worst day rather than an ordinary one.'
        : 'That is the kind of failure that shows up on the worst day rather than an ordinary one.',
    );
  } else {
    sentences.push('Nothing in the six practices is scoring badly, which is rare.');
  }

  return { text: sentences.join(' '), hasGaps: weak.length > 0 };
}

const capitalise = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
