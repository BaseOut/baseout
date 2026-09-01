/**
 * THE TWO LOCALSTORAGE KEYS, IN ONE PLACE.
 *
 * They were typed out as string literals in four module scripts — `pages/survey.astro`,
 * `pages/thanks.astro`, `layouts/Layout.astro`, and as of 2026-08-31 the splash. Four copies of a
 * string that MUST agree, with nothing to make them agree.
 *
 * The splash is what forced the issue. It now reads the answers key to decide whether anyone has a
 * survey to continue, and a typo there fails in the worst possible way: silently, and only for the
 * returning visitor, who is exactly the person the affordance exists for. Nothing would throw,
 * nothing would log, and the link would simply never appear. A shared constant makes that a build
 * error instead.
 *
 * WHY THE PREFIX SAYS `dbado`. It is the survey's old working name, from before Dan renamed the
 * thing on 2026-08-26. Renaming it now would orphan every part-finished response already in
 * somebody's browser — the key IS the identity of that data, and there is no migration worth
 * writing for a survey that has not launched. It stays wrong on purpose.
 */

/** Every answer given so far, as a JSON object keyed by question id. */
export const ANSWERS_KEY = 'dbado-survey-answers';

/** The scored result, written once at the end so `/thanks` does not rescore on every visit. */
export const RESULT_KEY = 'dbado-survey-result';
