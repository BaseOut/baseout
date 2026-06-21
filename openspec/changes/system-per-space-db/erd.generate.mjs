// Generates an ER-style diagram of the Baseout database schema as an .excalidraw file.
// Run with: node openspec/changes/system-per-space-db/erd.generate.mjs
//
// Source of truth: memory/per_space_db_architecture.md (Core vs Per-Space split).
// Helpers below are copied from ui-only/overview/generate.mjs (self-contained, no deps).

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- helpers (copied from ui-only/overview/generate.mjs) ----------

let counter = 0;
function id() {
  counter += 1;
  return `el-${counter.toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

function seed() {
  return Math.floor(Math.random() * 2147483647);
}

const baseProps = () => ({
  isDeleted: false,
  fillStyle: 'solid',
  strokeWidth: 2,
  strokeStyle: 'solid',
  roughness: 1,
  opacity: 100,
  angle: 0,
  groupIds: [],
  frameId: null,
  roundness: { type: 3 },
  seed: seed(),
  versionNonce: seed(),
  version: 1,
  updated: 0, // deterministic — files diff cleanly
  link: null,
  locked: false,
  boundElements: [],
  customData: null,
});

// COLORS — pulled from Baseout's principle (utility-admin, restrained).
const C = {
  ink: '#1e1e1e',
  muted: '#868e96',
  card: '#ffffff',
  cardAlt: '#f8f9fa',
  accent: '#1971c2',       // baseout-blue-ish
  accentSoft: '#e7f5ff',
  success: '#2f9e44',
  successSoft: '#ebfbee',
  warning: '#e8590c',
  warningSoft: '#fff4e6',
  error: '#e03131',
  errorSoft: '#ffe3e3',
  purple: '#9c36b5',
  purpleSoft: '#f3d9fa',
  teal: '#0c8599',
  tealSoft: '#c5f6fa',
};

function rect({ x, y, w, h, fill = C.card, stroke = C.ink, strokeWidth = 2, label = null, labelColor = C.ink, fontSize = 18, fontFamily = 5 }) {
  const rid = id();
  const elements = [
    {
      ...baseProps(),
      id: rid,
      type: 'rectangle',
      x, y, width: w, height: h,
      strokeColor: stroke,
      backgroundColor: fill,
      strokeWidth,
      boundElements: [],
    },
  ];
  if (label !== null) {
    const tid = id();
    elements[0].boundElements.push({ type: 'text', id: tid });
    elements.push({
      ...baseProps(),
      id: tid,
      type: 'text',
      x, y, width: w, height: h,
      strokeColor: labelColor,
      backgroundColor: 'transparent',
      strokeWidth: 1,
      fillStyle: 'hachure',
      text: label,
      fontSize,
      fontFamily,
      textAlign: 'center',
      verticalAlign: 'middle',
      baseline: Math.round(fontSize * 0.85),
      containerId: rid,
      originalText: label,
      lineHeight: 1.25,
      autoResize: true,
      roundness: null,
    });
  }
  return { id: rid, elements };
}

function text({ x, y, text: t, fontSize = 20, color = C.ink, align = 'left', fontFamily = 5, width = null }) {
  const tid = id();
  const w = width ?? Math.max(60, t.length * Math.round(fontSize * 0.55));
  const h = Math.round(fontSize * 1.4);
  return {
    id: tid,
    elements: [{
      ...baseProps(),
      id: tid,
      type: 'text',
      x, y, width: w, height: h,
      strokeColor: color,
      backgroundColor: 'transparent',
      strokeWidth: 1,
      text: t,
      fontSize,
      fontFamily,
      textAlign: align,
      verticalAlign: 'top',
      baseline: Math.round(fontSize * 0.85),
      containerId: null,
      originalText: t,
      lineHeight: 1.25,
      autoResize: true,
      roundness: null,
    }],
  };
}

// Arrow with binding to source + target containers when given.
function arrow({ from, to, dashed = false, label = null, stroke = C.ink, strokeWidth = 2 }) {
  const start = resolveAnchor(from);
  const end = resolveAnchor(to);
  const aid = id();
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const arrowEl = {
    ...baseProps(),
    id: aid,
    type: 'arrow',
    x: start.x,
    y: start.y,
    width: Math.abs(dx),
    height: Math.abs(dy),
    strokeColor: stroke,
    backgroundColor: 'transparent',
    fillStyle: 'hachure',
    strokeWidth,
    strokeStyle: dashed ? 'dashed' : 'solid',
    roundness: { type: 2 },
    points: [[0, 0], [dx, dy]],
    lastCommittedPoint: null,
    startBinding: from.bindId ? { elementId: from.bindId, focus: 0, gap: 4 } : null,
    endBinding: to.bindId ? { elementId: to.bindId, focus: 0, gap: 4 } : null,
    startArrowhead: null,
    endArrowhead: 'arrow',
    boundElements: [],
  };
  const elements = [arrowEl];
  if (label) {
    const tid = id();
    arrowEl.boundElements.push({ type: 'text', id: tid });
    const midX = start.x + dx / 2;
    const midY = start.y + dy / 2;
    const fontSize = 14;
    const w = Math.max(60, label.length * 9);
    elements.push({
      ...baseProps(),
      id: tid,
      type: 'text',
      x: midX - w / 2,
      y: midY - fontSize,
      width: w,
      height: Math.round(fontSize * 1.4),
      strokeColor: stroke,
      backgroundColor: 'transparent',
      strokeWidth: 1,
      text: label,
      fontSize,
      fontFamily: 5,
      textAlign: 'center',
      verticalAlign: 'middle',
      baseline: Math.round(fontSize * 0.85),
      containerId: aid,
      originalText: label,
      lineHeight: 1.25,
      autoResize: true,
      roundness: null,
    });
  }
  return { id: aid, elements };
}

function resolveAnchor(spec) {
  if (spec.x !== undefined && spec.y !== undefined && !spec.bindId) {
    return { x: spec.x, y: spec.y };
  }
  const { boxRect, side, offsetPct = 0.5, bindId } = spec;
  const { x, y, w, h } = boxRect;
  let ax, ay;
  switch (side) {
    case 'top':    ax = x + w * offsetPct; ay = y; break;
    case 'bottom': ax = x + w * offsetPct; ay = y + h; break;
    case 'left':   ax = x; ay = y + h * offsetPct; break;
    case 'right':  ax = x + w; ay = y + h * offsetPct; break;
    default:       ax = x + w / 2; ay = y + h / 2; break;
  }
  return { x: ax, y: ay, bindId };
}

function makeFile(elements, appState = {}) {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements,
    appState: {
      viewBackgroundColor: '#ffffff',
      gridSize: null,
      ...appState,
    },
    files: {},
  };
}

// ---------- ER table helper ----------
//
// Renders a table as two stacked boxes: a header (name, larger font) and a body
// (columns, small left-aligned font). Returns { id, headerRect, bodyRect, rect:{...full} }
// so arrows can bind to the header. We bind arrows to the header rectangle (a real
// container) and store the geometry for anchor math.

const TABLE_W = 240;
const HEADER_H = 30;
const LINE_H = 16;
const BODY_PAD = 10;

function erTable({ x, y, name, cols, accent = C.accent, accentSoft = C.accentSoft }) {
  const els = [];
  const bodyH = BODY_PAD * 2 + cols.length * LINE_H;

  // Header box (bound target for arrows)
  const header = rect({
    x, y, w: TABLE_W, h: HEADER_H,
    fill: accentSoft, stroke: accent, strokeWidth: 2,
    label: name, labelColor: C.ink, fontSize: 15,
  });
  els.push(...header.elements);

  // Body box
  const body = rect({
    x, y: y + HEADER_H, w: TABLE_W, h: bodyH,
    fill: C.card, stroke: accent, strokeWidth: 1,
  });
  els.push(...body.elements);

  // Column lines as a single left-aligned text block inside the body
  const colText = text({
    x: x + BODY_PAD,
    y: y + HEADER_H + BODY_PAD,
    text: cols.join('\n'),
    fontSize: 11,
    color: C.ink,
    align: 'left',
    fontFamily: 3, // code font for column listing
    width: TABLE_W - BODY_PAD * 2,
  });
  els.push(...colText.elements);

  const fullH = HEADER_H + bodyH;
  return {
    id: header.id,
    bodyId: body.id,
    headerRect: { x, y, w: TABLE_W, h: HEADER_H },
    rect: { x, y, w: TABLE_W, h: fullH },
    elements: els,
  };
}

// ---------- diagram ----------

function erd() {
  const els = [];

  // Title
  els.push(...text({ x: 40, y: 30, text: 'Baseout — Database Schema (Core + Per-Space)', fontSize: 30 }).elements);

  // ---- cluster region geometry ----
  const CORE_X = 60;
  const CORE_W = 360;
  const PS_X = 560;
  const PS_W = 880; // wider — holds two columns of tables
  const REGION_Y = 110;
  const REGION_H = 1760;

  // Core region background
  els.push(...rect({
    x: CORE_X, y: REGION_Y, w: CORE_W, h: REGION_H,
    fill: C.accentSoft, stroke: C.accent, strokeWidth: 2,
  }).elements);
  els.push(...text({ x: CORE_X + 16, y: REGION_Y + 14, text: 'Core / Master DB', fontSize: 20, color: C.accent }).elements);

  // Per-Space region background
  els.push(...rect({
    x: PS_X, y: REGION_Y, w: PS_W, h: REGION_H,
    fill: C.purpleSoft, stroke: C.purple, strokeWidth: 2,
  }).elements);
  els.push(...text({ x: PS_X + 16, y: REGION_Y + 14, text: 'Per-Space DB  (bo_at_* tables, one DB per Space: D1 / managed PG / BYODB)', fontSize: 18, color: C.purple, width: PS_W - 32 }).elements);

  const T = {}; // table refs by key

  // ---- CORE tables (single column, left) ----
  const coreCol = CORE_X + 60;
  let cy = REGION_Y + 60;
  function placeCore(key, name, cols) {
    const t = erTable({ x: coreCol, y: cy, name, cols, accent: C.accent, accentSoft: C.accentSoft });
    els.push(...t.elements);
    T[key] = t;
    cy = t.rect.y + t.rect.h + 28;
    return t;
  }

  placeCore('spaces', 'spaces', [
    'id  (PK)', 'organization_id', 'name', 'platform',
  ]);
  placeCore('space_databases', 'space_databases', [
    'id  (PK)', 'space_id', 'backend (d1|managed_pg|byodb)',
    'records_enabled', 'd1_database_id', 'pg_connection_string_enc',
    'byodb_connection_string_enc', 'status',
  ]);
  placeCore('backup_configurations', 'backup_configurations', [
    'id  (PK)', 'space_id', 'mode', 'schedule',
  ]);
  placeCore('backup_runs', 'backup_runs', [
    'id  (PK)', 'space_id', 'status', 'started_at',
    'completed_at', 'is_trial', 'record_count', 'table_count',
  ]);
  placeCore('storage_destinations', 'storage_destinations', [
    'id  (PK)', 'space_id', 'type', '...creds_enc',
  ]);
  placeCore('health_score_rules', 'health_score_rules', [
    'id  (PK)', 'org_id', 'rule_key', 'params', 'weight', 'enabled',
  ]);
  placeCore('static_snapshots', 'static_snapshots', [
    'id  (PK)', 'space_id', 'run_id', 'opaque_key',
  ]);

  // ---- PER-SPACE tables (two columns, right) ----
  const psCol1 = PS_X + 40;
  const psCol2 = PS_X + 40 + TABLE_W + 160; // gap for arrows between cols
  let py1 = REGION_Y + 60;
  let py2 = REGION_Y + 60;

  function placePS(key, name, cols, col = 1) {
    const x = col === 1 ? psCol1 : psCol2;
    const y = col === 1 ? py1 : py2;
    const t = erTable({ x, y, name, cols, accent: C.purple, accentSoft: C.purpleSoft });
    els.push(...t.elements);
    T[key] = t;
    const next = t.rect.y + t.rect.h + 24;
    if (col === 1) py1 = next; else py2 = next;
    return t;
  }

  // Column 1: run/schema lineage
  placePS('base_runs', 'bo_at_base_runs', [
    'id  (PK)', 'backup_run_id  (→core)', 'base_id', 'status',
    'curr_step', 'schema_version_id', 'counts',
  ], 1);
  placePS('bases', 'bo_at_bases', [
    'base_id  (PK)', 'name', 'status', 'first_seen_run',
    'first_unseen_run', 'last_seen_run',
  ], 1);
  placePS('tables', 'bo_at_tables', [
    'table_id  (PK)', 'base_id', 'name', 'primary_field_id', '+ lifecycle',
  ], 1);
  placePS('fields', 'bo_at_fields', [
    'field_id  (PK)', 'table_id', 'name', 'type', 'options',
    'is_primary', '+ lifecycle',
  ], 1);
  placePS('views', 'bo_at_views', [
    'view_id  (PK)', 'table_id', 'name', 'type', '+ lifecycle',
  ], 1);
  placePS('schema_versions', 'bo_at_schema_versions', [
    'id  (PK)', 'base_id', 'schema_hash', 'schema_json', 'first_seen_run',
  ], 1);
  placePS('schema_updates', 'bo_at_schema_updates', [
    'id  (PK)', 'run_id', 'entity_type', 'entity_id', 'change_type',
    'before_value', 'after_value', 'breaks_data',
  ], 1);
  placePS('documentation', 'bo_at_documentation', [
    'id  (PK)', 'target_type', 'target_id', 'description',
    'source', 'updated_at',
  ], 1);

  // Column 2: records / data / derived
  placePS('records', 'bo_at_records', [
    'record_id  (PK)', 'table_id', 'created_time',
    'modified_time', 'status', 'lifecycle',
  ], 2);
  placePS('record_field_data', 'bo_at_record_field_data', [
    '(record_id, field_id)  PK', 'table_id', 'value (JSON text)',
    'first_seen_run', 'last_seen_run',
  ], 2);
  placePS('record_updates', 'bo_at_record_updates', [
    'id  (PK)', 'record_id', 'field_id', 'run_id',
    'old_value (superseded log)',
  ], 2);
  placePS('attachments', 'bo_at_attachments', [
    'composite_id  (PK)', 'table_id', 'field_id', 'record_id',
    'storage_key', 'content_hash', 'upload_status',
  ], 2);
  placePS('health_scores', 'bo_at_health_scores', [
    'id  (PK)', 'base_id', 'run_id', 'score', 'band', 'categories',
  ], 2);
  placePS('health_issues', 'bo_at_health_issues', [
    'id  (PK)', 'base_id', 'run_id', 'rule_id', 'severity',
    'message', 'occurrence_count',
  ], 2);
  placePS('automations', 'bo_at_automations', [
    'id  (PK)', 'base_id', 'name', 'type', 'definition', 'status',
  ], 2);
  placePS('interfaces', 'bo_at_interfaces', [
    'id  (PK)', 'base_id', 'name', 'type', 'definition', 'status',
  ], 2);

  // ---- relationships ----
  function link(fromKey, fromSide, toKey, toSide, { dashed = false, label = null, stroke } = {}) {
    const f = T[fromKey];
    const t = T[toKey];
    els.push(...arrow({
      from: { bindId: f.id, boxRect: f.headerRect, side: fromSide.side, offsetPct: fromSide.offsetPct },
      to:   { bindId: t.id, boxRect: t.headerRect, side: toSide.side, offsetPct: toSide.offsetPct },
      dashed,
      label,
      stroke: stroke ?? (dashed ? C.error : C.ink),
    }).elements);
  }

  // --- within-DB (solid) per-Space references ---
  // schema lineage (column 1 internal)
  link('tables', { side: 'top' }, 'bases', { side: 'bottom' });
  link('fields', { side: 'top' }, 'tables', { side: 'bottom' });
  link('views', { side: 'top' }, 'tables', { side: 'bottom', offsetPct: 0.7 });
  link('base_runs', { side: 'left', offsetPct: 0.4 }, 'schema_versions', { side: 'left', offsetPct: 0.4 });
  link('schema_versions', { side: 'top' }, 'bases', { side: 'bottom', offsetPct: 0.3 });

  // records lineage (column 2 internal + col1→col2)
  link('records', { side: 'left' }, 'tables', { side: 'right' });
  link('record_field_data', { side: 'top' }, 'records', { side: 'bottom' });
  link('record_updates', { side: 'top' }, 'record_field_data', { side: 'bottom' });
  link('attachments', { side: 'left', offsetPct: 0.3 }, 'records', { side: 'right', offsetPct: 0.8 });

  // health derived
  link('health_issues', { side: 'top' }, 'health_scores', { side: 'bottom' });

  // --- cross-DB (dashed, UUID references) ---
  link('base_runs', { side: 'left', offsetPct: 0.7 }, 'backup_runs', { side: 'right', offsetPct: 0.5 }, { dashed: true, label: 'backup_run_id' });
  link('health_issues', { side: 'left' }, 'health_score_rules', { side: 'right', offsetPct: 0.6 }, { dashed: true, label: 'rule_id' });

  // ---- legend ----
  const legY = REGION_Y + REGION_H + 24;
  els.push(...text({ x: CORE_X, y: legY, text: 'Solid arrow = within-DB reference     Dashed arrow = cross-DB UUID reference (app-level, no FK)', fontSize: 14, color: C.muted, width: 1100 }).elements);

  return makeFile(els);
}

// ---------- write ----------

const out = join(__dirname, 'erd.excalidraw');
writeFileSync(out, JSON.stringify(erd(), null, 2));
console.log(`wrote ${out}`);
