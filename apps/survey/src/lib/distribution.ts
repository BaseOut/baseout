import type { Band } from './maturity';

/**
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 * THE NUMBERS ON THIS PAGE ARE NOT REAL YET. DO NOT SEND THE SURVEY WITH THEM.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════
 *
 * `survey-app/design.md` asks the thank-you page for a comparison as well as a band: *"the report
 * gets a teaser stat (\"only X% reach Engineered\")"*. A band on its own is a label; a band with a
 * population behind it is a measurement, and it is the measurement that makes the result worth
 * repeating to somebody else.
 *
 * THE PROBLEM IS THAT THE POPULATION DOES NOT EXIST. `/api/submit` is still a stub and the
 * `responses` table has not been created (survey-app task 2.1), so nothing has ever been counted.
 * PRODUCT.md is unambiguous about what that means: **"Every number on screen traces to a real
 * source, or it is not shown."**
 *
 * So this file exists to make the shape buildable while keeping the dishonesty impossible to
 * forget. `IS_PLACEHOLDER` is exported and the UI renders a review-only marker beside the stat for
 * as long as it is true. When task 2.1 lands, this file is replaced by a real aggregate over
 * `responses`, the flag goes false, and the marker disappears on its own rather than waiting for
 * somebody to remember it.
 *
 * The shares below are a plausible SHAPE, not a finding: most teams back up something, few have
 * tested a restore, and the top band is thin. Nothing in the report may cite them.
 */
export const IS_PLACEHOLDER = true;

/** Share of respondents in each band, as whole percentages. Must sum to 100. */
export const BAND_SHARE: Record<Band, number> = {
  'Ad hoc': 34,
  Aware: 31,
  Managed: 26,
  Engineered: 9,
};

/** How many people the shares are drawn from. */
export const RESPONDENT_COUNT = 0;

const ORDER: Band[] = ['Ad hoc', 'Aware', 'Managed', 'Engineered'];

/**
 * The share of respondents sitting in a band strictly BELOW this one.
 *
 * Deliberately not "at or below": a respondent is not ahead of the people standing beside them, and
 * a stat that quietly counts your own band inflates every result including the lowest one. Ad hoc
 * correctly returns 0, which is the honest and useful answer for the band that most needs to hear
 * it.
 */
export function shareBelow(band: Band): number {
  const at = ORDER.indexOf(band);
  return ORDER.slice(0, at).reduce((sum, b) => sum + BAND_SHARE[b], 0);
}

/**
 * The comparison line. Two shapes, because the top band and the rest need different sentences: for
 * Engineered the interesting fact is scarcity, for everyone else it is position.
 */
export function comparison(band: Band): string {
  const share = BAND_SHARE[band];
  if (band === 'Engineered') {
    return `Only ${share}% of teams reach Engineered.`;
  }
  const below = shareBelow(band);
  if (below === 0) {
    return `${share}% of teams answer the way you did. It is the most common band, and the one furthest from a tested restore.`;
  }
  return `You are ahead of ${below}% of teams, and ${share}% land where you did.`;
}
