/**
 * The public request board's data.
 *
 * FIXTURES, and the shape is the point. There is no backend in this repo — `apps/support` has no
 * database, no session and no mail — so every field below is what a real store must return, written
 * down once so the engineer porting this is not guessing. The handoff at the foot of `/roadmap`
 * says the same thing to a human.
 *
 * WHY A DATA FILE AND NOT A CONTENT COLLECTION: these are rows, not documents. They are filtered,
 * counted, sorted and rendered in two shapes (board card and detail page) from one source. A
 * collection would give us frontmatter parsing we do not need and take away the typed shape we do.
 *
 * THE DATE LIVES ON THE ITEM, NEVER ON THE COLUMN (Dan, 2026-08-18: "estimated ship date… Q4 of
 * next year type format"). A column called Q4 is a promise the board cannot keep when work slips;
 * a card that says "estimated Q4 2027" is an estimate, and an estimate survives being wrong.
 */

/**
 * `Not planned` and `Already exists` are terminal, and both were missing from the first board.
 * Without them a public board silently drops what it declines, and every asker learns their request
 * went nowhere — which is the fastest way to stop receiving any. `Already exists` is the more
 * common outcome on a docs-adjacent board: the thing was built, the asker did not find it. It is
 * required to carry `docs`, because the page that proves it is the whole answer.
 *
 * ── `Suggested` IS AN INTAKE STATE, AND IT IS A COMMITMENT BEFORE IT IS A WORD ─────────────────
 * Dan, 2026-08-20: "there should be a level above Planned… suggested and that list". The two are
 * not degrees of one thing, and the difference is who has spoken: `Planned` means WE agreed and
 * have not started; `Suggested` means SOMEONE ASKED and nobody has judged it yet. Collapsing them
 * would make every intake row read as a commitment we never made, which is the failure mode a
 * public roadmap cannot recover from.
 *
 * WHAT IT COSTS, written here because the type is where it gets adopted. A public queue of
 * unjudged requests is a promise that someone will look at them. `research-roadmap.md` §P6 prices
 * the moderation: an intake list that visibly stops being read is worse than no intake list,
 * because it converts "nobody has got to it" into "nobody works here". Adding this status is a
 * commitment to TRIAGE — a person, a cadence, and a rule for when a row leaves the list. Do not
 * ship it without one.
 *
 * IT DOES NOT GET A SEMANTIC HUE. Green would read as accepted and amber as underway, and it is
 * neither; `lib/status.ts` already argues why `Planned` and `Not planned` share the ghost pair, and
 * "nothing is happening yet" is exactly the claim `Suggested` makes too.
 */
export type RequestStatus =
  | 'Suggested'
  | 'Planned'
  | 'In progress'
  | 'Shipped'
  | 'Not planned'
  | 'Already exists';

/** Board columns, in order. The two terminal states are reachable by filter, not by column — a
 *  column of rejections is not what anyone came to read.
 *
 *  `Suggested` IS NOT A COLUMN EITHER, and for the opposite reason: it is the one state that grows
 *  without limit. One column of three cards beside a column of forty is a layout that breaks in the
 *  first week anyone uses the board. It gets a full-width section of ROWS under the columns —
 *  `pages/roadmap.astro` carries the shape and the argument. */
export const BOARD_COLUMNS: RequestStatus[] = ['Planned', 'In progress', 'Shipped'];

/** Filter-chip order, and it is the pipeline read left to right: asked, agreed, underway, done,
 *  then the two ways a request ends. */
export const ALL_STATUSES: RequestStatus[] = [
  'Suggested',
  'Planned',
  'In progress',
  'Shipped',
  'Already exists',
  'Not planned',
];

/**
 * ── TWO KINDS OF REQUEST ───────────────────────────────────────────────────────────────────────
 * Dan, 2026-08-20, on voting for the next platform Baseout backs up: "that's a big one". The field
 * gives us nothing to copy — `research-multi-platform-field-2026-08-20.md` §6 found that not one of
 * the six backup competitors surveyed runs a public vote on it, and Rewind's is a text field that
 * goes to the product team with no public tally. The two halves worth taking are Rewind's product
 * grid, which NAMES the platforms it does not support yet so they can be joined, and Airbyte's
 * connector board, which carries visible per-candidate counts and a free-text path that CREATES a
 * candidate instead of swallowing it.
 *
 * WHY A KIND AND NOT A TAG. A platform is not a feature: "Notion" answers a different question from
 * "scheduled reports", it competes with the other platforms rather than with the features, and a
 * vote on it is the vote Dan actually wants collected. Mixed into the three feature columns it
 * would be three cards among twenty, sorted by a state machine that is not the axis anyone is
 * comparing on. So the kind decides the SECTION and the status still decides the state. Rejected:
 * a separate `platforms.ts` data file, which would fork the vote control, the filter chips and the
 * detail page for five rows.
 */
export type RequestKind = 'feature' | 'platform';

import type { PlatformId } from '../lib/platforms';

export interface Attachment {
  /** Served from `public/`. A real store would hold a key and sign a URL. */
  src: string;
  alt: string;
  caption?: string;
}

export interface FeatureRequest {
  slug: string;
  title: string;
  /** One line for the board card. */
  summary: string;
  /** Prose for the detail page. Paragraphs, not a truncated blurb. */
  body: string[];
  status: RequestStatus;
  /**
   * Absent means `feature`, which is what nearly every row is. Declared rather than inferred, so a
   * fixture that forgets the field falls into the common case instead of accidentally becoming a
   * platform vote.
   */
  kind?: RequestKind;
  /**
   * ABSENT MEANS BASEOUT ITSELF, not "unknown" and not "every platform". It is the same convention
   * the documentation uses for its `platform` frontmatter field, and for the same reason measured
   * there: most of what we write is a noun swap away from being true everywhere, so the tagged rows
   * are the exception list and the untagged majority is the product. Scheduled reports and SQL
   * access are Baseout, not Airtable, and stay untagged.
   *
   * A PLATFORM REQUEST MAY HAVE NONE. `lib/platforms.ts` is the SUPPORTED set — an id there feeds
   * the docs filter and the vocabulary swap — so a candidate nobody has built yet cannot be added
   * to it just to borrow a logo. Those rows carry the platform's name in the title and take a
   * neutral connector glyph instead of a brand mark, which is honest: we do not ship its mark
   * because we do not ship it.
   */
  platform?: PlatformId;
  /**
   * The count a real store owns. RENDERED ONLY WHEN `VOTES_LIVE` — see `lib/votes.ts`. Kept in the
   * fixture because it is the shape the store fills, not because the number means anything.
   *
   * NEW ROWS ARE SEEDED AT `0`, and that is not modesty. The older rows below carry invented
   * figures from before the flag existed; nothing added since is allowed to invent one, because a
   * platform vote is exactly the number someone would quote back at us.
   */
  votes: number;
  /** Who raised it. A Baseout-authored item and a customer request must not look identical. */
  author: 'Baseout' | string;
  /** ISO date the request was raised. Rendered relative on the card, absolute on the detail page. */
  raised: string;
  /** Coarse estimate, e.g. `Q4 2027`. Only on Planned / In progress. Never a precise date. */
  estimate?: string;
  /** Coarse ship month, e.g. `Aug 2026`. Only on Shipped. */
  shipped?: string;
  /** The page that documents it. REQUIRED for Shipped and Already exists — see the type note. */
  docs?: { href: string; label: string };
  /** One sentence. REQUIRED for Not planned: a rejection without a reason reads as neglect. */
  reason?: string;
  attachments?: Attachment[];
}

export const REQUESTS: FeatureRequest[] = [
  {
    slug: 'scheduled-reports',
    title: 'Scheduled backup reports',
    summary: 'A periodic report of backup status, issues and schema health, emailed automatically.',
    body: [
      'A recurring email that says whether the backups ran, what failed, and what changed in the schema since the last one — so nobody has to remember to open the app to find out that nothing is wrong.',
      'The report should carry the same figures the Backups page shows: run status, record and attachment counts, and any run that failed or was cancelled. Schema health belongs in it too, because a drifting schema is the failure you do not notice.',
    ],
    status: 'Planned',
    votes: 42,
    author: 'Baseout',
    raised: '2026-06-02',
    estimate: 'Q2 2027',
  },
  {
    slug: 'data-browser',
    title: 'Browse your backed-up data',
    summary: 'Explore records across bases and tables, with filters, search and per-record history.',
    body: [
      'Reading a backup should not require restoring it. Being able to open a snapshot and look — filter a table, search a field, follow one record through its versions — is the difference between a backup you trust and a backup you hope about.',
    ],
    status: 'Planned',
    votes: 38,
    author: 'Priya N.',
    raised: '2026-06-18',
    estimate: 'Q3 2027',
  },
  {
    slug: 'sql-access',
    title: 'SQL access to your data',
    summary: 'Query a continuously-synced copy of your Airtable data with SQL and BI tools.',
    body: [
      'Airtable is not queryable the way a warehouse is. A continuously-synced copy in Postgres would let existing BI tools point at Airtable data without anyone writing an export script.',
      'This is a dynamic Destination rather than a new product surface — the backup already writes there; what is missing is keeping it current and giving people the connection string.',
    ],
    status: 'Planned',
    votes: 55,
    author: 'Marcus D.',
    raised: '2026-05-11',
    estimate: 'Q4 2027',
  },
  {
    slug: 'restore',
    title: 'Point-in-time restore',
    summary: 'Restore any base or table from any retained snapshot — never overwriting live data.',
    body: [
      'Pick a snapshot, pick what to bring back, and get it as NEW tables in a base you choose. Restore never overwrites: the point is to recover what was lost without risking what is still there.',
      'Airtable’s API cannot fully rebuild structure, so this is best-effort by design — formula fields have to be rebuilt by hand and some field types come back as text. The outcome report says exactly what still needs finishing.',
    ],
    status: 'In progress',
    votes: 61,
    author: 'Baseout',
    raised: '2026-04-20',
    estimate: 'Q1 2027',
    attachments: [
      {
        src: '/images/request-attachment-backups.webp',
        alt: 'The Baseout backups page showing a run history table with per-run status, counts and duration',
        caption: 'The run history a restore would start from — pick a succeeded run, then drill into a base.',
      },
    ],
  },
  {
    slug: 'schema-health',
    title: 'Schema health scores',
    summary: 'A score per base flagging unused fields, missing descriptions and risky patterns.',
    body: [
      'A number that goes down when a base gets messier, with the reasons listed underneath. Unused fields, fields with no description, tables nothing links to — the things that are individually fine and collectively a problem.',
    ],
    status: 'In progress',
    votes: 29,
    author: 'Baseout',
    raised: '2026-05-30',
    estimate: 'Q1 2027',
  },
  {
    /* Tagged, because it is a gap in ONE platform's capture rather than a Baseout capability:
       Airtable exposes record comments through its API and the backup does not take them. The
       facet exists to make exactly this kind of row findable. */
    slug: 'record-comments',
    title: 'Keep record comments in the backup',
    summary: 'Capture the comment thread on a record, not just the record.',
    body: [
      'A comment thread is where the decision behind a record was argued, and today a backup keeps the record and loses the argument. Restoring a table gives you the data back and none of the context.',
      'Airtable returns comments per record through its API, so this is capture work rather than a new integration. The cost is volume: comments are read separately from the records they hang off, which is a second pass over every table that has any.',
    ],
    status: 'Planned',
    platform: 'airtable',
    votes: 0,
    author: 'Baseout',
    raised: '2026-08-04',
    estimate: 'Q2 2027',
  },
  {
    slug: 'scheduled-backups',
    title: 'Scheduled backups',
    summary: 'Automatic backups of schema, records and attachments to storage you control.',
    body: [
      'Backups run on a schedule you set, to a Destination you own, with schema and data on separate cadences so structure can be captured more often than records.',
    ],
    status: 'Shipped',
    votes: 88,
    author: 'Baseout',
    raised: '2026-02-14',
    shipped: 'Jun 2026',
    docs: { href: '/backups/schedule-and-scope/', label: 'Schedule and scope' },
  },
  {
    slug: 'schema-map',
    title: 'Schema visualization',
    summary: 'A living diagram of your bases, tables, fields and relationships.',
    body: [
      'A diagram generated from the backed-up schema rather than drawn by hand, so it is never out of date with the base it describes.',
    ],
    status: 'Shipped',
    votes: 47,
    author: 'Baseout',
    raised: '2026-03-08',
    shipped: 'Jul 2026',
    docs: { href: '/schema/visualize-and-relationships/', label: 'Visualize and Relationships' },
  },
  {
    slug: 'retention-control',
    title: 'Control how long backups are kept',
    summary: 'Choose the retention cutoff instead of accepting a fixed one.',
    body: [
      'Raised as a request; it already exists. The cleanup schedule thins older versions on a tiered ladder keyed to your backup frequency, and the cutoff is configurable — 1 year, 2 years, 5 years or never, defaulting to 5 years.',
      'Kept on the board rather than deleted, because the request being made at all is evidence the documentation was not findable.',
    ],
    status: 'Already exists',
    votes: 17,
    author: 'Tomas R.',
    raised: '2026-07-22',
    docs: { href: '/backups/retention-and-cleanup/', label: 'Retention and cleanup' },
  },
  {
    slug: 'two-way-sync',
    title: 'Two-way sync back into Airtable',
    summary: 'Edit backed-up records in Baseout and have the changes written back.',
    body: [
      'The request is to treat the backup as a second editable copy, with changes flowing back into Airtable automatically.',
      'This is not something we are going to build. Baseout reads your Airtable and does not change it — that boundary is what makes a backup trustworthy, and a background writer would quietly become the thing most likely to destroy the data it was meant to protect. Restore and Actions are the two deliberate exceptions, and both are explicit, one-off and ask for a token that can write.',
    ],
    status: 'Not planned',
    platform: 'airtable',
    votes: 9,
    author: 'Alex W.',
    raised: '2026-07-05',
    reason:
      'A background writer would put the backup in a position to damage the data it exists to protect. Restore and Actions cover the cases where writing is genuinely wanted, explicitly and one at a time.',
    docs: { href: '/backups/how-backups-work/', label: 'How backups work' },
  },

  /* ── Tagged, because each one names something ONE platform has ───────────────────────
     The facet was pointing at three rows out of twenty, which made it look decorative and made the
     cards look interchangeable. The fix is NOT to label the untagged majority: `platform` absent
     means Baseout itself, and scheduled reports, SQL access, webhooks and Slack alerts are Baseout
     capabilities whichever product the data came from. Relabelling those would make the facet lie
     about exactly the thing it exists to answer.

     What was missing is requests that are genuinely about one product, so those are what was added.
     Every claim below is taken from the platform documentation on this site rather than invented:
     the two-hour attachment URL and the absent automation export from `platforms/airtable/*` and
     `schema/automations-and-interfaces.md`, the dependency edges, the custom task ids and the
     unreadable Dashboards from `platforms/clickup/*`. A request that misstates what a platform's
     API does is worse than an untagged one, because someone will quote it back. */
  {
    slug: 'airtable-attachments',
    title: 'Store attachment files, not links to them',
    summary: 'Keep the bytes of every attachment, because an Airtable file URL expires in two hours.',
    body: [
      'Airtable returns each attachment as a signed URL on its own content host, and that link stops working two hours after the API handed it over. A backup that recorded links would be a set of dead references by lunchtime, and it would look correct until the day you needed it.',
      'So a run downloads every file it finds and writes it into your Destination beside the record data. What you hold afterwards is the file itself, with its filename, size and content type, and the record and field it belonged to.',
    ],
    status: 'Shipped',
    platform: 'airtable',
    votes: 0,
    author: 'Noor A.',
    raised: '2026-03-19',
    shipped: 'Jun 2026',
    docs: { href: '/platforms/airtable/attachments/', label: 'Attachments in Airtable' },
  },
  {
    slug: 'airtable-interfaces',
    title: 'Back up Interfaces and Automations',
    summary: 'Capture the two parts of a base that are configuration rather than data.',
    body: [
      'An Interface and an Automation are as much a part of a base as its tables are. Restoring the tables without them gives you the data back and none of the machinery that was running on it.',
      'Airtable exports neither. Its API returns no automation definition and no interface layout, so there is nothing for a backup to read, and a tool that claimed to capture them would be recording a guess.',
      'What Baseout offers instead is a place to write them down: a per-base register of your automations and your interfaces, each with a description, tags and a soft delete. That is documentation you maintain, and it will not rebuild an automation for you.',
    ],
    status: 'Not planned',
    platform: 'airtable',
    votes: 0,
    author: 'Elias K.',
    raised: '2026-07-28',
    reason:
      'Airtable exposes no automation or interface definition through its API, so there is nothing to capture. The per-base register is where you can record them by hand.',
    docs: { href: '/schema/automations-and-interfaces/', label: 'Automations and Interfaces' },
  },
  {
    slug: 'clickup-dependencies',
    title: 'Keep ClickUp task dependencies and linked tasks',
    summary: 'Capture the edges between tasks, not only the tasks themselves.',
    body: [
      'A dependency is the part of a plan that says what waits for what. A backup that keeps every task and none of its relationships hands you a list where you had a schedule.',
      'ClickUp returns dependencies and linked tasks on the task itself, so the capture is straightforward. The restore is the harder half: a restored task is a new task with a new id, so every edge has to be repointed once both ends exist, and a relationship to a task outside the restore keeps pointing at the original.',
    ],
    status: 'In progress',
    platform: 'clickup',
    votes: 0,
    author: 'Baseout',
    raised: '2026-08-01',
    estimate: 'Q1 2027',
  },
  {
    slug: 'clickup-custom-task-ids',
    title: 'Show Custom Task IDs when browsing ClickUp data',
    summary: 'Find a task by the readable id your team quotes, not by ClickUp’s internal one.',
    body: [
      'A ClickUp Workspace can turn on custom task ids, giving every task a readable identifier with a prefix you chose. That is the id people say out loud, and a run already captures it alongside the internal one.',
      'What is missing is the browse side. Searching a ClickUp snapshot today means searching the internal id, which is the one nobody remembers, so the ask is to show the custom id wherever a task appears and to let you search on it.',
    ],
    status: 'Planned',
    platform: 'clickup',
    votes: 0,
    author: 'Ines M.',
    raised: '2026-08-08',
    estimate: 'Q1 2027',
  },
  {
    slug: 'clickup-dashboards',
    title: 'Back up ClickUp Dashboards',
    summary: 'Keep the Dashboard and its cards, not only the tasks the cards count.',
    body: [
      'A Dashboard is how a team reads its own work, and rebuilding one after a restore means remembering every card and every filter that fed it.',
      'ClickUp publishes no API for a Dashboard or for an Automation. Neither can be read, so neither can be captured. The only place an Automation surfaces at all is an outbound webhook payload, which tells you a rule ran and is not the rule.',
    ],
    status: 'Not planned',
    platform: 'clickup',
    votes: 0,
    author: 'Tomas R.',
    raised: '2026-08-09',
    reason:
      'ClickUp’s public API has no endpoint for Dashboards or Automations, so there is nothing to read. If that changes, this comes back to the board.',
    docs: { href: '/platforms/clickup/what-we-back-up/', label: 'What we back up in ClickUp' },
  },

  /* ── Suggested: asked for, not yet judged ───────────────────────────────────────────────────
     Deliberately short entries. A row in the intake list gets one line on the board and a page of
     its own; writing three paragraphs of argument for something nobody has assessed would be us
     making the case on the asker's behalf, which is how an intake list turns into a plan. */
  {
    slug: 'failure-alerts-slack',
    title: 'Post failed runs to Slack',
    summary: 'A message in a channel when a backup fails, instead of an email nobody owns.',
    body: [
      'Email goes to a person and a channel goes to a team. A failed run is the case where that distinction matters, because the person it was addressed to is the one on holiday.',
    ],
    status: 'Suggested',
    votes: 0,
    author: 'Ines M.',
    raised: '2026-08-11',
  },
  {
    slug: 'view-filters-and-sorts',
    title: 'Capture view filters and sorts',
    summary: 'Back up what a view actually shows, not only its name and columns.',
    body: [
      'A view is a saved question, and rebuilding one by hand after a restore means remembering the question. The ask is to keep the filter and sort configuration alongside the schema.',
      'Not yet judged, and there is a known obstacle: Airtable returns a view id, name and type, and its visible field ids only for grid views. The filters and sorts are not in the response, so this may turn out to be something we cannot capture rather than something we have not.',
    ],
    status: 'Suggested',
    platform: 'airtable',
    votes: 0,
    author: 'Priya N.',
    raised: '2026-08-13',
  },
  {
    slug: 'restore-one-record',
    title: 'Restore a single record',
    summary: 'Bring back one row from a snapshot without restoring the table around it.',
    body: [
      'The common recovery is one record someone deleted, and the current answer is a table-sized operation for a row-sized problem.',
    ],
    status: 'Suggested',
    votes: 0,
    author: 'Marcus D.',
    raised: '2026-08-06',
  },
  {
    slug: 'run-webhook',
    title: 'Send a webhook when a run finishes',
    summary: 'A POST with the run outcome, so your own tooling can react to it.',
    body: [
      'Anything we do not build an integration for, you could build yourself given a webhook. The ask is for the outcome payload the emails already carry.',
    ],
    status: 'Suggested',
    votes: 0,
    author: 'Tomas R.',
    raised: '2026-08-15',
  },
  {
    slug: 'notion-page-history',
    title: 'Keep page version history',
    summary: 'Retain the edit history of a page, not only its latest state.',
    body: [
      'Notion keeps its own version history and expires it by plan. Backing up only the current state means the history is the part that goes first and the part nobody notices going.',
      'Raised before Notion support exists, and kept on the list so it is not asked again from scratch when it does.',
    ],
    status: 'Suggested',
    platform: 'notion',
    votes: 0,
    author: 'Dana K.',
    raised: '2026-08-18',
  },
  {
    slug: 'notion-synced-blocks',
    title: 'Resolve synced blocks to their text',
    summary: 'Capture what a synced block says, not only the block it points at.',
    body: [
      'Notion returns a duplicate synced block as a pointer to its original and no content, so a page that borrows a paragraph from elsewhere backs up as an empty reference. Where the original sits outside what the connection can see, the words are gone entirely.',
      'Not yet judged. Following the pointer is possible where both ends are shared, which turns this into a question about how much of a workspace a connection should be asked to read.',
    ],
    status: 'Suggested',
    platform: 'notion',
    votes: 0,
    author: 'Dana K.',
    raised: '2026-08-17',
  },
  {
    slug: 'notion-wiki-verification',
    title: 'Keep wiki verification on a page',
    summary: 'Record whether a page was marked verified, and until when.',
    body: [
      'A verified wiki page carries two facts: someone checked it, and a date after which nobody has. Backing up the page without them keeps the words and loses the reason to trust them.',
      'Raised before Notion support exists, and kept on the list so it is not asked again from scratch when it arrives.',
    ],
    status: 'Suggested',
    platform: 'notion',
    votes: 0,
    author: 'Noor A.',
    raised: '2026-08-19',
  },

  /* ── Platform candidates ────────────────────────────────────────────────────────────────────
     NAMED, not collected in a text field. `research-multi-platform-field-2026-08-20.md` §6: an
     empty box cannot aggregate, and naming the platforms you do NOT support yet is the thing that
     makes a vote possible at all. Order here is the order on the board: what is moving, then what
     is agreed, then what has only been asked for. Sorting by count is what the field does (Airbyte
     sorts its connector board by Top) and it waits for `VOTES_LIVE` — sorting by a number we do not
     have would just be this order with a claim attached. */
  {
    slug: 'platform-clickup',
    title: 'ClickUp',
    kind: 'platform',
    platform: 'clickup',
    summary: 'Back up ClickUp Spaces, Lists and Tasks the way Baseout backs up Airtable.',
    body: [
      'The same job on a different noun: pick a Space, capture its Lists, Tasks and Custom Fields on a schedule, to storage you own.',
      'Documentation for it already exists on this site: connecting, what is captured, limits, field types, files, permissions, identifiers and restoring.',
    ],
    status: 'In progress',
    votes: 0,
    author: 'Baseout',
    raised: '2026-07-30',
    estimate: 'Q1 2027',
  },
  {
    slug: 'platform-notion',
    title: 'Notion',
    kind: 'platform',
    platform: 'notion',
    summary: 'Back up Teamspaces, Databases and Pages, with properties intact.',
    body: [
      'Notion is the least like Airtable of the candidates: a page is both a row and a document, so what counts as one unit of data is a decision rather than a mapping.',
    ],
    status: 'Planned',
    votes: 0,
    author: 'Baseout',
    raised: '2026-07-30',
    estimate: 'Q3 2027',
  },
  {
    /* No `platform` id on the three below, and that is the point of the field's optionality: an id
       in `lib/platforms.ts` feeds the docs filter and the vocabulary swap, so adding one for a
       platform we have not built would put a dead entry in both just to borrow a logo. */
    slug: 'platform-monday',
    title: 'Monday.com',
    kind: 'platform',
    summary: 'Boards, groups and items, on the same schedule and to the same Destinations.',
    body: [
      'Asked for by several people running Monday alongside Airtable. Nothing has been assessed yet, including whether its API exposes enough to rebuild a board.',
    ],
    status: 'Suggested',
    votes: 0,
    author: 'Ines M.',
    raised: '2026-08-12',
  },
  {
    slug: 'platform-trello',
    title: 'Trello',
    kind: 'platform',
    summary: 'Boards, lists, cards and their attachments.',
    body: [
      'The smallest data model of the candidates, which usually means the quickest to support and the least that is lost when it is not.',
    ],
    status: 'Suggested',
    votes: 0,
    author: 'Alex W.',
    raised: '2026-08-14',
  },
  {
    slug: 'platform-smartsheet',
    title: 'Smartsheet',
    kind: 'platform',
    summary: 'Sheets, rows and column definitions, including attachments.',
    body: [
      'Raised by teams where Smartsheet holds the schedule that Airtable holds the data for, so losing one is losing half the picture.',
    ],
    status: 'Suggested',
    votes: 0,
    author: 'Dana K.',
    raised: '2026-08-16',
  },
];

export const bySlug = (slug: string): FeatureRequest | undefined =>
  REQUESTS.find((r) => r.slug === slug);

export const countByStatus = (status: RequestStatus): number =>
  REQUESTS.filter((r) => r.status === status).length;

/** The default lives in ONE function rather than at every read site, so `kind` can stay optional in
 *  the fixtures without every consumer having to remember what absent means. */
export const kindOf = (r: FeatureRequest): RequestKind => r.kind ?? 'feature';

export const FEATURE_REQUESTS: FeatureRequest[] = REQUESTS.filter((r) => kindOf(r) === 'feature');

export const PLATFORM_REQUESTS: FeatureRequest[] = REQUESTS.filter((r) => kindOf(r) === 'platform');

/** Counts every request tagged with a platform, of either kind — the facet filters both sections,
 *  so a chip that counted only one of them would be pointing at less than it reveals. */
export const countByPlatform = (id: PlatformId): number =>
  REQUESTS.filter((r) => r.platform === id).length;
