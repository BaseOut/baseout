/**
 * THE REAL QUESTION BANK.
 *
 * Until 2026-08-26 this file held thirteen placeholder questions and said so at the top. The bank
 * below is Dan's own instrument, committed to the repo as `930f40c` and living at
 * `research/survey-app/survey-state-of-airtable-devops.md`. It is transcribed here, not invented:
 * every prompt, option list and conditional traces to a numbered item in that file, and `ref`
 * carries that number so the two can be checked against each other by eye.
 *
 * FOUR THINGS ABOUT THE TRANSCRIPTION, EACH OF WHICH IS A DECISION.
 *
 * 1 · `ref` IS THE ANALYSIS KEY, `id` IS THE CODE KEY. The bank's builder notes make the numbers
 *     the thing that must stay stable ("stable annual IDs", and a shared-core mapping table that
 *     joins this survey to two others by number). Numbers are unreadable in a scoring rubric, so
 *     `id` is a slug and `ref` is the number. `maturity.ts` reads slugs; anything that merges
 *     datasets reads `ref`. Neither may be renamed casually: both are the trend line.
 *
 * 2 · EM DASHES ARE GONE FROM THE COPY. DESIGN.md bans them outright and names the replacements
 *     ("use commas, colons, semicolons, periods or parentheses"). The bank uses them inside dozens
 *     of answer options ("Yes — regularly"). They are commas here. This is the same edit already
 *     applied to Dan's splash strings. It does NOT break the shared-core lock, which is a lock on
 *     WORDING: the words are unchanged, the punctuation is house style, and the join key is `ref`.
 *     En dashes inside numeric ranges (1–2 years, $25–99/mo) are not em dashes and stay.
 *
 * 3 · "Other: ___" OPTIONS ARE RENDERED AS PLAIN OPTIONS. A write-in box behind an option is a
 *     control this renderer does not have, and inventing one silently would produce a field the
 *     analysis plan has never seen. The option is offered, the free text is not collected, and
 *     this is listed as an open question for Dan rather than hidden here.
 *
 * 4 · THE SCREENER REALLY SCREENS. Bank S1: the last two options branch to "thank-you screen +
 *     optional email for the report. Excluded from the core dataset." `isScreenedOut` is that
 *     branch, and `visibleQuestions` collapses the whole instrument to the screener plus the email
 *     when it fires. Asking someone who does not use Airtable about their restore times is how a
 *     benchmark gets poisoned.
 *
 * PAGES WITHIN A SECTION are computed, not filed: see `sectionPages`. Sections here run from two
 * questions to ten, and Dan asked for "maybe three slices in there" rather than for a hand-kept
 * page number per question. A hand-kept one would also drift the moment a conditional opened.
 */

export type Answers = Record<string, string | string[]>;

export type SectionId =
  | 'screener'
  | 'you'
  | 'setup'
  | 'team'
  | 'backup'
  | 'incidents'
  | 'restore'
  | 'change'
  | 'docs'
  | 'access'
  | 'ai'
  | 'invest'
  | 'private'
  | 'wrap';

export interface Section {
  id: SectionId;
  title: string;
  blurb: string;
  /** Shown under the section header on its first page only. Bank section 7 and P both have one. */
  intro?: string;
  /** Section P is optional and never published; the header says so rather than the small print. */
  privateTail?: boolean;
}

/** The fourteen groups, in the bank's order. */
export const SECTIONS: Section[] = [
  {
    id: 'screener',
    title: 'First, a quick check',
    blurb: 'Two questions, so we know whose answers these are.',
  },
  {
    id: 'you',
    title: 'You and your organization',
    blurb: 'Who you are and who owns Airtable where you work.',
  },
  {
    id: 'setup',
    title: 'Your Airtable setup',
    blurb: 'How much Airtable there is, and how much rests on it.',
  },
  {
    id: 'team',
    title: 'Team practices and governance',
    blurb: 'Who can change things, and what is written down.',
  },
  {
    id: 'backup',
    title: 'Backup and recovery',
    blurb: 'What copies exist today, and what is actually inside them.',
  },
  {
    id: 'incidents',
    title: 'Incidents',
    blurb: 'The last twelve months, and what they cost.',
  },
  {
    id: 'restore',
    title: 'Restore readiness',
    blurb: 'What happens when you need one of those copies.',
  },
  {
    id: 'change',
    title: 'Change management',
    blurb: 'Structural changes to bases that are already live.',
    intro:
      'Structural changes are adding, renaming, or deleting tables and fields, or changing automations and interfaces. Not day-to-day data entry.',
  },
  {
    id: 'docs',
    title: 'Documentation and schema visibility',
    blurb: 'Whether anyone but the builder can read the build.',
  },
  {
    id: 'access',
    title: 'Data access and reporting',
    blurb: 'Getting the data out, and what stops you.',
  },
  {
    id: 'ai',
    title: 'AI and Airtable',
    blurb: 'The topic of the year, and what it is already touching.',
  },
  {
    id: 'invest',
    title: 'Investment and priorities',
    blurb: 'What you would fix first, and what it is worth.',
  },
  {
    id: 'private',
    title: 'A few private ones',
    blurb: 'Optional, and never published.',
    intro:
      'Last few, and they are optional. These help Baseout, the team behind On2Air, build the right tool. Your answers here stay private and never appear in the report.',
    privateTail: true,
  },
  {
    id: 'wrap',
    title: 'Wrap-up',
    blurb: 'Where the report should go.',
  },
];

/**
 * The kinds of answer this renderer can take.
 *
 * `number` and `date` are here because Dan asked for them by name on the video (04:28: *"we need a
 * date-based field where they pick the date, and probably like a number-based where they'd enter a
 * number"*). NO QUESTION IN THE COMMITTED BANK USES EITHER ONE: across all 82 items there is not a
 * single date and not a single number, and the closest candidate (5.8, hours per month) is banded
 * on purpose because the analysis plan wants ordinal answers. The controls are built, validated
 * and collected all the same, so a question can be added without touching the renderer. This is
 * open question O-3 for Dan and it is a mismatch, not an oversight.
 *
 * `scale`, `matrix` and `rank` are the reverse case: the bank needs all three (6.4, 9.3; 10.4;
 * 11.1) and Dan did not mention any of them.
 */
export type QuestionKind =
  | 'single'
  | 'multi'
  | 'short'
  | 'long'
  | 'email'
  | 'number'
  | 'date'
  | 'scale'
  | 'matrix'
  | 'rank';

export interface Question {
  /** Code key. Stable: it is what answers are stored under. */
  id: string;
  /** The bank's own number. The analysis and merge key. */
  ref: string;
  section: SectionId;
  kind: QuestionKind;
  prompt: string;
  help?: string;
  /** Options for single / multi / rank. Rows for matrix. */
  options?: string[];
  /**
   * The option that opens a write-in, named exactly as it appears in `options`.
   *
   * The bank writes these as "Other: ___" with a real blank after them, and the first build
   * rendered the option and threw the blank away: picking "Other" recorded the word "Other" and
   * nothing else, on eight questions. The text lands in `answers[id + '_other']` rather than in
   * the answer itself, so the option still counts in the distribution and the free text sits in a
   * column of its own, which is the shape the analysis plan expects.
   */
  otherOption?: string;
  /**
   * Options on a `multi` that cannot be held together with any other, named exactly as they
   * appear in `options`.
   *
   * THIS IS DECLARED, NOT INFERRED, AND THAT IS THE POINT. The obvious shortcut is to match
   * "None"/"Not sure" at render time, and it is a rule nobody can see in the bank and one that
   * misfires the first time a question uses those words without meaning them exclusively. 5.6
   * already offers "We couldn't recover some or all of it", which is a real answer alongside four
   * others and would be wrong to lock. So the bank says which options are exclusive, one question
   * at a time, and the renderer only obeys.
   *
   * EACH STRING MUST MATCH ITS OPTION CHARACTER FOR CHARACTER, apostrophes included — these are
   * typographic apostrophes (’), not ASCII ones — or it silently does nothing at all. `otherOption`
   * has the same hazard and the same answer: a script that asserts every declared string appears
   * verbatim in that question's own `options`.
   *
   * WHY IT IS WORTH THE DECLARATION. Without it a respondent can tick "None of these" AND three
   * other boxes, and the form records both. Three things then go wrong, and the third is not
   * cosmetic. The data contradicts itself and nobody can later tell a misclick from confusion.
   * `hadIncident()` below counts anything that is NOT "None of these", so 5.2 routes a respondent
   * who ticked both into 5.3–5.6 — four screens about an incident they have just said did not
   * happen. And 4.1 is one of the six questions in the core index, where `maturity.ts` takes the
   * BEST of the chosen options: "We don't back up Airtable" ticked together with "A third-party
   * backup tool" resolves silently to the better of the two. That is 3 raw points of 18, roughly
   * 17 points of the final 0-100 score, moved by one stray tick.
   *
   * "OTHER" IS NEVER EXCLUSIVE. It combines with everything, which is the whole point of a
   * write-in on a multi.
   */
  exclusiveOptions?: string[];
  /** Ends of a `scale` or the columns of a `matrix`. Defaults to the 1..5 pair below. */
  scaleLow?: string;
  scaleHigh?: string;
  /** How many of `options` a `rank` question wants ordered. */
  rankPick?: number;
  required?: boolean;
  /** Render this step only when the predicate over prior answers passes. */
  showIf?: (answers: Answers) => boolean;
  /** Force a page break before this question inside its section. */
  newPage?: boolean;
  /**
   * Force a page break AFTER this question, because other questions are waiting on its answer.
   *
   * THIS FLAG EXISTS BECAUSE FIVE QUESTIONS WERE NEVER ASKED. A page is built from the answers as
   * they stand when it is built, so a `showIf` that reads an answer given on the SAME page is
   * always false at that moment: the question is filtered out, the page is submitted, and by the
   * time the condition turns true the flow has moved past the page it belonged to. 4.2, 4.4, 4.7,
   * 8.2 and 9.2 were all lost this way, silently, including the one that feeds the report's
   * coverage section. Nothing failed; the questions simply did not exist.
   *
   * Ending the trigger's page is the fix: the answer is committed before the next page is built,
   * so the dependants are visible when it is. The cost is a short page, which is the right shape
   * for a question that decides what gets asked next.
   */
  endsPage?: boolean;
}

/**
 * Bumped with the SHAPE of the instrument. Progress rows are keyed by it, so an answer set from
 * the thirteen-question placeholder build cannot be resumed into this one, which is the correct
 * outcome rather than a loss.
 */
export const SURVEY_VERSION = 'dbado-airtable-v1';

/** 1.1's agency option, named because three other things branch on it. */
export const AGENCY_ROLE = 'Airtable consultant / agency serving multiple clients';

/** S1's agency option. Section P's conditional reads "S1 or 1.1", so both are named. */
export const AGENCY_RELATIONSHIP = 'I build for clients as a consultant / freelancer / agency';

/** The two S1 answers that end the survey. Bank S1: excluded from the core dataset. */
export const SCREENED_OUT = [
  'I evaluated Airtable but don’t actively use it',
  'I don’t use Airtable',
];

const has = (value: string | string[] | undefined, option: string): boolean =>
  Array.isArray(value) ? value.includes(option) : value === option;

export const questions: Question[] = [
  // ── S · Screener ──────────────────────────────────────────────────────────────────────────────
  {
    id: 'relationship',
    ref: 'S1',
    section: 'screener',
    kind: 'single',
    prompt: 'How would you describe your relationship with Airtable?',
    options: [
      'I build and manage bases regularly, it’s part of my job',
      AGENCY_RELATIONSHIP,
      'I use bases that others built',
      'I administer Airtable for my organization but don’t build much',
      ...SCREENED_OUT,
    ],
    required: true,
  },
  {
    id: 'tenure',
    ref: 'S2',
    section: 'screener',
    kind: 'single',
    prompt: 'How long have you been working with Airtable?',
    options: ['Under 1 year', '1–2 years', '3–5 years', '5+ years'],
    required: true,
  },

  // ── 1 · You and your organization ─────────────────────────────────────────────────────────────
  {
    id: 'role',
    ref: '1.1',
    section: 'you',
    kind: 'single',
    prompt: 'Which best describes your role?',
    options: [
      AGENCY_ROLE,
      'Internal Airtable admin, "the Airtable person" at my company',
      'Operations / RevOps / BizOps',
      'IT / engineering',
      'Founder / executive',
      'Other',
    ],
    otherOption: 'Other',
    required: true,
  },
  {
    id: 'org_size',
    ref: '1.2',
    section: 'you',
    kind: 'single',
    prompt: 'How many people are in your organization?',
    options: ['Just me', '2–10', '11–50', '51–200', '201–1,000', '1,000+'],
    required: true,
  },
  {
    id: 'industry',
    ref: '1.3',
    section: 'you',
    kind: 'single',
    prompt: 'What industry is your organization in?',
    options: [
      'Technology / SaaS',
      'Professional services & consulting',
      'Marketing / creative',
      'Manufacturing / logistics',
      'Healthcare',
      'Education',
      'Nonprofit',
      'Finance',
      'Real estate / construction',
      'Media / entertainment',
      'Government',
      'Other',
    ],
    otherOption: 'Other',
  },
  {
    id: 'region',
    ref: '1.4',
    section: 'you',
    kind: 'single',
    prompt: 'Where are you located?',
    options: [
      'North America',
      'Europe',
      'UK & Ireland',
      'Latin America',
      'Asia-Pacific',
      'Middle East & Africa',
    ],
  },
  {
    /**
     * MULTI, AGAINST THE BANK, AND THIS IS THE CLEAREST CASE IN THE INSTRUMENT.
     *
     * The bank marks 1.5 single select. Its own options are not mutually exclusive and are not
     * even unusual together: "Me, informally" plus "An external consultant / agency" is the
     * standard shape of a small company with a contractor, and "IT owns it" plus a dedicated ops
     * team is the standard shape of a large one. Forcing one answer makes every respondent in
     * either situation discard a true one, and the resulting chart reads as though ownership is
     * always in exactly one place.
     *
     * Safe to change: 1.5 is not in the shared-core mapping table, so no other survey merges
     * against it, and no index scores it.
     */
    id: 'ownership',
    ref: '1.5',
    section: 'you',
    kind: 'multi',
    prompt: 'Who is responsible for Airtable in your organization?',
    help: 'Select all that apply. Responsibility is often in more than one place.',
    options: [
      'Me, formally. It’s in my job description',
      'Me, informally. It became mine by default',
      'A dedicated Airtable / ops team',
      'IT owns it',
      'Nobody, really',
      'An external consultant / agency',
      'Someone else',
    ],
    exclusiveOptions: [
      'Nobody, really',
    ],
    otherOption: 'Someone else',
    required: true,
  },

  // ── 2 · Your Airtable setup ───────────────────────────────────────────────────────────────────
  {
    id: 'plan',
    ref: '2.1',
    section: 'setup',
    kind: 'single',
    prompt: 'Which Airtable plan are you on?',
    options: ['Free', 'Team', 'Business', 'Enterprise Scale', 'Multiple plans (consultant)', 'Not sure'],
    required: true,
  },
  {
    id: 'base_count',
    ref: '2.2',
    section: 'setup',
    kind: 'single',
    prompt: 'Roughly how many Airtable bases do you (or your clients) actively maintain?',
    options: ['1–3', '4–10', '11–25', '26–100', '100+'],
    required: true,
  },
  {
    id: 'largest_base',
    ref: '2.3',
    section: 'setup',
    kind: 'single',
    prompt: 'Roughly how many records are in your largest base?',
    options: ['Under 10k', '10k–50k', '50k–125k', '125k–500k', '500k+', 'Not sure'],
    required: true,
  },
  {
    id: 'builder_count',
    ref: '2.4',
    section: 'setup',
    kind: 'single',
    prompt: 'How many people actively build in your bases?',
    help: 'Create tables, fields, automations. Not just enter data.',
    options: ['Just me', '2–3', '4–10', '11+', 'Not sure'],
    required: true,
  },
  {
    id: 'criticality',
    ref: '2.5',
    section: 'setup',
    kind: 'single',
    newPage: true,
    prompt: 'How business-critical is the data in Airtable?',
    options: [
      'Mission-critical. The business stops without it',
      'Important. Major disruption if lost, but we’d survive',
      'Useful. Inconvenient to lose',
      'Experimental / low stakes',
    ],
    required: true,
  },
  {
    id: 'workloads',
    ref: '2.6',
    section: 'setup',
    kind: 'multi',
    prompt: 'What runs on your most important bases?',
    help: 'Select all that apply.',
    options: [
      'Customer / CRM data',
      'Project & operations management',
      'Product / inventory data',
      'Finance / billing data',
      'HR / people data',
      'Content / marketing',
      'Client deliverables (consultants)',
      'Other',
    ],
    otherOption: 'Other',
  },
  {
    id: 'automation_count',
    ref: '2.7',
    section: 'setup',
    kind: 'single',
    prompt: 'Roughly how many automations run across your important bases?',
    options: ['None', '1–10', '11–50', '51–200', '200+', 'Not sure'],
    required: true,
  },
  {
    id: 'external_connections',
    ref: '2.8',
    section: 'setup',
    kind: 'multi',
    prompt: 'What connects to your Airtable data from outside?',
    help: 'Select all that apply.',
    options: [
      'Zapier / Make / n8n workflows',
      'Custom code via the API',
      'Interfaces used by people outside the core team',
      'Airtable forms (or third-party forms) feeding data in',
      'Sync to or from other tools (CRM, spreadsheets, databases)',
      'BI / reporting tools',
      'AI tools or agents',
      'Nothing external',
      'Not sure',
      'Other',
    ],
    exclusiveOptions: [
      'Nothing external',
      'Not sure',
    ],
    otherOption: 'Other',
    required: true,
  },

  // ── 3 · Team practices and governance ─────────────────────────────────────────────────────────
  {
    id: 'who_can_change',
    ref: '3.1',
    section: 'team',
    kind: 'single',
    prompt: 'Who can change the structure of your important bases?',
    help: 'Add, rename, or delete tables and fields.',
    options: [
      'One designated builder / admin only',
      'A small, defined group of builders',
      'Most collaborators have creator access',
      'Honestly, almost anyone in the workspace',
      'Not sure',
    ],
    required: true,
  },
  {
    id: 'conventions',
    ref: '3.2',
    section: 'team',
    kind: 'single',
    prompt: 'Do you have written rules or conventions for building in Airtable?',
    help: 'Naming, field descriptions, who approves changes.',
    options: [
      'Yes, documented and generally followed',
      'Yes, documented but rarely followed',
      'Informal habits, nothing written',
      'No',
    ],
    required: true,
  },
  {
    id: 'offboarding',
    ref: '3.3',
    section: 'team',
    kind: 'single',
    prompt:
      'When someone leaves the team or a project, is there a process for their Airtable access and the bases they built?',
    options: [
      'Yes, access review and handover are standard',
      'Partially. Access gets removed, knowledge walks out the door',
      'No, we’ve been burned by this',
      'No, but it hasn’t hurt us yet',
      'Not sure',
    ],
    required: true,
  },
  {
    id: 'capabilities',
    ref: '3.4',
    section: 'team',
    kind: 'multi',
    newPage: true,
    prompt: 'Which of these do you have in place today?',
    help: 'Select all that apply.',
    options: [
      'A record of what changed and when',
      'A safe way to test changes before they go live',
      'Up-to-date documentation of how things are built',
      'Monitoring or alerts when something breaks',
      'A way to freely query or export the data (SQL or API)',
      'An external backup we control',
      'Access controls or an audit trail',
      'A named backup owner for critical bases, someone besides the original builder',
      'None of these',
      'Other',
    ],
    exclusiveOptions: [
      'None of these',
    ],
    otherOption: 'Other',
    required: true,
  },

  // ── 4 · Backup and recovery ───────────────────────────────────────────────────────────────────
  {
    id: 'backup_method',
    ref: '4.1',
    section: 'backup',
    kind: 'multi',
    prompt: 'How do you back up your Airtable data today?',
    help: 'Select all that apply.',
    options: [
      'Airtable’s built-in snapshots / revision history only',
      'A third-party backup tool (On2Air, etc.)',
      'Custom scripts / API export we built ourselves',
      'Manual CSV exports',
      'Zapier / Make syncing to another system',
      'We don’t back up Airtable',
      'Not sure',
    ],
    exclusiveOptions: [
      'We don’t back up Airtable',
      'Not sure',
    ],
    required: true,
    endsPage: true,
  },
  {
    id: 'backup_frequency',
    ref: '4.2',
    section: 'backup',
    kind: 'single',
    prompt: 'How often do backups run?',
    options: [
      'Continuously / near-real-time',
      'Daily',
      'Weekly',
      'Monthly',
      'Irregularly, when someone remembers',
      'Not sure',
    ],
    showIf: (a) => backsUpBeyondBuiltIn(a),
  },
  {
    id: 'external_copy',
    ref: '4.3',
    section: 'backup',
    kind: 'single',
    prompt: 'Does a copy of your Airtable data exist outside Airtable right now?',
    help: 'A file, database, or export you could open if Airtable were unreachable.',
    options: [
      'Yes, current within the last week',
      'Yes, but probably stale',
      'No, everything lives inside Airtable',
      'Not sure',
    ],
    required: true,
  },
  {
    id: 'backup_coverage',
    ref: '4.4',
    section: 'backup',
    kind: 'multi',
    prompt: 'What does your backup actually include?',
    help: 'Check everything you are confident is captured.',
    options: [
      'Records (the data itself)',
      'Attachment files (the actual files, not just links)',
      'Base structure (tables, fields, field types)',
      'Views and their configurations',
      'Automations',
      'Interfaces',
      'Comments',
      'Not sure what it includes',
    ],
    exclusiveOptions: [
      'Not sure what it includes',
    ],
    showIf: (a) => backsUpAtAll(a),
  },
  {
    id: 'retention_awareness',
    ref: '4.5',
    section: 'backup',
    kind: 'single',
    newPage: true,
    prompt: 'Do you know how long your Airtable plan retains snapshots and revision history?',
    options: [
      'Yes, I know the exact windows',
      'Roughly, I’d have to check',
      'No, I assumed it was forever',
      'No, never thought about it',
    ],
    required: true,
  },
  {
    id: 'external_requirement',
    ref: '4.6',
    section: 'backup',
    kind: 'single',
    prompt: 'Does anyone outside your team require your Airtable data to be backed up?',
    help: 'Clients, security reviews, compliance, insurance, leadership.',
    options: [
      'Yes, a formal requirement (compliance, contract, or security review)',
      'Yes, an informal expectation',
      'No',
      'Not sure',
    ],
    required: true,
    endsPage: true,
  },
  {
    id: 'requirement_kind',
    ref: '4.7',
    section: 'backup',
    kind: 'multi',
    prompt: 'Which of these does that requirement involve?',
    help: 'Select all that apply.',
    options: [
      'A security questionnaire or vendor review asked about it',
      'A client contract requires it',
      'A compliance framework (SOC 2, ISO 27001, HIPAA, GDPR retention)',
      'Cyber-insurance requirements',
      'Internal audit or leadership mandate',
      'Other',
    ],
    otherOption: 'Other',
    showIf: (a) =>
      a.external_requirement === 'Yes, a formal requirement (compliance, contract, or security review)',
  },
  {
    id: 'backup_tools',
    ref: '4.8',
    section: 'backup',
    kind: 'multi',
    prompt: 'Which third-party backup tool do you use?',
    help: 'Select all that apply.',
    options: [
      'On2Air Backups',
      'Baseout',
      'ProBackup',
      'AirBackups',
      'A sync tool used as backup (Whalesync, Stacksync, etc.)',
      'Something we built ourselves on another platform',
      'Other',
    ],
    otherOption: 'Other',
    showIf: (a) => has(a.backup_method, 'A third-party backup tool (On2Air, etc.)'),
  },

  // ── 5 · Incidents ─────────────────────────────────────────────────────────────────────────────
  {
    id: 'incident_count',
    ref: '5.1',
    section: 'incidents',
    kind: 'single',
    prompt:
      'In the last 12 months, how many times have you lost or corrupted Airtable data badly enough that you had to act?',
    help: 'Deleted records, tables or fields, a bad automation run, a sync overwrite.',
    options: ['Never', 'Once', '2–5 times', '6+ times', 'Not sure'],
    required: true,
  },
  {
    id: 'incident_kinds',
    ref: '5.2',
    section: 'incidents',
    kind: 'multi',
    prompt: 'In the last 12 months, which of these have you experienced?',
    help: 'Select all that apply.',
    options: [
      'A change broke something in a live system',
      'An automation failed silently, and we found out late',
      'Data was lost, overwritten, or corrupted',
      'We couldn’t tell what changed, or who changed it',
      'A client or stakeholder spotted a problem before we did',
      'None of these',
      'Other',
    ],
    exclusiveOptions: [
      'None of these',
    ],
    otherOption: 'Other',
    required: true,
  },
  {
    /**
     * MULTI, AGAINST THE BANK. Incidents chain: a departing employee's automation keeps running
     * and a sync overwrites what it wrote. Asked as a single select, the respondent picks the
     * proximate cause and the chain is lost, which is precisely the story the report's incident
     * funnel is trying to tell. As a multi it still produces a distribution, now read as "share of
     * worst incidents that involved X" rather than "share whose single cause was X".
     *
     * Safe to change: 5.3 is not in the shared-core mapping table and no index scores it. The
     * reading of the resulting chart changes, so it is called out for Dan rather than left quiet.
     */
    id: 'incident_cause',
    ref: '5.3',
    section: 'incidents',
    kind: 'multi',
    newPage: true,
    prompt: 'Thinking of the worst incident: what caused it?',
    help: 'Select everything that played a part.',
    options: [
      'Someone deleted records, tables or fields by accident',
      'An automation or script misbehaved',
      'A sync or integration overwrote good data',
      'A departing employee or offboarding issue',
      'An external collaborator’s change',
      'An AI tool or agent made unwanted changes',
      'Not sure',
      'Other',
    ],
    exclusiveOptions: [
      'Not sure',
    ],
    otherOption: 'Other',
    showIf: (a) => hadIncident(a),
  },
  {
    id: 'incident_detection',
    ref: '5.4',
    section: 'incidents',
    kind: 'single',
    prompt: 'How long did it take to notice that incident had happened?',
    options: ['Minutes', 'Hours', 'Days', 'Weeks or longer', 'We found it by accident'],
    showIf: (a) => hadIncident(a),
  },
  {
    id: 'incident_recovery',
    ref: '5.5',
    section: 'incidents',
    kind: 'single',
    prompt: 'How long did it take to get back to a working state?',
    options: ['Under an hour', 'Same day', 'A few days', 'A week or more', 'We never fully recovered'],
    showIf: (a) => hadIncident(a),
  },
  {
    id: 'recovery_involved',
    ref: '5.6',
    section: 'incidents',
    kind: 'multi',
    prompt: 'What did recovery involve?',
    help: 'Select all that apply.',
    options: [
      'Airtable’s undo or revision history',
      'Restoring records from Airtable’s trash',
      'Restoring a base snapshot (and rebuilding links and integrations)',
      'Restoring from an external backup',
      'Manually re-entering data',
      'Contacting Airtable support',
      'We couldn’t recover some or all of it',
      'Other',
    ],
    otherOption: 'Other',
    showIf: (a) => hadIncident(a),
  },
  {
    id: 'permanent_loss',
    ref: '5.7',
    section: 'incidents',
    kind: 'single',
    newPage: true,
    prompt: 'Have you ever permanently lost Airtable data, gone for good?',
    options: [
      'Yes',
      'No, but only because we got lucky',
      'No, we’ve always recovered',
      'Never had an incident',
    ],
    required: true,
  },
  {
    id: 'safety_hours',
    ref: '5.8',
    section: 'incidents',
    kind: 'single',
    prompt: 'Roughly how much time per month goes to manual safety work?',
    help: 'Taking backups, updating docs, double-checking changes, firefighting.',
    options: ['Under 1 hour', '1–4 hours', '5–15 hours', '15+ hours'],
    required: true,
  },
  {
    id: 'knock_on_cost',
    ref: '5.9',
    section: 'incidents',
    kind: 'single',
    prompt: 'What has been the biggest knock-on cost when something went wrong?',
    options: [
      'Data we couldn’t fully recover',
      'Firefighting hours and lost productivity',
      'We’re afraid to change things now, so we move slowly',
      'A client or leadership lost trust',
      'We were blocked from BI, AI, or reporting we wanted',
      'Revenue or customer impact',
      'Nothing significant has gone wrong',
      'Other',
    ],
    otherOption: 'Other',
    required: true,
  },

  // ── 6 · Restore readiness ─────────────────────────────────────────────────────────────────────
  {
    id: 'restore_speed',
    ref: '6.1',
    section: 'restore',
    kind: 'single',
    prompt:
      'If your most important base disappeared right now, how long would it take to get back to a working state?',
    options: [
      'Under an hour',
      'Same day',
      'A few days',
      'A week or more',
      'We might never fully recover',
      'No idea',
    ],
    required: true,
  },
  {
    id: 'restore_tested',
    ref: '6.2',
    section: 'restore',
    kind: 'single',
    prompt: 'Have you ever tested restoring from a backup, not just taking backups?',
    options: [
      'Yes, regularly',
      'Yes, once or twice',
      'No, but we have backups',
      'No, we have no backups to test',
    ],
    required: true,
  },
  {
    id: 'rto_target',
    ref: '6.3',
    section: 'restore',
    kind: 'single',
    prompt: 'Do you have an explicit target for how quickly you would need to recover?',
    help: 'Even an informal one.',
    options: [
      'Yes, written down and tested against',
      'Yes, informal ("we’d need it back same-day")',
      'No, never discussed',
      'Not applicable',
    ],
    required: true,
  },
  {
    id: 'restore_confidence',
    ref: '6.4',
    section: 'restore',
    kind: 'scale',
    newPage: true,
    prompt:
      'How confident are you that you could fully recover your most important base after a serious incident?',
    help: 'Structure, data, automations, interfaces, and integrations.',
    scaleLow: 'Not at all confident',
    scaleHigh: 'Completely confident',
    required: true,
  },
  {
    id: 'snapshot_rewiring',
    ref: '6.5',
    section: 'restore',
    kind: 'single',
    prompt:
      'Have you ever restored an Airtable snapshot and had to rewire what depended on the base?',
    help: 'Integrations, share links, embedded views.',
    options: [
      'Yes, the rewiring was the hardest part',
      'Yes, minor rewiring',
      'Restored, nothing depended on it',
      'Never restored a snapshot',
    ],
  },

  // ── 7 · Change management ─────────────────────────────────────────────────────────────────────
  {
    id: 'change_frequency',
    ref: '7.1',
    section: 'change',
    kind: 'single',
    prompt: 'How often does someone make a structural change to your important bases?',
    options: ['Daily', 'Weekly', 'Monthly', 'A few times a year', 'Almost never', 'Not sure'],
    required: true,
  },
  {
    id: 'change_lead_time',
    ref: '7.2',
    section: 'change',
    kind: 'single',
    prompt:
      'When you decide to make a significant change, how long does it usually take to go from decision to live?',
    help: 'A restructure, a new automation.',
    options: [
      'Same day',
      'Within a week',
      'Within a month',
      'Longer',
      'We avoid significant changes',
    ],
    required: true,
  },
  {
    id: 'change_testing',
    ref: '7.3',
    section: 'change',
    kind: 'single',
    prompt: 'How do you test risky changes before they hit the live base?',
    help: 'New automations, restructures.',
    options: [
      'We duplicate the base and test in the copy',
      'We test in the live base carefully (off-hours, small batches)',
      'We just make the change and watch',
      'We have a formal dev / staging / prod-style process',
      'Not applicable, we rarely make risky changes',
    ],
    required: true,
  },
  {
    id: 'change_failure_rate',
    ref: '7.4',
    section: 'change',
    kind: 'single',
    prompt: 'Roughly what share of structural changes cause something to break?',
    help: 'An automation, integration, formula, interface, or report.',
    options: ['Almost none', 'Under 10%', '10–25%', 'More than 25%', 'Not sure'],
    required: true,
  },
  {
    id: 'schema_break',
    ref: '7.5',
    section: 'change',
    kind: 'single',
    newPage: true,
    prompt: 'Has a schema change ever broken something?',
    help: 'A renamed or deleted field breaking an automation, integration, formula, or interface.',
    options: ['Yes, more than once', 'Yes, once', 'Not that I know of', 'No'],
    required: true,
  },
  {
    id: 'change_attribution',
    ref: '7.6',
    section: 'change',
    kind: 'single',
    prompt:
      'When something breaks, how easy is it to answer "what changed, when, and who changed it"?',
    options: [
      'Easy, we have change history we trust',
      'Possible, but slow and painful',
      'Basically impossible',
      'Never needed to',
    ],
    required: true,
  },
  {
    id: 'time_to_fix',
    ref: '7.7',
    section: 'change',
    kind: 'single',
    prompt: 'When something breaks, how long does it usually take to find the cause and fix it?',
    options: [
      'Under an hour',
      'A few hours',
      'A day or two',
      'Longer',
      'It’s still broken somewhere, probably',
    ],
    required: true,
  },
  {
    id: 'dependency_visibility',
    ref: '7.8',
    section: 'change',
    kind: 'single',
    prompt: 'Before renaming or deleting a field, can you see what depends on it?',
    help: 'Automations, integrations, formulas, interfaces.',
    options: [
      'Yes, we have dependency visibility',
      'Partially, within Airtable but not external tools',
      'No, we find out when something breaks',
      'Never thought to check',
    ],
  },
  {
    id: 'pre_change_snapshot',
    ref: '7.9',
    section: 'change',
    kind: 'single',
    newPage: true,
    prompt: 'Do you take a snapshot before making a risky change?',
    options: ['Always', 'Usually', 'Sometimes', 'Never', 'Didn’t know that was a thing'],
  },
  {
    id: 'app_sandbox',
    ref: '7.10',
    section: 'change',
    kind: 'single',
    prompt: 'Do you use Airtable’s App Sandbox?',
    help: 'It lets you test schema and automation changes in a copy, then publish them back.',
    options: [
      'Yes, regularly',
      'Tried it',
      'Know of it, haven’t used it',
      'Never heard of it',
      'Not on a plan that has it (Business and Enterprise only)',
    ],
    required: true,
  },

  // ── 8 · Documentation and schema visibility ───────────────────────────────────────────────────
  {
    id: 'schema_tracking',
    ref: '8.1',
    section: 'docs',
    kind: 'single',
    prompt: 'How do you keep track of how your bases are structured?',
    help: 'Tables, fields, relationships.',
    options: [
      'It’s all in my head, or the builder’s head',
      'Docs we maintain by hand (Notion, Google Docs, etc.)',
      'A diagramming tool (Whimsical, Lucidchart, etc.) updated manually',
      'A tool that auto-generates schema documentation',
      'We don’t, we open the base and look',
    ],
    required: true,
    endsPage: true,
  },
  {
    id: 'docs_currency',
    ref: '8.2',
    section: 'docs',
    kind: 'single',
    prompt: 'How current is that documentation?',
    options: ['Current, updated when the base changes', 'Months behind', 'Historical fiction at this point'],
    showIf: (a) =>
      a.schema_tracking === 'Docs we maintain by hand (Notion, Google Docs, etc.)' ||
      a.schema_tracking === 'A diagramming tool (Whimsical, Lucidchart, etc.) updated manually' ||
      a.schema_tracking === 'A tool that auto-generates schema documentation',
  },
  {
    id: 'field_descriptions',
    ref: '8.3',
    section: 'docs',
    kind: 'single',
    prompt: 'Do you use field descriptions in Airtable?',
    options: [
      'Yes, consistently, on most fields',
      'On the important or confusing fields',
      'Rarely',
      'Didn’t know fields had descriptions',
    ],
    required: true,
  },
  {
    id: 'logic_docs',
    ref: '8.4',
    section: 'docs',
    kind: 'single',
    newPage: true,
    prompt: 'Are your automations and interfaces documented anywhere outside Airtable?',
    help: 'What they do, what they touch, why they exist.',
    options: [
      'Yes, documented and current',
      'Partially, the important ones',
      'No, the base is the documentation',
      'Not sure',
    ],
    required: true,
  },
  {
    id: 'archaeology_time',
    ref: '8.5',
    section: 'docs',
    kind: 'single',
    prompt: 'Roughly how much of your team’s time goes to archaeology?',
    help: 'Figuring out how a base works, what a field is for, why something broke.',
    options: ['Hours every week', 'A few hours a month', 'Rarely', 'Never'],
    required: true,
  },
  {
    id: 'handover_time',
    ref: '8.6',
    section: 'docs',
    kind: 'single',
    prompt:
      'If a new person had to take over your most important base tomorrow, how long until they could maintain it safely?',
    options: ['Days', 'Weeks', 'Months', 'It would be very bad'],
  },

  // ── 9 · Data access and reporting ─────────────────────────────────────────────────────────────
  {
    id: 'needs_external',
    ref: '9.1',
    section: 'access',
    kind: 'single',
    prompt: 'Do you ever need your Airtable data outside Airtable?',
    help: 'SQL, BI tools, custom apps, spreadsheets.',
    options: [
      'Yes, constantly. It’s core to how we work',
      'Yes, occasionally',
      'No, everything stays in Airtable',
      'Not yet, but we’re heading there',
    ],
    required: true,
    endsPage: true,
  },
  {
    id: 'export_methods',
    ref: '9.2',
    section: 'access',
    kind: 'multi',
    prompt: 'How do you get it out today?',
    help: 'Select all that apply.',
    options: [
      'CSV exports',
      'Airtable API + custom code',
      'Zapier / Make',
      'A sync tool (Whalesync, Coefficient, etc.)',
      'Airtable’s native BI connectors',
      'Other',
    ],
    otherOption: 'Other',
    showIf: (a) =>
      a.needs_external === 'Yes, constantly. It’s core to how we work' ||
      a.needs_external === 'Yes, occasionally',
  },
  {
    id: 'sql_interest',
    ref: '9.3',
    section: 'access',
    kind: 'scale',
    prompt:
      'How interested are you in a continuously-synced SQL database of your Airtable data?',
    help: 'Queryable with SQL, BI tools, or your own code.',
    scaleLow: 'Not interested',
    scaleHigh: 'Extremely interested',
    required: true,
  },
  {
    id: 'platform_limits',
    ref: '9.4',
    section: 'access',
    kind: 'single',
    newPage: true,
    prompt: 'Have Airtable’s platform limits ever constrained something you were running or building?',
    help: 'API rate limits, monthly automation run caps, record caps per base.',
    options: [
      'Yes, a real blocker. Something stopped working',
      'Yes, annoying but workable',
      'No',
      'Didn’t know there were limits',
    ],
  },
  {
    id: 'other_platforms',
    ref: '9.5',
    section: 'access',
    kind: 'multi',
    prompt: 'Which other platforms would you want the same backup and DevOps protection for?',
    help: 'Select all that apply.',
    options: [
      'Notion',
      'monday.com',
      'ClickUp',
      'SmartSuite',
      'HubSpot',
      'Salesforce',
      'Another platform',
      'None, Airtable is the one that matters',
    ],
    exclusiveOptions: [
      'None, Airtable is the one that matters',
    ],
    otherOption: 'Another platform',
    required: true,
  },

  // ── 10 · AI and Airtable ──────────────────────────────────────────────────────────────────────
  {
    id: 'ai_usage',
    ref: '10.1',
    section: 'ai',
    kind: 'single',
    prompt: 'Is your team using Airtable’s AI capabilities?',
    help: 'Omni, AI fields, agents.',
    options: ['Yes, regularly, in production bases', 'Experimenting', 'Tried it, not using it', 'No', 'Not sure'],
    required: true,
  },
  {
    id: 'ai_writes',
    ref: '10.2',
    section: 'ai',
    kind: 'single',
    prompt: 'Do AI tools or agents ever make changes to your bases?',
    help: 'Airtable’s or external. Creating structure, editing records, building automations.',
    options: [
      'Yes, routinely',
      'Yes, occasionally, supervised',
      'We’ve tested it',
      'No',
      'Not sure',
    ],
    required: true,
  },
  {
    id: 'ai_concern',
    ref: '10.3',
    section: 'ai',
    kind: 'single',
    prompt: 'How does AI change your level of concern about unwanted changes to your data and base structure?',
    options: [
      'More concerned. AI raises the risk of changes nobody reviewed',
      'About the same',
      'Less concerned. AI helps us catch problems',
      'Haven’t thought about it',
    ],
    required: true,
  },
  {
    id: 'ai_interest',
    ref: '10.4',
    section: 'ai',
    kind: 'matrix',
    newPage: true,
    prompt: 'How interested are you in AI applied to protecting and understanding your data?',
    help: 'One rating per row.',
    options: [
      'Ask questions about your data in plain English (chat)',
      'AI-generated documentation of your bases',
      'Connecting your data to AI assistants you already use (Claude, ChatGPT) via MCP',
      'AI flagging anomalies (sudden deletions, unusual data changes)',
    ],
    scaleLow: 'Not interested',
    scaleHigh: 'Extremely interested',
    required: true,
  },
  {
    id: 'ai_connected',
    ref: '10.5',
    section: 'ai',
    kind: 'single',
    prompt: 'Do you connect external AI assistants to your Airtable data today?',
    help: 'Claude, ChatGPT and the like, via MCP or connectors.',
    options: [
      'Yes, regularly',
      'Experimenting',
      'No, but planning to',
      'No',
      'Didn’t know that was possible',
    ],
    required: true,
  },

  // ── 11 · Investment and priorities ────────────────────────────────────────────────────────────
  {
    id: 'priorities',
    ref: '11.1',
    section: 'invest',
    kind: 'rank',
    prompt: 'Rank your top 3 priorities for an Airtable data platform.',
    options: [
      'Reliable automated backups',
      'Fast, easy restore when something breaks',
      'Schema visibility (diagrams, changelog, docs)',
      'Change alerts & monitoring',
      'SQL / external access to my data',
      'Automation & interface backup',
      'Governance / compliance (audit trails, PII detection, retention)',
      'AI features on my data',
    ],
    rankPick: 3,
    required: true,
  },
  {
    id: 'current_spend',
    ref: '11.2',
    section: 'invest',
    kind: 'single',
    newPage: true,
    prompt:
      'What does your organization spend today on Airtable backup or management tooling?',
    help: 'Excluding Airtable itself.',
    options: ['$0', 'Under $25/mo', '$25–99/mo', '$100–299/mo', '$300–999/mo', '$1,000+/mo'],
    required: true,
  },
  {
    id: 'justifiable_budget',
    ref: '11.3',
    section: 'invest',
    kind: 'single',
    prompt:
      'For a tool that solved your top 3 priorities well, what monthly budget could you realistically justify?',
    options: [
      'Under $25',
      '$25–49',
      '$50–99',
      '$100–199',
      '$200–399',
      '$400+',
      'Depends entirely on client billing (consultant)',
    ],
    required: true,
  },
  {
    id: 'trajectory',
    ref: '11.4',
    section: 'invest',
    kind: 'single',
    prompt: 'Over the next 12 months, is your organization’s use of Airtable...',
    options: [
      'Growing. More bases, more people, more critical',
      'Steady',
      'Shrinking, or migrating away',
      'Not sure',
    ],
    required: true,
  },
  {
    id: 'self_assessment',
    ref: '11.5',
    section: 'invest',
    kind: 'single',
    newPage: true,
    prompt: 'Honestly: how mature is your team’s Airtable data protection and change management?',
    options: [
      'We wing it',
      'We have the basics, with gaps',
      'Solid. Automated and documented',
      'Engineered. We’d pass an audit tomorrow',
    ],
    required: true,
  },
  /* THE THREE FREE-TEXT QUESTIONS, AND WHY THEIR HELPER TEXT LISTS NOTHING. Added 2026-08-28.
     11.6, 11.7 and 12.4 are the entire open-ended surface of an 82-question instrument. All three
     ran with no `help` at all until this date, and the change brief recorded a helper on 11.6 and
     11.7 that is kept here verbatim so restoring it stays a copy-paste:

       'Change history, safe restores, monitoring and alerts, always-current docs, a live SQL or
        API copy of your data, and an external backup you own.'

     THAT STRING IS STILL LIVE IN THIS FILE, ONCE, ON P1, where the prompt says "all of this" and
     the list is the definition of it. It is deliberately not used on these three. It enumerates
     the Baseout product surface, so a respondent asked what frustrates them would be choosing from
     our own menu, and the result reads back as market demand when it is an echo of the prompt.
     Read this note before restoring it; it is the client's own wording, and the client agreed.

     WHAT REPLACED IT DOES A DIFFERENT JOB. Smyth, Dillman, Christian & McBride (2009, POQ 73(2))
     found that any introduction making response quality and length salient improves open-ended
     answers: the mechanism is the reader believing a person reads this and that substance counts.
     An example list does the opposite, because it lowers the effort to a pick. So each helper says
     the answer is read, pushes for specificity, and supplies neither content nor a direction.
     They are not placeholders (Kunz, Quoß & Gummer 2021, JSSAM 9(5): "we advise against using
     them" in narrative open-ends), and all three stay optional, because a forced open-end buys
     meaningless answers and shortens the real ones.

     THE THREE DIFFER IN KIND, NOT IN WORDING, which was the second fault in the old arrangement:
     one string under two different questions tells the reader they are the same question, and the
     second gets skipped or answered "same as above". 11.6 asks for a want, so it pushes for one
     thing rather than a category. 11.7 asks for a grievance, where the useful answer is usually an
     occasion rather than an abstraction. 12.4 turns the instrument on itself, so its helper is
     about consequence: what comes back changes what gets asked next time. */
  {
    id: 'one_improvement',
    ref: '11.6',
    section: 'invest',
    kind: 'long',
    prompt: 'What is the one thing that would most improve how you manage Airtable?',
    help: 'One specific thing, not a category. A person reads every one of these, so the detail is not wasted.',
  },
  {
    id: 'biggest_frustration',
    ref: '11.7',
    section: 'invest',
    kind: 'long',
    /* ITS OWN PAGE, SO THE TWO PROSE QUESTIONS ARE NOT STACKED. 11.5 opens a page and `PAGE_SIZE`
       is 4, so 11.5, 11.6 and 11.7 were landing together: a maturity self-assessment followed by
       TWO four-row textareas, one directly under the other. That is the mechanism behind an answer
       of "same as above" on the second one, and no amount of rewriting the two prompts separates
       boxes that share a screen. 11.6 asks what would improve things and 11.7 asks what hurts;
       they are different questions and now they are different screens. Oleh, 2026-08-28.

       It costs one more page, which the completion research counts against us (every page is
       another chance to leave). Taken deliberately: these are two of only three free-text answers
       in the whole instrument, and a skipped one is worth less than a shorter walk. */
    newPage: true,
    prompt: 'What is your single biggest frustration with Airtable overall?',
    help: 'If there was a particular occasion, tell us about that one. Written answers are read individually, not counted.',
  },

  // ── P · Private validation tail ───────────────────────────────────────────────────────────────
  {
    id: 'all_in_one_interest',
    ref: 'P1',
    section: 'private',
    kind: 'single',
    prompt:
      'Imagine one tool gave you all of this. How interested are you?',
    help: 'Change history, safe restores, monitoring and alerts, always-current docs, a live SQL or API copy of your data, and an external backup you own.',
    options: [
      'I’d want it now',
      'I’d pilot it on one base or client',
      'Interested, but I’d need to see it work',
      'Not for me',
    ],
  },
  {
    id: 'per_client_price',
    ref: 'P2',
    section: 'private',
    kind: 'single',
    prompt: 'What would feel reasonable to pay per client, per month, for that tool?',
    options: ['Under $20', '$20–49', '$50–149', '$150–499', '$500+'],
    showIf: (a) => isAgency(a),
  },
  {
    id: 'would_resell',
    ref: 'P3',
    section: 'private',
    kind: 'single',
    prompt: 'Would you resell or mark this up to clients?',
    options: [
      'Yes, as a recurring line item',
      'Yes, bundled into my fee',
      'Maybe',
      'No, or not applicable',
    ],
    showIf: (a) => isAgency(a),
  },
  {
    id: 'product_updates',
    ref: 'P4',
    section: 'private',
    kind: 'single',
    prompt: 'Want product updates from Baseout as this gets built?',
    help: 'Separate from the report email. Consenting to one is not consenting to the other.',
    options: ['Yes', 'No thanks'],
  },

  // ── 12 · Wrap-up ──────────────────────────────────────────────────────────────────────────────
  {
    id: 'email',
    ref: '12.1',
    section: 'wrap',
    kind: 'email',
    prompt: 'Where should we send your copy of the report?',
    required: true,
  },
  {
    id: 'interview_ok',
    ref: '12.2',
    section: 'wrap',
    kind: 'single',
    prompt: 'May we contact you for a 20-minute interview about your Airtable practices?',
    help: 'Interviewees get an extended findings pack.',
    options: ['Yes', 'No'],
  },
  {
    id: 'next_year',
    ref: '12.3',
    section: 'wrap',
    kind: 'single',
    prompt: 'Can we count you in for next year’s survey, to track how the ecosystem changes?',
    options: ['Yes', 'No'],
  },
  {
    id: 'anything_missed',
    ref: '12.4',
    section: 'wrap',
    kind: 'long',
    prompt: 'Anything we should have asked but didn’t?',
    /* Helper added 2026-08-28; see the note above 11.6. This one is framed by consequence rather
       than by specificity: the answer is not scored, it decides what the next edition asks. */
    help: 'Gaps you noticed while answering. Answers here shape the next edition of this survey.',
  },
];

// ── PREDICATES ─────────────────────────────────────────────────────────────────────────────────
// Named rather than inlined, because several of them are read twice: once by a `showIf` and once by
// the scoring rubric or the flow. A conditional that two places disagree about is a conditional
// that shows a question to somebody it was never meant for.

const NO_BACKUP = 'We don’t back up Airtable';
const BUILT_IN_ONLY = 'Airtable’s built-in snapshots / revision history only';

/** 4.2's condition: "any method beyond built-in". */
function backsUpBeyondBuiltIn(a: Answers): boolean {
  const m = a.backup_method;
  if (!Array.isArray(m)) return false;
  return m.some((x) => x !== BUILT_IN_ONLY && x !== NO_BACKUP && x !== 'Not sure');
}

/** 4.4's condition: "if you back up", by any method at all. */
function backsUpAtAll(a: Answers): boolean {
  const m = a.backup_method;
  if (!Array.isArray(m)) return false;
  return m.some((x) => x !== NO_BACKUP && x !== 'Not sure');
}

/** 5.3 to 5.6: "conditional on >=1 in 5.1 or any non-None in 5.2". */
function hadIncident(a: Answers): boolean {
  const count = a.incident_count;
  const counted = count === 'Once' || count === '2–5 times' || count === '6+ times';
  const kinds = a.incident_kinds;
  const experienced =
    Array.isArray(kinds) && kinds.some((k) => k !== 'None of these');
  return counted || experienced;
}

/** Section P's agency conditional reads "S1 or 1.1", so both are checked. */
export function isAgency(a: Answers): boolean {
  return a.role === AGENCY_ROLE || a.relationship === AGENCY_RELATIONSHIP;
}

/**
 * The screener branch. Bank S1: the last two options go to a thank-you and an optional email, and
 * are "excluded from the core dataset".
 */
export function isScreenedOut(a: Answers): boolean {
  return typeof a.relationship === 'string' && SCREENED_OUT.includes(a.relationship);
}

// ── THE FLOW ───────────────────────────────────────────────────────────────────────────────────

/** The steps that apply for a given answer set, in order. */
export function visibleQuestions(answers: Answers): Question[] {
  if (isScreenedOut(answers)) {
    // Everything but the screener itself and the report email. They said they do not use Airtable;
    // asking them how fast they restore it would put noise in the benchmark, and the bank says so.
    return questions.filter((q) => q.section === 'screener' || q.id === 'email');
  }
  return questions.filter((q) => (q.showIf ? q.showIf(answers) : true));
}

export interface SectionGroup {
  section: Section;
  questions: Question[];
}

/** The visible questions grouped by section, dropping sections that have none left. */
export function visibleSections(answers: Answers): SectionGroup[] {
  const visible = visibleQuestions(answers);
  return SECTIONS.map((section) => ({
    section,
    questions: visible.filter((q) => q.section === section.id),
  })).filter((g) => g.questions.length > 0);
}

/**
 * HOW MANY QUESTIONS SHARE A SCREEN.
 *
 * Dan asked for pages inside a section and sketched three of them, without saying where the breaks
 * go. Four is the number that makes his sketch true for the sections he was looking at: the bank's
 * sections run four to ten questions, so most land on two or three pages and none on one long one.
 *
 * It is a MAXIMUM, not a quota. A conditional that closes shrinks the last page rather than pulling
 * a question up from nowhere, and `newPage` forces a break earlier where the bank's own grouping
 * asks for it (the matrix, the ranking, the private-tail pricing).
 */
export const PAGE_SIZE = 4;

/** One section's visible questions, cut into pages. */
export function sectionPages(section: SectionGroup): Question[][] {
  const pages: Question[][] = [];
  let page: Question[] = [];
  for (const q of section.questions) {
    if (page.length > 0 && (q.newPage || page.length >= PAGE_SIZE)) {
      pages.push(page);
      page = [];
    }
    page.push(q);
    // A question other questions are waiting on closes its page, so its answer is committed before
    // the next page decides what to show. See `endsPage`.
    if (q.endsPage) {
      pages.push(page);
      page = [];
    }
  }
  if (page.length > 0) pages.push(page);
  return pages;
}

export interface Step {
  section: Section;
  questions: Question[];
  /** 1-based page within the section, and how many pages it has. Drives the slice indicator. */
  page: number;
  pages: number;
  /** 1-based section position, and how many sections there are. Drives the section rail. */
  sectionIndex: number;
  sectionCount: number;
}

/**
 * THE WHOLE FLOW AS A FLAT LIST OF SCREENS, each of which knows where it sits in both dimensions.
 *
 * The renderer needs two facts on every screen: which section this is (for the rail and the header)
 * and which page of it (for the slices). Computing them here rather than in the page keeps one
 * definition of "where am I" instead of two that can disagree.
 */
export function steps(answers: Answers): Step[] {
  const groups = visibleSections(answers);
  const out: Step[] = [];
  groups.forEach((group, gi) => {
    const pages = sectionPages(group);
    pages.forEach((questions, pi) => {
      out.push({
        section: group.section,
        questions,
        page: pi + 1,
        pages: pages.length,
        sectionIndex: gi + 1,
        sectionCount: groups.length,
      });
    });
  });
  return out;
}

/** Lookup by the bank's own number, for anything that merges datasets. */
export function byRef(ref: string): Question | undefined {
  return questions.find((q) => q.ref === ref);
}
