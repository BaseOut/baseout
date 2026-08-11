// Generates .excalidraw files for the overview diagrams.
// Run with: node overview/generate.mjs
//
// We hand-author scenes via the helpers below (rect, text, arrow, etc.),
// then serialize to Excalidraw v2 JSON. Bindings between arrows and boxes
// are wired automatically so arrows snap to box edges in the Excalidraw app.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- helpers ----------

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

function ellipse({ x, y, w, h, fill = C.card, stroke = C.ink, label = null, labelColor = C.ink, fontSize = 18, fontFamily = 5 }) {
  const eid = id();
  const elements = [
    {
      ...baseProps(),
      id: eid,
      type: 'ellipse',
      x, y, width: w, height: h,
      strokeColor: stroke,
      backgroundColor: fill,
      boundElements: [],
      roundness: { type: 2 },
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

function diamond({ x, y, w, h, fill = C.card, stroke = C.ink, label = null, labelColor = C.ink, fontSize = 16, fontFamily = 5 }) {
  const did = id();
  const elements = [
    {
      ...baseProps(),
      id: did,
      type: 'diamond',
      x, y, width: w, height: h,
      strokeColor: stroke,
      backgroundColor: fill,
      boundElements: [],
      roundness: { type: 2 },
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
      text: label, fontSize, fontFamily,
      textAlign: 'center',
      verticalAlign: 'middle',
      baseline: Math.round(fontSize * 0.85),
      containerId: did,
      originalText: label,
      lineHeight: 1.25,
      autoResize: true,
      roundness: null,
    });
  }
  return { id: did, elements };
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
// Each side is { id, side: 'top'|'bottom'|'left'|'right', offsetPx? }.
function arrow({ from, to, dashed = false, label = null, stroke = C.ink, strokeWidth = 2 }) {
  // Compute start/end coords from bound containers' rectangles.
  // The caller passes raw {x,y} for unbound endpoints or {boundTo: ref} with explicit anchor.
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
  // spec = {x,y} OR {bindId, side: 'top'|'bottom'|'left'|'right', boxRect: {x,y,w,h}, offsetPct?}
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

function flatten(...groups) {
  return groups.flatMap((g) => g.elements ?? g);
}

// ---------- diagram 01 — what Baseout does (one-pager) ----------

function diagram01() {
  // Three columns: SOURCE (Airtable) → BASEOUT (engine + capabilities) → DESTINATIONS (storage / DB)
  const els = [];

  els.push(text({ x: 40, y: 30, text: 'What Baseout Does', fontSize: 32, fontFamily: 5 }).elements);
  els.push(text({ x: 40, y: 75, text: 'Backs up your Airtable data on a schedule, to where you want it, in the form you want it.', fontSize: 16, color: C.muted, width: 880 }).elements);

  // ---- Left column: source ----
  const sourceLabel = text({ x: 60, y: 140, text: 'Your Airtable workspace', fontSize: 14, color: C.muted });
  els.push(sourceLabel.elements);
  const airtable = rect({ x: 60, y: 170, w: 240, h: 280, fill: C.warningSoft, stroke: C.warning, label: 'Airtable\n\nBases · Tables ·\nFields · Records ·\nAttachments ·\nAutomations ·\nInterfaces', fontSize: 16 });
  els.push(airtable.elements);
  const airtableRect = { x: 60, y: 170, w: 240, h: 280 };

  // ---- Middle column: Baseout ----
  const baseoutLabel = text({ x: 420, y: 140, text: 'Baseout', fontSize: 14, color: C.muted });
  els.push(baseoutLabel.elements);

  const engine = rect({ x: 400, y: 170, w: 280, h: 100, fill: C.accentSoft, stroke: C.accent, label: 'Connection\n(OAuth to Airtable)', fontSize: 16 });
  els.push(engine.elements);
  const engineRect = { x: 400, y: 170, w: 280, h: 100 };

  const space = rect({ x: 400, y: 290, w: 280, h: 100, fill: C.accentSoft, stroke: C.accent, label: 'Space\n(your backup configuration)', fontSize: 16 });
  els.push(space.elements);
  const spaceRect = { x: 400, y: 290, w: 280, h: 100 };

  const engineCore = rect({ x: 400, y: 410, w: 280, h: 80, fill: C.accent, stroke: C.accent, label: 'Baseout backup engine', labelColor: '#ffffff', fontSize: 16 });
  els.push(engineCore.elements);
  const engineCoreRect = { x: 400, y: 410, w: 280, h: 80 };

  // ---- Right column: destinations ----
  const destLabel = text({ x: 780, y: 140, text: 'Your chosen destination', fontSize: 14, color: C.muted });
  els.push(destLabel.elements);

  const staticDest = rect({ x: 780, y: 170, w: 280, h: 140, fill: C.successSoft, stroke: C.success, label: 'Static backup\n→ Google Drive\n→ Dropbox · Box · OneDrive\n→ S3 · Baseout R2', fontSize: 15 });
  els.push(staticDest.elements);
  const staticRect = { x: 780, y: 170, w: 280, h: 140 };

  const dynamicDest = rect({ x: 780, y: 330, w: 280, h: 140, fill: C.purpleSoft, stroke: C.purple, label: 'Dynamic backup\n→ Postgres database\n→ Cloudflare D1 · Neon ·\n      Supabase · BYODB', fontSize: 15 });
  els.push(dynamicDest.elements);
  const dynamicRect = { x: 780, y: 330, w: 280, h: 140 };

  // ---- Arrows ----
  els.push(arrow({ from: { bindId: airtable.id, boxRect: airtableRect, side: 'right' }, to: { bindId: engine.id, boxRect: engineRect, side: 'left' }, label: 'read schema + data' }).elements);
  els.push(arrow({ from: { bindId: engine.id, boxRect: engineRect, side: 'bottom' }, to: { bindId: space.id, boxRect: spaceRect, side: 'top' } }).elements);
  els.push(arrow({ from: { bindId: space.id, boxRect: spaceRect, side: 'bottom' }, to: { bindId: engineCore.id, boxRect: engineCoreRect, side: 'top' } }).elements);
  els.push(arrow({ from: { bindId: engineCore.id, boxRect: engineCoreRect, side: 'right', offsetPct: 0.3 }, to: { bindId: staticDest.id, boxRect: staticRect, side: 'left' }, label: 'files' }).elements);
  els.push(arrow({ from: { bindId: engineCore.id, boxRect: engineCoreRect, side: 'right', offsetPct: 0.7 }, to: { bindId: dynamicDest.id, boxRect: dynamicRect, side: 'left' }, label: 'rows' }).elements);

  // ---- Footnotes ----
  els.push(text({ x: 60, y: 520, text: '1. Connect Airtable once at the Organization level.', fontSize: 14, color: C.ink }).elements);
  els.push(text({ x: 60, y: 545, text: '2. Create a Space — the unit of "this backup configuration." One Space per platform.', fontSize: 14, color: C.ink }).elements);
  els.push(text({ x: 60, y: 570, text: '3. Choose what to back up (bases), how often (schedule), and where it goes (static or dynamic).', fontSize: 14, color: C.ink }).elements);
  els.push(text({ x: 60, y: 595, text: '4. Each run captures schema, records, and attachments — see "What gets backed up" diagram for detail.', fontSize: 14, color: C.ink }).elements);

  return makeFile(els.flat());
}

// ---------- diagram 02 — hierarchy ----------

function diagram02() {
  const els = [];

  els.push(text({ x: 40, y: 30, text: 'Hierarchy — How things nest', fontSize: 32 }).elements);
  els.push(text({ x: 40, y: 75, text: 'Top to bottom: who pays → what they configure → what gets backed up.', fontSize: 16, color: C.muted, width: 880 }).elements);

  // ORG level
  const org = rect({ x: 380, y: 140, w: 360, h: 70, fill: C.accentSoft, stroke: C.accent, label: 'Organization\n(billing entity — one per company)', fontSize: 16 });
  els.push(org.elements);
  const orgRect = { x: 380, y: 140, w: 360, h: 70 };

  // Connection (sits beside Org, fed by Org but feeds multiple Spaces)
  const conn = rect({ x: 80, y: 240, w: 240, h: 70, fill: C.warningSoft, stroke: C.warning, label: 'Connection\n(OAuth to Airtable)', fontSize: 14 });
  els.push(conn.elements);
  const connRect = { x: 80, y: 240, w: 240, h: 70 };

  // SPACE level (two examples to show 1-to-many)
  const space1 = rect({ x: 400, y: 240, w: 240, h: 90, fill: C.accentSoft, stroke: C.accent, label: 'Space "Sales CRM"\n(Single-Platform: Airtable)\nschedule · storage · bases', fontSize: 13 });
  els.push(space1.elements);
  const space1Rect = { x: 400, y: 240, w: 240, h: 90 };

  const space2 = rect({ x: 700, y: 240, w: 240, h: 90, fill: C.accentSoft, stroke: C.accent, label: 'Space "Ops Wiki"\n(Single-Platform: Airtable)\nschedule · storage · bases', fontSize: 13 });
  els.push(space2.elements);
  const space2Rect = { x: 700, y: 240, w: 240, h: 90 };

  // Bases (under space1)
  const base1 = rect({ x: 320, y: 400, w: 140, h: 60, fill: C.warningSoft, stroke: C.warning, label: 'Base\n"Pipeline"', fontSize: 13 });
  els.push(base1.elements);
  const base1Rect = { x: 320, y: 400, w: 140, h: 60 };

  const base2 = rect({ x: 480, y: 400, w: 140, h: 60, fill: C.warningSoft, stroke: C.warning, label: 'Base\n"Customers"', fontSize: 13 });
  els.push(base2.elements);
  const base2Rect = { x: 480, y: 400, w: 140, h: 60 };

  const base3 = rect({ x: 740, y: 400, w: 140, h: 60, fill: C.warningSoft, stroke: C.warning, label: 'Base\n"Runbooks"', fontSize: 13 });
  els.push(base3.elements);
  const base3Rect = { x: 740, y: 400, w: 140, h: 60 };

  // Contents (under each base)
  const contents1 = rect({ x: 320, y: 510, w: 300, h: 90, fill: C.cardAlt, stroke: C.muted, label: 'Tables · Fields · Records ·\nViews · Attachments ·\nAutomations · Interfaces', fontSize: 13 });
  els.push(contents1.elements);
  const c1Rect = { x: 320, y: 510, w: 300, h: 90 };

  const contents2 = rect({ x: 740, y: 510, w: 140, h: 90, fill: C.cardAlt, stroke: C.muted, label: '... same ...', fontSize: 13 });
  els.push(contents2.elements);
  const c2Rect = { x: 740, y: 510, w: 140, h: 90 };

  // Arrows
  els.push(arrow({ from: { bindId: org.id, boxRect: orgRect, side: 'bottom', offsetPct: 0.2 }, to: { bindId: conn.id, boxRect: connRect, side: 'top' }, label: 'auths' }).elements);
  els.push(arrow({ from: { bindId: org.id, boxRect: orgRect, side: 'bottom', offsetPct: 0.4 }, to: { bindId: space1.id, boxRect: space1Rect, side: 'top' }, label: 'contains' }).elements);
  els.push(arrow({ from: { bindId: org.id, boxRect: orgRect, side: 'bottom', offsetPct: 0.8 }, to: { bindId: space2.id, boxRect: space2Rect, side: 'top' }, label: 'contains' }).elements);

  // Connection feeds both spaces
  els.push(arrow({ from: { bindId: conn.id, boxRect: connRect, side: 'right' }, to: { bindId: space1.id, boxRect: space1Rect, side: 'left' }, label: 'used by', dashed: true }).elements);
  els.push(arrow({ from: { bindId: conn.id, boxRect: connRect, side: 'right' }, to: { bindId: space2.id, boxRect: space2Rect, side: 'left', offsetPct: 0.3 }, dashed: true }).elements);

  // Spaces include bases
  els.push(arrow({ from: { bindId: space1.id, boxRect: space1Rect, side: 'bottom', offsetPct: 0.3 }, to: { bindId: base1.id, boxRect: base1Rect, side: 'top' } }).elements);
  els.push(arrow({ from: { bindId: space1.id, boxRect: space1Rect, side: 'bottom', offsetPct: 0.7 }, to: { bindId: base2.id, boxRect: base2Rect, side: 'top' } }).elements);
  els.push(arrow({ from: { bindId: space2.id, boxRect: space2Rect, side: 'bottom' }, to: { bindId: base3.id, boxRect: base3Rect, side: 'top' } }).elements);

  // Bases contain things
  els.push(arrow({ from: { bindId: base1.id, boxRect: base1Rect, side: 'bottom' }, to: { bindId: contents1.id, boxRect: c1Rect, side: 'top', offsetPct: 0.2 } }).elements);
  els.push(arrow({ from: { bindId: base2.id, boxRect: base2Rect, side: 'bottom' }, to: { bindId: contents1.id, boxRect: c1Rect, side: 'top', offsetPct: 0.8 } }).elements);
  els.push(arrow({ from: { bindId: base3.id, boxRect: base3Rect, side: 'bottom' }, to: { bindId: contents2.id, boxRect: c2Rect, side: 'top' } }).elements);

  // Side notes
  els.push(text({ x: 60, y: 660, text: 'Key rules', fontSize: 18, color: C.ink }).elements);
  els.push(text({ x: 60, y: 690, text: '• One Connection per Platform can serve many Spaces — you don\'t re-auth Airtable for each Space.', fontSize: 14, color: C.muted, width: 980 }).elements);
  els.push(text({ x: 60, y: 715, text: '• Each Space is bound to exactly one Platform (Airtable in V1; Notion / HubSpot / Salesforce later).', fontSize: 14, color: C.muted, width: 980 }).elements);
  els.push(text({ x: 60, y: 740, text: '• A Space\'s backup configuration is its own — pick bases, schedule, and destination independently.', fontSize: 14, color: C.muted, width: 980 }).elements);
  els.push(text({ x: 60, y: 765, text: '• Bases live in the Connection (Airtable owns them). The Space "selects" which bases to back up.', fontSize: 14, color: C.muted, width: 980 }).elements);

  return makeFile(els.flat());
}

// ---------- diagram 03 — backup configuration flow ----------

function diagram03() {
  const els = [];

  els.push(text({ x: 40, y: 30, text: 'Setting up a backup — step by step', fontSize: 32 }).elements);
  els.push(text({ x: 40, y: 75, text: 'The Integrations page walks the user through these in order, top to bottom.', fontSize: 16, color: C.muted, width: 980 }).elements);

  // 5 steps in a vertical column with descriptions on the right.
  const steps = [
    { n: 1, title: '1. Connect Airtable', body: 'OAuth dance. Once per Organization. Establishes the Connection that every Space in this Org can reuse.' },
    { n: 2, title: '2. Pick bases', body: 'Choose which of the discovered Airtable Bases this Space should back up. Tier-capped (e.g. 12 bases on Pro).' },
    { n: 3, title: '3. Choose a schedule', body: 'Weekly / Daily / Hourly / Instant (webhook-driven). Determined by tier.' },
    { n: 4, title: '4. Choose where backups go', body: 'Static (files to Google Drive / Dropbox / Box / OneDrive / S3 / Baseout R2) or Dynamic (rows into a Postgres DB).' },
    { n: 5, title: '5. Run the first backup', body: 'Click "Run backup now" to verify everything\'s wired up. Future runs happen automatically on the schedule.' },
  ];

  const startY = 140;
  const stepH = 90;
  const gap = 20;
  let prevId = null;
  let prevRect = null;

  steps.forEach((s, i) => {
    const y = startY + i * (stepH + gap);

    const stepBox = rect({ x: 80, y, w: 380, h: stepH, fill: C.accentSoft, stroke: C.accent, label: s.title, fontSize: 18 });
    els.push(stepBox.elements);
    const stepRect = { x: 80, y, w: 380, h: stepH };

    const descBox = rect({ x: 500, y, w: 540, h: stepH, fill: C.card, stroke: C.muted, strokeWidth: 1, label: s.body, fontSize: 14 });
    els.push(descBox.elements);

    if (prevId) {
      els.push(arrow({
        from: { bindId: prevId, boxRect: prevRect, side: 'bottom' },
        to: { bindId: stepBox.id, boxRect: stepRect, side: 'top' },
      }).elements);
    }
    prevId = stepBox.id;
    prevRect = stepRect;
  });

  // Footer
  const yFooter = startY + steps.length * (stepH + gap) + 20;
  els.push(text({ x: 60, y: yFooter, text: 'After step 5: backup runs land in the Backup History on /backups, with status, duration, counts, and full audit detail.', fontSize: 14, color: C.muted, width: 980 }).elements);

  return makeFile(els.flat());
}

// ---------- diagram 04 — static vs dynamic ----------

function diagram04() {
  const els = [];

  els.push(text({ x: 40, y: 30, text: 'Static vs. Dynamic backup', fontSize: 32 }).elements);
  els.push(text({ x: 40, y: 75, text: 'Two backup modes. Same source data, different output shape. Pick per Space.', fontSize: 16, color: C.muted, width: 980 }).elements);

  // Source on left
  const source = rect({ x: 60, y: 200, w: 220, h: 200, fill: C.warningSoft, stroke: C.warning, label: 'Airtable\n(bases · records ·\nattachments)', fontSize: 16 });
  els.push(source.elements);
  const sourceRect = { x: 60, y: 200, w: 220, h: 200 };

  // Engine in middle
  const engine = rect({ x: 360, y: 250, w: 200, h: 100, fill: C.accent, stroke: C.accent, label: 'Baseout engine', labelColor: '#ffffff', fontSize: 16 });
  els.push(engine.elements);
  const engineRect = { x: 360, y: 250, w: 200, h: 100 };

  // Two output paths
  // STATIC top
  const staticBox = rect({ x: 640, y: 140, w: 380, h: 200, fill: C.successSoft, stroke: C.success, label: 'Static backup\n\nOutput: files (CSV / JSON)\n  + attachment binaries\n\nDestination: a file-storage service\nyou own — Google Drive, Dropbox,\nBox, OneDrive, S3, or Baseout R2.', fontSize: 14 });
  els.push(staticBox.elements);
  const staticRect = { x: 640, y: 140, w: 380, h: 200 };

  // DYNAMIC bottom
  const dynamicBox = rect({ x: 640, y: 380, w: 380, h: 220, fill: C.purpleSoft, stroke: C.purple, label: 'Dynamic backup\n\nOutput: live rows in a relational DB\n\nDestination: a Postgres database —\nBaseout-hosted (D1 / Shared PG /\nDedicated PG) or your own (BYODB).\n\nUnlocks: SQL access, real-time sync,\nschema diffing in-database.', fontSize: 14 });
  els.push(dynamicBox.elements);
  const dynamicRect = { x: 640, y: 380, w: 380, h: 220 };

  // Arrows
  els.push(arrow({ from: { bindId: source.id, boxRect: sourceRect, side: 'right' }, to: { bindId: engine.id, boxRect: engineRect, side: 'left' }, label: 'pull' }).elements);
  els.push(arrow({ from: { bindId: engine.id, boxRect: engineRect, side: 'right', offsetPct: 0.3 }, to: { bindId: staticBox.id, boxRect: staticRect, side: 'left' }, label: 'static path' }).elements);
  els.push(arrow({ from: { bindId: engine.id, boxRect: engineRect, side: 'right', offsetPct: 0.7 }, to: { bindId: dynamicBox.id, boxRect: dynamicRect, side: 'left' }, label: 'dynamic path' }).elements);

  // Comparison table
  els.push(text({ x: 60, y: 650, text: 'When to pick which', fontSize: 20 }).elements);

  const colW = 320;
  const colH = 200;
  const colY = 690;

  // Static column
  const staticCol = rect({ x: 60, y: colY, w: colW, h: colH, fill: C.successSoft, stroke: C.success, label: 'Pick STATIC when:\n\n• You want backups in storage you\n  already own.\n• You don\'t need to query the data\n  outside Airtable.\n• You want the simplest possible\n  setup — works on every tier.', fontSize: 13 });
  els.push(staticCol.elements);

  // Dynamic column
  const dynamicCol = rect({ x: 420, y: colY, w: colW, h: colH, fill: C.purpleSoft, stroke: C.purple, label: 'Pick DYNAMIC when:\n\n• You want to query backups with SQL.\n• You want a "live mirror" of\n  Airtable kept in sync continuously.\n• You\'re on Pro+ and want the\n  Schema / Reports surfaces to show\n  data-level (not just schema) info.', fontSize: 13 });
  els.push(dynamicCol.elements);

  // Both column
  const bothCol = rect({ x: 780, y: colY, w: colW - 20, h: colH, fill: C.cardAlt, stroke: C.muted, label: 'You can do BOTH:\n\nA Space can be configured\nwith both a static destination\n(safety copy in Google Drive)\nand a dynamic destination\n(queryable mirror in Postgres)\nin parallel.', fontSize: 13 });
  els.push(bothCol.elements);

  return makeFile(els.flat());
}

// ---------- diagram 05 — what gets backed up ----------

function diagram05() {
  const els = [];

  els.push(text({ x: 40, y: 30, text: 'What gets backed up', fontSize: 32 }).elements);
  els.push(text({ x: 40, y: 75, text: 'A Backup Run captures three layers of an Airtable Base. You can opt in to each.', fontSize: 16, color: C.muted, width: 980 }).elements);

  // Airtable Base on left
  const base = rect({ x: 80, y: 160, w: 260, h: 460, fill: C.warningSoft, stroke: C.warning, label: 'Airtable Base', fontSize: 18 });
  els.push(base.elements);

  // Three layers visualized inside the base, as nested rectangles
  const schemaInner = rect({ x: 110, y: 220, w: 200, h: 90, fill: C.card, stroke: C.warning, label: 'Tables\nFields (names,\ntypes, options)\nViews\nRelationships', fontSize: 12 });
  els.push(schemaInner.elements);
  const dataInner = rect({ x: 110, y: 330, w: 200, h: 110, fill: C.card, stroke: C.warning, label: 'Records\n(every row, every\nfield value)\nLinked-record graph', fontSize: 12 });
  els.push(dataInner.elements);
  const attachInner = rect({ x: 110, y: 460, w: 200, h: 90, fill: C.card, stroke: C.warning, label: 'Attachment files\n(image, PDF, video,\nany blob)', fontSize: 12 });
  els.push(attachInner.elements);

  // Arrows out of each layer to "what we capture"
  const schemaOut = rect({ x: 480, y: 200, w: 320, h: 120, fill: C.tealSoft, stroke: C.teal, label: 'Schema backup\n\nThe shape of your data.\nLight, fast, runs even on free tier.\nAlways included.', fontSize: 14 });
  els.push(schemaOut.elements);
  const schemaOutRect = { x: 480, y: 200, w: 320, h: 120 };

  const dataOut = rect({ x: 480, y: 340, w: 320, h: 120, fill: C.tealSoft, stroke: C.teal, label: 'Data backup\n\nEvery row and field value.\nDefault on; opt-out per Space.\nThe main backup.', fontSize: 14 });
  els.push(dataOut.elements);
  const dataOutRect = { x: 480, y: 340, w: 320, h: 120 };

  const attachOut = rect({ x: 480, y: 480, w: 320, h: 120, fill: C.tealSoft, stroke: C.teal, label: 'Attachment backup\n\nFiles uploaded to attachment fields.\nOpt-in per Space.\nBilled separately on storage.', fontSize: 14 });
  els.push(attachOut.elements);
  const attachOutRect = { x: 480, y: 480, w: 320, h: 120 };

  els.push(arrow({ from: { x: 310, y: 265 }, to: { bindId: schemaOut.id, boxRect: schemaOutRect, side: 'left' } }).elements);
  els.push(arrow({ from: { x: 310, y: 385 }, to: { bindId: dataOut.id, boxRect: dataOutRect, side: 'left' } }).elements);
  els.push(arrow({ from: { x: 310, y: 505 }, to: { bindId: attachOut.id, boxRect: attachOutRect, side: 'left' } }).elements);

  // Right rail — also-captured metadata
  const meta = rect({ x: 860, y: 200, w: 200, h: 400, fill: C.cardAlt, stroke: C.muted, label: 'Also captured\nas metadata:\n\n• Automations\n  (read-only)\n\n• Interfaces\n  (read-only)\n\n• Comments\n\n• Created /\n  modified timestamps\n\n• User attribution', fontSize: 12 });
  els.push(meta.elements);

  // Footer
  els.push(text({ x: 60, y: 660, text: 'Important: Baseout does not run your Automations or render your Interfaces. We store them so they\'re part of the snapshot, but', fontSize: 14, color: C.muted, width: 980 }).elements);
  els.push(text({ x: 60, y: 685, text: 'restoring them requires writing them back into Airtable (V1 restore creates a NEW Base; Automations are configured fresh.)', fontSize: 14, color: C.muted, width: 980 }).elements);

  return makeFile(els.flat());
}

// ---------- write all files ----------

const outputs = [
  ['01-what-baseout-does.excalidraw', diagram01()],
  ['02-hierarchy.excalidraw', diagram02()],
  ['03-backup-config-flow.excalidraw', diagram03()],
  ['04-static-vs-dynamic.excalidraw', diagram04()],
  ['05-what-gets-backed-up.excalidraw', diagram05()],
];

for (const [filename, contents] of outputs) {
  const path = join(__dirname, filename);
  writeFileSync(path, JSON.stringify(contents, null, 2));
  console.log(`wrote ${filename}`);
}
