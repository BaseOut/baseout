/**
 * STORED ENUM → CUSTOMER LABEL. The whole file is `pattern-ticket-status-wording` applied.
 *
 * THE ENUM AND THE LABEL ARE DIFFERENT THINGS. An enum is written for the system that stores it; a
 * label is written for the person reading it, and that person does not have our schema. Where the
 * two are allowed to be one string the schema leaks, and it leaks in the one direction that costs
 * money.
 *
 * THE ROW THAT PROVES IT IS `pending`. Internally it means we are pending on the CUSTOMER — we have
 * replied and are waiting. Rendered literally, "Pending" reads as pending on Baseout's side:
 * something is in progress, somebody is on it, there is nothing for me to do. So the customer waits,
 * we wait, and the case stalls with both parties believing the other has it. Zendesk renamed this
 * exact state for this exact reason. Ours is `Awaiting your reply` — second person, naming who is
 * owed and what is owed.
 *
 * EXACTLY ONE HUE, ON EXACTLY ONE ROW. `pending` is the only state carrying a task on the customer,
 * so it is the only state with a colour. If `open` also had one, the row that needs the customer to
 * act would stop being the row that stands out and the table would be three pills that all look
 * equally urgent, i.e. none. Warning, not error: a case waiting on a reply is a request, not a
 * failure, and red spent on a non-failure is red we cannot use when something breaks.
 *
 * THERE IS NO FOURTH COLOUR TO REACH FOR. The badge vessel has no `info` variant and that is a
 * ruling, not an omission (D19 §4). This is precisely the table that invents one — three states, two
 * of them neutral, and a strong pull to separate `Open` from `Closed` with a calm blue. The correct
 * separation is WEIGHT, not hue.
 *
 * NEUTRAL MEANS THE GHOST PAIR (`bo-tone-ghost` = `--bo-base-200` behind `--bo-muted-strong`), never
 * a soft-neutral badge, which is banned outright at 1.34:1 dark / 4.35:1 light.
 *
 * THE TABLE IS TOTAL (D43). Every read goes through `ticketStatusMeta()`, which takes a `string` and
 * always returns a row. The fallback is a NEW neutral `Unknown` and it is never aliased onto
 * `closed`: telling a customer their live case is closed is the worst lie available here, and
 * `TABLE[x].label` on an unknown value is a runtime TypeError — a blank page instead of a wrong word.
 *
 * THE LABEL IS NOT A SECOND SOURCE OF TRUTH. Nothing filters, sorts or branches on the rendered
 * string. The enum stays the key in the store, in the URL and in a tab's value; this table is
 * applied at the last possible moment, inside the badge. A tab may READ `Awaiting your reply` and
 * still carry `pending`.
 *
 * SCOPE: CUSTOMER-FACING ONLY. An internal agent queue may keep saying `Pending`, because internally
 * it is unambiguous and shorter. Two vocabularies are fine; one string doing both jobs is not.
 */
import type { TicketStatus } from '../data/tickets';
import type { IconName } from './icons';

/** Only the two tones this table is allowed to spend. It is a narrower type than the roadmap's on
 *  purpose — `success` and `primary` are unreachable here, and the type is what says so. */
export type TicketTone = 'ghost' | 'warning';

export interface TicketStatusMeta {
  /** The stored key, kept on the meta so a caller never has to hold both. */
  key: TicketStatus | 'unknown';
  /** Kebab suffix for `data-status`, which is how the quieter `closed` weight is reached. */
  slug: string;
  /** What the CUSTOMER reads. Never a filter value, never a sort key. */
  label: string;
  tone: TicketTone;
  icon: IconName;
  /** One line saying what the state MEANS, for the case rail. Not the label restated. */
  hint: string;
}

const TABLE: Record<TicketStatus, TicketStatusMeta> = {
  /* NO HUE. We have it and nothing is owed by the customer — a live case is not an alarm, and
     giving it a colour would cost the one row that must stand out its distinctiveness. */
  open: {
    key: 'open',
    slug: 'open',
    label: 'Open',
    tone: 'ghost',
    icon: 'circle-dot',
    hint: 'With us. Nothing is needed from you.',
  },
  /* THE ONLY HUE IN THE TABLE. The question mark is the glyph, not a warning triangle: something is
     being asked of the reader, and nothing is wrong. */
  pending: {
    key: 'pending',
    slug: 'pending',
    label: 'Awaiting your reply',
    tone: 'warning',
    icon: 'message-circle-question-mark',
    hint: 'We have replied and are waiting on you.',
  },
  /* NEUTRAL AND QUIETER — separated from `Open` by weight, in the badge's own `data-status` rule.
     THE GLYPH IS A CHECK AND THE TONE IS WHAT KEEPS IT HONEST: a GREY check reads "finished", where
     a green one would read "solved", and `Closed` deliberately does not claim that. A case closed by
     the customer, or after silence, was not necessarily solved, and a label claiming otherwise is a
     small lie the customer can see. That is also why the word is `Closed` and not Zendesk's
     `Solved`. */
  closed: {
    key: 'closed',
    slug: 'closed',
    label: 'Closed',
    tone: 'ghost',
    icon: 'circle-check',
    hint: 'Finished. A reply reopens it.',
  },
};

/**
 * The fallback row. NEW, neutral, and never an alias onto `closed`. It exists so that a state this
 * build has not heard of renders as an honest unknown rather than crashing the page or, worse,
 * quietly claiming the case is finished.
 */
const UNKNOWN: TicketStatusMeta = {
  key: 'unknown',
  slug: 'unknown',
  label: 'Unknown',
  tone: 'ghost',
  icon: 'circle-dashed',
  hint: 'This case is in a state this page does not recognise.',
};

/** The ONE read path. It takes a `string` on purpose: a store can return anything. */
export function ticketStatusMeta(status: string): TicketStatusMeta {
  return (TABLE as Record<string, TicketStatusMeta>)[status] ?? UNKNOWN;
}

/* ── The list's tabs ────────────────────────────────────────────────────────────────────────────
 * `Open / Closed / All`, and `Open` HOLDS `pending`. That is not a shortcut: `pending` is an open
 * case with the ball in the customer's court, and putting it in its own tab would hide the one
 * state that needs them behind a click. The tab is a lane, the badge is the detail. */
export type TicketTab = 'open' | 'closed' | 'all';

export const TABS: { key: TicketTab; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

/** The membership rule, in one place, so the counts and the rows can never disagree. */
export const inTab = (status: TicketStatus, tab: TicketTab): boolean =>
  tab === 'all' ? true : tab === 'closed' ? status === 'closed' : status !== 'closed';
