import { useMemo, useCallback, useState, useEffect, useRef, type ReactNode, type Dispatch, type SetStateAction } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type NodeProps,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { AIRTABLE_FIELD_ICONS, airtableIconKey, fieldTypeLabel } from '../../lib/schema-docs/airtable-field-icons';
import FieldsFilter from './FieldsFilter';

/**
 * SchemaCanvas — the Visualize-tab ER diagram (React Flow island).
 * Ported from apps/design (web-schema-visualize); adaptations for real data:
 * - `health` is OPTIONAL (the engine schema payload carries no per-table grade
 *   yet) — the status dot + Health legend only render when present.
 * - Field types are the Airtable REST camelCase names (engine payload);
 *   relKind/typeLabel/icons resolve both vocabularies.
 * - Relationships mode fetches the live per-base feed via
 *   /api/spaces/:spaceId/relationships (adapted client-side) when `spaceId` is
 *   provided; the `relationships` prop remains for embedded/story use.
 * - Node click opens EntityPanel via `schema:openEntity` (same as Browse).
 * - The design's "Add to doc" + "Export" dropdowns are NOT ported — both were
 *   non-functional prototypes; real doc persistence + tiered export are deferred
 *   follow-ups in the openspec change.
 *
 * Decisions (design round-3):
 * - HYBRID node — header over the relationship-bearing field rows (primary +
 *   linked-record fields); the full field list lives in the entity panel.
 * - Field-to-table edges anchored on the specific linked-record row, coloured by
 *   relation type (Airtable's own language; NOT crow's-foot). Linked = neutral.
 * - dagre auto-layout (left→right), fit-to-view. No force-directed.
 *
 * Styled with the app's CSS tokens so it themes light/dark with everything else.
 */

export interface SchemaField {
  id: string;
  name: string;
  /** Airtable field type (drives the type label / icon). */
  type: string;
  isPrimary?: boolean;
  /** Set on linked-record fields — the table this field links to. */
  linkedTableId?: string;
  /** AI-generated, editable description (persisted). Absent → offer "Generate". */
  description?: string;
  /** Live description in Airtable (the synced truth; meta API `field.description`). */
  airtableDescription?: string;
  /** Edited-but-unpublished Airtable description. Present + ≠ airtableDescription ⇒
   *  "out of sync": shows a Draft label + Publish action. Fixture-seeds the demo state. */
  airtableDraft?: string;
  /** True when Airtable's live description changed since the last backup — drives the
   *  "publishing overwrites it" stale warning on the Publish confirm step. */
  airtableExternallyChanged?: boolean;
  /** The user's own internal/extended description (Baseout-only, never synced). */
  userDescription?: string;
  /** AI-generated *technical* internal draft — more verbose/technical than `description`;
   *  seeds the Internal tab's Generate action (engine runs a more-technical prompt). */
  technicalDescription?: string;
  /** Deleted in Airtable but retained for history (deleted-items-filter). Default-hidden. */
  removed?: boolean;
  /** ISO date the field went missing from Airtable (drives the "deleted since" caption). */
  removedAt?: string;
  /** Couldn't be confirmed this run — NOT deleted; stays visible. */
  unknown?: boolean;
  /** Select-type choices (Airtable `options.choices`) — shown in the Browse panel. */
  options?: string[];
  /** Computed fields (lookup/rollup/count): the source field this derives from. */
  derivedFrom?: string;
  // A4 — field-type configuration (all obtainable from the Airtable meta API).
  /** Formula expression text (formula fields). */
  formula?: string;
  /** Field ids this formula references (same table). */
  referencedFieldIds?: string[];
  /** Lookup/rollup: the link field in THIS table it resolves through. */
  lookupViaFieldId?: string;
  /** Lookup/rollup: the field id in the linked table being pulled. */
  lookupTargetFieldId?: string;
  // A6 — linked-record cardinality + the symmetric backlink field.
  /** Linked-record fields: false = single link (1:1); true/undefined = multiple (1:many). */
  allowsMultiple?: boolean;
  /** The symmetric inverse link field id in the linked table (the backlink). */
  inverseFieldId?: string;
}
export interface SchemaView {
  id: string;
  name: string;
  /** Airtable view type (grid/form/calendar/…); OPEN enum — unknown values render verbatim. */
  type?: string;
  /** Set when the view is PERSONAL (visible to one collaborator alone). */
  personalForUserId?: string;
  /** Field ids the view shows (Airtable exposes this for GRID views only). */
  visibleFieldIds?: string[];
  /** The capture could not resolve the owning table — the view hangs off the base. */
  tableUnresolved?: boolean;
  /** Captured per-view field count — fallback when the table has no fields to count. */
  fieldCount?: number;
  /** Deleted in Airtable but retained for history. */
  removed?: boolean;
  removedAt?: string;
  /** Unconfirmed this run (NOT deleted; stays visible). */
  unknown?: boolean;
}
export interface SchemaTable {
  id: string;
  name: string;
  /** Per-table grade — optional: the engine schema payload carries none yet. */
  health?: 'green' | 'amber' | 'red';
  fieldCount: number;
  /** Only present when the Space has a dynamic backup (schema-only plans omit it). */
  recordCount?: number;
  fields: SchemaField[];
  description?: string;
  /** Live description in Airtable (the synced truth). */
  airtableDescription?: string;
  /** Edited-but-unpublished Airtable description (see SchemaField.airtableDraft). */
  airtableDraft?: string;
  /** Airtable's live description changed since the last backup (stale-warning seed). */
  airtableExternallyChanged?: boolean;
  /** The user's own internal/extended description (Baseout-only, never synced). */
  userDescription?: string;
  /** AI-generated *technical* internal draft — more verbose/technical than `description`;
   *  seeds the Internal tab's Generate action (engine runs a more-technical prompt). */
  technicalDescription?: string;
  /** Deleted in Airtable but retained for history (deleted-items-filter). Default-hidden. */
  removed?: boolean;
  /** ISO date the table went missing from Airtable. */
  removedAt?: string;
  /** Couldn't be confirmed this run — NOT deleted; stays visible. */
  unknown?: boolean;
  /** The Airtable base this table belongs to — drives the base filter on multi-base Spaces. */
  baseId?: string;
  /** Views captured for this table (view-schema-details). Optional: schema-shallow
   *  captures and schema-only plans omit it. */
  views?: SchemaView[];
}
interface Props {
  tables: SchemaTable[];
  /** Bases in the Space (id + name) — labels the Display filter's Base section. */
  bases?: { id: string; name: string }[];
  /** AI capability for the Generate-description action: ready (Pro+, has credits),
   *  locked (below Pro+ → upsell), no-credits (Pro+ but out of credits). Harness: ?ai=. */
  genState?: 'ready' | 'locked' | 'no-credits';
  /** Health per base id — drives the status dot on the Bases facet so it matches the
   *  per-table dots (and Browse / Changelog). */
  baseHealth?: Record<string, 'green' | 'amber' | 'red'>;
  /** When set, the Relationships mode lazy-fetches the live per-base feed from
   *  `/api/spaces/:spaceId/relationships` on first switch (adapted client-side). */
  spaceId?: string;
  /** Curated relationships for the Visualize "Relationships" mode (table-level graph).
   *  Used directly when provided (embed/story); otherwise fetched via `spaceId`. */
  relationships?: SchemaRelationship[];
  /** Registered automations for the Visualize "Automations & Interfaces" mode. */
  automations?: AppAutomation[];
  /** Registered interfaces + pages for the Visualize "Automations & Interfaces" mode. */
  interfaces?: AppInterface[];
  /** Embedded, scoped, read-only mode (Docs mini-diagrams): hide the toolbar + minimap. */
  embed?: boolean;
}

type TableNodeData = {
  table: SchemaTable;
  /** Relationship-bearing rows shown in the node (primary + links). */
  rows: SchemaField[];
  hiddenCount: number;
};

const NODE_W = 248;
const HEAD_H = 46;
const ROW_H = 30;
const FOOT_H = 26;
const NODE_FIELD_CAP = 14; // show every field per node up to this; collapse the rest into "+N more"

const HEALTH: Record<NonNullable<SchemaTable['health']>, string> = {
  green: 'var(--color-success)',
  amber: 'var(--color-warning)',
  red: 'var(--color-error)',
};

// Short, lower-case Airtable type labels (mono boundary — machine tokens).
const TYPE_LABEL: Record<string, string> = {
  single_line_text: 'text',
  long_text: 'long text',
  rich_text: 'rich text',
  number: 'number',
  currency: 'currency',
  percent: 'percent',
  single_select: 'select',
  multiple_select: 'multi-select',
  date: 'date',
  checkbox: 'checkbox',
  email: 'email',
  url: 'url',
  phone_number: 'phone',
  attachment: 'attachment',
  link: 'link',
  lookup: 'lookup',
  rollup: 'rollup',
  formula: 'formula',
  count: 'count',
  rating: 'rating',
  collaborator: 'user',
  created_time: 'created',
  last_modified_time: 'modified',
  autonumber: 'autonumber',
};
// Fall back through the shared camelCase-aware label for engine-payload types.
const typeLabel = (t: string) => TYPE_LABEL[t] ?? fieldTypeLabel(t).toLowerCase();

// B2 — relationship types as a colour language (Airtable "Base Schema" extension):
// linked = solid neutral, lookup = dashed orange, rollup = dashed violet, formula = dashed blue.
type RelKind = 'linked' | 'lookup' | 'rollup' | 'formula';
const RELATION: Record<RelKind, { label: string; color: string; dashed: boolean }> = {
  linked: { label: 'Linked record', color: 'var(--color-base-content)', dashed: false },
  lookup: { label: 'Lookup', color: '#d97706', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  rollup: { label: 'Rollup', color: '#7c3aed', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  formula: { label: 'Formula', color: '#2563eb', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
};
const REL_KINDS = Object.keys(RELATION) as RelKind[];
function relKind(f: SchemaField): RelKind | null {
  // Both vocabularies: design snake_case fixtures AND the engine's REST camelCase.
  if (f.type === 'rollup') return 'rollup';
  if (f.type === 'lookup' || f.type === 'multipleLookupValues') return 'lookup';
  if (f.type === 'formula' && f.referencedFieldIds && f.referencedFieldIds.length) return 'formula';
  if (f.type === 'link' || f.type === 'multipleRecordLinks' || f.type === 'singleRecordLink' || f.linkedTableId) return 'linked';
  return null;
}

function nodeHeight(rows: number, hasFoot: boolean): number {
  return HEAD_H + rows * ROW_H + (hasFoot ? FOOT_H : 0);
}

// ── Relationships mode (Visualize) — the curated SchemaRelationship graph ──────
// Table-level nodes + typed relationship edges. Distinct from the field-derived ER
// edges above AND from the Relationships-tab table. Types mirror
// SchemaRelationships.astro; the array is passed in as the `relationships` prop.
type RelType = 'linkedRecords' | 'formulas' | 'rollups' | 'lookups' | 'lastModified' | 'syncedViews';
interface RelEndpoint { id: string; name: string; kind: 'table' | 'field'; fieldType?: string; tableName?: string }
interface RelLink { from: RelEndpoint; to: RelEndpoint; removed?: boolean; firstSeen?: string; removedAt?: string; note?: string }
export interface SchemaRelationship {
  id: string; type: RelType; baseId: string; baseName: string;
  a: RelEndpoint; b: RelEndpoint; cardinality?: string; direction?: 'one' | 'two';
  inferred?: boolean; validity: 'valid' | 'invalid'; hasRemovedHistory?: boolean;
  provenance?: string; links?: RelLink[];
}
const REL_TYPE_META: Record<RelType, { label: string; color: string; dashed: boolean }> = {
  linkedRecords: { label: 'Linked records', color: 'var(--color-base-content)', dashed: false },
  formulas: { label: 'Formulas', color: '#2563eb', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  rollups: { label: 'Rollups', color: '#7c3aed', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  lookups: { label: 'Lookups', color: '#d97706', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  lastModified: { label: 'Last modified', color: '#0891b2', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  syncedViews: { label: 'Synced views', color: '#059669', dashed: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
};
const REL_TYPES = Object.keys(REL_TYPE_META) as RelType[];
const REL_NODE_W = 208;
const REL_NODE_H = 44;
// Stable empty default — a fresh `[]` in the Canvas signature would change identity
// every render and re-fire the re-layout effect (React Flow "max update depth").
const EMPTY_REL: SchemaRelationship[] = [];

// Adapt the engine relationships payload (the guarded `/api/spaces/:id/relationships`
// proxy — `derived` + `syncedViews`, same shape the Relationships tab consumes) to the
// canvas's SchemaRelationship shape. Derived rows carry participant refs; the first two
// become the drawable endpoints (rows with fewer can't be drawn as a cross-table edge).
type EngineRef = { tableId?: string; fieldId?: string; name: string; removed: boolean };
type EngineDerived = {
  id: string;
  type: 'linkedRecords' | 'formulas' | 'rollups' | 'lookups' | 'lastModified';
  label: string;
  refs: EngineRef[];
  hasRemovedHistory: boolean;
  valid: boolean;
};
type EngineSynced = {
  id: string;
  sourceTableId: string;
  sourceTableName: string;
  destTableId: string;
  destTableName: string;
  status: string;
  origin: string;
  inferred: boolean;
  matchScore: number | null;
};
export function adaptEngineRelationships(
  baseId: string,
  baseName: string,
  payload: { derived: EngineDerived[]; syncedViews: EngineSynced[] },
): SchemaRelationship[] {
  const out: SchemaRelationship[] = [];
  const ep = (r: EngineRef): RelEndpoint => ({
    id: r.tableId ?? r.fieldId ?? r.name,
    name: r.name,
    kind: r.tableId ? 'table' : 'field',
  });
  for (const d of payload.derived) {
    const [a, b] = d.refs;
    if (!a || !b) continue;
    out.push({
      id: d.id, type: d.type, baseId, baseName,
      a: ep(a), b: ep(b),
      validity: d.valid ? 'valid' : 'invalid',
      hasRemovedHistory: d.hasRemovedHistory,
    });
  }
  for (const s of payload.syncedViews) {
    out.push({
      id: s.id, type: 'syncedViews', baseId, baseName,
      a: { id: s.sourceTableId, name: s.sourceTableName, kind: 'table' },
      b: { id: s.destTableId, name: s.destTableName, kind: 'table' },
      inferred: s.inferred, validity: 'valid',
    });
  }
  return out;
}

// ── App-layer mode (Visualize) — Automations & Interfaces over the table/field substrate ──
// Epic 4 / openspec visualize-automations-interfaces. Types mirror SchemaAutomations.astro /
// SchemaInterfaces.astro (declared locally, like SchemaRelationship, so the React island never
// imports a .astro). Structural typing accepts the wider .astro types SchemaView passes in.
type AppTag = { entityId: string; source?: 'auto' | 'manual' };
export interface AppAutomation {
  id: string; name: string; group?: string; triggerType?: string;
  status: 'active' | 'removed'; tags?: AppTag[];
  /** Automation ids this one is triggered BY — reserved; triggers are captured on the caller. */
  removedAt?: string;
}
export interface AppInterface {
  id: string; name: string; type: 'interface' | 'page'; parentId?: string;
  status: 'active' | 'removed'; tags?: AppTag[];
  /** Automation ids this page/interface triggers (captured page→automation links). */
  triggers?: string[];
  removedAt?: string;
}
const EMPTY_AUTO: AppAutomation[] = [];
const EMPTY_IF: AppInterface[] = [];

// The five node types get a distinct accent colour + label; the card itself stays neutral
// (Fibery pattern — type = chip + icon, not a loud fill). Removed → muted, handled at render.
type AppNodeKind = 'automation' | 'interface' | 'page' | 'table' | 'field';
const APP_NODE_META: Record<AppNodeKind, { label: string; color: string; icon: string }> = {
  automation: { label: 'Automation', color: '#d97706', icon: 'lucide--zap' }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  interface:  { label: 'Interface',  color: '#7c3aed', icon: 'lucide--layout-panel-left' }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  page:       { label: 'Page',       color: '#2563eb', icon: 'lucide--file' }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  table:      { label: 'Table',      color: 'var(--color-base-content)', icon: 'lucide--table-2' },
  field:      { label: 'Field',      color: 'var(--color-base-content)', icon: 'lucide--type' },
};
const APP_NODE_KINDS = Object.keys(APP_NODE_META) as AppNodeKind[];

// Three edge kinds (spec) distinguished by colour + dash + arrowhead + inline label — plus a
// faint structural "contains" (interface→page) that isn't one of the three (kept out of the legend).
type AppEdgeKind = 'references' | 'reads' | 'triggers' | 'contains';
const APP_EDGE_META: Record<AppEdgeKind, { label: string; color: string; dashed: boolean; legend: boolean }> = {
  references: { label: 'References', color: '#d97706', dashed: false, legend: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  reads:      { label: 'Reads',      color: '#2563eb', dashed: true,  legend: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  triggers:   { label: 'Triggers',   color: '#7c3aed', dashed: false, legend: true }, // ds-ok: ER-diagram edge/legend palette (6 distinguishable hues, no 1:1 theme token)
  contains:   { label: 'Contains',   color: 'var(--color-base-content)', dashed: true, legend: false },
};
const APP_EDGE_KINDS = (Object.keys(APP_EDGE_META) as AppEdgeKind[]).filter((k) => APP_EDGE_META[k].legend);
const APP_ENT_W = 240;
const APP_ENT_H = 52;
const APP_FIELD_W = 156;
const APP_FIELD_H = 30;

/** A linked-record / primary field row inside the table node. */
function FieldRow({ field }: { field: SchemaField }) {
  const isLink = field.type === 'link' || !!field.linkedTableId;
  const kind = relKind(field);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: ROW_H,
        padding: '0 8px',
        borderTop: '1px solid var(--color-base-200)',
        fontSize: 12.5,
        position: 'relative',
      }}
    >
      <span
        aria-hidden
        style={{
          width: 13,
          height: 13,
          flex: 'none',
          display: 'grid',
          placeItems: 'center',
          color: isLink ? 'var(--color-primary)' : 'var(--color-base-content)',
          opacity: field.isPrimary ? 0.9 : isLink ? 1 : 0.45,
        }}
      >
        {fieldGlyph(field)}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: field.isPrimary ? 600 : 500,
          color: 'var(--color-base-content)',
        }}
      >
        {field.name}
      </span>
      <span
        className="mono-data"
        style={{ fontSize: 10.5, color: 'var(--color-base-content)', opacity: 0.5, flex: 'none' }}
      >
        {typeLabel(field.type)}
      </span>
      {/* B2 — outgoing source handle, coloured by relationship type */}
      {kind && (
        <Handle
          id={field.id}
          type="source"
          position={Position.Right}
          style={{ background: RELATION[kind].color, opacity: kind === 'linked' ? 1 : 0.9, width: 7, height: 7, border: 'none' }}
        />
      )}
      {/* B2 — invisible target handle so same-table formula edges can anchor on this field */}
      <Handle id={`t-${field.id}`} type="target" position={Position.Left} style={{ background: 'transparent', width: 7, height: 7, border: 'none', opacity: 0 }} />
    </div>
  );
}

function TableNode({ data, selected }: NodeProps<Node<TableNodeData>>) {
  const { table, rows, hiddenCount } = data;
  const nf = new Intl.NumberFormat('en-US');
  return (
    <div
      style={{
        width: NODE_W,
        background: 'var(--color-base-100)',
        border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-base-300)'}`,
        borderRadius: 10,
        boxShadow: selected
          ? '0 0 0 1px var(--color-primary), 0 8px 24px oklch(0 0 0 / 0.18)'
          : '0 1px 2px oklch(0 0 0 / 0.06)',
        overflow: 'hidden',
        fontFamily: 'inherit',
      }}
    >
      {/* incoming edges anchor on the node (header), so they stay valid even when the
          primary row is hidden by a field-type filter */}
      <Handle id="in" type="target" position={Position.Left} style={{ top: HEAD_H / 2, background: 'var(--color-base-content)', opacity: 0.35, width: 7, height: 7, border: 'none' }} />
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: HEAD_H, padding: '0 8px' }}>
        {table.health && (
          <span
            aria-hidden
            style={{ width: 9, height: 9, borderRadius: 999, flex: 'none', background: HEALTH[table.health] }}
          />
        )}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: 650,
            fontSize: 13.5,
            color: 'var(--color-base-content)',
          }}
        >
          {table.name}
        </span>
        <span className="mono-data" style={{ fontSize: 10.5, color: 'var(--color-base-content)', opacity: 0.55, flex: 'none' }}>
          {table.recordCount != null ? `${nf.format(table.recordCount)} rec` : `${table.fieldCount} fld`}
        </span>
      </div>
      {/* relationship-bearing field rows */}
      {rows.map((f) => (
        <FieldRow key={f.id} field={f} />
      ))}
      {/* the rest collapse into a count (full list = side panel) */}
      {hiddenCount > 0 && (
        <div
          style={{
            height: FOOT_H,
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            borderTop: '1px solid var(--color-base-200)',
            fontSize: 11.5,
            color: 'var(--color-base-content)',
            opacity: 0.55,
            background: 'oklch(from var(--color-base-200) l c h / 0.35)',
          }}
        >
          +{hiddenCount} more field{hiddenCount === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}

// B1 — a labelled background container behind the tables of one base (dbdiagram "Table Groups").
function BaseGroupNode({ data }: NodeProps<Node<{ name: string; w: number; h: number }>>) {
  return (
    <div style={{ width: data.w, height: data.h, border: '1px dashed var(--color-base-300)', borderRadius: 14, background: 'oklch(from var(--color-base-200) l c h / .22)', pointerEvents: 'none', position: 'relative' }}>
      <span style={{ position: 'absolute', top: 5, left: 13, fontSize: 11, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--color-base-content)', opacity: 0.5 }}>{data.name}</span>
    </div>
  );
}

// Relationships-mode node — a compact table card (health dot + name + count) with
// generic in/out handles for the typed relationship edges.
type RelNodeData = { table: SchemaTable };
function RelTableNode({ data, selected }: NodeProps<Node<RelNodeData>>) {
  const { table } = data;
  const nf = new Intl.NumberFormat('en-US');
  return (
    <div style={{ width: REL_NODE_W, background: 'var(--color-base-100)', border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-base-300)'}`, borderRadius: 10, boxShadow: selected ? '0 0 0 1px var(--color-primary), 0 8px 24px oklch(0 0 0 / 0.18)' : '0 1px 2px oklch(0 0 0 / 0.06)', display: 'flex', alignItems: 'center', gap: 8, height: REL_NODE_H, padding: '0 12px' }}>
      <Handle id="in" type="target" position={Position.Left} style={{ background: 'var(--color-base-content)', opacity: 0.35, width: 7, height: 7, border: 'none' }} />
      <Handle id="out" type="source" position={Position.Right} style={{ background: 'var(--color-base-content)', opacity: 0.35, width: 7, height: 7, border: 'none' }} />
      {table.health && <span aria-hidden style={{ width: 9, height: 9, borderRadius: 999, flex: 'none', background: HEALTH[table.health] }} />}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 650, fontSize: 13.5, color: 'var(--color-base-content)' }}>{table.name}</span>
      <span className="mono-data" style={{ fontSize: 10.5, color: 'var(--color-base-content)', opacity: 0.55, flex: 'none' }}>{table.recordCount != null ? `${nf.format(table.recordCount)} rec` : `${table.fieldCount} fld`}</span>
    </div>
  );
}

// App-layer entity node (automation / interface / page) — a neutral card with a coloured
// left accent, a type chip + icon, the name, and (automations) a trigger caption. Removed
// entities render muted with a badge. Generic in/out handles carry the typed edges.
type AppEntityData = { kind: 'automation' | 'interface' | 'page'; name: string; caption?: string; removed?: boolean };
function AppEntityNode({ data, selected }: NodeProps<Node<AppEntityData>>) {
  const meta = APP_NODE_META[data.kind];
  return (
    <div style={{ width: APP_ENT_W, position: 'relative', background: 'var(--color-base-100)', border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-base-300)'}`, borderRadius: 10, boxShadow: selected ? '0 0 0 1px var(--color-primary), 0 8px 24px oklch(0 0 0 / 0.18)' : '0 1px 2px oklch(0 0 0 / 0.06)', opacity: data.removed ? 0.55 : 1, overflow: 'hidden' }}>
      <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: meta.color, opacity: data.removed ? 0.5 : 0.9 }} />
      <Handle id="in" type="target" position={Position.Left} style={{ background: 'var(--color-base-content)', opacity: 0.35, width: 7, height: 7, border: 'none' }} />
      <Handle id="out" type="source" position={Position.Right} style={{ background: 'var(--color-base-content)', opacity: 0.35, width: 7, height: 7, border: 'none' }} />
      <div style={{ padding: '8px 12px 8px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span aria-hidden className={`iconify ${meta.icon} size-4`} style={{ color: meta.color, flex: 'none' }} />
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 640, fontSize: 13, color: 'var(--color-base-content)' }}>{data.name}</span>
          <span style={{ flex: 'none', fontSize: 9.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', padding: '1px 8px', borderRadius: 999, color: meta.color, background: `color-mix(in oklch, ${meta.color} 14%, transparent)` }}>{meta.label}</span>
        </div>
        {data.caption && (
          <div style={{ marginTop: 3, fontSize: 11, color: 'var(--color-base-content)', opacity: 0.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.caption}</div>
        )}
        {data.removed && (
          <div style={{ marginTop: 5 }}><span style={{ fontSize: 9.5, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'oklch(from var(--color-warning) l c h / .14)', color: 'var(--color-warning)' }}>Removed from Airtable</span></div>
        )}
      </div>
    </div>
  );
}

// App-layer field node — a compact chip shown only when fields are expanded under their table.
type AppFieldData = { name: string; fieldType?: string; removed?: boolean };
function AppFieldNode({ data, selected }: NodeProps<Node<AppFieldData>>) {
  return (
    <div style={{ width: APP_FIELD_W, height: APP_FIELD_H, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', background: 'var(--color-base-100)', border: `1px solid ${selected ? 'var(--color-primary)' : 'var(--color-base-300)'}`, borderRadius: 8, boxShadow: '0 1px 2px oklch(0 0 0 / 0.05)', opacity: data.removed ? 0.55 : 1 }}>
      <Handle id="in" type="target" position={Position.Left} style={{ background: 'var(--color-base-content)', opacity: 0.3, width: 6, height: 6, border: 'none' }} />
      <span aria-hidden style={{ width: 13, height: 13, flex: 'none', display: 'grid', placeItems: 'center', opacity: 0.6 }}><AirtableFieldIcon type={data.fieldType || ''} /></span>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, color: 'var(--color-base-content)' }}>{data.name}</span>
    </div>
  );
}

const nodeTypes = { table: TableNode, baseGroup: BaseGroupNode, relTable: RelTableNode, appEntity: AppEntityNode, appField: AppFieldNode };

// Shared canvas legend — one card, bottom-left, non-interactive. Keys the colour language of
// the current Visualize mode (the same swatch colour used on nodes/edges), so every mode reads
// consistently. `dot` = a node/health swatch (square for a type, circle for health); `line` = an
// edge sample (dashed mirrors the real stroke). Extended from the app-layer legend Oleh liked.
type LegendItem = { label: string; color: string; kind: 'dot' | 'line'; dashed?: boolean; circle?: boolean };
type LegendCol = { title: string; items: LegendItem[] };
function CanvasLegend({ cols }: { cols: LegendCol[] }) {
  return (
    <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 15, pointerEvents: 'none', background: 'color-mix(in oklch, var(--color-base-100) 92%, transparent)', border: '1px solid var(--color-base-300)', borderRadius: 10, boxShadow: '0 4px 16px oklch(0 0 0 / 0.10)', fontSize: 11.5, color: 'var(--color-base-content)', backdropFilter: 'blur(3px)', padding: '8px 12px' }}>
      <div style={{ display: 'flex', gap: 16 }}>
        {cols.map((c) => (
          <div key={c.title}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', opacity: 0.45, marginBottom: 5 }}>{c.title}</div>
            {c.items.map((it) => (
              <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                {it.kind === 'dot' ? (
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: it.circle ? 999 : 3, background: it.color, flex: 'none', opacity: 0.9 }} />
                ) : (
                  <svg width="18" height="8" style={{ flex: 'none' }} aria-hidden>
                    <line x1="1" y1="4" x2="17" y2="4" stroke={it.color} strokeWidth="1.6" strokeDasharray={it.dashed ? '4 3' : undefined} />
                  </svg>
                )}
                <span>{it.label}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
const HEALTH_LEGEND: LegendItem[] = [
  { label: 'Healthy', kind: 'dot', circle: true, color: 'var(--color-success)' },
  { label: 'Warning', kind: 'dot', circle: true, color: 'var(--color-warning)' },
  { label: 'Error', kind: 'dot', circle: true, color: 'var(--color-error)' },
];

/** The field rows a node surfaces: primary first, then the rest in order — minus any
 *  field types hidden by the Display filter, capped (the overflow collapses to "+N more"). */
function nodeFields(t: SchemaTable, hiddenTypes?: Set<string>, hiddenFields?: Set<string>): { rows: SchemaField[]; hidden: number } {
  // Deleted (removed) fields are history — never drawn on the live diagram.
  const ordered = [...t.fields.filter((f) => f.isPrimary), ...t.fields.filter((f) => !f.isPrimary)].filter((f) => !f.removed);
  let visible = hiddenTypes && hiddenTypes.size ? ordered.filter((f) => !hiddenTypes.has(f.type)) : ordered;
  if (hiddenFields && hiddenFields.size) visible = visible.filter((f) => !hiddenFields.has(f.id));
  const rows = visible.slice(0, NODE_FIELD_CAP);
  return { rows, hidden: Math.max(0, visible.length - rows.length) };
}

function layout(
  tables: SchemaTable[],
  opts?: { hiddenTypes?: Set<string>; hiddenFields?: Set<string>; showRelationships?: boolean; hiddenRel?: Set<RelKind>; bases?: { id: string; name: string }[] },
): { nodes: Node[]; edges: Edge[] } {
  const hiddenTypes = opts?.hiddenTypes;
  const hiddenFields = opts?.hiddenFields;
  const showRel = opts?.showRelationships !== false;
  const meta = new Map<string, { rows: SchemaField[]; hidden: number; h: number }>();
  const shownFieldIds = new Set<string>();
  for (const t of tables) {
    const { rows, hidden } = nodeFields(t, hiddenTypes, hiddenFields);
    const h = nodeHeight(rows.length, hidden > 0);
    meta.set(t.id, { rows, hidden, h });
    rows.forEach((f) => shownFieldIds.add(f.id));
  }

  // Field-id map → resolve formula references and the table a lookup/rollup pulls from.
  const fieldById = new Map<string, SchemaField>();
  tables.forEach((t) => t.fields.forEach((f) => fieldById.set(f.id, f)));
  const sourceTableOf = (f: SchemaField): string | undefined =>
    f.lookupViaFieldId ? fieldById.get(f.lookupViaFieldId)?.linkedTableId : f.linkedTableId;

  // Build + lay out (LR) a dagre graph for a SUBSET of tables. EVERY structural cross-table link
  // (linked + lookup/rollup) inside the subset is fed in so positions stay stable when
  // relationship/field types are toggled. Running this per-base keeps each base its own cluster.
  const buildGraph = (subset: SchemaTable[]) => {
    const g = new dagre.graphlib.Graph();
    g.setDefaultEdgeLabel(() => ({}));
    g.setGraph({ rankdir: 'LR', nodesep: 36, ranksep: 90, marginx: 24, marginy: 24 });
    const ids = new Set(subset.map((t) => t.id));
    for (const t of subset) g.setNode(t.id, { width: NODE_W, height: meta.get(t.id)!.h });
    for (const t of subset) {
      for (const f of t.fields) {
        const k = relKind(f);
        if (k === 'linked' && f.linkedTableId && ids.has(f.linkedTableId)) g.setEdge(t.id, f.linkedTableId);
        else if (k === 'lookup' || k === 'rollup') { const tt = sourceTableOf(f); if (tt && ids.has(tt)) g.setEdge(t.id, tt); }
      }
    }
    dagre.layout(g);
    return g;
  };

  const hiddenRel = opts?.hiddenRel;
  const edges: Edge[] = [];
  if (showRel) {
    for (const t of tables) {
      for (const f of t.fields) {
        const k = relKind(f);
        if (!k || (hiddenRel && hiddenRel.has(k)) || !shownFieldIds.has(f.id)) continue;
        const rel = RELATION[k];
        const base = {
          source: t.id,
          sourceHandle: f.id,
          type: 'smoothstep' as const,
          style: { stroke: rel.color, strokeOpacity: k === 'linked' ? 0.32 : 0.7, strokeWidth: 1.5, strokeDasharray: rel.dashed ? '5 4' : undefined },
          markerEnd: { type: 'arrowclosed' as any, color: rel.color, width: 14, height: 14 },
        };
        if (k === 'linked' && f.linkedTableId && meta.has(f.linkedTableId)) {
          edges.push({ ...base, id: `${t.id}.${f.id}->${f.linkedTableId}`, target: f.linkedTableId, targetHandle: 'in' });
        } else if (k === 'lookup' || k === 'rollup') {
          const tt = sourceTableOf(f);
          if (tt && meta.has(tt)) edges.push({ ...base, id: `${t.id}.${f.id}->${tt}`, target: tt, targetHandle: 'in' });
        } else if (k === 'formula') {
          (f.referencedFieldIds || []).forEach((rid) => {
            if (shownFieldIds.has(rid)) edges.push({ ...base, id: `${t.id}.${f.id}->${rid}`, target: t.id, targetHandle: `t-${rid}` });
          });
        }
      }
    }
  }

  const bs = opts?.bases;
  const baseOf = (t: SchemaTable) => t.baseId ?? bs?.[0]?.id ?? '_';
  const present = Array.from(new Set(tables.map(baseOf)));
  const multi = present.length > 1;

  // Final node-centre positions. Single base → one dagre run (unchanged). Multi-base → lay each
  // base out on its own, then stack the bases into DISJOINT vertical bands separated by GROUP_GAP,
  // so the labelled group boxes are always clearly separate rectangles (never overlap or touch).
  const pos = new Map<string, { x: number; y: number }>();
  const PAD = 26, LABEL = 22, GROUP_GAP = 72;
  const groupNodes: Node[] = [];

  if (!multi) {
    const g = buildGraph(tables);
    for (const t of tables) { const p = g.node(t.id); pos.set(t.id, { x: p.x, y: p.y }); }
  } else {
    let cursorY = 0; // running top of the next base band
    for (const bid of present) {
      const bt = tables.filter((t) => baseOf(t) === bid && meta.has(t.id));
      if (!bt.length) continue;
      const g = buildGraph(bt);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const t of bt) {
        const p = g.node(t.id), m = meta.get(t.id)!;
        minX = Math.min(minX, p.x - NODE_W / 2); maxX = Math.max(maxX, p.x + NODE_W / 2);
        minY = Math.min(minY, p.y - m.h / 2); maxY = Math.max(maxY, p.y + m.h / 2);
      }
      const offX = -minX;            // left-align every base band to x ≈ 0
      const offY = cursorY - minY;   // place this base's content top at cursorY
      for (const t of bt) { const p = g.node(t.id); pos.set(t.id, { x: p.x + offX, y: p.y + offY }); }
      const wBand = maxX - minX, hBand = maxY - minY;
      groupNodes.push({
        id: `grp-${bid}`, type: 'baseGroup', draggable: false, selectable: false, zIndex: -1,
        position: { x: -PAD, y: cursorY - PAD - LABEL },
        data: { name: bs?.find((b) => b.id === bid)?.name ?? bid, w: wBand + PAD * 2, h: hBand + PAD * 2 + LABEL },
      });
      cursorY += hBand + PAD * 2 + LABEL + GROUP_GAP; // next base clears this box + a visible gap
    }
  }

  const nodes: Node<TableNodeData>[] = tables.map((t) => {
    const m = meta.get(t.id)!;
    const p = pos.get(t.id) ?? { x: 0, y: 0 };
    return {
      id: t.id,
      type: 'table',
      position: { x: p.x - NODE_W / 2, y: p.y - m.h / 2 },
      data: { table: t, rows: m.rows, hiddenCount: m.hidden },
    };
  });

  return { nodes: [...groupNodes, ...nodes], edges };
}

// Relationships mode layout — table-level nodes + typed relationship edges from the
// curated SchemaRelationship[]. Only relationships whose BOTH endpoints resolve to a
// visible table are drawn; self-relationships (same table) are skipped so the graph
// reads as a clean cross-table web. dagre LR, same as the ER view.
function relLayout(
  tables: SchemaTable[],
  relationships: SchemaRelationship[],
  opts?: { hiddenRelTypes?: Set<string> },
): { nodes: Node[]; edges: Edge[] } {
  const tableIds = new Set(tables.map((t) => t.id));
  const fieldToTable = new Map<string, string>();
  tables.forEach((t) => t.fields.forEach((f) => fieldToTable.set(f.id, t.id)));
  const resolve = (e: RelEndpoint): string | undefined =>
    e.kind === 'table' ? (tableIds.has(e.id) ? e.id : undefined) : fieldToTable.get(e.id);
  const hidden = opts?.hiddenRelTypes;

  const edges: Edge[] = [];
  const participants = new Set<string>();
  for (const r of relationships) {
    if (hidden && hidden.has(r.type)) continue;
    const s = resolve(r.a), t = resolve(r.b);
    if (!s || !t || s === t) continue; // need two distinct visible tables
    participants.add(s); participants.add(t);
    const meta = REL_TYPE_META[r.type];
    const invalid = r.validity === 'invalid';
    const marker = { type: 'arrowclosed' as any, color: meta.color, width: 13, height: 13 };
    edges.push({
      id: r.id,
      source: s, target: t, sourceHandle: 'out', targetHandle: 'in',
      type: 'smoothstep',
      interactionWidth: 24, // fat invisible hit-path so the thin line is easy to hover/click
      label: r.cardinality || undefined,
      labelStyle: { fontSize: 10, fontWeight: 600, fill: 'var(--color-base-content)' },
      labelBgStyle: { fill: 'var(--color-base-100)', fillOpacity: 0.85 },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      style: { stroke: meta.color, strokeOpacity: invalid ? 0.22 : r.inferred ? 0.5 : 0.72, strokeWidth: 1.5, strokeDasharray: meta.dashed || r.inferred ? '5 4' : undefined },
      markerEnd: marker,
      ...(r.direction === 'two' ? { markerStart: marker } : {}),
      data: { relType: r.type },
    });
  }

  const nodeTables = tables.filter((t) => participants.has(t.id));
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 120, marginx: 24, marginy: 24 });
  nodeTables.forEach((t) => g.setNode(t.id, { width: REL_NODE_W, height: REL_NODE_H }));
  for (const e of edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);

  const nodes: Node<RelNodeData>[] = nodeTables.map((t) => {
    const p = g.node(t.id);
    return { id: t.id, type: 'relTable', position: { x: p.x - REL_NODE_W / 2, y: p.y - REL_NODE_H / 2 }, data: { table: t } };
  });
  return { nodes, edges };
}

// App-layer mode layout — automations / interfaces / pages over the table (and, when
// expanded, field) substrate. dagre LR: app entities flow left → the data they touch on the
// right. Edges: references (automation→table/field), reads (page→table/field), triggers
// (page/interface→automation), and a faint structural contains (interface→page). Fields are
// collapsed under their table by default (edge docks to the table, field name on the label);
// with `expandFields`, referenced fields become nodes docked under their table.
function appLayout(
  tables: SchemaTable[],
  automations: AppAutomation[],
  interfaces: AppInterface[],
  opts?: { hiddenKinds?: Set<string>; hiddenBases?: Set<string>; includeRemoved?: boolean; expandFields?: boolean },
): { nodes: Node[]; edges: Edge[] } {
  const hiddenKinds = opts?.hiddenKinds ?? new Set<string>();
  const hiddenBases = opts?.hiddenBases ?? new Set<string>();
  const includeRemoved = !!opts?.includeRemoved;
  const expandFields = !!opts?.expandFields;

  const tableById = new Map(tables.map((t) => [t.id, t]));
  const fieldById = new Map<string, SchemaField>();
  const fieldToTable = new Map<string, string>();
  tables.forEach((t) => t.fields.forEach((f) => { fieldById.set(f.id, f); fieldToTable.set(f.id, t.id); }));
  const baseOf = (t?: SchemaTable) => t?.baseId;
  const tableVisible = (tid: string) => { const t = tableById.get(tid); return !!t && !(baseOf(t) && hiddenBases.has(baseOf(t)!)); };
  // Resolve a tag's entityId → { tableId, fieldId? }. Tag may point at a table or a field.
  const resolveTag = (entityId: string): { tableId: string; fieldId?: string } | null => {
    if (tableById.has(entityId)) return { tableId: entityId };
    const tid = fieldToTable.get(entityId);
    return tid ? { tableId: tid, fieldId: entityId } : null;
  };

  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: 'LR', nodesep: 30, ranksep: 96, marginx: 24, marginy: 24 });

  const nodeDefs = new Map<string, Node>();
  const usedTables = new Set<string>();
  const usedFields = new Set<string>();
  const edges: Edge[] = [];
  const addEdge = (id: string, source: string, target: string, kind: AppEdgeKind, label?: string) => {
    const m = APP_EDGE_META[kind];
    const marker = { type: 'arrowclosed' as any, color: m.color, width: 13, height: 13 };
    edges.push({
      id, source, target, sourceHandle: 'out', targetHandle: 'in', type: 'smoothstep',
      interactionWidth: 20,
      label, labelStyle: { fontSize: 9.5, fontWeight: 600, fill: 'var(--color-base-content)' },
      labelBgStyle: { fill: 'var(--color-base-100)', fillOpacity: 0.85 }, labelBgPadding: [4, 2] as [number, number], labelBgBorderRadius: 4,
      animated: kind === 'triggers',
      style: { stroke: m.color, strokeOpacity: kind === 'contains' ? 0.3 : 0.72, strokeWidth: 1.5, strokeDasharray: m.dashed ? '5 4' : undefined },
      markerEnd: kind === 'contains' ? undefined : marker,
      data: { appKind: kind },
    });
  };

  // Register a data node (table, or field when expanded) on demand + return the handle target.
  const ensureTableNode = (tid: string) => {
    if (nodeDefs.has(tid) || !tableVisible(tid)) return tableVisible(tid);
    const t = tableById.get(tid)!;
    usedTables.add(tid);
    nodeDefs.set(tid, { id: tid, type: 'relTable', position: { x: 0, y: 0 }, data: { table: t } as any });
    g.setNode(tid, { width: REL_NODE_W, height: REL_NODE_H });
    return true;
  };
  const fieldNodeId = (fid: string) => `fld:${fid}`;
  const ensureFieldNode = (fid: string, tid: string) => {
    const nid = fieldNodeId(fid);
    if (nodeDefs.has(nid)) return nid;
    const f = fieldById.get(fid); if (!f) return null;
    usedFields.add(fid);
    nodeDefs.set(nid, { id: nid, type: 'appField', position: { x: 0, y: 0 }, data: { name: f.name, fieldType: f.type, removed: f.removed } as any });
    g.setNode(nid, { width: APP_FIELD_W, height: APP_FIELD_H });
    // faint containment so the field sits beside its table
    ensureTableNode(tid);
    addEdge(`${tid}~${nid}`, tid, nid, 'contains');
    return nid;
  };

  // The data target for a tag: a field node (expanded) or its table node (collapsed).
  const dataTarget = (entityId: string): { id: string; label?: string } | null => {
    const r = resolveTag(entityId);
    if (!r || !tableVisible(r.tableId)) return null;
    if (r.fieldId && expandFields) { const nid = ensureFieldNode(r.fieldId, r.tableId); return nid ? { id: nid } : null; }
    ensureTableNode(r.tableId);
    return { id: r.tableId, label: r.fieldId ? fieldById.get(r.fieldId)?.name : undefined };
  };
  // Emit one edge per unique (source → data-node) — a field tag plus its own table tag both
  // collapse to the same table node, so aggregate: single field → its name; several → "N fields".
  const emitDataEdges = (sourceId: string, tags: AppTag[], kind: AppEdgeKind) => {
    const byTarget = new Map<string, Set<string>>();
    for (const tag of tags) {
      const tgt = dataTarget(tag.entityId);
      if (!tgt) continue;
      const labels = byTarget.get(tgt.id) ?? byTarget.set(tgt.id, new Set()).get(tgt.id)!;
      if (tgt.label) labels.add(tgt.label);
    }
    for (const [targetId, labels] of byTarget) {
      const label = labels.size === 1 ? [...labels][0] : labels.size > 1 ? `${labels.size} fields` : undefined;
      addEdge(`${sourceId}~>${targetId}`, sourceId, targetId, kind, label);
    }
  };

  const autoActive = automations.filter((a) => includeRemoved || a.status !== 'removed');
  const ifActive = interfaces.filter((i) => includeRemoved || i.status !== 'removed');
  const autoById = new Map(autoActive.map((a) => [a.id, a]));

  // Automation nodes + `references` edges.
  if (!hiddenKinds.has('automation')) {
    for (const a of autoActive) {
      nodeDefs.set(a.id, { id: a.id, type: 'appEntity', position: { x: 0, y: 0 }, data: { kind: 'automation', name: a.name, caption: a.triggerType, removed: a.status === 'removed' } as any });
      g.setNode(a.id, { width: APP_ENT_W, height: APP_ENT_H });
      emitDataEdges(a.id, a.tags || [], 'references');
    }
  }
  // Interface + page nodes; contains (interface→page), reads (page→table/field), triggers.
  const showIf = !hiddenKinds.has('interface');
  const showPage = !hiddenKinds.has('page');
  for (const i of ifActive) {
    const isPage = i.type === 'page';
    if (isPage ? !showPage : !showIf) continue;
    nodeDefs.set(i.id, { id: i.id, type: 'appEntity', position: { x: 0, y: 0 }, data: { kind: isPage ? 'page' : 'interface', name: i.name, removed: i.status === 'removed' } as any });
    g.setNode(i.id, { width: APP_ENT_W, height: APP_ENT_H });
  }
  for (const i of ifActive) {
    if (i.type === 'page' && i.parentId && showPage && showIf && nodeDefs.has(i.parentId)) addEdge(`${i.parentId}~${i.id}`, i.parentId, i.id, 'contains');
    // reads — pages (and interfaces without pages) point at the data they show
    if ((i.type === 'page' ? showPage : showIf) && nodeDefs.has(i.id)) {
      emitDataEdges(i.id, i.tags || [], 'reads');
      // triggers — captured page/interface → automation links
      for (const autoId of i.triggers || []) {
        if (autoById.has(autoId) && !hiddenKinds.has('automation') && nodeDefs.has(autoId)) addEdge(`${i.id}!>${autoId}`, i.id, autoId, 'triggers', 'triggers');
      }
    }
  }

  // Feed edges to dagre (only where both endpoints are real nodes), then position.
  for (const e of edges) if (g.hasNode(e.source) && g.hasNode(e.target)) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const nodes: Node[] = [];
  for (const [id, def] of nodeDefs) {
    const p = g.node(id);
    if (!p) { nodes.push(def); continue; }
    const w = (def.type === 'appField') ? APP_FIELD_W : def.type === 'relTable' ? REL_NODE_W : APP_ENT_W;
    const h = (def.type === 'appField') ? APP_FIELD_H : def.type === 'relTable' ? REL_NODE_H : APP_ENT_H;
    nodes.push({ ...def, position: { x: p.x - w / 2, y: p.y - h / 2 } });
  }
  // Keep only edges whose endpoints both rendered.
  const present = new Set(nodes.map((n) => n.id));
  const liveEdges = edges.filter((e) => present.has(e.source) && present.has(e.target));
  return { nodes, edges: liveEdges };
}

function Canvas({ tables, bases, baseHealth, spaceId, genState = 'ready', embed = false, relationships = EMPTY_REL, automations = EMPTY_AUTO, interfaces = EMPTY_IF }: Props) {
  const initial = useMemo(() => layout(tables, { bases }), [tables, bases]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initial.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initial.edges);
  const rf = useReactFlow();

  // Display filter — a layers menu (NOT a single-select): show/hide bases, tables, field
  // types, and the relationship edges. Replaces the old base dropdown (founder request).
  const baseList = useMemo(() => {
    if (bases && bases.length) return bases;
    const ids = new Set<string>();
    tables.forEach((t) => t.baseId && ids.add(t.baseId));
    return Array.from(ids, (id) => ({ id, name: id }));
  }, [bases, tables]);
  const multiBase = baseList.length > 1;
  const typeList = useMemo(() => {
    const set = new Set<string>();
    tables.forEach((t) => t.fields.forEach((f) => set.add(f.type)));
    return Array.from(set).sort();
  }, [tables]);

  const [hiddenBases, setHiddenBases] = useState<Set<string>>(() => new Set());
  const [hiddenTables, setHiddenTables] = useState<Set<string>>(() => new Set());
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(() => new Set());
  const [hiddenFields, setHiddenFields] = useState<Set<string>>(() => new Set());
  const [hiddenRel, setHiddenRel] = useState<Set<RelKind>>(() => new Set());
  // Visualize sub-mode (Dan 2026-07-01 / Q8): Data ER diagram (default), the Relationships
  // graph, and the Automations & Interfaces (app-layer) graph (Epic 4).
  const [mode, setMode] = useState<'data' | 'relationships' | 'appLayer'>('data');
  const [hiddenRelTypes, setHiddenRelTypes] = useState<Set<string>>(() => new Set());
  // App-layer mode filters: which node kinds are hidden, whether removed entities show, and
  // whether referenced fields expand into their own nodes (collapsed under the table by default).
  const [hiddenAppKinds, setHiddenAppKinds] = useState<Set<string>>(() => new Set());
  const [includeRemovedApp, setIncludeRemovedApp] = useState(false);
  const [expandFields, setExpandFields] = useState(false);
  const hasApp = automations.length > 0 || interfaces.length > 0;
  const appRemovedCount = useMemo(
    () => automations.filter((a) => a.status === 'removed').length + interfaces.filter((i) => i.status === 'removed').length,
    [automations, interfaces],
  );
  const resetFilters = () => { setHiddenBases(new Set()); setHiddenTables(new Set()); setHiddenTypes(new Set()); setHiddenFields(new Set()); setHiddenRel(new Set()); setHiddenRelTypes(new Set()); setHiddenAppKinds(new Set()); };

  // Relationships mode: lazy-fetch the live per-base feed once, on first switch.
  // The engine route is per-base (baseId required), so fan out over the live bases
  // and adapt each payload to the canvas's SchemaRelationship shape.
  const [fetchedRels, setFetchedRels] = useState<SchemaRelationship[] | null>(null);
  const [relsLoading, setRelsLoading] = useState(false);
  const [relsError, setRelsError] = useState(false);
  const liveRels = relationships.length > 0 ? relationships : (fetchedRels ?? EMPTY_REL);
  useEffect(() => {
    if (mode !== 'relationships' || !spaceId || relationships.length > 0) return;
    if (fetchedRels || relsLoading || relsError) return; // once; no retry loop on failure
    let cancelled = false;
    setRelsLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          baseList.map(async (b) => {
            const res = await fetch(`/api/spaces/${spaceId}/relationships?baseId=${encodeURIComponent(b.id)}`);
            if (!res.ok) throw new Error(String(res.status));
            const data = (await res.json()) as { derived: EngineDerived[]; syncedViews: EngineSynced[] };
            return adaptEngineRelationships(b.id, b.name, data);
          }),
        );
        if (!cancelled) setFetchedRels(results.flat());
      } catch {
        if (!cancelled) setRelsError(true);
      } finally {
        if (!cancelled) setRelsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [mode, spaceId, relationships, fetchedRels, relsLoading, relsError, baseList]);

  // Facet item lists for the toolbar dropdowns.
  const baseItems = useMemo<FacetItem[]>(
    () => baseList.map((b) => { const h = baseHealth?.[b.id]; return { id: b.id, label: b.name, dot: h ? HEALTH[h] : undefined }; }),
    [baseList, baseHealth],
  );
  const tableGroups = useMemo(() => {
    const mk = (t: SchemaTable): FacetItem => ({ id: t.id, label: t.name, dot: t.health ? HEALTH[t.health] : undefined });
    if (!multiBase) return [{ items: tables.map(mk) }];
    const groups = baseList
      .map((b) => ({ label: b.name, items: tables.filter((t) => t.baseId === b.id).map(mk) }))
      .filter((g) => g.items.length);
    const orphan = tables.filter((t) => !t.baseId);
    if (orphan.length) groups.push({ label: 'Other', items: orphan.map(mk) });
    return groups;
  }, [tables, baseList, multiBase]);
  const typeItems = useMemo<FacetItem[]>(
    () => typeList.map((ty) => ({ id: ty, label: typeLabel(ty), icon: <span style={{ width: 13, height: 13, display: 'grid', placeItems: 'center', opacity: 0.7 }}><AirtableFieldIcon type={ty} /></span> })),
    [typeList],
  );

  const toggleSet = <T extends string>(set: Dispatch<SetStateAction<Set<T>>>) => (id: string) =>
    set((s) => { const n = new Set(s); if (n.has(id as T)) n.delete(id as T); else n.add(id as T); return n; });
  const toggleBase = useCallback(toggleSet(setHiddenBases), []);
  const toggleTable = useCallback(toggleSet(setHiddenTables), []);
  const toggleType = useCallback(toggleSet(setHiddenTypes), []);
  const toggleRel = useCallback(toggleSet(setHiddenRel), []);
  const toggleRelType = useCallback(toggleSet(setHiddenRelTypes), []);
  const toggleAppKind = useCallback(toggleSet(setHiddenAppKinds), []);
  const setAllBases = (hide: boolean) => setHiddenBases(hide ? new Set(baseList.map((b) => b.id)) : new Set());
  const setAllTables = (hide: boolean) => setHiddenTables(hide ? new Set(tables.map((t) => t.id)) : new Set());
  const setAllTypes = (hide: boolean) => setHiddenTypes(hide ? new Set(typeList) : new Set());
  const setAllRel = (hide: boolean) => setHiddenRel(hide ? new Set(REL_KINDS) : new Set());
  const setAllRelTypes = (hide: boolean) => setHiddenRelTypes(hide ? new Set(REL_TYPES) : new Set());
  // App-layer node-kind facet covers the app entities (automation/interface/page) — tables/fields
  // are the substrate, governed by the Bases facet + the Expand-fields toggle.
  const APP_KIND_FACET: AppNodeKind[] = ['automation', 'interface', 'page'];
  const setAllAppKinds = (hide: boolean) => setHiddenAppKinds(hide ? new Set(APP_KIND_FACET) : new Set());
  const appKindItems = useMemo<FacetItem[]>(
    () => APP_KIND_FACET.map((k) => ({ id: k, label: APP_NODE_META[k].label, dot: APP_NODE_META[k].color })),
    [],
  );
  const filterCount = mode === 'data'
    ? hiddenBases.size + hiddenTables.size + hiddenTypes.size + hiddenFields.size + hiddenRel.size
    : mode === 'relationships'
    ? hiddenBases.size + hiddenTables.size + hiddenRelTypes.size
    : hiddenBases.size + hiddenAppKinds.size;
  const relTypeItems = useMemo<FacetItem[]>(
    () => REL_TYPES.map((rt) => ({ id: rt, label: REL_TYPE_META[rt].label, dot: REL_TYPE_META[rt].color })),
    [],
  );

  const visibleTables = useMemo(
    () => tables.filter((t) => !(t.baseId && hiddenBases.has(t.baseId)) && !hiddenTables.has(t.id)),
    [tables, hiddenBases, hiddenTables],
  );

  // Re-layout on any filter change. Only re-fit when the visible-table SET changes (base /
  // table toggles); field-type / relationship toggles keep the current viewport.
  const didMount = useRef(false);
  const prevVis = useRef(visibleTables);
  const prevMode = useRef(mode);
  useEffect(() => {
    if (!didMount.current) { didMount.current = true; prevVis.current = visibleTables; return; }
    const l = mode === 'relationships'
      ? relLayout(visibleTables, liveRels, { hiddenRelTypes })
      : mode === 'appLayer'
      ? appLayout(visibleTables, automations, interfaces, { hiddenKinds: hiddenAppKinds, includeRemoved: includeRemovedApp, expandFields })
      : layout(visibleTables, { hiddenTypes, hiddenFields, hiddenRel, bases });
    setNodes(l.nodes);
    setEdges(l.edges);
    // Re-fit when the visible SET changes (base/table toggles) or the mode switches.
    if (prevVis.current !== visibleTables || prevMode.current !== mode) {
      setSelectedId(null);
      setSelectedEdgeId(null);
      setHoveredEdgeId(null);
      setEdgeTip(null);
      requestAnimationFrame(() => rf.fitView({ padding: 0.2, duration: 450 }));
    }
    prevVis.current = visibleTables;
    prevMode.current = mode;
  }, [visibleTables, hiddenTypes, hiddenFields, hiddenRel, hiddenRelTypes, hiddenAppKinds, includeRemovedApp, expandFields, mode, liveRels, automations, interfaces, setNodes, setEdges, rf]);

  // "Open in Visualize" from a doc diagram switches to this tab and fires this event to scope
  // the canvas to that diagram's tables (so context is preserved). Embedded diagrams ignore it.
  useEffect(() => {
    if (embed) return;
    const onScope = (ev: Event) => {
      const ids = new Set(((ev as CustomEvent).detail?.tableIds as string[]) || []);
      if (!ids.size) return;
      setHiddenBases(new Set());
      setHiddenTypes(new Set());
      setHiddenRel(new Set());
      setHiddenTables(new Set(tables.filter((t) => !ids.has(t.id)).map((t) => t.id)));
    };
    document.addEventListener('schema:visualizeScope', onScope);
    return () => document.removeEventListener('schema:visualizeScope', onScope);
  }, [embed, tables]);

  // Embedded diagrams (Docs) mount while their tab/panel is hidden (0×0), so the initial
  // fitView runs against an empty box. Re-fit once the container gains real width.
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!embed || !wrapRef.current) return;
    const el = wrapRef.current;
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      if (w > 0 && Math.abs(w - lastW) > 4) { lastW = w; requestAnimationFrame(() => rf.fitView({ padding: 0.18 })); }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [embed, rf]);

  // Follow the app's theme (data-theme), not the OS — our dark theme is set by
  // attribute, not prefers-color-scheme. (The chrome is also re-themed via CSS
  // tokens in SchemaView, which covers runtime theme toggles.)
  const colorMode: 'light' | 'dark' =
    typeof document !== 'undefined' && (document.documentElement.getAttribute('data-theme') || '').includes('light')
      ? 'light'
      : 'dark';

  const minimapColor = useCallback(
    (n: Node) => {
      if (n.type === 'baseGroup') return 'transparent';
      const h = (n.data as TableNodeData)?.table?.health;
      return h ? HEALTH[h] : 'var(--color-base-300)';
    },
    [],
  );

  // Click a table → open its side panel + focus its relationships (dim the rest).
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => tables.find((t) => t.id === selectedId) ?? null, [tables, selectedId]);
  // A10 — a node click opens the SAME full Browse panel (schema:openEntity), not a separate
  // light side panel. setSelectedId still drives focus-mode dimming. (Embedded Docs diagrams
  // stay read-only: they dim on click but don't open the page-level panel.)
  // Open an app-layer entity's detail: the read drawers live inside the (hidden) Automations/
  // Interfaces panels, so switch to that tab first (the same handoff EntityPanel's "Referenced
  // by" jump uses), then fire the open event.
  const openAppEntity = useCallback((kind: 'automation' | 'interface' | 'page', id: string) => {
    if (typeof document === 'undefined') return;
    const tab = kind === 'automation' ? 'automations' : 'interfaces';
    const ev = kind === 'automation' ? 'schema:openAutomation' : 'schema:openInterface';
    document.querySelector<HTMLElement>(`[data-tab="${tab}"]`)?.click();
    document.dispatchEvent(new CustomEvent(ev, { detail: { id } }));
  }, []);
  const onNodeClick: NodeMouseHandler = useCallback((_, node) => {
    setSelectedId(node.id);
    setSelectedEdgeId(null);
    if (embed || typeof document === 'undefined') return;
    // App-layer entity nodes hand off to their tab; the table/field substrate opens the
    // shared EntityPanel (`schema:openEntity` — same event SchemaBrowse uses).
    if (node.type === 'appEntity') { openAppEntity((node.data as AppEntityData)?.kind, node.id); return; }
    const isField = node.id.startsWith('fld:');
    const id = isField ? node.id.slice(4) : node.id;
    document.dispatchEvent(new CustomEvent('schema:openEntity', { detail: { id } }));
  }, [embed, openAppEntity]);
  const onPaneClick = useCallback(() => { setSelectedId(null); setSelectedEdgeId(null); setEdgeTip(null); }, []);

  // Relationships-mode edge inspection (research: Power BI / React Flow): hover = highlight
  // the edge + its two nodes + a midpoint tooltip; click = open the SAME shared relationship
  // detail the Relationships table uses (via schema:openRelationship). Only rel-mode edges
  // (whose id is a relationship id) are interactive — the guard `relById.has(edge.id)` scopes it.
  const relById = useMemo(() => new Map(liveRels.map((r) => [r.id, r])), [liveRels]);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [edgeTip, setEdgeTip] = useState<{ id: string; x: number; y: number } | null>(null);
  // An app-layer edge is interactive when it's one of the three real kinds (skip the faint
  // structural `contains` connector — nesting isn't a "connection" worth a tooltip).
  const appEdgeKindOf = (edge: Edge): AppEdgeKind | null => {
    const k = (edge.data as { appKind?: AppEdgeKind } | undefined)?.appKind;
    return k && k !== 'contains' ? k : null;
  };
  const isInspectableEdge = useCallback((edge: Edge) => relById.has(edge.id) || appEdgeKindOf(edge) != null, [relById]);
  const onEdgeMouseEnter: EdgeMouseHandler = useCallback((ev, edge) => {
    if (!isInspectableEdge(edge)) return;
    setHoveredEdgeId(edge.id);
    setEdgeTip({ id: edge.id, x: ev.clientX, y: ev.clientY });
  }, [isInspectableEdge]);
  const onEdgeMouseMove: EdgeMouseHandler = useCallback((ev, edge) => {
    if (!isInspectableEdge(edge)) return;
    setEdgeTip({ id: edge.id, x: ev.clientX, y: ev.clientY });
  }, [isInspectableEdge]);
  const onEdgeMouseLeave = useCallback(() => { setHoveredEdgeId(null); setEdgeTip(null); }, []);
  const onEdgeClick: EdgeMouseHandler = useCallback((_, edge) => {
    if (typeof document === 'undefined') return;
    // Relationships-mode edge → the shared relationship detail. App-layer edge → its SOURCE app
    // entity (the automation / page the connection belongs to).
    if (relById.has(edge.id)) {
      setSelectedEdgeId(edge.id);
      setSelectedId(null);
      document.dispatchEvent(new CustomEvent('schema:openRelationship', { detail: { id: edge.id } }));
      return;
    }
    if (appEdgeKindOf(edge)) {
      setSelectedEdgeId(edge.id);
      setSelectedId(null);
      const src = nodes.find((n) => n.id === edge.source);
      if (src?.type === 'appEntity') openAppEntity((src.data as AppEntityData)?.kind, src.id);
    }
  }, [relById, nodes, openAppEntity]);
  // Look-ups for the edge tooltip: the edge object + a node-id → display-name map.
  const edgeById = useMemo(() => new Map(edges.map((e) => [e.id, e])), [edges]);
  const nodeNameById = useMemo(() => {
    const m = new Map<string, string>();
    nodes.forEach((n) => { const d = n.data as any; m.set(n.id, d?.name ?? d?.table?.name ?? n.id); });
    return m;
  }, [nodes]);

  // Focus-mode: the selected node + its direct neighbours stay lit; the rest dim,
  // and the edges touching the selection light up (primary, animated). Large schemas
  // become legible — you see exactly what THIS table relates to.
  const focusSet = useMemo(() => {
    if (!selectedId) return null;
    const s = new Set<string>([selectedId]);
    edges.forEach((e) => {
      if (e.source === selectedId) s.add(e.target);
      if (e.target === selectedId) s.add(e.source);
    });
    return s;
  }, [selectedId, edges]);

  // A hovered/selected edge (relationships mode) takes visual priority: light it + its two
  // endpoint nodes, dim the rest.
  const edgeFocusId = hoveredEdgeId ?? selectedEdgeId;
  const edgeFocus = useMemo(() => {
    if (!edgeFocusId) return null;
    const e = edges.find((x) => x.id === edgeFocusId);
    return e ? { id: e.id, source: e.source as string, target: e.target as string } : null;
  }, [edgeFocusId, edges]);

  const displayNodes = useMemo(() => {
    if (edgeFocus) {
      const lit = new Set([edgeFocus.source, edgeFocus.target]);
      return nodes.map((n) => ({
        ...n,
        style: { ...n.style, opacity: n.type === 'baseGroup' || lit.has(n.id) ? 1 : 0.16, transition: 'opacity .2s ease' },
      }));
    }
    if (!focusSet) return nodes;
    return nodes.map((n) => ({
      ...n,
      style: { ...n.style, opacity: focusSet.has(n.id) ? 1 : 0.16, transition: 'opacity .2s ease' },
    }));
  }, [nodes, focusSet, edgeFocus]);

  const displayEdges = useMemo<Edge[]>(() => {
    if (edgeFocus) {
      return edges.map((e): Edge => {
        const on = e.id === edgeFocus.id;
        return {
          ...e,
          style: { ...e.style, strokeOpacity: on ? 1 : 0.08, strokeWidth: on ? 2.5 : ((e.style?.strokeWidth as number) ?? 1.5) },
        };
      });
    }
    if (!focusSet) return edges;
    return edges.map((e): Edge => {
      const on = e.source === selectedId || e.target === selectedId;
      return {
        ...e,
        animated: on,
        style: { ...e.style, stroke: on ? 'var(--color-primary)' : (e.style?.stroke as string), strokeOpacity: on ? 1 : 0.06, strokeWidth: on ? 2 : 1.5 },
        markerEnd: on ? { ...(e.markerEnd as Record<string, unknown>), color: 'var(--color-primary)' } : e.markerEnd,
      } as Edge;
    });
  }, [edges, focusSet, selectedId, edgeFocus]);

  // Search-jump: find a table by name → centre + select it (handy past ~10 tables).
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as SchemaTable[];
    return tables.filter((t) => t.name.toLowerCase().includes(q)).slice(0, 8);
  }, [query, tables]);
  const jumpTo = useCallback(
    (id: string) => {
      setSelectedId(id);
      setQuery('');
      rf.fitView({ nodes: [{ id }], duration: 650, maxZoom: 1.3, padding: 0.5 });
    },
    [rf],
  );

  // Legend columns per mode — the same colour language the nodes/edges use, so every Visualize
  // mode carries a matching key (Oleh liked the app-layer one; extend it to Data + Relationships).
  // Health legend only when any visible table actually carries a grade (the
  // engine schema payload has none yet — a Health/Visualize integration follow-up).
  const hasHealth = useMemo(() => visibleTables.some((t) => t.health), [visibleTables]);
  const legendCols = useMemo<LegendCol[] | null>(() => {
    if (mode === 'data') {
      return [
        ...(hasHealth ? [{ title: 'Health', items: HEALTH_LEGEND }] : []),
        { title: 'Relationships', items: REL_KINDS.map((k) => ({ label: RELATION[k].label, kind: 'line', color: RELATION[k].color, dashed: RELATION[k].dashed })) },
      ];
    }
    if (mode === 'relationships') {
      return [
        ...(hasHealth ? [{ title: 'Health', items: HEALTH_LEGEND }] : []),
        { title: 'Relationship types', items: REL_TYPES.map((rt) => ({ label: REL_TYPE_META[rt].label, kind: 'line', color: REL_TYPE_META[rt].color, dashed: REL_TYPE_META[rt].dashed })) },
      ];
    }
    return [
      { title: 'Nodes', items: (['automation', 'interface', 'page', 'table'] as AppNodeKind[]).map((k) => ({ label: APP_NODE_META[k].label, kind: 'dot', color: APP_NODE_META[k].color })) },
      { title: 'Edges', items: APP_EDGE_KINDS.map((k) => ({ label: APP_EDGE_META[k].label, kind: 'line', color: APP_EDGE_META[k].color, dashed: APP_EDGE_META[k].dashed })) },
    ];
  }, [mode, hasHealth]);
  // Only show the legend when the current mode actually has something drawn.
  const showLegend = !embed && (mode === 'data' ? visibleTables.length > 0 : mode === 'relationships' ? liveRels.length > 0 : hasApp);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      {/* Toolbar — the shared .sch-tb pattern: search │ faceted Display filters … → mode switch. */}
      {!embed && (
      <div className="sch-tb" style={{ padding: '8px 12px', borderBottom: '1px solid var(--color-base-200)' }}>
        <div className="sch-tb-search" style={{ position: 'relative' }}>
          <label className="input input-sm w-full">
            <span aria-hidden style={{ width: 14, height: 14, display: 'grid', placeItems: 'center', opacity: 0.5 }}><SearchGlyph /></span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a table…" aria-label="Find a table"
              onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) jumpTo(matches[0].id); if (e.key === 'Escape') setQuery(''); }} />
          </label>
          {matches.length > 0 && (
            <ul className="menu menu-sm bg-base-100 rounded-box border border-base-300 shadow-lg" style={{ position: 'absolute', zIndex: 20, left: 0, marginTop: 4, padding: 4, width: '100%', maxHeight: 264, overflowY: 'auto', flexWrap: 'nowrap' }}>
              {matches.map((t) => (
                <li key={t.id}>
                  <a onClick={() => jumpTo(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {t.health && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, flex: 'none', background: HEALTH[t.health] }} />}
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                    <span className="mono-data" style={{ fontSize: 10.5, opacity: 0.5 }}>{t.fieldCount}f</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
        <span className="sch-tb-div" aria-hidden />

        {multiBase && <FacetDropdown label="Bases" groups={[{ items: baseItems }]} hidden={hiddenBases} onToggle={toggleBase} onAll={setAllBases} />}
        {mode !== 'appLayer' && <FacetDropdown label="Tables" groups={tableGroups} hidden={hiddenTables} onToggle={toggleTable} onAll={setAllTables} />}
        {mode === 'data' && (
          <>
            <FacetDropdown label="Field types" groups={[{ items: typeItems }]} hidden={hiddenTypes} onToggle={toggleType} onAll={setAllTypes} />
            <FieldsFilter bases={baseList} tables={tables} hidden={hiddenFields} onChange={setHiddenFields} />
            <FacetDropdown label="Relationships" groups={[{ items: REL_KINDS.map((k) => ({ id: k, label: RELATION[k].label, dot: RELATION[k].color })) }]} hidden={hiddenRel} onToggle={toggleRel} onAll={setAllRel} />
          </>
        )}
        {mode === 'relationships' && (
          <FacetDropdown label="Relationship types" groups={[{ items: relTypeItems }]} hidden={hiddenRelTypes} onToggle={toggleRelType} onAll={setAllRelTypes} />
        )}
        {mode === 'appLayer' && (
          <>
            <FacetDropdown label="Node types" groups={[{ items: appKindItems }]} hidden={hiddenAppKinds} onToggle={toggleAppKind} onAll={setAllAppKinds} />
            <label className="btn btn-sm gap-1.5" style={{ background: expandFields ? 'color-mix(in oklch, var(--color-primary) 13%, transparent)' : 'var(--color-base-100)', borderColor: expandFields ? 'color-mix(in oklch, var(--color-primary) 35%, transparent)' : 'var(--color-base-300)', color: expandFields ? 'var(--color-primary)' : undefined, boxShadow: 'none', fontWeight: 400 }}>
              <input type="checkbox" className="sr-only" checked={expandFields} onChange={(e) => setExpandFields(e.target.checked)} />
              <span aria-hidden className="iconify lucide--list-tree size-4" />Expand fields
            </label>
            {appRemovedCount > 0 && (
              <label className="btn btn-sm gap-1.5" style={{ background: includeRemovedApp ? 'color-mix(in oklch, var(--color-primary) 13%, transparent)' : 'var(--color-base-100)', borderColor: includeRemovedApp ? 'color-mix(in oklch, var(--color-primary) 35%, transparent)' : 'var(--color-base-300)', color: includeRemovedApp ? 'var(--color-primary)' : undefined, boxShadow: 'none', fontWeight: 400 }}>
                <input type="checkbox" className="sr-only" checked={includeRemovedApp} onChange={(e) => setIncludeRemovedApp(e.target.checked)} />
                <span aria-hidden className="iconify lucide--history size-4" />Include removed <span className="mono-data" style={{ opacity: 0.6 }}>{appRemovedCount}</span>
              </label>
            )}
          </>
        )}
        {filterCount > 0 && (
          <button type="button" className="btn btn-sm btn-ghost text-error gap-1" onClick={resetFilters}>
            <span aria-hidden style={{ width: 13, height: 13, display: 'grid', placeItems: 'center' }}><XGlyph /></span>
            Clear
          </button>
        )}

        {/* Right cluster — the view-mode switch (right corner, like the Relationships Tree/Flat
            toggle) + tab-specific actions (Add to doc + Export). */}
        <div className="sch-tb-right">
        {/* Mode switch — Data ER diagram vs the Relationships graph (Automations & Interfaces later).
            Reuses the Relationships tab's .rl-modes segmented style (subtle, not filled-primary). */}
        <div className="join rl-modes" role="tablist" aria-label="Visualize mode">
          <button type="button" role="tab" aria-selected={mode === 'data'} className={`btn btn-sm join-item ${mode === 'data' ? 'rl-mode-active' : ''}`} onClick={() => setMode('data')}>
            <span className="iconify lucide--workflow size-4" aria-hidden="true" />Data
          </button>
          <button type="button" role="tab" aria-selected={mode === 'relationships'} className={`btn btn-sm join-item ${mode === 'relationships' ? 'rl-mode-active' : ''}`} onClick={() => setMode('relationships')}>
            <span className="iconify lucide--waypoints size-4" aria-hidden="true" />Relationships
          </button>
          <button type="button" role="tab" aria-selected={mode === 'appLayer'} className={`btn btn-sm join-item ${mode === 'appLayer' ? 'rl-mode-active' : ''}`} onClick={() => setMode('appLayer')}>
            <span className="iconify lucide--zap size-4" aria-hidden="true" />Automations &amp; Interfaces
          </button>
        </div>
        {/* The design's Add-to-doc + Export dropdowns are deferred (non-functional
            prototypes in the source; real doc persistence + tiered export are
            openspec follow-ups). */}
        </div>
      </div>
      )}

      {/* Canvas */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0 }} ref={wrapRef}>
      <ReactFlow
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgeMouseEnter={onEdgeMouseEnter}
        onEdgeMouseMove={onEdgeMouseMove}
        onEdgeMouseLeave={onEdgeMouseLeave}
        onEdgeClick={onEdgeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.8}
        proOptions={{ hideAttribution: true }}
        colorMode={colorMode}
        nodesConnectable={false}
        edgesFocusable={false}
      >
        <Background gap={18} size={1} color="var(--color-base-300)" />
        {/* Zoom controls → top-left on the full canvas so the bottom-left legend has the corner
            to itself; embedded mini-diagrams (no legend) keep the default bottom-left. */}
        <Controls showInteractive={false} position={embed ? 'bottom-left' : 'top-left'} />
        {!embed && <MiniMap pannable zoomable nodeColor={minimapColor} nodeStrokeWidth={0} maskColor="oklch(0 0 0 / 0.06)" />}
      </ReactFlow>
      {/* A10 — the shared Browse EntityPanel now serves Visualize too (opened via schema:openEntity
          in onNodeClick); the old light SidePanel is retired so the panel is standardised everywhere. */}

      {/* Canvas legend — mode-aware key (Data health + relationship colours · Relationships types ·
          app-layer nodes + edge kinds). One shared card so every mode reads consistently. */}
      {showLegend && legendCols && <CanvasLegend cols={legendCols} />}

      {/* Relationships-mode fetch states — loading / error / nothing-to-draw. */}
      {!embed && mode === 'relationships' && (relsLoading || relsError || liveRels.length === 0) && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 16, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ maxWidth: 340, textAlign: 'center', background: 'var(--color-base-100)', border: '1px solid var(--color-base-300)', borderRadius: 12, padding: '24px 24px', boxShadow: '0 4px 16px oklch(0 0 0 / 0.08)' }}>
            {relsLoading ? (
              <span className="loading loading-spinner loading-sm" aria-label="Loading relationships" />
            ) : relsError ? (
              <p style={{ fontSize: 12.5, color: 'var(--color-error)' }}>Could not load relationships.</p>
            ) : (
              <>
                <span aria-hidden className="iconify lucide--waypoints" style={{ fontSize: 26, opacity: 0.4 }} />
                <p style={{ fontWeight: 640, fontSize: 14, marginTop: 8 }}>No relationships yet</p>
                <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 5 }}>Cross-table relationships appear once your schema carries linked records, lookups, rollups, or synced views.</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* App-layer empty / upsell — no captured entities yet (or below the tier). Points at the tabs. */}
      {!embed && mode === 'appLayer' && !hasApp && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 16, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
          <div style={{ maxWidth: 340, textAlign: 'center', pointerEvents: 'auto', background: 'var(--color-base-100)', border: '1px solid var(--color-base-300)', borderRadius: 12, padding: '24px 24px', boxShadow: '0 4px 16px oklch(0 0 0 / 0.08)' }}>
            <span aria-hidden className="iconify lucide--workflow" style={{ fontSize: 26, opacity: 0.4 }} />
            {genState !== 'ready' ? (
              <>
                <p style={{ fontWeight: 640, fontSize: 14, marginTop: 8 }}>See how your app layer connects</p>
                <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 5 }}>Graph the automations and interfaces that touch your tables and fields. Available on Growth and above.</p>
                <a href="/settings/billing" className="btn btn-sm btn-primary gap-1.5" style={{ marginTop: 12 }}><span aria-hidden className="iconify lucide--arrow-up-circle size-4" />View plans</a>
              </>
            ) : (
              <>
                <p style={{ fontWeight: 640, fontSize: 14, marginTop: 8 }}>Nothing to graph yet</p>
                <p style={{ fontSize: 12.5, opacity: 0.6, marginTop: 5 }}>Register automations and interfaces on their tabs, then see how they connect to your tables and fields here.</p>
              </>
            )}
          </div>
        </div>
      )}
      </div>
      {/* Edge hover tooltip (relationships mode) — a quick-glance summary at the cursor;
          full detail opens on click via the shared relationship panel. */}
      {edgeTip && relById.get(edgeTip.id) && (() => {
        const r = relById.get(edgeTip.id)!;
        const meta = REL_TYPE_META[r.type];
        return (
          <div style={{ position: 'fixed', left: edgeTip.x + 14, top: edgeTip.y + 14, zIndex: 70, pointerEvents: 'none', background: 'var(--color-base-100)', border: '1px solid var(--color-base-300)', borderRadius: 9, boxShadow: '0 8px 24px oklch(0 0 0 / 0.18)', padding: '8px 12px', maxWidth: 264, fontSize: 12.5, color: 'var(--color-base-content)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: meta.color, flex: 'none' }} />
              <span style={{ fontWeight: 650 }}>{meta.label}</span>
              {r.cardinality && <span className="mono-data" style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>{r.cardinality}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.8, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.a.name}</span>
              <span aria-hidden style={{ opacity: 0.5, flex: 'none' }}>{r.direction === 'two' ? '↔' : '→'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.b.name}</span>
            </div>
            {(r.inferred || r.validity === 'invalid') && (
              <div style={{ marginTop: 5, display: 'flex', gap: 5 }}>
                {r.inferred && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'oklch(from var(--color-primary) l c h / .12)', color: 'var(--color-primary)' }}>Inferred</span>}
                {r.validity === 'invalid' && <span style={{ fontSize: 10.5, fontWeight: 600, padding: '1px 8px', borderRadius: 999, background: 'oklch(from var(--color-warning) l c h / .14)', color: 'var(--color-warning)' }}>Invalid</span>}
              </div>
            )}
            <div style={{ marginTop: 5, fontSize: 10.5, opacity: 0.45 }}>Click to open details</div>
          </div>
        );
      })()}
      {/* Edge hover tooltip (app-layer mode) — what this connection means for impact analysis:
          the kind, the two endpoints, the field it goes through, and a one-line consequence. */}
      {edgeTip && !relById.has(edgeTip.id) && edgeById.get(edgeTip.id) && (() => {
        const edge = edgeById.get(edgeTip.id)!;
        const kind = appEdgeKindOf(edge);
        if (!kind) return null;
        const meta = APP_EDGE_META[kind];
        const srcName = nodeNameById.get(edge.source as string) ?? '';
        const tgtName = nodeNameById.get(edge.target as string) ?? '';
        // `via <field>` only for references/reads (a field name); triggers' label is just "triggers".
        const via = kind !== 'triggers' && typeof edge.label === 'string' ? edge.label : undefined;
        const hint = kind === 'references'
          ? 'This automation references it — schema changes here may affect it.'
          : kind === 'reads'
          ? 'This page reads it — schema changes here may affect it.'
          : 'This page/interface triggers the automation.';
        return (
          <div style={{ position: 'fixed', left: edgeTip.x + 14, top: edgeTip.y + 14, zIndex: 70, pointerEvents: 'none', background: 'var(--color-base-100)', border: '1px solid var(--color-base-300)', borderRadius: 9, boxShadow: '0 8px 24px oklch(0 0 0 / 0.18)', padding: '8px 12px', maxWidth: 268, fontSize: 12.5, color: 'var(--color-base-content)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: meta.color, flex: 'none' }} />
              <span style={{ fontWeight: 650 }}>{meta.label}</span>
              {via && <span className="mono-data" style={{ marginLeft: 'auto', opacity: 0.6, fontSize: 11 }}>via {via}</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.8, minWidth: 0 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{srcName}</span>
              <span aria-hidden style={{ opacity: 0.5, flex: 'none' }}>→</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tgtName}</span>
            </div>
            <div style={{ marginTop: 5, fontSize: 11, opacity: 0.6 }}>{hint}</div>
            <div style={{ marginTop: 5, fontSize: 10.5, opacity: 0.45 }}>Click to open the source</div>
          </div>
        );
      })()}
    </div>
  );
}

export default function SchemaCanvas({ tables, bases, baseHealth, spaceId, genState, embed, relationships, automations, interfaces }: Props) {
  return (
    <ReactFlowProvider>
      <Canvas tables={tables} bases={bases} baseHealth={baseHealth} spaceId={spaceId} genState={genState} embed={embed} relationships={relationships} automations={automations} interfaces={interfaces} />
    </ReactFlowProvider>
  );
}

/* — Faceted filter: a daisyUI dropdown of checkboxes (multi-select show/hide), the same
   pattern as the Backups list. One per facet in the toolbar: Bases / Tables / Field types. — */
type FacetItem = { id: string; label: string; dot?: string; icon?: ReactNode };
function FacetDropdown({ label, groups, hidden, onToggle, onAll }: {
  label: string;
  groups: { label?: string; items: FacetItem[] }[];
  hidden: Set<string>;
  onToggle: (id: string) => void;
  onAll: (hide: boolean) => void;
}) {
  const all = groups.flatMap((g) => g.items);
  const hiddenCount = all.reduce((n, i) => n + (hidden.has(i.id) ? 1 : 0), 0);
  // In-popover search — present on every facet for consistency with the Astro twin.
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const fgroups = ql
    ? groups.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(ql)) })).filter((g) => g.items.length)
    : groups;
  return (
    <div className="dropdown">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm gap-1.5"
        style={
          hiddenCount > 0
            ? { background: 'color-mix(in oklch, var(--color-primary) 13%, transparent)', borderColor: 'color-mix(in oklch, var(--color-primary) 35%, transparent)', color: 'var(--color-primary)', boxShadow: 'none', fontWeight: 400 }
            : { background: 'var(--color-base-100)', borderColor: 'var(--color-base-300)', boxShadow: 'none', fontWeight: 400 }
        }
      >
        {label}
        {hiddenCount > 0 && <span className="badge badge-sm badge-primary">{all.length - hiddenCount}/{all.length}</span>}
        <span aria-hidden style={{ width: 12, height: 12, display: 'grid', placeItems: 'center', opacity: 0.55 }}><ChevronGlyph /></span>
      </div>
      <div
        tabIndex={0}
        className="dropdown-content bg-base-100 rounded-box border border-base-300 shadow-lg"
        style={{ zIndex: 20, marginTop: 4, padding: 6, width: 232, maxHeight: 'min(58vh, 420px)', overflowY: 'auto', fontSize: 13 }}
      >
        <div style={{ padding: '2px 2px 8px' }}>
          <label className="input input-sm" style={{ width: '100%' }}>
            <span aria-hidden style={{ width: 13, height: 13, display: 'grid', placeItems: 'center', opacity: 0.5 }}><SearchGlyph /></span>
            <input type="text" placeholder="Search" aria-label={`Search ${label}`} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 4, padding: '2px 2px 8px' }}>
          <button type="button" className={`btn btn-sm btn-ghost gap-1 px-2${hiddenCount === 0 ? '' : ' text-primary'}`} disabled={hiddenCount === 0} onClick={() => onAll(false)}>
            <span aria-hidden style={{ width: 13, height: 13, display: 'grid', placeItems: 'center' }}><EyeGlyph /></span>Show all
          </button>
          <button type="button" className="btn btn-sm btn-ghost gap-1 px-2" disabled={hiddenCount === all.length} onClick={() => onAll(true)}>
            <span aria-hidden style={{ width: 13, height: 13, display: 'grid', placeItems: 'center' }}><EyeOffGlyph /></span>Hide all
          </button>
        </div>
        {fgroups.length === 0 && <div style={{ padding: '8px 8px', fontSize: 12, opacity: 0.5 }}>No matches</div>}
        {fgroups.map((g, gi) => (
          <div key={g.label ?? gi}>
            {g.label && <div style={{ padding: '8px 8px 2px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.45 }}>{g.label}</div>}
            {g.items.map((i) => (
              <label key={i.id} className="hover:bg-base-200" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderRadius: 7, cursor: 'pointer', opacity: hidden.has(i.id) ? 0.45 : 1, transition: 'opacity .12s ease' }}>
                {i.dot && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, flex: 'none', background: i.dot }} />}
                {i.icon}
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>{i.label}</span>
                <input type="checkbox" className="toggle toggle-sm toggle-primary" style={{ flex: 'none' }} checked={!hidden.has(i.id)} onChange={() => onToggle(i.id)} aria-label={`Show ${i.label}`} />
              </label>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function ChevronGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
function fieldGlyph(f: SchemaField) {
  // Primary field keeps the key marker (a UI concept, not an Airtable type);
  // everything else renders the real Airtable field-type icon (incl. link).
  if (f.isPrimary) return <KeyGlyph />;
  return <AirtableFieldIcon type={f.type} />;
}

/* — tiny inline glyphs (no Lucide in the React island) — */
function KeyGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="4.5" /><path d="m21 2-9.6 9.6" /><path d="m15.5 7.5 3 3L22 7l-3-3" />
    </svg>
  );
}
function DotGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}
/** The real Airtable field-type icon (vendored 16x16, currentColor). Unknown types
 *  fall back to a neutral glyph — never blank (per the field-icon-set README). */
function AirtableFieldIcon({ type }: { type: string }) {
  const key = airtableIconKey(type);
  if (!key) return <FallbackFieldGlyph />;
  return <svg width="14" height="14" viewBox="0 0 16 16" dangerouslySetInnerHTML={{ __html: AIRTABLE_FIELD_ICONS[key] }} />;
}
/** Neutral fallback for a type not in the Airtable set (new / AI field types). */
function FallbackFieldGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="16" height="16" x="4" y="4" rx="2" /><path d="M8 12h8" />
    </svg>
  );
}
function SearchGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
}
function EyeGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function EyeOffGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" /><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" /><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" /><path d="m2 2 20 20" />
    </svg>
  );
}
function XGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
