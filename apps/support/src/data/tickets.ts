/**
 * Support cases — the fixture, and the shape a real store must fill.
 *
 * FIXTURES, AND THE SHAPE IS THE POINT — the same discipline `data/requests.ts` opens with, for the
 * same reason. `apps/support` has no database, no session and no mail, so every field below is
 * written down as what a real store must RETURN, not as what a mock needs to render. The engineer
 * porting this is reading the types, not the rows.
 *
 * WHY A DATA FILE AND NOT A CONTENT COLLECTION: identical to the roadmap's answer. These are rows —
 * filtered, counted, sorted and rendered in two shapes (a list row and a thread) from one source.
 *
 * ── TEN FIELDS THAT MUST EXIST BEFORE THE FIRST CASE DOES ──────────────────────────────────────
 * `openspec/changes/support-ticket-portal/design.md` §5 prices the four load-bearing ones, and each
 * is declared below with the failure it prevents rather than a description of itself:
 *
 *   `spaceId` / `runId`   nullable, both, NOW. A backup tool's most common case is "my backup
 *                         failed"; without `runId` support asks for it in the first reply, which is
 *                         a full round-trip on every failure case. Retro-fitting means a migration
 *                         AND re-asking every open case.
 *   `ref` + `threadToken` TWO ids, and never one. `ref` is the human string a customer quotes — in
 *                         a public forum, in a screenshot, to a colleague. `threadToken` is the
 *                         routing key in the reply-to address, and it is rotatable. Collapsing them
 *                         makes the quotable string a write key into the customer's own case.
 *                         `threadToken` IS NEVER RENDERED. It is here because the type is the
 *                         handoff, and a field invented later changes every live reply-to at once.
 *   `kind: 'human'|'auto'` per message. Without it an out-of-office bounce counts as a customer
 *                         reply, flips the case out of `pending` and bumps the sort. Detection
 *                         leaks, so the MODEL has to tolerate one arriving.
 *   `lastActivityAt`      distinct from `raised`. The list's whole default sort depends on it, and
 *                         a customer opens that list to find the one that MOVED.
 *
 * And one that already exists in the parent change and is read by nothing: `unauthenticated`. A
 * declared field no component consumes is the `provisional: true` failure repeated — every gate
 * green, the fact invisible. It is consumed here: it is what makes a message `verified: false`.
 *
 * ── EVERY `threadToken` BELOW IS A WORD, NOT HEX — AND MUST STAY ONE ───────────────────────────
 * On 2026-08-21 the `secret-scan` workflow failed on `main` for three commits running: gitleaks
 * v8.30.1 reported five `generic-api-key` findings, one per `threadToken`, because the values were
 * written as realistic high-entropy hex. The scanner was RIGHT — a routing
 * key in a reply-to address is exactly the kind of string it exists to catch, and this file is the
 * one place a real one would eventually land. So the fix is not an allowlist: no `.gitleaksignore`,
 * no `gitleaks.toml` rule, and no inline suppression comment may be added for this file, because muting
 * the alarm here disarms it precisely where it should be loudest. (This paragraph names none of
 * those escape hatches literally, and that is deliberate: gitleaks reads its own directive out of
 * any line that spells it, so a sentence forbidding the shortcut would switch it on for itself.)
 *
 * The realism went instead. `threadToken` is rendered nowhere (grep it: only this file and one
 * prose comment in `pages/requests/[ref].astro`), so it is here to prove the type carries TWO
 * distinct ids — and `th_placeholder_not_a_secret_01` proves that as well as any hex did, while
 * reading as "not a secret" to a person with no comment needed. Do NOT "improve" these back into
 * realistic tokens: keep them low-entropy words, and keep `ref` — which IS rendered and IS meant
 * to look quotable — as the only id in this file with any entropy in it.
 *
 * ── THE STORED ENUM IS NOT THE LABEL ───────────────────────────────────────────────────────────
 * `status` below is the STORED enum and nothing renders it. `lib/ticket-status.ts` holds the map to
 * what a customer reads, and `pattern-ticket-status-wording` holds the argument. Nothing in this
 * file, and nothing that filters or sorts, may touch the rendered string.
 *
 * ── DATES ARE ISO AND UTC, AND THAT IS A BUILD CONSTRAINT ──────────────────────────────────────
 * `apps/support` is a STATIC build. A fixture written as "2 days ago" is baked at build time and
 * starts lying the next morning; a fixture rendered through the visitor's local timezone renders
 * differently for the reviewer and for the build. So every stamp is an explicit UTC instant and
 * `lib/ticket-time.ts` formats it in UTC, deterministically.
 */

/** The stored enum. Three states, and `pending` means WE are waiting on the customer. */
export type TicketStatus = 'open' | 'pending' | 'closed';

/** Which side of the conversation. It drives the plate and the label. It is NOT a channel. */
export type MessageSender = 'customer' | 'support';

/**
 * Written by a person, or generated by one of their machines. An auto-reply is a real message that
 * really arrived — it is kept and shown, and it must not count as the customer answering.
 */
export type MessageKind = 'human' | 'auto';

/**
 * The chip's glyph is chosen from the TYPE, never from the filename (`pattern-file-attach`). Three
 * buckets are the whole set these surfaces can produce, and `other` is the honest fallback rather
 * than a guess dressed as a type.
 */
export type AttachmentKind = 'image' | 'document' | 'other';

export interface TicketAttachment {
  name: string;
  /** Raw bytes. Formatting is `lib/ticket-time.ts`'s job so one rule prints every size. */
  bytes: number;
  kind: AttachmentKind;
  /**
   * Whether the chip actually opens the asset. `false` here for every fixture because there is no
   * object store in this app — and the chip's affordance is conditional exactly so that it never
   * looks interactive while being a dead link (`pattern-file-attach`).
   */
  openable: boolean;
}

/**
 * Quoted history that arrived inside an emailed reply. DETECTED, COLLAPSED, AND KEPT — never
 * stripped. There is no standard quote marker across Gmail, Outlook and Apple Mail, so every
 * stripper over-strips somewhere, and what it eats is a sentence the customer typed under the
 * quote. `lines` is carried separately so the reader can tell a two-line signature from a forty-
 * line thread without opening either.
 */
export interface TicketQuote {
  lines: number;
  text: string;
}

export interface TicketMessage {
  id: string;
  sender: MessageSender;
  /**
   * A REAL name, or `null`. `null` on our side renders `Baseout Support` in the muted worded-
   * absence register — never a generated first name, never "Support Agent" dressed as a person.
   * The renderer chooses on this field being null, never by string-comparing a label against the
   * fallback (`commentText.ts:44-71`, and the "Author not captured" ruling behind it).
   */
  senderName: string | null;
  kind: MessageKind;
  /**
   * VERIFIED vs ASSERTED AUTHOR — and this is not "arrived by email". A message from a signed-in
   * account is verified. A message that arrived from the case's address with no session behind it
   * is asserted, and on a thread that may hold another organisation's data that difference is
   * load-bearing. The two facts correlate and are not the same claim.
   */
  verified: boolean;
  /** ISO 8601, UTC. Every message carries its own — a thread that stamps only its ends hides the
   *  four-day gap that is usually the complaint. */
  at: string;
  body: string;
  attachments: TicketAttachment[];
  quoted: TicketQuote | null;
}

/**
 * WHAT THE CASE IS ABOUT, where anything is. Nullable by construction: most cases are about
 * nothing in particular, and a row that invents an object to fill a slot is worse than a row with
 * an empty one.
 */
export interface TicketSubject {
  kind: 'space' | 'run';
  label: string;
  /** The stored id. Rendered nowhere; here because the store returns it and the row links on it. */
  id: string;
}

export interface Ticket {
  /** The human, quotable id. High-entropy on purpose — it is public the moment it is pasted. */
  ref: string;
  /** The routing key. NEVER RENDERED, rotatable, and the reason `ref` can be quoted safely.
   *  Fixture values are deliberately low-entropy placeholders — see the header, secret-scan. */
  threadToken: string;
  subject: string;
  status: TicketStatus;
  /** When it was opened. Distinct from `lastActivityAt`, and never the sort key. */
  raised: string;
  /** THE SORT KEY of the list. */
  lastActivityAt: string;
  spaceId: string | null;
  runId: string | null;
  /** The resolved display of `spaceId`/`runId`, which a real store joins. Null where neither. */
  about: TicketSubject | null;
  /**
   * True when the case was raised without a session — the anonymous intake at `/contact/`. It is
   * what makes the submitter's own messages `verified: false`, and it is the field the parent
   * change declared and nothing read.
   */
  unauthenticated: boolean;
  messages: TicketMessage[];
}

/* ── The fixture ────────────────────────────────────────────────────────────────────────────────
 * Five cases, chosen to cover the states the surfaces have to survive rather than to look like a
 * plausible inbox: three open, one awaiting the customer's reply, one closed, one carrying
 * attachments, one carrying a long quoted email, and one auto-reply that must not count as a
 * customer answer. The empty case has no rows at all and is `NO_TICKETS` below — an empty array is
 * a state, not an oversight, and the list has to be able to render it.
 *
 * DELIBERATELY OUT OF ORDER IN THE SOURCE. `lastActivityAt` decides the order on screen, and a
 * fixture already sorted by hand would hide a sort that never ran. */
export const TICKETS: Ticket[] = [
  {
    ref: 'BO-7QX9-K4TD',
    threadToken: 'th_placeholder_not_a_secret_01',
    subject: 'Scheduled backup on Sales CRM has not run since Sunday',
    status: 'pending',
    raised: '2026-08-16T08:41:00Z',
    lastActivityAt: '2026-08-20T15:02:00Z',
    spaceId: 'spc_ops',
    runId: null,
    about: { kind: 'space', label: 'Ops', id: 'spc_ops' },
    unauthenticated: false,
    messages: [
      {
        id: 'm1',
        sender: 'customer',
        senderName: 'Dana Keller',
        kind: 'human',
        verified: true,
        at: '2026-08-16T08:41:00Z',
        body:
          'The nightly schedule on Sales CRM has not produced a run since Sunday. Nothing changed on ' +
          'our side that I know of, and the connection still shows as connected.',
        attachments: [],
        quoted: null,
      },
      {
        id: 'm2',
        sender: 'support',
        senderName: 'Priya Raghavan',
        kind: 'human',
        verified: true,
        at: '2026-08-18T10:15:00Z',
        body:
          'A schedule stops producing runs when the connection behind it loses a scope rather than ' +
          'the connection itself — the Space keeps its green state and the run never starts. Open ' +
          'the Space, then Connections, and tell me what the scope line under Airtable reads.',
        attachments: [],
        quoted: null,
      },
      /* THE LONG QUOTED EMAIL. It arrived from a mail client that quoted the whole thread under the
         reply, plus a signature and a corporate footer — 31 lines of it. Collapsed, kept, and the
         count is on the disclosure so the reader can tell this from a two-line signature. */
      {
        id: 'm3',
        sender: 'customer',
        senderName: 'Dana Keller',
        kind: 'human',
        verified: true,
        at: '2026-08-20T15:02:00Z',
        body: 'It reads "Airtable · limited scope". I did not change it. What do I do from there?',
        attachments: [],
        quoted: {
          lines: 31,
          text:
            'On Tue, 18 Aug 2026 at 10:15, Baseout Support <support@baseout.com> wrote:\n' +
            '> A schedule stops producing runs when the connection behind it loses a scope rather\n' +
            '> than the connection itself — the Space keeps its green state and the run never\n' +
            '> starts. Open the Space, then Connections, and tell me what the scope line under\n' +
            '> Airtable reads.\n' +
            '>\n' +
            '> On Sun, 16 Aug 2026 at 08:41, Dana Keller <dana@northwind.example> wrote:\n' +
            '> > The nightly schedule on Sales CRM has not produced a run since Sunday. Nothing\n' +
            '> > changed on our side that I know of, and the connection still shows as connected.\n' +
            '> >\n' +
            '> > --\n' +
            '> > Dana Keller\n' +
            '> > Operations · Northwind Trading\n' +
            '> > dana@northwind.example · +1 555 0148\n' +
            '>\n' +
            '> --\n' +
            '> Baseout Support\n' +
            '> You are receiving this because you wrote to support@baseout.com.\n' +
            '>\n' +
            'This message and any attachments are confidential and intended solely for the\n' +
            'addressee. If you have received it in error, notify the sender and delete it from\n' +
            'your system. Northwind Trading accepts no liability for any loss or damage arising\n' +
            'from the use of this email or its attachments. Northwind Trading Ltd is registered\n' +
            'in England and Wales, company number 04471129, registered office 14 Bell Yard,\n' +
            'London WC2A 2JR. Please consider the environment before printing this email.\n' +
            '\n' +
            '--\n' +
            'Dana Keller\n' +
            'Operations · Northwind Trading\n' +
            'dana@northwind.example · +1 555 0148',
        },
      },
    ],
  },

  /* ATTACHMENTS, AND AN AUTO-REPLY. Two states in one case on purpose: the chips are the detail
     surface's half of the attachment ruling, and the out-of-office is the message that must not
     count as the customer answering — the case stays `open`, not `pending`. */
  {
    ref: 'BO-4K2M-P8RV',
    threadToken: 'th_placeholder_not_a_secret_02',
    subject: 'Attachments tab is empty after the first run on a new base',
    status: 'open',
    raised: '2026-08-19T09:12:00Z',
    lastActivityAt: '2026-08-19T13:20:00Z',
    spaceId: 'spc_ops',
    runId: 'run_20826',
    about: { kind: 'run', label: 'Run 20826 · Sales CRM', id: 'run_20826' },
    unauthenticated: false,
    messages: [
      {
        id: 'm1',
        sender: 'customer',
        senderName: 'Dana Keller',
        kind: 'human',
        verified: true,
        at: '2026-08-19T09:12:00Z',
        body:
          'The nightly backup on Sales CRM finished but the Attachments tab is empty. Screenshot and ' +
          'the run log are attached.',
        attachments: [
          { name: 'attachments-tab-empty.png', bytes: 254_000, kind: 'image', openable: false },
          { name: 'run-log-2026-08-19.txt', bytes: 18_400, kind: 'document', openable: false },
        ],
        quoted: null,
      },
      {
        id: 'm2',
        sender: 'support',
        senderName: null,
        kind: 'human',
        verified: true,
        at: '2026-08-19T11:40:00Z',
        body:
          'Attachments are captured on the pass after the record pass, so the first run of a newly ' +
          'scoped base can land with the tab empty. Can you confirm the run finished after 02:00?',
        attachments: [],
        quoted: null,
      },
      /* `kind: 'auto'`. It is a real message, it is kept, and the status above stays `open` because
         a machine answering is not the customer answering. */
      {
        id: 'm3',
        sender: 'customer',
        senderName: 'Dana Keller',
        kind: 'auto',
        verified: false,
        at: '2026-08-19T13:20:00Z',
        body:
          'I am out of the office until 24 August with limited access to email. For anything urgent ' +
          'please contact ops@northwind.example.',
        attachments: [],
        quoted: null,
      },
    ],
  },

  {
    ref: 'BO-2H5T-W3LC',
    threadToken: 'th_placeholder_not_a_secret_03',
    subject: 'Can a restore write into a different base than the one it came from?',
    status: 'open',
    raised: '2026-08-21T07:55:00Z',
    lastActivityAt: '2026-08-21T07:55:00Z',
    spaceId: null,
    runId: null,
    about: null,
    unauthenticated: false,
    messages: [
      {
        id: 'm1',
        sender: 'customer',
        senderName: 'Dana Keller',
        kind: 'human',
        verified: true,
        at: '2026-08-21T07:55:00Z',
        body:
          'We want to restore last week’s snapshot into a staging base rather than over the live one. ' +
          'Is that a supported target, or does a restore always write back to its source?',
        attachments: [],
        quoted: null,
      },
    ],
  },

  /* THE ASSERTED AUTHOR. Raised through the anonymous intake, so `unauthenticated` is true and the
     submitter's own messages carry `verified: false` — one quiet marker with a tooltip saying what
     it means, and never a claim about which channel the message came in on. */
  {
    ref: 'BO-9DN4-QZ6B',
    threadToken: 'th_placeholder_not_a_secret_04',
    subject: 'Billing address on the August invoice is the old one',
    status: 'open',
    raised: '2026-08-14T16:30:00Z',
    lastActivityAt: '2026-08-18T09:05:00Z',
    spaceId: null,
    runId: null,
    about: null,
    unauthenticated: true,
    messages: [
      {
        id: 'm1',
        sender: 'customer',
        senderName: 'Marc Oyelaran',
        kind: 'human',
        verified: false,
        at: '2026-08-14T16:30:00Z',
        body:
          'The August invoice still carries our previous registered address. We updated it in the app ' +
          'in July. Can the invoice be reissued?',
        attachments: [],
        quoted: null,
      },
      {
        id: 'm2',
        sender: 'support',
        senderName: 'Priya Raghavan',
        kind: 'human',
        verified: true,
        at: '2026-08-18T09:05:00Z',
        body:
          'An invoice is stamped with the address held at the moment it was issued, so July’s change ' +
          'reaches September rather than August. I can reissue August against the current address — ' +
          'reply from the address on the account and I will do it.',
        attachments: [],
        quoted: null,
      },
    ],
  },

  {
    ref: 'BO-1RB8-N7EK',
    threadToken: 'th_placeholder_not_a_secret_05',
    subject: 'Two Spaces are both backing up the same base',
    status: 'closed',
    raised: '2026-08-04T11:20:00Z',
    lastActivityAt: '2026-08-07T14:48:00Z',
    spaceId: 'spc_finance',
    runId: null,
    about: { kind: 'space', label: 'Finance', id: 'spc_finance' },
    unauthenticated: false,
    messages: [
      {
        id: 'm1',
        sender: 'customer',
        senderName: 'Dana Keller',
        kind: 'human',
        verified: true,
        at: '2026-08-04T11:20:00Z',
        body:
          'Finance and Ops are both running a nightly backup of the same base. Is that doubling what ' +
          'we store, and which one does a restore read from?',
        attachments: [],
        quoted: null,
      },
      {
        id: 'm2',
        sender: 'support',
        senderName: 'Priya Raghavan',
        kind: 'human',
        verified: true,
        at: '2026-08-05T08:02:00Z',
        body:
          'Two Spaces holding the same base keep two independent histories, so yes — it is stored ' +
          'twice, and a restore reads from whichever Space you start it in. Remove the base from one ' +
          'Space and that Space’s existing runs stay readable; nothing is deleted by unscoping it.',
        attachments: [],
        quoted: null,
      },
      {
        id: 'm3',
        sender: 'customer',
        senderName: 'Dana Keller',
        kind: 'human',
        verified: true,
        at: '2026-08-07T14:48:00Z',
        body: 'Unscoped it from Finance. That answers it, thank you — closing this.',
        attachments: [],
        quoted: null,
      },
    ],
  },
];

/**
 * THE EMPTY CASE, and it is a fixture rather than an absence. Nobody has ever written in: the list
 * has a first-ever state that is a different sentence from "no open cases", and a surface whose
 * empty branch is only reachable by deleting the data is a branch nobody looks at.
 * `lib/tickets-view.ts` is what selects between them for the client.
 */
export const NO_TICKETS: Ticket[] = [];

/** THE DEFAULT SORT, and the list's whole reason for existing: the one that MOVED, first. */
export const byLastActivity = (list: Ticket[]): Ticket[] =>
  [...list].sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));

export const byRef = (ref: string): Ticket | undefined => TICKETS.find((t) => t.ref === ref);

/** The last message that is worth showing as a snippet. An auto-reply is a real message and it is
 *  kept on the thread — but a row summarised by somebody's out-of-office tells the reader nothing
 *  about their case, so the snippet steps back to the last message a person wrote. */
export const lastHumanMessage = (t: Ticket): TicketMessage | undefined =>
  [...t.messages].reverse().find((m) => m.kind === 'human');
