/**
 * ONE STATUS VOCABULARY — the colour, the glyph and the class name for every request state, in one
 * place, read by the board, the filter chips, the column heads and the detail page.
 *
 * THE COLOURS ARE NOT NEW. They are the product's own ruling, ported: `apps/web/src/lib/backups/
 * format.ts` paints `succeeded` soft-success, `running` soft-PRIMARY ("`info` was a seventh
 * semantic colour used at exactly one site; blue for 'happening now' is `primary` everywhere else
 * in the product" — Oleh, 2026-08-14), and `queued`/`cancelled` ghost. A roadmap is the same state
 * machine at a slower clock, so it wears the same paint:
 *
 *   Suggested      → ghost      nobody has judged it, so no colour may imply anyone has
 *   Planned        → ghost      a request that has not started is `queued`
 *   In progress    → warning    see below — this ONE differs from the product, on purpose
 *   Shipped        → success    it succeeded
 *   Already exists → success    it also exists; the word and the doc link carry the difference
 *   Not planned    → ghost      `cancelled` is ghost, and NOT red — red means something broke
 *
 * THE ONE DIVERGENCE, and it is argued rather than drifted. Backups paints `running` PRIMARY, and
 * that is right THERE: a run's row holds no blue action, so blue can mean "happening now" without
 * competing with anything. A request CARD is the opposite — it holds a Vote button, and a vote is
 * the one thing the board exists to collect. Two things cannot both own the accent. So the action
 * keeps blue and the state takes amber, which is the system's "in flight, watch this" colour and
 * still not red. `In progress` on a roadmap and `running` on a backup are also not the same claim:
 * one is a quarter of work, the other is a job that finishes while you watch it.
 *
 * WHY NOT SOFT-NEUTRAL FOR THE GHOSTS: it is a banned paint (1.34:1 dark / 4.35:1 light, audit
 * X08-F6). Grey on grey is grey. The ghost pair is `--bo-base-200` behind `--bo-muted-strong`,
 * which is what the product paints and what clears the floor.
 *
 * EVERY STATUS IS A GLYPH AND A WORD AND A COLOUR. Colour alone fails the ~8% of readers with a
 * colour vision deficiency, and green-vs-grey is exactly the pair that fails first.
 */
import type { RequestStatus } from '../data/requests';
import { iconHtml, type IconName } from './icons';

export type Tone = 'ghost' | 'primary' | 'warning' | 'success';

export interface StatusMeta {
  /** Kebab class suffix, e.g. `in-progress`. */
  slug: string;
  tone: Tone;
  icon: IconName;
  /**
   * The column's subtitle. Says what the state MEANS, not what it is called — and it has to fit on
   * ONE line in a third of the content column, because a hint that wraps pushes its column's cards
   * out of step with the other two. That is a hard constraint on the wording, not a preference.
   */
  hint: string;
}

export const STATUS: Record<RequestStatus, StatusMeta> = {
  /**
   * GHOST, AND THAT IS THE HONEST CHOICE RATHER THAN THE LEFTOVER ONE. `Suggested` means asked for
   * and not yet judged, where `Planned` means agreed and not started — so any hue that reads as a
   * verdict is a lie about a decision nobody has taken. Green would say accepted, amber would say
   * underway, and red is reserved for something broken. The ghost pair says "nothing is happening
   * yet", which is the same claim `Planned` and `Not planned` make, and it is why all three share
   * it. The glyph and the word carry the difference, as they do for those two.
   *
   * The lightbulb is not a decorative flourish: it is the glyph `/contact/` already puts on
   * "Something I wish existed", so the thing you submitted and the row it becomes wear one mark.
   */
  Suggested: {
    slug: 'suggested',
    tone: 'ghost',
    icon: 'lightbulb',
    hint: 'Asked for, not yet judged.',
  },
  Planned: {
    slug: 'planned',
    tone: 'ghost',
    icon: 'circle-dashed',
    hint: 'Agreed, not started.',
  },
  'In progress': {
    slug: 'in-progress',
    tone: 'warning',
    icon: 'circle-dot',
    hint: 'Being built now.',
  },
  Shipped: {
    slug: 'shipped',
    tone: 'success',
    icon: 'circle-check',
    hint: 'Live, and documented.',
  },
  'Already exists': {
    slug: 'already-exists',
    tone: 'success',
    icon: 'book-open-check',
    hint: 'Already built — the link is the proof.',
  },
  'Not planned': {
    slug: 'not-planned',
    tone: 'ghost',
    icon: 'circle-slash',
    hint: 'Not going to be built, and the reason is on the item.',
  },
};

export const statusMeta = (s: RequestStatus): StatusMeta => STATUS[s];

/**
 * The same badge as an HTML string, for `lib/submit.ts` — the duplicate suggestions are built at
 * keystroke time, and an Astro component cannot be reached from there. The class names are the ones
 * in `styles/support.css`, which is global for exactly this reason.
 */
export function statusBadgeHtml(status: RequestStatus, size = 13): string {
  const m = STATUS[status];
  return (
    `<span class="bo-badge bo-tone-${m.tone}" data-status="${m.slug}">` +
    `${iconHtml(m.icon, size)}${status}</span>`
  );
}
