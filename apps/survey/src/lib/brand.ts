/**
 * THE NAME OF THE THING, IN ONE PLACE, BECAUSE IT HAS ALREADY CHANGED ONCE.
 *
 * This shipped as "State of Airtable DevOps". On 2026-08-26 Dan found the title taken and renamed
 * it in Slack: **"State of DevOps for App Platforms" for the Survey/Report and The DOAP Score for the
 * scoring.** That message post-dates the "Initial Impressions" video, so every "SODO score" on the
 * recording is a DOAP Score here.
 *
 * THE PLATFORM IS A SLOT, NOT PART OF THE BRAND. On the video Dan asks for a family: *"eventually
 * I want to brand this as a survey for each platform, so it'll be like your state of DevOps for
 * Airtable or for Notion, and we could run these surveys for the different platforms."* A brand
 * string with "Airtable" welded into it cannot do that. So `BRAND` is platform-free, `PLATFORM`
 * names this edition, and `EDITION` joins them. Running the Notion edition is one line here.
 *
 * The joiner is a colon rather than the em dash Dan says on the video, because DESIGN.md bans em
 * dashes in copy outright. Same rule already applied to his splash strings.
 *
 * OPEN QUESTION (O-1, for Dan). He has not said how the new name carries the platform. This file
 * takes the reading that keeps his stated intent working, and everything on screen changes from
 * here when he answers.
 *
 * ── THE ENTITY IS THE SURVEY ────────────────────────────────────────────────────────────────────
 *
 * Dan, 2026-08-28, spending four minutes of a seven-minute video on exactly this: *"we need to add
 * survey in here, because it's state of DevOps for app platforms SURVEY, that's what is the
 * first-ever."* And, flatly: *"it should never be 'State of DevOps for App Platforms' — it should
 * be survey, because the entity itself is the State of ... Survey."*
 *
 * So the word is IN `BRAND`, not appended at call sites. Every surface that names the thing now
 * names it in full for free, and `REPORT_NAME` composes to "The State of DevOps for App Platforms
 * Survey report" — which is the phrase he asked for out loud: *"I think we need to add like survey
 * report into here."*
 *
 * WHY IT IS ALSO SPLIT IN THREE. He asked for the name to be set apart from its frame: *"maybe we
 * differentiate with a different font, or a different colour — 'State of', and then 'Survey' below,
 * separated from the name."* Only the splash headline sets the three parts differently, and it can
 * only do that if it is handed three strings. Everywhere else joins them back into `BRAND` and
 * never sees the seams.
 *
 * The coined, ownable part is the MIDDLE one. "State of" and "Survey" are the genre words that any
 * industry report carries; "DevOps for App Platforms" is the thing Dan named. That is why the
 * middle is the loud half of the contrast on the splash and the outer two are the quiet half.
 */

/** "State of" — the genre word that opens the name. */
export const BRAND_LEAD = 'State of';

/** The coined part, and the only part that is anyone's property. Platform-free by design. */
export const BRAND_CORE = 'DevOps for App Platforms';

/** "Survey" — what the entity IS, per Dan. Not "report": see `REPORT_NAME`. */
export const BRAND_KIND = 'Survey';

/** The instrument, with no platform in it. Reusable across editions. */
export const BRAND = `${BRAND_LEAD} ${BRAND_CORE} ${BRAND_KIND}`;

/** Which edition this build is. One word to change for the Notion run. */
export const PLATFORM = 'Airtable';

/** The full name of this edition, for headlines and page titles. */
export const EDITION = `${BRAND}: ${PLATFORM}`;

/**
 * The score, named. `SCORE_NAME` carries the article; `SCORE_SHORT` goes inside a sentence.
 *
 * `SCORE_ACRONYM` exists so the letters can be set apart from the word "Score" where a surface
 * wants to mark them: the acronym is the coined thing and the rest of the line is ordinary English.
 */
export const SCORE_NAME = 'The DOAP Score';
export const SCORE_SHORT = 'DOAP Score';
export const SCORE_ACRONYM = 'DOAP';

/**
 * The report the respondent is promised — and it is the INDUSTRY one, always.
 *
 * Dan, 2026-08-28, drawing the line this whole file now depends on: *"there's two things they're
 * getting by filling out this survey. One is their DOAP Score, which is specific to them. The
 * other — the report — is the aggregate, the state of DevOps."* And then the rule: *"maybe we
 * don't call this a report; the report is more the industry overall one."*
 *
 * So `REPORT_NAME` is never the thing on `/thanks`. What the respondent gets at the end is their
 * DOAP Score and its analysis; this constant is what arrives by email months later, once everyone
 * has answered. Anything on the finish page that called itself a report has been renamed.
 */
export const REPORT_NAME = `The ${BRAND} report`;

/**
 * The persistent mark, for the strip that runs across the top of every screen. Dan, 09:19: *"all
 * throughout, I think we should have like a state of DevOps dash Airtable, for kind of branding,
 * that shows throughout."* Rendered uppercase by the stylesheet, so it is written in sentence case
 * here and the separator is a middle dot rather than a dash.
 */
export const MARK = `${BRAND} · ${PLATFORM}`;
