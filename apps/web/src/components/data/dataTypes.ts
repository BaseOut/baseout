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
   * Comment-presence filter (comments-explorer, 2026-07-31): all records / only records with at
   * least one captured comment / only records with none. Kept OFF the field-filter tree (`filters`
   * above) — comment presence isn't a field on the table, so faking one as a pseudo-field would
   * corrupt that tree the moment a real field shared its synthetic id. Owned by the preset (same
   * Save/Discard/dirty/Draft rules as everything else here); `undefined` degrades to `'all'`.
   */
  commentFilter?: 'all' | 'with' | 'without';
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
  /** Airtable `comment.attachments`. Rendered as a paperclip+count in the listing (tooltip names
   *  the files) and as read-only file chips in the record panel (founder, 2026-07-31).
   *  Typed off `MediaAsset` (media-library, 2026-07-31) — the app used to carry THREE incompatible
   *  descriptions of the same object and this is the one that survived. */
  attachments?: CommentAttachment[];
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
  /**
   * Attachments render as thumbnails; linked/lookup/formula carry provenance affordances.
   * This used to be a THIRD, incompatible attachment shape (`{ name, thumbUrl }` — `name`, not
   * `filename`, and no id/size/type), which `DataBrowse.astro` degraded further to `unknown[]`.
   * Reconciled onto `MediaAsset` (media-library, 2026-07-31): one object, one field name.
   */
  attachments?: CellAttachment[];
  linkedCount?: number;
  empty?: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Media / attachments (media-library, 2026-07-31)
 *
 * Baseout's backup pipeline downloads the BYTES of every Airtable attachment, because Airtable's
 * own attachment URLs expire ~2 hours after the API returns them. Those files had no surface in
 * either repo; the Data page's Attachments tab is it. The types below are the one description of
 * a captured file — the app previously carried three of them (this file's comment attachment, the
 * grid cell's `{ name, thumbUrl }`, and `recordReadBody.ts`'s structural clone `PanelAttachment`).
 *
 * HONESTY NOTE: `checksum`, `storage`, `capturedAt` and `lastSeenAt` are OURS, not
 * Airtable's, and the engine that would emit them (`server-media-index`) is unfiled. They are
 * modelled here as a PROPOSED contract; no UI copy may claim a fact the engine cannot supply.
 * ──────────────────────────────────────────────────────────────────────────── */

/** The five buckets a captured file falls into — derived from MIME + extension, never stored twice
 *  (see `mediaKind()` in ./mediaFormat). `other` is a real bucket (archives, unknown types). */
export type MediaKind = 'image' | 'video' | 'audio' | 'document' | 'other';

/** The subset of a file the record panel's comment chips need. */
export type CommentAttachment = Pick<MediaAsset, 'id' | 'filename' | 'type' | 'size'> & {
  /** Airtable's own attachment URL. EXPIRES ~2h — never use it as an <img src>. */
  url?: string;
};

/** The subset a Browse grid cell needs: enough to draw the thumbnail and name the file. */
export type CellAttachment = Pick<MediaAsset, 'id' | 'filename' | 'type' | 'size' | 'thumbUrl'>;

/** Where the bytes of a captured file actually live. Drives which panel actions are offered. */
export interface AssetStorage {
  /** A Baseout-managed (R2) copy exists → Download is offered. False on a BYOS-only Space. */
  baseout: boolean;
  /** The account-level destination the copy was written to (fixtures/destinations.ts). */
  destinationId?: string;
  provider?: 'google_drive' | 'dropbox' | 'box' | 'onedrive' | 's3';
  /** "Google Drive" — the label the "Open in {provider}" button says. */
  providerLabel?: string;
}

/**
 * WHERE AN ATTACHMENT COMES FROM — exactly one place (founder, 2026-08-03).
 *
 * This replaced an `AssetTrail[]` array and the whole "one asset, N trails" dedup model, which was
 * simply wrong about Airtable: *"attachments are a unique id … the source of the attachment will
 * always be in a single table, field, and record"*. An attachment id lives in ONE
 * base ▸ table ▸ field ▸ record and nowhere else, so the source is a single object and every
 * segment of it is renderable in full.
 *
 * A lookup field can SURFACE the same attachment elsewhere. That is a different relation
 * ("referenced by …"), it is OUT OF SCOPE until the engine can supply it, and until then no copy
 * on this surface may imply it exists.
 */
export interface AssetSource {
  baseId: string;
  tableId: string;
  /**
   * Field attachments only. A comment attachment has NO field — Airtable's comment payload carries
   * none — so this is genuinely absent, never a placeholder segment. The trail is then
   * base ▸ table ▸ record, three levels, and the field crumb is not rendered at all.
   */
  fieldId?: string;
  recordId: string;
  /**
   * Deep link to the source RECORD in Airtable. Absent when the record left backup scope.
   *
   * RECORD-LEVEL BY VERIFICATION, not by omission (2026-08-03): Airtable's own documentation
   * describes record-level linking (a base URL composed with `RECORD_ID()`) and documents no
   * per-ATTACHMENT deep link. The only attachment-level URLs it documents are the temporary
   * `airtableusercontent.com` ones, which expire ~2h after the API returns them and which this
   * product must never link to. So the action stays "View in Airtable" and points at the record —
   * inventing an attachment URL shape is the same class of error as linking an expiring URL.
   */
  airtableUrl?: string;
}

/**
 * A comment attachment's source. Airtable's comment payload carries NO field id, so the field is
 * absent as a matter of fact — `fieldId?: never` makes the compiler say so. Without this the pair
 * `{ sourceKind: 'comment', source: { fieldId: 'fld…' } }` type-checks happily and renders a
 * four-level trail on a row labelled "Comment": a lie the fixtures' early-warning system could
 * never catch, because it is not a shape error, it is a false statement.
 */
export interface CommentAssetSource extends Omit<AssetSource, 'fieldId'> {
  fieldId?: never;
}

/**
 * One captured file. It has ONE source — see `AssetSource`.
 *
 * A DISCRIMINATED UNION on `sourceKind`, not a flat record with two independent fields: the
 * invariant "a comment attachment has no field" is the whole reason the trail renders three levels
 * instead of four, and an invariant a comment describes is one the next writer can break by
 * accident. `sourceKind` stays EXPLICIT rather than derived from `source.fieldId` — a future engine
 * could emit a FIELD attachment whose field id it failed to resolve, and a derived label would then
 * call that file a comment.
 */
export type MediaAsset = MediaAssetBase &
  ({ sourceKind: 'field'; source: AssetSource } | { sourceKind: 'comment'; source: CommentAssetSource });

interface MediaAssetBase {
  id: string;
  /** The winning name. The grid cell's `name` was renamed to this. Optional: Airtable's payload
   *  allows it to be missing, and the UI must degrade rather than print "undefined". */
  filename?: string;
  /** MIME type, when the capture recorded one. */
  type?: string;
  /** Bytes. Optional — Airtable does withhold it. */
  size?: number;
  kind: MediaKind;
  /** OUR stored copy ONLY. Never an Airtable URL: it expires in ~2h and renders a wall of broken
   *  images by the same afternoon. Absent = the designed glyph state, not an error. */
  thumbUrl?: string;
  width?: number;
  height?: number;
  /** The engine's dedup key. Modelled, not yet emitted — see the honesty note above. */
  checksum?: string;
  storage: AssetStorage;
  capturedAt: string;
  /** The most recent capture in which this file was still attached in the source. */
  lastSeenAt: string;
}
