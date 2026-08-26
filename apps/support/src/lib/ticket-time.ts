/**
 * One formatter for every stamp and every file size on the ticket surfaces.
 *
 * NOTHING ON THESE PAGES FORMATS A DATE ITSELF. `apps/web` learned this as `pattern-time` (D09) and
 * paid for it with two feeds answering the same question from two anchors. There is no `lib/time.ts`
 * in `apps/support`, so this is it — small, and the only one.
 *
 * ── EVERYTHING IS UTC, AND THE REASON IS THE BUILD ─────────────────────────────────────────────
 * `apps/support` is a fully STATIC build: these strings are computed on a build machine, written
 * into HTML, and served unchanged to everybody. Two consequences, and both are constraints rather
 * than preferences:
 *
 *   NO RELATIVE TIME. "2 days ago" is true for about a day and then it is a lie printed in HTML that
 *   nothing re-renders. The list's whole promise is "the one that moved", so a stale relative stamp
 *   is not a cosmetic fault — it is the page's one claim, wrong.
 *
 *   NO LOCAL TIMEZONE. `toLocaleString()` with no `timeZone` reads the machine's, so the reviewer's
 *   screen and the build's output disagree with each other and neither is reproducible. `timeZone:
 *   'UTC'` is pinned on every formatter here. When there is a session, a real store can re-render
 *   these in the reader's zone — and that is a change in ONE file.
 */

const fmt = (opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts });

const DAY = fmt({ month: 'short', day: 'numeric' });
const DAY_YEAR = fmt({ month: 'short', day: 'numeric', year: 'numeric' });
const STAMP = fmt({ month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const STAMP_YEAR = fmt({
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/**
 * THE YEAR APPEARS ONLY WHEN IT IS NOT THE CURRENT ONE — and "current" is the BUILD's year, which
 * is the only year this static page can know. A support case can be a year old and a thread that
 * drops the year makes "Aug 19" ambiguous exactly where the gap matters most.
 */
const THIS_YEAR = new Date().getUTCFullYear();
const sameYear = (d: Date) => d.getUTCFullYear() === THIS_YEAR;

/** A per-message stamp: `Aug 19, 09:12`. Every message carries one — a thread that stamps only its
 *  ends hides the four-day gap that is usually the complaint. */
export const fmtStamp = (iso: string): string => {
  const d = new Date(iso);
  return (sameYear(d) ? STAMP : STAMP_YEAR).format(d).replace(/,\s(?=\d{2}:)/, ', ');
};

/** A list row's last-activity: `Aug 20`. Coarser than a message stamp on purpose — the row answers
 *  "which one moved", and the thread answers "when, exactly". */
export const fmtDay = (iso: string): string => {
  const d = new Date(iso);
  return (sameYear(d) ? DAY : DAY_YEAR).format(d);
};

/** The machine-readable half, for `<time datetime>`. A screen reader and a scraper both get the
 *  instant even though the rendered string is deliberately coarse. */
export const isoAttr = (iso: string): string => new Date(iso).toISOString();

/**
 * File sizes. Copied in SPIRIT from `lib/submit.ts`'s `formatBytes` and deliberately not imported:
 * that module is the submit controller and pulling a whole form controller into a static page to
 * borrow four lines is a dependency that will outlive the reason for it. If a third caller appears,
 * lift ONE of them into a shared module — do not grow a third.
 */
export const fmtBytes = (n: number): string => {
  if (n < 1024) return `${n} B`;
  const kb = n / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb >= 10 ? Math.round(mb) : mb.toFixed(1)} MB`;
};
