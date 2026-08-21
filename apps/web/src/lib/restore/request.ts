/**
 * THE restore derivation — one place, every reader.
 *
 * D05's rule is "restore is a run": it starts from a named, dated, health-graded
 * snapshot, carries the user's scope end to end, is confirmed in plain words, executes
 * with running/failed states, and writes an audit row. Four surfaces have to agree
 * about the SAME request — the live summary on the form, the confirm dialog, the
 * in-flight/failed panels, the result screen, and the Restore Run row in /backups.
 *
 * Wave 2 (D01) shipped its blockers because a correct derivation had three
 * hand-written consumers. So the request is computed here and NOWHERE else: the view
 * imports it in its frontmatter, the client controller imports the same functions, and
 * `BackupsListView` reads `restoreRunLine` for its audit row. If a sentence about a
 * restore appears on a screen, it came out of this file.
 *
 * Nothing here touches the DOM or the network — it is pure text derivation, so both
 * the server render and the browser get identical strings.
 */

const nf = new Intl.NumberFormat('en-US');
const plural = (n: number, one: string, many: string): string => (n === 1 ? one : many);

/** How much of the backup this snapshot came from actually landed. */
export type SnapshotStatus = 'succeeded' | 'partial' | 'failed' | 'cancelled';

/**
 * A restorable snapshot. One backup run produces one snapshot; the run's own health is
 * what grades it, which is why `runId` is carried rather than a synthetic snapshot id.
 */
export interface RestoreSnapshot {
  /** The backup run that wrote it — named on the row, in the confirm, and in the audit row. */
  runId: string;
  /** Absolute, already-formatted timestamp. Formatting is the caller's timezone problem. */
  takenAtLabel: string;
  /** ISO date (YYYY-MM-DD) — the date component of the generated new-base name. */
  takenOn: string;
  status: SnapshotStatus;
  tables: number;
  records: number;
  attachments: number;
  /** Bases this snapshot ACTUALLY captured. A failed run captured fewer than were selected. */
  baseIds: string[];
  /**
   * Bases the run was asked for and never wrote. Named at confirm so "restore from the
   * failed run" cannot silently mean "restore two of your six bases".
   */
  missedBaseNames: string[];
}

export interface RestoreTargetNew {
  kind: 'new';
  name: string;
}
export interface RestoreTargetExisting {
  kind: 'existing';
  name: string;
}
export type RestoreTarget = RestoreTargetNew | RestoreTargetExisting;

/** Everything a restore request is. Every screen renders this and only this. */
export interface RestoreRequest {
  snapshot: RestoreSnapshot;
  /** The source base inside the snapshot. */
  baseName: string;
  /** The tables selected out of that base, in display order. */
  tableNames: string[];
  records: number;
  attachments: number;
  attachmentsMode: 'attachments' | 'links';
  /** Where the backup itself lives — the dependency the "as links" option leans on. */
  destinationLabel: string;
  /** Whether that destination holds the FILES. Absent means "yes", the shape every caller had. */
  destinationStoresFiles?: boolean;
  target: RestoreTarget;
  /**
   * The Airtable workspace the new base lands in. Optional: the model does not carry it
   * today, and the clause is DROPPED rather than filled with a placeholder when absent.
   * FOR THE CLIENT'S ENGINEER — production must supply the workspace name or the
   * confirm permanently loses "in your Airtable workspace ‹name›" (spec 09, line 94).
   */
  workspaceName?: string | null;
}

/** The seven facts a restore confirm has to state, plus the snapshot caveat. */
export interface RestoreConfirmCopy {
  headline: string;
  /** What — named tables and counts. */
  what: string;
  /** From when — the snapshot and the run behind it. */
  when: string;
  /** Where — the named target, new or existing. */
  where: string;
  /** What happens to what is already there. */
  existing: string;
  /** That it cannot be undone. */
  irreversible: string;
  /** The write-permission requirement. */
  permission: string;
  /** The credit cost (spec 09, line 101). */
  credits: string;
  /** Non-null only when the chosen snapshot is not a clean success. */
  snapshotWarning: string | null;
  /** One-line restatement, for the result screen and the page title. */
  line: string;
}

export const snapshotIsClean = (s: Pick<RestoreSnapshot, 'status'>): boolean => s.status === 'succeeded';

/**
 * ── HOW WELL IS THIS BASE COVERED? (2026-08-11, the base-first reorder) ──────────────────────────
 *
 * The form used to start from a snapshot, so the only question it could answer was "which bases are
 * in this backup". Dan's objection is a data dependency: *"there's a chance this is different
 * depending on what base you choose — if you added a base later than the other bases you may not
 * have as much of a backup"*. Asking for the base first makes that answerable, and the answer is
 * derived here so the picker, the row's sentence and the empty case cannot drift apart.
 *
 * Three states, and they are the three the fixture has always carried and never shown:
 *   restorable           in the newest snapshot — pick any of its backups
 *   last-attempt-failed  it HAS backups, but a newer run was asked for it and never wrote it, so
 *                        the freshest copy is older than the reader would assume
 *   not-backed-up        in no snapshot at all — there is nothing to restore, and saying so is the
 *                        whole value of asking the question in this order
 *
 * Before this, all three hid behind one grey footnote reading "2 bases are not in this backup, so
 * they are not offered here" — which conflates "not in THIS backup" with "not in ANY backup", and
 * a base whose last attempt failed was indistinguishable from one nobody ever backed up.
 *
 * ORDER IS THE CONTRACT. `snapshots` is newest-first — the same assumption `snapshotIsClean`
 * already relies on when it calls the first match "the newest clean backup". A snapshot ahead of
 * this base's newest holder is therefore NEWER than it.
 */
export type BaseCoverageKind = 'restorable' | 'last-attempt-failed' | 'not-backed-up';

export interface BaseCoverage {
  kind: BaseCoverageKind;
  /** The snapshots that actually hold this base, newest first. Empty for `not-backed-up`. */
  snapshots: RestoreSnapshot[];
  /** The newest snapshot holding it — what the picker preselects. */
  newest: RestoreSnapshot | null;
  /** For `last-attempt-failed`: the newer run that was asked for this base and did not write it. */
  missedBy: RestoreSnapshot | null;
  /** The row's own sentence, so no surface writes its own. */
  line: string;
}

export function baseCoverage(
  baseId: string,
  baseName: string,
  snapshots: RestoreSnapshot[],
): BaseCoverage {
  const holders = snapshots.filter((s) => s.baseIds.includes(baseId));
  if (holders.length === 0) {
    return {
      kind: 'not-backed-up',
      snapshots: [],
      newest: null,
      missedBy: null,
      line: 'No backup holds this base. Add it to this Space’s backup scope and it will appear here after the next run.',
    };
  }
  const newest = holders[0];
  const newestIdx = snapshots.indexOf(newest);
  // A run NEWER than the freshest copy that was asked for this base and did not write it. `slice`
  // rather than a scan of everything: a run OLDER than the copy we hold missed nothing that matters.
  const missedBy = snapshots.slice(0, newestIdx).find((s) => s.missedBaseNames.includes(baseName)) ?? null;
  const count = `${nf.format(holders.length)} ${plural(holders.length, 'backup', 'backups')}`;
  if (missedBy) {
    return {
      kind: 'last-attempt-failed',
      snapshots: holders,
      newest,
      missedBy,
      line: `${count} · newest ${newest.takenAtLabel} — the run on ${missedBy.takenAtLabel} was asked for this base and never reached it.`,
    };
  }
  return {
    kind: 'restorable',
    snapshots: holders,
    newest,
    missedBy: null,
    line: `${count} · newest ${newest.takenAtLabel}`,
  };
}

/** "14 tables · 12,407 records · 218 attachments" — the size column of the snapshot list. */
export function snapshotSizeLine(s: Pick<RestoreSnapshot, 'tables' | 'records' | 'attachments'>): string {
  return [
    `${nf.format(s.tables)} ${plural(s.tables, 'table', 'tables')}`,
    `${nf.format(s.records)} ${plural(s.records, 'record', 'records')}`,
    `${nf.format(s.attachments)} ${plural(s.attachments, 'attachment', 'attachments')}`,
  ].join(' · ');
}

const SNAPSHOT_VERB: Record<SnapshotStatus, string> = {
  succeeded: 'finished cleanly',
  partial: 'finished with some bases missing',
  failed: 'failed part-way',
  cancelled: 'was cancelled part-way',
};

/**
 * The caveat a non-clean snapshot carries — on its row in the list AND again at confirm.
 * It names what the run actually captured, because "restore from the failed run" without
 * that list is the asserted-claim shape: a status flag standing in for the data.
 */
export function snapshotWarning(
  s: Pick<RestoreSnapshot, 'status' | 'missedBaseNames'>,
  capturedBaseNames: string[],
): string | null {
  if (snapshotIsClean(s)) return null;
  const captured = capturedBaseNames.length
    ? `It captured ${capturedBaseNames.join(', ')}.`
    : 'It captured nothing you can restore.';
  const missed = s.missedBaseNames.length
    ? ` ${s.missedBaseNames.join(', ')} ${plural(s.missedBaseNames.length, 'was', 'were')} never written — restoring from this backup cannot bring ${plural(s.missedBaseNames.length, 'it', 'them')} back.`
    : '';
  return `This backup ${SNAPSHOT_VERB[s.status]}. ${captured}${missed}`;
}

/* ── Form furniture, shared so SSR and the client cannot disagree ──────────────────
 * These three are not sentences about the request, so they sit apart from
 * `describeRestoreRequest`. They are here for the same reason it is: each was written
 * once in the view's frontmatter and again in the controller, and a drift between the
 * two only shows AFTER hydration — the hardest kind to notice, because the first paint
 * looks right.
 */

/** "4 tables" / "1 table" — the count-in-button label. */
export function tableCountLabel(n: number): string {
  return `${nf.format(n)} ${plural(n, 'table', 'tables')}`;
}

/** "52 files" / "1 file" — the attachment count on step 4's options. */
export function fileCountLabel(n: number): string {
  return `${nf.format(n)} ${plural(n, 'file', 'files')}`;
}

/**
 * The note under the base picker when the chosen snapshot holds fewer bases than the
 * Space has. Returns null when nothing was dropped, so the caller hides the row rather
 * than printing an empty one.
 */
export function droppedBasesNote(dropped: number): string | null {
  if (dropped <= 0) return null;
  return dropped === 1
    ? '1 base is not in this backup, so it is not offered here.'
    : `${nf.format(dropped)} bases are not in this backup, so they are not offered here.`;
}

/** The generated new-base name — base + the date the snapshot was taken. Prefilled, required. */
export function newBaseName(baseName: string, s: Pick<RestoreSnapshot, 'takenOn'>): string {
  return `Restored — ${baseName} — ${s.takenOn}`;
}

/** "Accounts, Contacts, Opportunities and 2 more" — named, not counted, up to the point it stops helping. */
export function nameList(names: string[], max = 5): string {
  if (names.length === 0) return 'nothing';
  if (names.length <= max) {
    if (names.length === 1) return names[0]!;
    return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(', ')} and ${names.length - max} more`;
}

/**
 * The attachments clause — carries its count, and the links option names its dependency.
 *
 * IT NAMES THE DESTINATION ONLY WHEN THE DESTINATION HOLDS THE FILES (2026-08-11). The links
 * sentence was unconditional, so at a records-only destination it read "links to the files kept in
 * Company Drive (Google Drive)" — directly beneath the line explaining that there are no files to
 * re-upload. Two sentences on one screen, contradicting each other, both generated.
 *
 * What the links point at in that case is genuinely unknown to us — Airtable's own attachment URLs
 * expire, and whether the engine keeps a usable reference is the client engineer's answer (Q16).
 * So the sentence STOPS at what we know instead of naming a store we do not have: the rule this
 * codebase already follows for `workspaceName` and `accessLostAt`, which drop their clause rather
 * than fill it.
 */
export function attachmentsLine(
  r: Pick<RestoreRequest, 'attachments' | 'attachmentsMode' | 'destinationLabel'> & { destinationStoresFiles?: boolean },
): string {
  const n = nf.format(r.attachments);
  const word = plural(r.attachments, 'attachment', 'attachments');
  if (r.attachments === 0) return 'No attachments in the selected tables.';
  if (r.attachmentsMode !== 'links') return `${n} ${word} re-uploaded into the restored tables.`;
  return r.destinationStoresFiles === false
    ? `${n} ${word} restored as links rather than files — this Space's backups keep records only, so there is nothing to re-upload.`
    : `${n} ${word} restored as links to the files kept in ${r.destinationLabel} — nothing is re-uploaded, and the links stop working if that destination is disconnected or its files are removed.`;
}

/**
 * THE function. Every restore sentence in the product comes out of here.
 */
export function describeRestoreRequest(r: RestoreRequest, capturedBaseNames: string[] = []): RestoreConfirmCopy {
  const tableCount = r.tableNames.length;
  const isNew = r.target.kind === 'new';
  const where = isNew
    ? `Into a new base named “${r.target.name}”${r.workspaceName ? ` in your Airtable workspace ${r.workspaceName}` : ''}.`
    : `Into your existing base “${r.target.name}” — as new tables beside the ones already there.`;

  return {
    headline: `Restore ${nf.format(tableCount)} ${plural(tableCount, 'table', 'tables')} into ${r.target.name}?`,
    what: `${nf.format(tableCount)} ${plural(tableCount, 'table', 'tables')} from ${r.baseName} — ${nameList(r.tableNames)} — holding ${nf.format(r.records)} ${plural(r.records, 'record', 'records')}. ${attachmentsLine(r)}`,
    when: `From the backup taken ${r.snapshot.takenAtLabel}, written by run ${r.snapshot.runId}.`,
    where,
    existing: isNew
      ? 'Nothing you already have is touched — this creates a brand-new base and writes into that.'
      : `Nothing already in ${r.target.name} is changed or removed. Restore never writes into an existing table; it always adds new ones.`,
    irreversible: `This cannot be undone. To reverse it you have to delete the restored ${isNew ? 'base' : 'tables'} in Airtable by hand.`,
    permission: 'Restore writes to Airtable, so it needs a connection with write access. A read-only token cannot complete it.',
    credits: 'This counts as 1 restore run against your activity credit allowance.',
    snapshotWarning: snapshotWarning(r.snapshot, capturedBaseNames),
    line: `${nf.format(tableCount)} ${plural(tableCount, 'table', 'tables')} from ${r.baseName} → ${r.target.name}${isNew ? ' (new base)' : ''}, from the backup taken ${r.snapshot.takenAtLabel}`,
  };
}

/* ── View-side shapes ──────────────────────────────────────────────────────────────
 * These live here rather than in RestoreView's frontmatter: Astro's esbuild pass chokes
 * on union-heavy types declared inline (see `feedback-astro-frontmatter-thin`), and the
 * harness types its fixtures against them.
 */

export interface RestoreTableDef {
  id: string;
  name: string;
  records: number;
  fields: number;
  /** Attachments captured for this table — the count the attachments step carries. */
  attachments: number;
}
export interface RestoreBaseDef {
  id: string;
  /** Airtable base id. The run pages carry only this, so `?base=` accepts either. */
  atBaseId: string;
  name: string;
  tables: RestoreTableDef[];
}
export interface ExistingBaseDef {
  id: string;
  name: string;
}

/** One thing the restore couldn't rebuild automatically (Airtable API limit). */
export interface RestoreManualItem {
  table: string;
  field: string;
  kind: 'formula' | 'text' | 'link';
  detail: string;
}

export interface RestoreOutcome {
  /** Source base that was restored. */
  baseName: string;
  /** Where it landed. */
  targetName: string;
  targetIsNew: boolean;
  /** Open the restored base in Airtable. */
  targetUrl: string;
  tablesRestored: number;
  recordsRestored: number;
  /** How attachments were brought back (client Q6, 2026-06-20). */
  attachmentsMode: 'attachments' | 'links';
  attachmentsRestored: number;
  /** Structure that needs a manual touch-up; empty = a clean restore. */
  manual: RestoreManualItem[];
  /**
   * The request this result came from, restated rather than re-derived — the outcome
   * screen's job is to render the request that was actually made (D05 item 2).
   */
  requestLine?: string;
}

/** While a restore is executing. Every number is written by the engine as it goes. */
export interface RestoreProgress {
  tablesDone: number;
  tablesTotal: number;
  recordsDone: number;
  recordsTotal: number;
}

/** A restore that stopped. `written` is what landed before it did — never blanked. */
export interface RestoreFailure {
  message: string;
  tablesWritten: number;
  recordsWritten: number;
}

/**
 * What a Restore Run row in the /backups audit log carries. The engine owns every field —
 * nothing here is inferred from a status flag (D04's `outcome` rule, applied again).
 */
export interface RestoreRunMeta {
  /** The backup run the snapshot came from. */
  sourceRunId: string;
  /**
   * WHEN that backup was taken — an ISO instant, NOT a formatted string.
   *
   * The log column asks "out of which backup", and `run_2026_06_15_daily` answers only a machine:
   * it cost 188px of a 1094px table to say something a reader cannot date. The first version of
   * this field was the formatted label, and it was wrong in a way worth recording — a column
   * showing dates SORTED BY RUN ID, because the id was the only sortable thing on the row. A
   * timestamp formats and sorts; a label does neither honestly.
   *
   * Formatting stays with the reader (`lib/time.ts`), timezone stays the caller's problem, and the
   * id stays for the audit trail and the detail page. Optional: a caller that cannot resolve it
   * falls back to the id rather than inventing a date.
   */
  sourceTakenAt?: string | null;
  /** Source base inside that snapshot. */
  baseName: string;
  tableCount: number;
  targetName: string;
  targetIsNew: boolean;
  /**
   * What the restore ACHIEVED — `status` alone does not say.
   *
   * `running` was added when the Restore log gained a live row (2026-08-11). Without it a
   * restore still in flight rendered "Restored Product Roadmap…", stating an achievement it
   * had not reached yet — the asserted-claim shape, from a union that had no word for "not
   * finished". A verb tense is data, not decoration.
   */
  outcome: 'complete' | 'partial' | 'none' | 'running';
  /** Structure Airtable's API could not rebuild, waiting on the user. */
  manualFixups: number;
  /**
   * Why it stopped, when it stopped. A backup row carries its reason in the run's
   * `errorMessage`; a restore row's sentence is built HERE, so a reason attached to the run
   * never reached the reader — a failed restore said what it failed to do and never why.
   * Null on a restore that did not fail.
   */
  reason?: string | null;
  /**
   * Where this restore's own result screen lives. Carried rather than assembled by the
   * list, so the row and the page it opens describe the SAME request — reconstructing a
   * href from the fields above would give the reader a result screen that quietly differs
   * from the sentence they clicked.
   */
  detailHref: string;
}

const OUTCOME_VERB: Record<RestoreRunMeta['outcome'], string> = {
  complete: 'Restored',
  partial: 'Partly restored',
  none: 'Restored nothing from',
  running: 'Restoring',
};

/**
 * The audit row's own sentence — source run, scope, target, outcome and manual-fixup
 * count in one line, so the Backups log reads a restore the same way it reads a backup.
 * Same reader contract as `BackupRunSummary.errorMessage`: truncated on the row, full
 * text on the catalog `tooltip`.
 *
 * THE FIX-UP CLAUSE IS NOT PRINTED FOR EVERY OUTCOME, and that is the point of the guard
 * rather than an omission. It was unconditional, so a restore that wrote nothing read
 * "Restored nothing from Marketing Calendar … · nothing left to finish by hand" — literally
 * true and completely misleading, because it invites a reader to conclude the restore is
 * settled. A count of remaining work is only meaningful once work has finished happening:
 * `none` has nothing to finish, `running` does not know yet.
 */
export function restoreRunLine(m: RestoreRunMeta): string {
  const scope = `${m.baseName} (${nf.format(m.tableCount)} ${plural(m.tableCount, 'table', 'tables')})`;
  const target = `${m.targetName}${m.targetIsNew ? ', a new base' : ''}`;
  const settled = m.outcome === 'complete' || m.outcome === 'partial';
  const fixups = !settled
    ? ''
    : m.manualFixups > 0
      ? ` · ${nf.format(m.manualFixups)} ${plural(m.manualFixups, 'item', 'items')} to finish by hand`
      : ' · nothing left to finish by hand';
  const reason = m.reason ? ` · ${m.reason}` : '';
  return `${OUTCOME_VERB[m.outcome]} ${scope} into ${target} · from backup run ${m.sourceRunId}${fixups}${reason}`;
}
