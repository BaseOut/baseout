/**
 * Shared types for the Data page (/data) — the record-browsing sibling of Schema.
 *
 * Kept in a .ts sibling (not .astro frontmatter) per the "frontmatter stays thin" rule:
 * union-heavy types in .astro frontmatter break the esbuild production build.
 *
 * The Data page browses backed-up *rows*, where Schema browses *structure*. These types
 * describe the minimal record shape the UI needs; the engine (`server-data-browse`) owns
 * the real query/pagination. Field metadata deliberately mirrors Airtable vocabulary.
 */

/** Which data posture a Space's backups have. Drives the whole page (see design.md). */
export type DataMode = 'dynamic' | 'static' | 'both';

/**
 * A saved Browse VIEW (iteration-2, Dan 2026-07-15) — a named configuration of the record
 * grid: which table, which filters, which fields are visible, and the sort. The Views/Tabs
 * shell (`pattern-data-views`) manages a set of these; the active view drives the toolbar +
 * grid. `pinned` = persisted into the bar/rail (a NEW view starts temporary/unpinned and
 * vanishes on reload — pin ≠ save). All presentational in this mirror.
 */
export interface SavedView {
  id: string;
  name: string;
  tableId: string;
  /** Persisted into the views bar/rail. Temporary (unpinned) views are throwaway. */
  pinned: boolean;
  /**
   * Thematic GROUP this view is filed under (iteration-2b). One group per view (a folder
   * model) or undefined = Ungrouped. Pin and group are ORTHOGONAL: pin = quick-access working
   * set; group = filing. A view can be both pinned AND in a group.
   */
  groupId?: string;
  /** Field ids hidden in this view (default: all shown). */
  hiddenFieldIds?: string[];
  /** Serialized field filters (rehydrated against the table's fields at runtime). */
  filters?: { fieldId: string; op: string; val?: string; val2?: string }[];
  /** Sort column + direction (1 asc, -1 desc). */
  sortFieldId?: string;
  sortDir?: 1 | -1;
  /** In-view text search. */
  query?: string;
  /** Whether the Record ID column is shown. */
  showRecordId?: boolean;
  /** Column display order (field ids); default = table field order. */
  colOrder?: string[];
  /**
   * Save/Discard/lock/Draft model (Dan 2026-07-23): a preset is explicitly saved — an
   * unsaved preset (never saved, or with edits pending) is a Draft. The first Save locks
   * this preset's base + table (see `pattern-faceted-filter`'s locked scope picker); after
   * that, only filters/fields/sort/search stay editable. `undefined`/`false` = Draft.
   */
  saved?: boolean;
}

/** A thematic GROUP (folder) of saved views — Dan's "projects" layer, kept as simple membership. */
export interface ViewGroup {
  id: string;
  name: string;
}

/** A base in the Space (id + display name), same shape Schema uses. */
export interface DataBase {
  id: string;
  name: string;
  /** Airtable workspace identity (workspace-visual-grouping) — optional, same fields as
   *  stores/connections.ts BaseSummary; absent bases fall into a "Workspace unknown" group. */
  workspaceId?: string;
  workspaceName?: string;
}

/**
 * A field (column) in a table. `type` is the Airtable field type (singleLineText,
 * number, multipleRecordLinks, formula, rollup, multipleLookupValues, …) — used to pick
 * the type-aware cell viewer, the filter operators, and the field icon.
 */
export interface DataField {
  id: string;
  name: string;
  type: string;
  /** For a link field, the table it points at (drives linked-record provenance). */
  linkedTableId?: string;
  /** Formula/rollup expression text (from the backed-up schema), shown read-only. */
  expression?: string;
  /** Provenance — the fields a FORMULA references (same table), for the Inputs panel. */
  refs?: string[];
  /** Provenance — a LOOKUP/ROLLUP travels through this link field to reach its source. */
  viaFieldId?: string;
  /** Provenance — the source table a lookup/rollup reads from. */
  sourceTableId?: string;
  /** Provenance — the looked-up field id in the source table. */
  sourceFieldId?: string;
  /** Provenance — a rollup's aggregation label, e.g. "SUM of Amount". */
  aggregation?: string;
}

/** One row of the Space-wide data changelog (pattern-data-changelog), grouped by backup run. */
export interface DataChangeEntry {
  id: string;
  recordId: string;
  primary: string;
  tableId: string;
  /** The backup run this change was detected in. */
  runId: string;
  at: string;
  type: 'created' | 'updated' | 'deleted';
  /** Number of fields changed (updates only). */
  fieldCount?: number;
}

/** One entry in a record's cross-backup history timeline (pattern-record-history). */
export interface HistoryEntry {
  /** The backup run this state was captured in. */
  runId: string;
  at: string;
  type: 'created' | 'updated' | 'deleted';
  /** Per-field before → after diffs (updates only). */
  fields?: { fieldId: string; before: string; after: string }[];
}

/**
 * A comment AUTHOR — Airtable's `comment.author`. There is deliberately no avatar field:
 * Airtable's comment payload carries no profile picture, so initials-or-nothing is not a design
 * preference, it is the only option. `email` is documented required but typed optional here
 * because a withheld / malformed payload is a real capture outcome, and that is exactly what
 * makes the display chain name → email → "Airtable user" earn its third rung.
 */
export interface DataCommentAuthor {
  id: string;
  email?: string;
  name?: string;
}

/**
 * A resolved @-mention target — Airtable's `comment.mentioned` map, keyed by the id that appears
 * inside `text` as a raw `@[usrXXX]` token. WITHOUT this map the token renders as a raw id, so
 * resolution is not decoration: it is the difference between a name and a database key on screen.
 * `userGroup` and `appAgent` are as real as `user` — an unhandled kind is a raw id too.
 */
export interface DataCommentMention {
  id: string;
  type: 'user' | 'userGroup' | 'appAgent';
  displayName?: string;
  email?: string;
}

/**
 * One captured record comment (comments-explorer). Mirrors Airtable's comment object
 * (`GET /v0/{baseId}/{table}/{recordId}/comments`) plus the one field that is OURS.
 *
 * Two properties of the source shape drive the whole surface and must not be designed around:
 * · There is NO deleted / status field on a comment, no comment webhook and no comment audit
 *   event. A comment's absence is only ever inferable by diffing two captures — and that is
 *   indistinguishable from the record leaving backup scope, or from a missed capture window.
 *   Hence `lastSeenAt` below, and hence the badge states an observation ("Last seen …"), never
 *   the diagnosis "deleted in Airtable".
 * · `lastUpdatedTime` is null until the comment is edited, and the PREVIOUS text is never
 *   returned. An "edited" indicator is honest; a "view previous version" affordance would not be.
 */
export interface DataComment {
  id: string;
  /** The record the comment hangs off. May not exist in this backup — see the dangling-ref case. */
  recordId: string;
  tableId: string;
  author: DataCommentAuthor;
  /** Raw comment text — carries unresolved `@[usrXXX]` tokens; resolve against `mentioned`. */
  text: string;
  /** Airtable `createdTime`. */
  createdAt: string;
  /** Airtable `lastUpdatedTime` — null until edited. Non-null = the "edited" indicator. */
  lastUpdatedAt: string | null;
  /** Airtable `parentCommentId` — set on a threaded reply. Carried; the thread VIEW is a later slice. */
  parentCommentId?: string;
  /** Airtable `comment.attachments`. Carried so the capture is lossless; NOT rendered in this slice. */
  attachments?: { id: string; filename?: string; url?: string; type?: string; size?: number }[];
  /** Airtable `comment.reactions`. Carried; NOT rendered in this slice. */
  reactions?: { emoji: { unicodeCharacter: string }; reactingUser: DataCommentAuthor }[];
  /** Airtable `comment.mentioned` — id → mention. Absent when the text mentions nobody. */
  mentioned?: Record<string, DataCommentMention>;
  /**
   * OURS, not Airtable's: the timestamp of the most recent backup capture in which this comment
   * was still present. Equal to the Space's latest sync for a live comment; older for one that has
   * since left the source. The UI compares the two rather than trusting a hand-set "deleted" flag.
   */
  lastSeenAt: string;
}

/** A table within a base, plus an approximate record total for the count header. */
export interface DataTable {
  id: string;
  baseId: string;
  name: string;
  fields: DataField[];
  /** Approximate total record count — never blocks the grid on an exact count(*). */
  approxRecordCount: number;
}

/**
 * One backed-up record. `cells` is keyed by field id → a display-ready cell value.
 * `primary` is the primary-field display string (what a linked chip shows).
 */
export interface DataRecord {
  id: string;
  tableId: string;
  primary: string;
  cells: Record<string, DataCell>;
  /** Linked-record sets keyed by link field id → linked record ids (in the linked table). */
  linked?: Record<string, string[]>;
  /** Cross-backup history; when absent the panel shows a single "created" entry. */
  history?: HistoryEntry[];
}

/**
 * A single cell's value, already shaped for read-only display. The `kind` mirrors the
 * field type family so the viewer knows how to render it; `raw` is the plain text
 * fallback the grid shows before a cell is expanded.
 */
export interface DataCell {
  raw: string;
  /** Attachments render as thumbnails; linked/lookup/formula carry provenance affordances. */
  attachments?: { name: string; thumbUrl?: string }[];
  linkedCount?: number;
  empty?: boolean;
}
