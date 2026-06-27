// Generates the Schema-page wireframe .excalidraw files.
// Run with: node overview/schema/generate.mjs
//
// Same helper set + palette as overview/generate.mjs (kept local so this
// folder is self-contained). These are low-fidelity WIREFRAMES, not visual
// comps — boxes + labels showing structure, hierarchy, and gating. The
// designer draws the real thing from these + the per-tab .md docs.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- helpers (mirrors ../generate.mjs) ----------

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
  updated: 0,
  link: null,
  locked: false,
  boundElements: [],
  customData: null,
});

// Restrained, utility-admin palette (matches the overview diagrams).
const C = {
  ink: '#1e1e1e',
  muted: '#868e96',
  card: '#ffffff',
  cardAlt: '#f8f9fa',
  accent: '#1971c2',
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

function rect({ x, y, w, h, fill = C.card, stroke = C.ink, strokeWidth = 2, label = null, labelColor = C.ink, fontSize = 16, fontFamily = 5, align = 'center', valign = 'middle' }) {
  const rid = id();
  const elements = [{
    ...baseProps(),
    id: rid,
    type: 'rectangle',
    x, y, width: w, height: h,
    strokeColor: stroke,
    backgroundColor: fill,
    strokeWidth,
    boundElements: [],
  }];
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
      textAlign: align,
      verticalAlign: valign,
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

function ellipse({ x, y, w, h, fill = C.card, stroke = C.ink, label = null, labelColor = C.ink, fontSize = 14, fontFamily = 5 }) {
  const eid = id();
  const elements = [{
    ...baseProps(),
    id: eid,
    type: 'ellipse',
    x, y, width: w, height: h,
    strokeColor: stroke,
    backgroundColor: fill,
    boundElements: [],
    roundness: { type: 2 },
  }];
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
      text: label, fontSize, fontFamily,
      textAlign: 'center',
      verticalAlign: 'middle',
      baseline: Math.round(fontSize * 0.85),
      containerId: eid,
      originalText: label,
      lineHeight: 1.25,
      autoResize: true,
      roundness: null,
    });
  }
  return { id: eid, elements };
}

function text({ x, y, text: t, fontSize = 18, color = C.ink, align = 'left', fontFamily = 5, width = null }) {
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
      text: t, fontSize, fontFamily,
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

function arrow({ from, to, dashed = false, label = null, stroke = C.ink, strokeWidth = 2, endHead = 'arrow', startHead = null }) {
  const start = resolveAnchor(from);
  const end = resolveAnchor(to);
  const aid = id();
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const arrowEl = {
    ...baseProps(),
    id: aid,
    type: 'arrow',
    x: start.x, y: start.y,
    width: Math.abs(dx), height: Math.abs(dy),
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
    startArrowhead: startHead,
    endArrowhead: endHead,
    boundElements: [],
  };
  const elements = [arrowEl];
  if (label) {
    const tid = id();
    arrowEl.boundElements.push({ type: 'text', id: tid });
    const midX = start.x + dx / 2;
    const midY = start.y + dy / 2;
    const fontSize = 13;
    const w = Math.max(50, label.length * 8);
    elements.push({
      ...baseProps(),
      id: tid,
      type: 'text',
      x: midX - w / 2, y: midY - fontSize,
      width: w, height: Math.round(fontSize * 1.4),
      strokeColor: stroke,
      backgroundColor: 'transparent',
      strokeWidth: 1,
      text: label, fontSize, fontFamily: 5,
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

// A small coloured health dot + label, returned as elements.
function dot({ x, y, color, label, labelColor = C.ink, r = 9 }) {
  const els = [];
  els.push(ellipse({ x, y, w: r, h: r, fill: color, stroke: color }).elements);
  if (label) els.push(text({ x: x + r + 8, y: y - 4, text: label, fontSize: 13, color: labelColor }).elements);
  return els.flat();
}

function makeFile(elements, appState = {}) {
  return {
    type: 'excalidraw',
    version: 2,
    source: 'https://excalidraw.com',
    elements,
    appState: { viewBackgroundColor: '#ffffff', gridSize: null, ...appState },
    files: {},
  };
}

// ---------- 01 — page anatomy ----------

function diagram01() {
  const els = [];
  els.push(text({ x: 40, y: 28, text: 'Schema page — anatomy', fontSize: 30 }).elements);
  els.push(text({ x: 40, y: 70, text: 'One Space-scoped page. Three tabs. Read-only. The "Data Intelligence" half of Baseout.', fontSize: 15, color: C.muted, width: 1000 }).elements);

  // App sidebar strip
  const sb = rect({ x: 40, y: 120, w: 190, h: 360, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '', });
  els.push(sb.elements);
  els.push(text({ x: 58, y: 134, text: 'SPACE', fontSize: 12, color: C.muted }).elements);
  els.push(text({ x: 58, y: 162, text: 'Overview', fontSize: 14, color: C.ink }).elements);
  els.push(text({ x: 58, y: 190, text: 'Backups', fontSize: 14, color: C.ink }).elements);
  els.push(text({ x: 58, y: 218, text: 'Restore', fontSize: 14, color: C.ink }).elements);
  // Schema highlighted
  els.push(rect({ x: 48, y: 242, w: 174, h: 30, fill: C.accentSoft, stroke: C.accent, strokeWidth: 1, label: 'Schema', labelColor: C.accent, fontSize: 14, align: 'left' }).elements);
  els.push(text({ x: 58, y: 286, text: 'Reports', fontSize: 14, color: C.ink }).elements);
  els.push(text({ x: 58, y: 340, text: 'ACCOUNT', fontSize: 12, color: C.muted }).elements);
  els.push(text({ x: 58, y: 368, text: 'Sources', fontSize: 14, color: C.muted }).elements);
  els.push(text({ x: 58, y: 396, text: 'Destinations', fontSize: 14, color: C.muted }).elements);

  // Main panel
  els.push(rect({ x: 250, y: 120, w: 820, h: 360, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  // Header bar
  els.push(text({ x: 272, y: 140, text: 'Schema', fontSize: 22, color: C.ink }).elements);
  els.push(rect({ x: 760, y: 138, w: 140, h: 32, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: 'Base filter ▾', fontSize: 13 }).elements);
  els.push(rect({ x: 918, y: 138, w: 130, h: 32, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: 'Export ▾', fontSize: 13 }).elements);

  // Tab bar
  const tabY = 196;
  const tVis = rect({ x: 272, y: tabY, w: 150, h: 38, fill: C.accent, stroke: C.accent, label: 'Visualize', labelColor: '#ffffff', fontSize: 15 });
  els.push(tVis.elements);
  els.push(rect({ x: 432, y: tabY, w: 150, h: 38, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Changelog', fontSize: 15 }).elements);
  els.push(rect({ x: 592, y: tabY, w: 150, h: 38, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Health', fontSize: 15 }).elements);
  els.push(text({ x: 760, y: tabY + 10, text: 'Visualize = default', fontSize: 12, color: C.muted }).elements);

  // Active tab body placeholder
  els.push(rect({ x: 272, y: 252, w: 776, h: 208, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: 'active tab body\n(the selected tab renders here)', labelColor: C.muted, fontSize: 15 }).elements);

  // Three tab-purpose cards
  const cardY = 520;
  const cards = [
    { x: 40, fill: C.accentSoft, stroke: C.accent, title: '1 · Visualize', body: '"Show me my structure."\nSchema diagram — tables as\nnodes, links as edges.\nDesign first (most novel).' },
    { x: 390, fill: C.cardAlt, stroke: C.muted, title: '2 · Changelog', body: '"Show me what changed."\nAuto-generated feed of schema\ndiffs. ⚠ flags changes that may\nhave broken data. Easiest.' },
    { x: 740, fill: C.warningSoft, stroke: C.warning, title: '3 · Health', body: '"Tell me where the rot is."\nPer-Base grade 0–100 + band.\nIssue punch-list. Most\ncommercially valuable.' },
  ];
  cards.forEach((c) => {
    els.push(rect({ x: c.x, y: cardY, w: 330, h: 130, fill: c.fill, stroke: c.stroke, strokeWidth: 1, label: '' }).elements);
    els.push(text({ x: c.x + 16, y: cardY + 14, text: c.title, fontSize: 16, color: C.ink }).elements);
    els.push(text({ x: c.x + 16, y: cardY + 44, text: c.body, fontSize: 13, color: C.ink, width: 300 }).elements);
  });

  // Gating callout
  els.push(rect({ x: 40, y: 678, w: 1030, h: 96, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: 58, y: 690, text: 'Gating to design (not just the happy path):', fontSize: 14, color: C.ink }).elements);
  els.push(text({ x: 58, y: 716, text: '• Page: Launch+ (also a pre-registration conversion hook).   • Record counts on nodes / data-quality issues: need a dynamic backup.', fontSize: 13, color: C.muted, width: 1000 }).elements);
  els.push(text({ x: 58, y: 738, text: '• Export: PNG (Growth) · SVG (Pro) · PDF (Business) · embed (Enterprise).   • Health rule config: Pro+.   • AI "Generate description": Pro+ (in scope, 10 credits).', fontSize: 13, color: C.muted, width: 1010 }).elements);

  return makeFile(els.flat());
}

// ---------- 02 — Visualize wireframe ----------

function diagram02() {
  const els = [];
  els.push(text({ x: 40, y: 28, text: 'Tab 1 — Visualize (wireframe)', fontSize: 30 }).elements);
  els.push(text({ x: 40, y: 70, text: 'Read-only schema diagram. Tables = nodes, linked-record fields = edges. Auto-arranged. Think ERD, not network graph.', fontSize: 15, color: C.muted, width: 1010 }).elements);

  // Canvas frame
  const cx = 40, cy = 120, cw = 720, ch = 430;
  els.push(rect({ x: cx, y: cy, w: cw, h: ch, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  // Floating chrome inside canvas
  els.push(rect({ x: cx + 16, y: cy + 14, w: 150, h: 30, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Base: Sales ▾', fontSize: 13 }).elements);
  els.push(rect({ x: cx + cw - 130, y: cy + 14, w: 114, h: 30, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Export ▾', fontSize: 13 }).elements);

  // Nodes
  const node = (x, y, name, color, meta) => {
    const r = rect({ x, y, w: 168, h: 72, fill: C.card, stroke: C.ink, strokeWidth: 1, label: '' });
    els.push(r.elements);
    els.push(dot({ x: x + 14, y: y + 16, color, label: name, r: 10 }));
    els.push(text({ x: x + 14, y: y + 40, text: meta, fontSize: 12, color: C.muted }).elements);
    return { id: r.id, rect: { x, y, w: 168, h: 72 } };
  };
  const leads = node(cx + 70, cy + 90, 'Leads', C.success, '8 fields · 1.2k rec');
  const deals = node(cx + 360, cy + 90, 'Deals', C.warning, '12 fields · 540 rec');
  const people = node(cx + 70, cy + 250, 'People', C.success, '6 fields · 3.1k rec');
  const notes = node(cx + 360, cy + 250, 'Notes', C.success, '4 fields · 900 rec');

  // Edges (linked-record relationships)
  els.push(arrow({ from: { bindId: leads.id, boxRect: leads.rect, side: 'right' }, to: { bindId: deals.id, boxRect: deals.rect, side: 'left' }, stroke: C.muted, label: 'linked' }).elements);
  els.push(arrow({ from: { bindId: people.id, boxRect: people.rect, side: 'right' }, to: { bindId: deals.id, boxRect: deals.rect, side: 'bottom', offsetPct: 0.3 }, stroke: C.muted }).elements);
  els.push(arrow({ from: { bindId: deals.id, boxRect: deals.rect, side: 'bottom' }, to: { bindId: notes.id, boxRect: notes.rect, side: 'top' }, stroke: C.muted }).elements);

  // Minimap
  els.push(rect({ x: cx + cw - 130, y: cy + ch - 76, w: 114, h: 60, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'minimap', labelColor: C.muted, fontSize: 11 }).elements);

  // Side panel (on table click)
  const px = 790, py = 120, pw = 280, ph = 430;
  els.push(rect({ x: px, y: py, w: pw, h: ph, fill: C.card, stroke: C.accent, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: px + 16, y: py + 14, text: 'Table: Deals', fontSize: 16, color: C.ink }).elements);
  els.push(dot({ x: px + 16, y: py + 44, color: C.warning, label: 'amber · 12 fields · 540 records', r: 9 }));
  els.push(rect({ x: px + 16, y: py + 74, w: pw - 32, h: 1, fill: C.muted, stroke: C.muted, strokeWidth: 1 }).elements);
  const fields = [
    ['Name', 'single line text'],
    ['Stage', 'single select'],
    ['Owner', 'linked → People'],
    ['Value', 'currency'],
    ['Close date', 'date'],
    ['Notes', 'linked → Notes'],
  ];
  fields.forEach(([n, t], i) => {
    const fy = py + 92 + i * 34;
    els.push(rect({ x: px + 16, y: fy, w: 22, h: 22, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '▢', fontSize: 12 }).elements);
    els.push(text({ x: px + 46, y: fy + 2, text: n, fontSize: 13, color: C.ink }).elements);
    els.push(text({ x: px + 150, y: fy + 2, text: t, fontSize: 12, color: C.muted }).elements);
  });
  els.push(text({ x: px + 16, y: py + ph - 52, text: 'field-type icon: vendored Airtable set', fontSize: 11, color: C.success }).elements);
  els.push(rect({ x: px + 16, y: py + ph - 34, w: 150, h: 24, fill: C.accentSoft, stroke: C.accent, strokeWidth: 1, label: '✦ Generate desc. (Pro+)', labelColor: C.accent, fontSize: 10 }).elements);

  // Annotations
  els.push(text({ x: 40, y: 580, text: 'Node = table: health dot (green/amber/red) · name · field count · record count (record count needs a dynamic backup).', fontSize: 13, color: C.muted, width: 1030 }).elements);
  els.push(text({ x: 40, y: 606, text: 'Click a node → side panel with the full field list. Field-type icons use the vendored Airtable set (overview/schema/field-icons/). Per field/table: AI "Generate description" (Pro+, 10 credits).', fontSize: 13, color: C.muted, width: 1030 }).elements);
  els.push(text({ x: 40, y: 632, text: 'References: dbdiagram.io, Airtable "Field overview", Lucidchart ER. Avoid force-directed network-graph aesthetics.', fontSize: 13, color: C.muted, width: 1030 }).elements);

  return makeFile(els.flat());
}

// ---------- 03 — Changelog wireframe ----------

function diagram03() {
  const els = [];
  els.push(text({ x: 40, y: 28, text: 'Tab 2 — Changelog (wireframe)', fontSize: 30 }).elements);
  els.push(text({ x: 40, y: 70, text: 'Day-grouped feed of schema diffs, auto-generated from backup snapshots. ⚠ flags changes that may have broken data.', fontSize: 15, color: C.muted, width: 1010 }).elements);

  // Filter rail
  els.push(rect({ x: 40, y: 120, w: 190, h: 420, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: 58, y: 134, text: 'Filters', fontSize: 15, color: C.ink }).elements);
  els.push(rect({ x: 58, y: 168, w: 154, h: 32, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Base ▾', fontSize: 13, align: 'left' }).elements);
  els.push(rect({ x: 58, y: 212, w: 154, h: 32, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Change type ▾', fontSize: 13, align: 'left' }).elements);
  els.push(rect({ x: 58, y: 256, w: 154, h: 32, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Date range ▾', fontSize: 13, align: 'left' }).elements);

  // Feed
  const fx = 260, fw = 800;
  let y = 128;
  const dayHeader = (label) => { els.push(text({ x: fx, y, text: label, fontSize: 15, color: C.muted }).elements); y += 30; };
  const entry = (time, base, type, typeColor, desc, warn) => {
    const h = warn ? 78 : 58;
    els.push(rect({ x: fx, y, w: fw, h, fill: warn ? C.warningSoft : C.card, stroke: warn ? C.warning : C.muted, strokeWidth: 1, label: '' }).elements);
    els.push(text({ x: fx + 16, y: y + 12, text: time, fontSize: 12, color: C.muted }).elements);
    els.push(rect({ x: fx + 70, y: y + 10, w: 64, h: 22, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: base, fontSize: 11 }).elements);
    els.push(rect({ x: fx + 144, y: y + 10, w: 96, h: 22, fill: C.card, stroke: typeColor, strokeWidth: 1, label: type, labelColor: typeColor, fontSize: 11 }).elements);
    els.push(text({ x: fx + 252, y: y + 12, text: desc, fontSize: 13, color: C.ink, width: fw - 270 }).elements);
    if (warn) els.push(text({ x: fx + 252, y: y + 44, text: '⚠  12 records may now be invalid', fontSize: 12, color: C.error }).elements);
    y += h + 12;
  };

  dayHeader('May 20, 2026');
  entry('09:14', 'Sales', '+ Table', C.success, '"Q2 Forecast" added — 3 fields, 0 records', false);
  dayHeader('May 18, 2026');
  entry('16:02', 'Mktg', '✎ Rename', C.accent, '"Lead Source"  →  "Acquisition Channel"', false);
  entry('11:30', 'Ops', '⚠ Type', C.warning, '"Status": Single select → Multiple select', true);
  dayHeader('May 12, 2026');
  entry('08:47', 'Ops', '− Field', C.error, '"Legacy ID" removed from "Tasks"', false);

  els.push(text({ x: 260, y: y + 6, text: 'Each row: time · base badge · change-type badge · pre-rendered description. Group by day; secondary group by base at high volume.', fontSize: 13, color: C.muted, width: 800 }).elements);

  return makeFile(els.flat());
}

// ---------- 04 — Health wireframe ----------

function diagram04() {
  const els = [];
  els.push(text({ x: 40, y: 28, text: 'Tab 3 — Health (wireframe)', fontSize: 30 }).elements);
  els.push(text({ x: 40, y: 70, text: 'Per-Base grade 0–100 + band (Green ≥90 · Yellow 60–89 · Red <60). Select a base → category breakdown + issue punch-list.', fontSize: 15, color: C.muted, width: 1020 }).elements);

  // Grade cards
  const grade = (x, base, score, band, color, soft) => {
    els.push(rect({ x, y: 120, w: 180, h: 100, fill: soft, stroke: color, strokeWidth: 1, label: '' }).elements);
    els.push(text({ x: x + 16, y: 132, text: base, fontSize: 14, color: C.ink }).elements);
    els.push(text({ x: x + 16, y: 152, text: String(score), fontSize: 36, color: color }).elements);
    els.push(dot({ x: x + 100, y: 168, color, label: band, labelColor: color, r: 11 }));
  };
  grade(40, 'Sales', 92, 'Green', C.success, C.successSoft);
  grade(240, 'Mktg', 74, 'Yellow', C.warning, C.warningSoft);
  grade(440, 'Ops', 48, 'Red', C.error, C.errorSoft);
  // Configure rules (Pro+)
  els.push(rect({ x: 860, y: 134, w: 200, h: 36, fill: C.card, stroke: C.accent, strokeWidth: 1, label: 'Configure rules  (Pro+)', labelColor: C.accent, fontSize: 13 }).elements);

  // Selected base section
  els.push(text({ x: 40, y: 250, text: 'Ops · 48 · Red  — selected', fontSize: 17, color: C.ink }).elements);
  els.push(rect({ x: 40, y: 248, w: 12, h: 12, fill: C.error, stroke: C.error }).elements);

  // Category breakdown — track + fill bars
  const cat = (y, label, score, color) => {
    els.push(text({ x: 40, y: y + 2, text: label, fontSize: 14, color: C.ink }).elements);
    els.push(rect({ x: 280, y, w: 360, h: 18, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
    els.push(rect({ x: 280, y, w: Math.round(360 * score / 100), h: 18, fill: color, stroke: color }).elements);
    els.push(text({ x: 652, y: y + 1, text: String(score), fontSize: 13, color: C.muted }).elements);
  };
  cat(290, 'Schema cleanliness', 62, C.warning);
  cat(320, 'Data quality', 31, C.error);
  cat(350, 'Config best practices', 58, C.warning);

  // Issues list
  els.push(text({ x: 40, y: 396, text: 'Issues', fontSize: 16, color: C.ink }).elements);
  els.push(rect({ x: 920, y: 392, w: 140, h: 30, fill: C.card, stroke: C.muted, strokeWidth: 1, label: 'Sort: severity ▾', fontSize: 12 }).elements);

  const issue = (y, sev, sevColor, label, count) => {
    els.push(rect({ x: 40, y, w: 1020, h: 40, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
    els.push(dot({ x: 56, y: y + 15, color: sevColor, label: sev, labelColor: sevColor, r: 10 }));
    els.push(text({ x: 150, y: y + 12, text: label, fontSize: 13, color: C.ink, width: 720 }).elements);
    els.push(text({ x: 800, y: y + 12, text: count, fontSize: 12, color: C.muted }).elements);
    els.push(rect({ x: 940, y: y + 8, w: 104, h: 24, fill: C.accentSoft, stroke: C.accent, strokeWidth: 1, label: 'Show in Airtable', labelColor: C.accent, fontSize: 11 }).elements);
  };
  issue(430, 'high', C.error, 'Empty primary field in "Tasks"', '47 records');
  issue(478, 'high', C.error, 'Linked field "Owner" points to deleted records', '9 records');
  issue(526, 'med', C.warning, 'Unnamed fields in "Imports"', '3 fields');
  issue(574, 'low', C.muted, 'Fields missing descriptions', '12 fields');

  els.push(text({ x: 40, y: 628, text: 'Tone: advisory, not pejorative — "12 fields could use clearer names," never "your schema is bad." Same band colours as the Visualize health dots.', fontSize: 13, color: C.muted, width: 1030 }).elements);
  els.push(text({ x: 40, y: 654, text: '"Show in Airtable" opens the field/record where it lives — Baseout is read-only and does not auto-fix.', fontSize: 13, color: C.muted, width: 1030 }).elements);

  return makeFile(els.flat());
}

// ---------- 05 — Browse wireframe ----------

function diagram05() {
  const els = [];
  els.push(text({ x: 40, y: 28, text: 'Tab — Browse (wireframe)', fontSize: 30 }).elements);
  els.push(text({ x: 40, y: 70, text: 'The index counterpart to Visualize. Search, walk Base ▸ Table ▸ Field, drill into any one — detail panel stacks as you go.', fontSize: 15, color: C.muted, width: 1040 }).elements);

  // Search / filter bar
  const barY = 116;
  els.push(rect({ x: 40, y: barY, w: 470, h: 36, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '⌕  Search bases, tables, fields…', labelColor: C.muted, fontSize: 13, align: 'left' }).elements);
  els.push(rect({ x: 520, y: barY, w: 86, h: 36, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: 'Base ▾', fontSize: 12 }).elements);
  els.push(rect({ x: 616, y: barY, w: 86, h: 36, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: 'Type ▾', fontSize: 12 }).elements);
  els.push(rect({ x: 712, y: barY, w: 96, h: 36, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: 'Health ▾', fontSize: 12 }).elements);
  // Tree | Flat toggle
  els.push(rect({ x: 818, y: barY, w: 130, h: 36, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(rect({ x: 820, y: barY + 2, w: 63, h: 32, fill: C.accent, stroke: C.accent, label: 'Tree', labelColor: '#ffffff', fontSize: 12 }).elements);
  els.push(rect({ x: 883, y: barY + 2, w: 63, h: 32, fill: C.card, stroke: C.card, label: 'Flat', labelColor: C.muted, fontSize: 12 }).elements);

  // ---- Browse area (left): collapsible tree ----
  const tx = 40, ty = 168, tw = 410, th = 470;
  els.push(rect({ x: tx, y: ty, w: tw, h: th, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);

  // Tree rows. indent: 0 base / 1 table / 2 field.
  let ry = ty + 14;
  const rowH = 30;
  const treeRow = ({ indent, caret, glyph, glyphColor, name, meta, health, doc, sel }) => {
    const rx = tx + 14 + indent * 22;
    if (sel) els.push(rect({ x: tx + 6, y: ry - 4, w: tw - 12, h: rowH, fill: C.accentSoft, stroke: C.accent, strokeWidth: 1, label: '' }).elements);
    let cx2 = rx;
    if (caret) { els.push(text({ x: cx2, y: ry, text: caret, fontSize: 13, color: C.muted }).elements); }
    cx2 += 16;
    // field-type icon glyph in a small chip
    if (glyph) {
      els.push(rect({ x: cx2, y: ry - 3, w: 20, h: 20, fill: C.cardAlt, stroke: glyphColor, strokeWidth: 1, label: glyph, labelColor: glyphColor, fontSize: 11 }).elements);
      cx2 += 28;
    }
    els.push(text({ x: cx2, y: ry, text: name, fontSize: 13, color: sel ? C.accent : C.ink }).elements);
    if (meta) els.push(text({ x: cx2 + name.length * 8 + 12, y: ry + 1, text: meta, fontSize: 11, color: C.muted }).elements);
    // right-aligned health dot + doc indicator
    if (health) els.push(ellipse({ x: tx + tw - 30, y: ry + 1, w: 10, h: 10, fill: health, stroke: health }).elements);
    if (doc) els.push(text({ x: tx + tw - 56, y: ry, text: '◰', fontSize: 12, color: C.teal }).elements);
    ry += rowH;
  };

  treeRow({ indent: 0, caret: '▾', glyph: '▦', glyphColor: C.accent, name: 'Sales', meta: '4 tables', health: C.success });
  treeRow({ indent: 1, caret: '▾', glyph: '▤', glyphColor: C.accent, name: 'Deals', meta: '12 fields', health: C.warning, doc: true });
  treeRow({ indent: 2, caret: null, glyph: 'Aa', glyphColor: C.ink, name: 'Name', meta: 'single line', health: C.success });
  treeRow({ indent: 2, caret: null, glyph: '◇', glyphColor: C.purple, name: 'Stage', meta: 'single select', health: C.success, doc: true });
  treeRow({ indent: 2, caret: null, glyph: '⇄', glyphColor: C.teal, name: 'Owner', meta: 'linked → People', health: C.warning, sel: true });
  treeRow({ indent: 2, caret: null, glyph: '$', glyphColor: C.success, name: 'Value', meta: 'currency', health: C.success });
  treeRow({ indent: 1, caret: '▸', glyph: '▤', glyphColor: C.accent, name: 'Leads', meta: '8 fields', health: C.success });
  treeRow({ indent: 1, caret: '▸', glyph: '▤', glyphColor: C.accent, name: 'People', meta: '6 fields', health: C.success, doc: true });
  treeRow({ indent: 0, caret: '▸', glyph: '▦', glyphColor: C.accent, name: 'Marketing', meta: '6 tables', health: C.warning });
  treeRow({ indent: 0, caret: '▸', glyph: '▦', glyphColor: C.accent, name: 'Ops', meta: '9 tables', health: C.error });

  // tree legend
  els.push(text({ x: tx + 14, y: ty + th - 30, text: '▦ base   ▤ table   Aa/◇/⇄/$ field-type icon   ● health   ◰ tagged by a doc', fontSize: 11, color: C.muted, width: tw - 28 }).elements);

  // ---- Detail panel (right): stacking sheets ----
  // A peeking sheet behind to convey the stack.
  const px = 530, py = 168, pw = 540, ph = 470;
  els.push(rect({ x: px + 14, y: py - 10, w: pw - 14, h: ph, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: px + pw - 150, y: py - 2, text: 'sheet behind (Table: Deals)', fontSize: 10, color: C.muted }).elements);
  // Front sheet
  els.push(rect({ x: px, y: py, w: pw - 14, h: ph, fill: C.card, stroke: C.accent, strokeWidth: 1, label: '' }).elements);

  // Breadcrumb header → conveys stack
  els.push(text({ x: px + 16, y: py + 12, text: '‹ Back', fontSize: 12, color: C.accent }).elements);
  els.push(text({ x: px + 80, y: py + 12, text: 'Sales  ▸  Deals  ▸  Owner', fontSize: 12, color: C.muted }).elements);

  // (1) Context + type
  let sy = py + 38;
  els.push(text({ x: px + 16, y: sy, text: '1 · Context + type', fontSize: 11, color: C.muted }).elements);
  els.push(rect({ x: px + 16, y: sy + 18, w: 24, h: 24, fill: C.cardAlt, stroke: C.teal, strokeWidth: 1, label: '⇄', labelColor: C.teal, fontSize: 13 }).elements);
  els.push(text({ x: px + 48, y: sy + 18, text: 'Owner', fontSize: 16, color: C.ink }).elements);
  els.push(rect({ x: px + 120, y: sy + 18, w: 130, h: 22, fill: C.tealSoft, stroke: C.teal, strokeWidth: 1, label: 'linked → People', labelColor: C.teal, fontSize: 11 }).elements);
  els.push(dot({ x: px + 270, y: sy + 22, color: C.warning, label: 'amber · referenced 540×', labelColor: C.muted, r: 9 }));

  // (2) Descriptions
  sy = py + 100;
  els.push(text({ x: px + 16, y: sy, text: '2 · Descriptions', fontSize: 11, color: C.muted }).elements);
  const descBlk = (yy, title, titleColor, body, fill, stroke) => {
    els.push(rect({ x: px + 16, y: yy, w: pw - 46, h: 38, fill, stroke, strokeWidth: 1, label: '' }).elements);
    els.push(text({ x: px + 26, y: yy + 5, text: title, fontSize: 10, color: titleColor }).elements);
    els.push(text({ x: px + 26, y: yy + 20, text: body, fontSize: 11, color: C.ink, width: pw - 66 }).elements);
  };
  descBlk(sy + 16, 'Airtable · read-only', C.muted, '"Deal owner."', C.cardAlt, C.muted);
  descBlk(sy + 58, 'AI', C.purple, '"The sales rep accountable for this deal." [✦ Generate / Regenerate · Pro+]', C.purpleSoft, C.purple);
  descBlk(sy + 100, 'Yours · editable', C.accent, 'click to write your own…', C.accentSoft, C.accent);
  // action row
  els.push(rect({ x: px + 16, y: sy + 144, w: 140, h: 26, fill: C.card, stroke: C.accent, strokeWidth: 1, label: 'Copy AI → Yours', labelColor: C.accent, fontSize: 11 }).elements);
  els.push(rect({ x: px + 166, y: sy + 144, w: 230, h: 26, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: 'Push to Airtable · Coming soon', labelColor: C.muted, fontSize: 11 }).elements);
  els.push(text({ x: px + 402, y: sy + 148, text: '(disabled · V2)', fontSize: 10, color: C.muted }).elements);

  // (3) Children  +  (4) Relationships  side by side
  sy = py + 300;
  els.push(text({ x: px + 16, y: sy, text: '3 · Children (select choices)', fontSize: 11, color: C.muted }).elements);
  els.push(rect({ x: px + 16, y: sy + 16, w: 230, h: 64, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: px + 26, y: sy + 24, text: '› (field has no choices)', fontSize: 11, color: C.muted }).elements);
  els.push(text({ x: px + 26, y: sy + 44, text: '› for a table: its fields', fontSize: 11, color: C.muted }).elements);
  els.push(text({ x: px + 26, y: sy + 60, text: '  each clickable → pushes sheet', fontSize: 10, color: C.muted }).elements);

  els.push(text({ x: px + 266, y: sy, text: '4 · Relationships', fontSize: 11, color: C.muted }).elements);
  els.push(rect({ x: px + 266, y: sy + 16, w: 230, h: 64, fill: C.card, stroke: C.teal, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: px + 276, y: sy + 24, text: '⇄ People  (linked target)', fontSize: 11, color: C.teal }).elements);
  els.push(text({ x: px + 276, y: sy + 44, text: '⤷ click through to that sheet', fontSize: 10, color: C.muted }).elements);

  // (5) Documentation
  sy = py + 396;
  els.push(text({ x: px + 16, y: sy, text: '5 · Documentation (docs that tag this entity)', fontSize: 11, color: C.muted }).elements);
  els.push(rect({ x: px + 16, y: sy + 16, w: pw - 46, h: 44, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: px + 26, y: sy + 22, text: '◰ "How the Sales pipeline links to People"', fontSize: 11, color: C.accent }).elements);
  els.push(text({ x: px + 26, y: sy + 40, text: '◰ "Deal ownership rules"        · clickable → opens the doc', fontSize: 11, color: C.accent }).elements);

  // footer note
  els.push(text({ x: 40, y: 654, text: 'Stacking sheets: each child / related entity pushes a new sheet (breadcrumb grows); Back pops it. This same panel is reused by the Docs tab (tag click).', fontSize: 13, color: C.muted, width: 1030 }).elements);

  return makeFile(els.flat());
}

// ---------- 06 — Docs wireframe ----------

function diagram06() {
  const els = [];
  els.push(text({ x: 40, y: 28, text: 'Tab — Docs (wireframe)', fontSize: 30 }).elements);
  els.push(text({ x: 40, y: 70, text: 'Long-form schema docs: Plate markdown + inline entity tags (@), a tags panel, external links, and saved mini React Flow diagrams.', fontSize: 15, color: C.muted, width: 1050 }).elements);

  // ---- Left: document list ----
  const lx = 40, ly = 116, lw = 260, lh = 522;
  els.push(rect({ x: lx, y: ly, w: lw, h: lh, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: lx + 14, y: ly + 12, text: 'Documents', fontSize: 15, color: C.ink }).elements);
  els.push(rect({ x: lx + lw - 92, y: ly + 8, w: 80, h: 26, fill: C.accent, stroke: C.accent, label: '+ New', labelColor: '#ffffff', fontSize: 12 }).elements);
  els.push(rect({ x: lx + 14, y: ly + 44, w: lw - 28, h: 30, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '⌕  Search documents…', labelColor: C.muted, fontSize: 11, align: 'left' }).elements);

  const docItem = (yy, title, tags, excerpt, sel) => {
    els.push(rect({ x: lx + 10, y: yy, w: lw - 20, h: 78, fill: sel ? C.accentSoft : C.card, stroke: sel ? C.accent : C.muted, strokeWidth: 1, label: '' }).elements);
    els.push(text({ x: lx + 22, y: yy + 8, text: title, fontSize: 13, color: sel ? C.accent : C.ink, width: lw - 90 }).elements);
    els.push(rect({ x: lx + lw - 64, y: yy + 8, w: 44, h: 18, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: tags, labelColor: C.muted, fontSize: 10 }).elements);
    els.push(text({ x: lx + 22, y: yy + 34, text: excerpt, fontSize: 11, color: C.muted, width: lw - 44 }).elements);
  };
  docItem(ly + 86, 'Sales pipeline ↔ People', '4 tags', 'How Deals link to People and\nhow ownership is assigned…', true);
  docItem(ly + 174, 'Ops sync architecture', '7 tags', 'The external sync into Ops and\nthe fields it overwrites…', false);
  docItem(ly + 262, 'Marketing attribution', '3 tags', 'Acquisition Channel rollups and\nwhere they feed…', false);

  // ---- Right: document view ----
  const dx = 320, dy = 116, dw = 750, dh = 522;
  els.push(rect({ x: dx, y: dy, w: dw, h: dh, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: dx + 16, y: dy + 14, text: 'Sales pipeline ↔ People', fontSize: 20, color: C.ink }).elements);
  els.push(text({ x: dx + 16, y: dy + 44, text: 'edited 2d ago', fontSize: 11, color: C.muted }).elements);

  // Editor area (Plate)
  const ex = dx + 16, ey = dy + 70, ew = 470, eh = 250;
  els.push(rect({ x: ex, y: ey, w: ew, h: eh, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: ex + 12, y: ey + 10, text: 'Plate markdown editor', fontSize: 11, color: C.muted }).elements);
  els.push(text({ x: ex + 12, y: ey + 32, text: 'Each deal in', fontSize: 12, color: C.ink }).elements);
  // inline tag chip
  els.push(rect({ x: ex + 110, y: ey + 30, w: 86, h: 20, fill: C.accentSoft, stroke: C.accent, strokeWidth: 1, label: '▤ Deals', labelColor: C.accent, fontSize: 11 }).elements);
  els.push(text({ x: ex + 204, y: ey + 32, text: 'is owned by a record in', fontSize: 12, color: C.ink }).elements);
  // second inline chip + typing @
  els.push(text({ x: ex + 12, y: ey + 60, text: 'People via the field', fontSize: 12, color: C.ink }).elements);
  els.push(text({ x: ex + 150, y: ey + 60, text: '@own', fontSize: 12, color: C.accent }).elements);

  // open @ dropdown (entity-search typeahead)
  const ddx = ex + 150, ddy = ey + 82, ddw = 240;
  els.push(rect({ x: ddx, y: ddy, w: ddw, h: 116, fill: C.card, stroke: C.accent, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: ddx + 10, y: ddy + 6, text: 'tag an entity…', fontSize: 10, color: C.muted }).elements);
  const ddRow = (yy, glyph, glyphColor, name, ctx) => {
    els.push(rect({ x: ddx + 10, y: yy, w: 20, h: 18, fill: C.cardAlt, stroke: glyphColor, strokeWidth: 1, label: glyph, labelColor: glyphColor, fontSize: 10 }).elements);
    els.push(text({ x: ddx + 38, y: yy + 1, text: name, fontSize: 11, color: C.ink }).elements);
    els.push(text({ x: ddx + 38, y: yy + 16, text: ctx, fontSize: 9, color: C.muted }).elements);
  };
  ddRow(ddy + 22, '⇄', C.teal, 'Owner', 'field · Sales ▸ Deals');
  ddRow(ddy + 56, '▤', C.accent, 'Owners', 'table · Ops');
  ddRow(ddy + 90, '▦', C.accent, 'Ownership', 'base');

  // Tags panel
  const gx = dx + 502, gy = dy + 70, gw = dw - 518;
  els.push(text({ x: gx, y: gy, text: 'Tags', fontSize: 12, color: C.muted }).elements);
  els.push(rect({ x: gx, y: gy + 18, w: gw, h: 96, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  const tagChip = (xx, yy, glyph, glyphColor, name) => {
    const w = 36 + name.length * 7;
    els.push(rect({ x: xx, y: yy, w, h: 22, fill: C.card, stroke: glyphColor, strokeWidth: 1, label: `${glyph} ${name}  ×`, labelColor: glyphColor, fontSize: 10 }).elements);
    return w;
  };
  tagChip(gx + 10, gy + 30, '▤', C.accent, 'Deals');
  tagChip(gx + 10, gy + 58, '▤', C.accent, 'People');
  tagChip(gx + 110, gy + 30, '⇄', C.teal, 'Owner');
  els.push(rect({ x: gx + 10, y: gy + 86, w: gw - 20, h: 20, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '+ add tag…', labelColor: C.muted, fontSize: 10 }).elements);

  // Links section
  const kx = dx + 502, ky = dy + 192, kw = dw - 518;
  els.push(text({ x: kx, y: ky, text: 'Links', fontSize: 12, color: C.muted }).elements);
  els.push(rect({ x: kx, y: ky + 18, w: kw, h: 70, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  els.push(text({ x: kx + 10, y: ky + 26, text: 'Pipeline runbook', fontSize: 11, color: C.ink }).elements);
  els.push(text({ x: kx + 10, y: ky + 40, text: 'notion.so/…', fontSize: 10, color: C.accent }).elements);
  els.push(text({ x: kx + 10, y: ky + 56, text: 'Owner SLA  ·  docs.co/sla', fontSize: 11, color: C.ink }).elements);

  // Diagrams section — saved mini React Flow diagram
  const mx = dx + 16, my = dy + 336, mw = dw - 32, mh = 150;
  els.push(text({ x: mx, y: my - 18, text: 'Diagrams · saved mini React Flow view (scoped)', fontSize: 12, color: C.muted }).elements);
  els.push(rect({ x: mx, y: my, w: mw, h: mh, fill: C.cardAlt, stroke: C.muted, strokeWidth: 1, label: '' }).elements);
  // two small nodes + an edge
  const nDeals = rect({ x: mx + 40, y: my + 40, w: 150, h: 56, fill: C.card, stroke: C.ink, strokeWidth: 1, label: '' });
  els.push(nDeals.elements);
  els.push(dot({ x: mx + 54, y: my + 54, color: C.warning, label: 'Deals', r: 10 }));
  els.push(text({ x: mx + 54, y: my + 74, text: 'Owner → People', fontSize: 10, color: C.muted }).elements);
  const nPeople = rect({ x: mx + 320, y: my + 40, w: 150, h: 56, fill: C.card, stroke: C.ink, strokeWidth: 1, label: '' });
  els.push(nPeople.elements);
  els.push(dot({ x: mx + 334, y: my + 54, color: C.success, label: 'People', r: 10 }));
  els.push(text({ x: mx + 334, y: my + 74, text: '6 fields', fontSize: 10, color: C.muted }).elements);
  els.push(arrow({ from: { bindId: nDeals.id, boxRect: { x: mx + 40, y: my + 40, w: 150, h: 56 }, side: 'right' }, to: { bindId: nPeople.id, boxRect: { x: mx + 320, y: my + 40, w: 150, h: 56 }, side: 'left' }, stroke: C.muted, label: 'linked' }).elements);
  els.push(rect({ x: mx + mw - 110, y: my + 12, w: 96, h: 24, fill: C.card, stroke: C.muted, strokeWidth: 1, label: '+ diagram', labelColor: C.muted, fontSize: 11 }).elements);

  // caption
  els.push(text({ x: 40, y: 654, text: 'Tag chips are clickable → open the shared entity detail panel (same one as Browse). Plate renders the chip as a custom inline node; the @ dropdown reuses the Browse entity-search typeahead.', fontSize: 13, color: C.muted, width: 1030 }).elements);

  return makeFile(els.flat());
}

// ---------- write ----------

const outputs = [
  ['01-page-anatomy.excalidraw', diagram01()],
  ['02-visualize-wireframe.excalidraw', diagram02()],
  ['03-changelog-wireframe.excalidraw', diagram03()],
  ['04-health-wireframe.excalidraw', diagram04()],
  ['05-browse-wireframe.excalidraw', diagram05()],
  ['06-docs-wireframe.excalidraw', diagram06()],
];

for (const [filename, contents] of outputs) {
  const path = join(__dirname, filename);
  writeFileSync(path, JSON.stringify(contents, null, 2));
  console.log(`wrote ${filename}`);
}
