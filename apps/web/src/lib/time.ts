/**
 * ONE time system for the whole app — audit decision D09.
 *
 * WHY THIS FILE EXISTS, and why it is `lib/time.ts` rather than more of
 * `lib/backups/format.ts`: the journeys counted at least eight coexisting time
 * formats and three private formatter copies (`SpaceHomeView`, `BackupsListView`,
 * `BackupRunDetailView`), and — worst — the same "Last 7 days" control returning
 * 0 rows on Schema and 314 on Data at the same instant, because one read the wall
 * clock and one read the backup's as-of. `lib/backups/format.ts` is the BACKUP
 * domain (run status vocabulary, health derivation, space health); Schema, Data,
 * Comments, Attachments, Reports and the Inbox all print times and none of them
 * is a backup surface, so importing `backups/format` from `SchemaChat.astro`
 * would make every caller declare a domain it is not in. The primitives live
 * here; `backups/format.ts` re-exports the four it already published so its
 * existing importers keep working against ONE implementation.
 *
 * THE RULES this module encodes (mirrored in storybook `pattern-time`):
 *
 * 1. Day rule / row time / relative / absolute-with-zone / duration are the five
 *    shapes. There is no sixth. A surface that wants one writes an import, never
 *    an `Intl.DateTimeFormat`.
 * 2. A relative time ALWAYS carries its absolute on a `tooltip` (`fmtAbsolute`),
 *    because "3h ago" cannot be checked against anything.
 * 3. Every "last N days" control anchors on the BACKUP AS-OF, not the wall clock,
 *    and PRINTS its anchor (`rangeAnchorLabel` → "Last 7 days · to Jul 14"). The
 *    as-of is the honest anchor for a backup product — `DataChangelog` already
 *    wrote that reasoning down — but either choice is only honest when the anchor
 *    is visible.
 * 4. The zone is printed ONCE per surface (`zoneNote`), never per row.
 *
 * THE CONVENTION — US, and stated here so no surface re-derives it from taste
 * (Oleh, 2026-08-08; the customers are in the United States):
 *
 *   • ORDER — month before day, always. `Jul 14, 2026` · `Jul 14, 9:12 AM`.
 *     Never `14 Jul`, never `2026-07-14`.
 *   • CLOCK — 12-hour with AM/PM. `hour12: true` is passed EXPLICITLY, not left
 *     to the locale's hour cycle, because a `-u-hc-h23` extension or a host
 *     preference can flip it underneath an `en-US` tag.
 *   • LOCALE — `'en-US'` is passed at every call site below. A bare
 *     `toLocaleString()` reads the RUNTIME locale, so the identical build renders
 *     `14/07/2026` on a European laptop and `7/14/2026` on the customer's, and
 *     nobody would see it in review. That is why the tree's private copies could
 *     disagree without a single diff between them.
 *   • THE ONE EXCEPTION — a machine identifier that happens to contain a date
 *     (`run_2026_06_15_daily`, anything rendered `mono-data` as an id) is DATA,
 *     not a date being formatted for a reader. It is printed verbatim.
 *
 * ZONE — a boundary worth stating. `zoneLabel()` reads the RENDER environment.
 * Server-side that is the server (a Cloudflare Worker: UTC); client-side it is
 * the viewer. `ZoneNote.astro` therefore corrects itself on mount rather than
 * shipping the server's offset as if it were the reader's. Whether the engine
 * emits offsets at all on its timestamps is NOT verifiable from this mirror —
 * see `audit/PARKED.md` P23.
 */

const LOCALE = 'en-US'

/* ── Render timezone ─────────────────────────────────────────────────────────
 *
 * These formatters run in TWO environments. In the browser the runtime zone IS
 * the viewer's, so `timeZone: undefined` is already correct. Server-side the
 * runtime zone is the Worker's (UTC), which is NOT the viewer's — that was the
 * defect this hook removes: every SSR'd stamp printed UTC wall-clock time with
 * no zone label to say so (the label itself was deliberately dropped, see
 * `asOfWhen`). The server registers a per-request resolver (an
 * AsyncLocalStorage lookup — `server-timezone.ts`, wired in middleware); the
 * client never registers one, so client behavior is unchanged. The resolver
 * lives behind a setter, not an import, so this module stays free of
 * `node:async_hooks` and safe to bundle for the browser.
 */
type TimeZoneResolver = () => string | undefined

let serverTimeZoneResolver: TimeZoneResolver | null = null

export function setServerTimeZoneResolver(resolver: TimeZoneResolver | null): void {
  serverTimeZoneResolver = resolver
}

/** The zone to format in: the resolved viewer zone, else the runtime default. */
function renderTimeZone(): string | undefined {
  return serverTimeZoneResolver?.() ?? undefined
}

/** Parse to a Date, or null. Never throws, never returns `Invalid Date`. */
function parse(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Epoch ms, or null — the anchor helpers work in ms so callers do not re-parse. */
export function toMs(value: string | number | Date | null | undefined): number | null {
  return parse(value)?.getTime() ?? null
}

/* ── The five shapes ─────────────────────────────────────────────────────── */

/** Day rule, with year: "Jul 14, 2026". The default for anything dated. */
export function fmtDay(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  return d
    ? d.toLocaleDateString(LOCALE, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: renderTimeZone(),
      })
    : ''
}

/** Day rule, spelled out: "July 14, 2026". Feed day headers only. */
export function fmtDayLong(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  return d
    ? d.toLocaleDateString(LOCALE, {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        timeZone: renderTimeZone(),
      })
    : ''
}

/** Day rule, compact: "Jul 14". For cells where the year is established above. */
export function fmtDayShort(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  return d
    ? d.toLocaleDateString(LOCALE, {
        month: 'short',
        day: 'numeric',
        timeZone: renderTimeZone(),
      })
    : ''
}

/** Month bucket: "July 2026". For month separators in a long feed. */
export function fmtMonth(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  return d
    ? d.toLocaleDateString(LOCALE, {
        month: 'long',
        year: 'numeric',
        timeZone: renderTimeZone(),
      })
    : ''
}

/** Row time: "9:12 AM". Used beside a day header that carries the date. */
export function fmtTime(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  return d
    ? d.toLocaleTimeString(LOCALE, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: renderTimeZone(),
      })
    : ''
}

/** Row absolute: "Jul 14, 9:12 AM". One value, one cell, no day header needed. */
export function fmtDateTime(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  return d
    ? d.toLocaleString(LOCALE, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: renderTimeZone(),
      })
    : ''
}

/**
 * Absolute WITH the zone: "Jul 14, 2026, 9:12 AM (GMT+3)". This is what goes in
 * the `data-tip` of every relative time — the value a person can check.
 */
export function fmtAbsolute(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  if (!d) return ''
  const stamp = d.toLocaleString(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: renderTimeZone(),
  })
  return `${stamp} (${zoneLabel(d)})`
}

/**
 * Relative "N ago". Returns null — never a placeholder — when there is no
 * timestamp, so the caller decides whether an em-dash is honest.
 */
export function fmtRelative(
  value: string | number | Date | null | undefined,
  now: number = Date.now(),
): string | null {
  const d = parse(value)
  if (!d) return null
  const minutes = Math.round((now - d.getTime()) / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.round(hours / 24)}d ago`
}

/**
 * Duration between two moments. <60s → "Xs"; <60m → "Xm Ys"; else "Xh Ym".
 * Null when either bound is missing (still running, or never started).
 */
export function fmtDuration(
  startedAt: string | number | Date | null | undefined,
  completedAt: string | number | Date | null | undefined,
): string | null {
  const a = parse(startedAt)
  const b = parse(completedAt)
  if (!a || !b || b.getTime() < a.getTime()) return null
  const seconds = Math.round((b.getTime() - a.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remSec = seconds % 60
  if (minutes < 60) return remSec === 0 ? `${minutes}m` : `${minutes}m ${remSec}s`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin === 0 ? `${hours}h` : `${hours}h ${remMin}m`
}

/* ── Zone ────────────────────────────────────────────────────────────────── */

/**
 * "GMT+3" for the RENDER environment. Server-side this is the server's zone, so
 * anything that prints it to a reader must correct itself on the client —
 * `ZoneNote.astro` is the one component that does, and it is the only thing that
 * should call this for display.
 */
export function zoneLabel(at: Date = new Date()): string {
  const part = new Intl.DateTimeFormat(LOCALE, {
    timeZoneName: 'shortOffset',
    timeZone: renderTimeZone(),
  })
    .formatToParts(at)
    .find((p) => p.type === 'timeZoneName')
  return part?.value ?? 'UTC'
}

/** The once-per-surface sentence. See `ZoneNote.astro`. */
export function zoneNote(at: Date = new Date()): string {
  return `Times in your local zone (${zoneLabel(at)})`
}

/* ── As-of, and the anchored range ───────────────────────────────────────── */

/**
 * The as-of stamp's TIME half: "Jun 22, 2:07 PM". Deliberately not `fmtAbsolute`,
 * which is still the right thing for a tooltip and stays untouched.
 *
 * Two things came off, both on Oleh's call (2026-08-12), and the second one is not
 * merely shorter:
 *
 *   THE YEAR. "Jun 22, 2026" over a backup taken this year is a digit group that
 *   changes nothing. A stamp from a different year is a thing worth showing, so
 *   the year returns when it is not the current one — which is the only case it
 *   ever carried information.
 *
 *   THE ZONE. "(GMT+3)" was a claim about the READER'S clock, and this module's
 *   own `zoneLabel` doc says it is the zone of the RENDER environment — server
 *   side, the SERVER'S. So on every server-rendered page the stamp named a
 *   timezone the reader may not be in, labelled as though they were. Oleh:
 *   Americans are not helped by being told their own offset, and this product
 *   ships to the States. A label that is unnecessary AND can be wrong is not a
 *   trade-off. `ZoneNote.astro` remains the one component allowed to print a zone,
 *   because it is the one that corrects itself on the client.
 *
 * `fmtAbsolute` keeps its zone and its 19 tooltip callers: a tooltip is the
 * checkable value, and changing it is a separate decision from this one. The same
 * server-zone caveat applies there and is recorded rather than quietly patched.
 */
export function asOfWhen(value: string | number | Date | null | undefined): string {
  const d = parse(value)
  if (!d) return ''
  const timeZone = renderTimeZone()
  // The year comparison happens in the SAME zone the stamp renders in —
  // `getFullYear()` reads the runtime zone, which around New Year disagrees
  // with the viewer's by up to a day.
  const yearIn = (x: Date) => x.toLocaleDateString(LOCALE, { year: 'numeric', timeZone })
  const sameYear = yearIn(d) === yearIn(new Date())
  return d.toLocaleString(LOCALE, {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone,
  })
}

/**
 * The as-of stamp, in the SAME words on Schema and Data (D09 item 4):
 * "As of run_2026_06_22_daily · Jun 22, 2026, 2:07 PM (GMT+3)".
 *
 * The run id is printed because "as of Jun 22" does not tell a person WHICH
 * capture they are reading, and a backup product's whole contract is that a
 * screen names the snapshot behind it. Falls back to the timestamp alone when
 * the model does not carry a run id — it drops the clause rather than inventing
 * an id.
 */
export function asOfLabel(
  runId: string | null | undefined,
  at: string | number | Date | null | undefined,
): string {
  const stamp = asOfWhen(at)
  if (!stamp) return ''
  return runId ? `As of ${runId} · ${stamp}` : `As of ${stamp}`
}

/**
 * The printed anchor of a "last N days" control (D09 item 3):
 * `rangeAnchorLabel(7, asOf)` → "Last 7 days · to Jul 14".
 *
 * With no anchor the control is reading the wall clock, and the label says so
 * rather than implying a snapshot: "Last 7 days · to today".
 */
export function rangeAnchorLabel(
  days: number,
  anchor: string | number | Date | null | undefined,
): string {
  const to = fmtDayShort(anchor)
  return `Last ${days} days · to ${to || 'today'}`
}

/** The anchor a "last N days" window counts back from: the as-of, else the clock. */
export function rangeAnchorMs(
  anchor: string | number | Date | null | undefined,
  fallback: number = Date.now(),
): number {
  return toMs(anchor) ?? fallback
}

/* ── Schedules ───────────────────────────────────────────────────────────── */

/**
 * "Next backup" for a schedule. Reads `backup_configurations.next_scheduled_at`.
 * NULL renders as "Not yet scheduled" (no schedule armed — pre-bootstrap or
 * instant frequency).
 *
 * A schedule whose date has PASSED is not a promise, it is a miss. The overdue
 * branch says so rather than printing a past date as if it were still coming —
 * "Next backup: Jun 4, 09:00" on Jun 9 is the asserted-claim shape D01 removes.
 */
export function formatNextScheduledAt(
  iso: string | null,
  now: number = Date.now(),
): string {
  const date = parse(iso)
  if (!date) return 'Not yet scheduled'
  const label = date.toLocaleString(LOCALE, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: renderTimeZone(),
  })
  return date.getTime() < now ? `Overdue — expected ${label}` : label
}

/** True when a schedule exists and its moment has already passed. */
export function isOverdue(iso: string | null, now: number = Date.now()): boolean {
  const t = toMs(iso)
  return t !== null && t < now
}

/**
 * Full timestamp for a detail panel — "Jul 14, 2026, 9:12:04 AM". Returns '—' on
 * null/invalid so the panel never renders 'Invalid Date'.
 *
 * D09's "Not changing" list protects this function's BEHAVIOUR, and its shape is
 * untouched: same `dateStyle: 'medium'` + `timeStyle: 'medium'`, same '—'. What
 * changed is the locale argument, which was `undefined` — i.e. the RUNTIME's
 * locale. That is precisely the defect Oleh named on 2026-08-08: the same build
 * would render `14 Jul 2026, 09:12:04` for a European reviewer and
 * `Jul 14, 2026, 9:12:04 AM` for the US customer, with no diff between them.
 * "Already correct" cannot cover a call that renders differently per machine.
 * Argued in `audit/PARKED.md` P23.
 */
export function expandedTimestamp(iso: string | null): string {
  const date = parse(iso)
  if (!date) return '—'
  return date.toLocaleString(LOCALE, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: true,
    timeZone: renderTimeZone(),
  })
}
