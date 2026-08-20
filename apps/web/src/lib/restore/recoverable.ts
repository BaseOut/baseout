/**
 * recoverable — "can I get this base back, and from when?", derived rather than asserted.
 *
 * ╔══════════════════════════════════════════════════════════════════════════════════════════════╗
 * ║ PARKED, AND DELIBERATELY UNIMPORTED — read this before concluding the file is dead.          ║
 * ╚══════════════════════════════════════════════════════════════════════════════════════════════╝
 *
 * The screen this module fed — `RecoverableView.astro`, the nav entry and the `/recoverable` route
 * — was REMOVED on 2026-08-10, hours after it was built, and the derivation was kept on purpose.
 *
 * IT WAS NOT REMOVED BECAUSE IT WAS WRONG. Deriving the answer from `RestoreSnapshot` instead of
 * the misleading `includedBases` (see below) is the right call and is the most valuable thing in
 * this wave. It was removed because the PREMISE is being re-opened with the client: the recorded
 * client position, quoted in `RestoreView.astro`'s own header, is that *"restore is a rare,
 * last-resort, best-effort need — NOT the headline (the value is the external backup +
 * documentation + insights)"* (Q3, 2026-06-19). A four-entry phone menu should not spend one of
 * its entries on the case the client himself calls rare, and Oleh wants to discuss the surface
 * with the client before it ships.
 *
 * WHAT THIS MEANS FOR THIS FILE. It is not imported by anything today. That is a decision, not
 * rot: `audit/PARKED.md` P32 carries the full record of the removed screen — its three states, its
 * copy, its verdict strip, its markup shape — so restoring it costs minutes. Deleting this module
 * would throw away the only part that took real work, which is the reasoning below about which
 * field in this model may be trusted. **Do not delete it as an unused file without reading P32.**
 * `tsc --noEmit --strict` still covers it, so it cannot silently drift out of sync with
 * `RestoreSnapshot`.
 *
 * The one live consumer of the knowledge below is `pattern-restore-flow` in the catalog, which now
 * carries the `includedBases` warning directly — because that trap belongs to anyone reading a run
 * row, not to the screen that happened to find it.
 *
 * ── WHY THIS FILE EXISTS AND WHY IT IS NOT A NEW MODEL (Wave B, B3, 2026-08-10) ────────────────
 * The Recoverable screen does not exist on desktop and nobody asked for it; the designer proposed
 * it and its whole job is one moment — someone deleted a table, it is Monday morning, they are not
 * at a desk, and the only question is *yes or no, and from when*.
 *
 * The brief's rule for it was explicit: **if the model cannot support an honest date, build nothing
 * rather than invent one.** So the first job was to find out what the model actually carries.
 *
 * ── WHAT THE MODEL CARRIES, AND THE ONE THAT LOOKED RIGHT AND IS NOT ───────────────────────────
 * The obvious source is the run list, and it is the WRONG one. `BackupRunSummary.includedBases`
 * says in its own doc comment:
 *
 *     "Bases currently included in the Space's backup configuration. NOT a per-run snapshot —
 *      engine doesn't capture that today."
 *
 * So it is the CURRENT configuration echoed onto every historical row. Folding "newest successful
 * run whose includedBases contains this base" over it would date every base by the newest success
 * regardless of whether that run ever touched it — a fabricated per-base date, on the one screen
 * where a wrong date means a person believing their data is recoverable when it is not. Rejected.
 *
 * The RIGHT source already exists and already ships: `RestoreSnapshot` in `./request.ts`, the model
 * behind step ① of the restore flow (`pattern-restore-flow`). It carries, per snapshot:
 *
 *     baseIds          "Bases this snapshot ACTUALLY captured. A failed run captured fewer
 *                       than were selected."
 *     missedBaseNames  "Bases the run was asked for and never wrote."
 *     takenAtLabel     the absolute, already-formatted moment
 *     status           succeeded | partial | failed | cancelled
 *
 * That is exactly the fact this screen needs, and it is the SAME list `/restore` shows. Recoverable
 * is therefore a second READER of one model, not a second model — which is the whole reason it can
 * be trusted: the phone cannot claim a base is recoverable from a snapshot the desktop restore
 * picker would not offer, because they are reading the same array.
 *
 * ── WHAT THE MODEL DOES **NOT** CARRY, STATED PLAINLY ──────────────────────────────────────────
 * 1. **No per-snapshot expiry.** Retention is a SPACE-level policy (`settingsCatalog.ts`,
 *    `space-retention`: "Tiered (GFS)" / 30 days / 90 days / 1 year / Keep everything). Nothing
 *    per snapshot records whether cleanup has already reclaimed it. So "restorable from X" is
 *    exactly as strong a claim as the restore picker's own list — no weaker, and NOT stronger.
 *    This screen therefore says what the picker says and adds no promise of its own; the page
 *    prints the caveat rather than the module inventing a confidence it cannot compute.
 *    FOR THE CLIENT'S ENGINEER: a per-snapshot `retainedUntil` (or a `reclaimed` flag) is the one
 *    field that would let this screen say "still there" instead of "was written".
 * 2. **No per-BASE timestamp inside a snapshot.** `takenAtLabel` is the run's moment, not the
 *    moment that base's write finished. The run-detail model has it (`BaseRun.completedAt`), the
 *    snapshot model does not. The copy is written for what we have — *restorable from <the
 *    backup taken then>* — and never claims a per-base write time.
 * 3. **`takenOn` is a DATE, not a timestamp.** Two snapshots on one day cannot be ordered by the
 *    model, so this file does a STABLE sort on `takenOn` and preserves the caller's order for
 *    ties, rather than pretending a date-only field is a total order. The caller passes newest
 *    first; `/restore` already does.
 *
 * ── WHAT IT REFUSES TO DO ──────────────────────────────────────────────────────────────────────
 * It shows that a restore is POSSIBLE. It does not offer to perform one — restoring needs a table
 * picker and a destination, which is desktop work, so the row leads to the desktop-only explainer
 * Wave A built. There is no derivation here that produces an action.
 */
import type { RestoreSnapshot } from './request';

/** A base the Space backs up, named. The minimum this screen needs to name a row. */
export interface RecoverableBaseInput {
  id: string;
  name: string;
}

export type RecoverableState =
  /** A snapshot captured it, and no newer attempt has failed on it. */
  | 'restorable'
  /** A snapshot captured it, but a NEWER attempt was asked for it and did not write it. */
  | 'stale'
  /** No snapshot has ever captured it. */
  | 'none';

export interface RecoverableBase {
  id: string;
  name: string;
  state: RecoverableState;
  /** The newest snapshot that ACTUALLY captured this base. Null only when `state` is 'none'. */
  from: RestoreSnapshot | null;
  /**
   * The newest snapshot that was asked for this base and did not write it, when it is newer than
   * `from`. This is what turns "restorable" into "last attempt failed" — and naming the snapshot
   * rather than a boolean is what lets the row link to the run that failed.
   */
  failedAttempt: RestoreSnapshot | null;
  /** The whole answer, as one sentence. Every row prints this; no caller assembles its own. */
  line: string;
}

/**
 * Newest first, stable. `takenOn` is date-only (see the note above), so same-day snapshots keep
 * the order the caller gave them instead of being reordered by a comparator that cannot tell.
 */
function newestFirst(snapshots: RestoreSnapshot[]): RestoreSnapshot[] {
  return snapshots
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.takenOn === b.s.takenOn ? a.i - b.i : a.s.takenOn < b.s.takenOn ? 1 : -1))
    .map((x) => x.s);
}

/**
 * Did this snapshot ASK for this base? A snapshot names what it missed by display NAME
 * (`missedBaseNames`) and what it captured by ID (`baseIds`) — two different handles for the same
 * set, which is the model's shape and not something to paper over here. So "asked for" is
 * "captured it OR named it as missed", and a base a run never had in scope at all is neither.
 */
function askedFor(snapshot: RestoreSnapshot, base: RecoverableBaseInput): boolean {
  return snapshot.baseIds.includes(base.id) || snapshot.missedBaseNames.includes(base.name);
}

/**
 * The row's sentence. One place, so the three states cannot drift into three wordings of the same
 * fact — the rule `restoreRunLine` follows in the sibling module.
 *
 * "restorable from" is the verb the brief specified and it is the one the model supports: the
 * snapshot exists and it captured this base. It is deliberately NOT "safe" or "protected" — those
 * are claims about the present, and the present is what retention would have to answer.
 *
 * The failed attempt is NOT named in the clean row's sentence, and that is deliberate: a row with
 * nothing wrong with it must not grow a clause about a failure that did not happen to it.
 */
function lineFor(state: RecoverableState, from: RestoreSnapshot | null): string {
  if (state === 'none' || !from) return 'No backup has captured this base yet';
  if (state === 'stale') return `Last attempt failed — restorable from ${from.takenAtLabel}`;
  return `Restorable from ${from.takenAtLabel}`;
}

/**
 * The screen, derived. One pass per base over the snapshots, newest first:
 *   the first snapshot that CAPTURED it  → `from`
 *   any snapshot NEWER than that which asked for it and missed → `failedAttempt`
 */
export function deriveRecoverable(
  bases: RecoverableBaseInput[],
  snapshots: RestoreSnapshot[],
): RecoverableBase[] {
  const ordered = newestFirst(snapshots);
  return bases.map((base) => {
    const fromIdx = ordered.findIndex((s) => s.baseIds.includes(base.id));
    const from = fromIdx === -1 ? null : ordered[fromIdx];
    // Everything newer than the capture. With no capture at all, every snapshot is "newer".
    const newer = fromIdx === -1 ? ordered : ordered.slice(0, fromIdx);
    const failedAttempt = newer.find((s) => askedFor(s, base) && !s.baseIds.includes(base.id)) ?? null;
    const state: RecoverableState = !from ? 'none' : failedAttempt ? 'stale' : 'restorable';
    return { id: base.id, name: base.name, state, from, failedAttempt, line: lineFor(state, from) };
  });
}

/**
 * The verdict for the whole screen, in the Airwallex shape the research names for "nothing needs
 * you": a count that appears ONLY where there is work. It is derived from the rows, so the summary
 * and the list cannot disagree — the D01 rule, applied to a new surface.
 */
export interface RecoverableSummary {
  total: number;
  /** Bases whose newest attempt failed, or which have never been captured. */
  needsAttention: number;
  headline: string;
}

export function summariseRecoverable(rows: RecoverableBase[]): RecoverableSummary {
  const total = rows.length;
  const needsAttention = rows.filter((r) => r.state !== 'restorable').length;
  const headline =
    total === 0
      ? 'No bases are being backed up yet'
      : needsAttention === 0
        ? `All ${total} ${total === 1 ? 'base is' : 'bases are'} restorable`
        : `${needsAttention} of ${total} ${total === 1 ? 'base needs' : 'bases need'} attention`;
  return { total, needsAttention, headline };
}
